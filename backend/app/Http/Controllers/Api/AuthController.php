<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InternalUser;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Cookie as HttpCookie;

class AuthController extends Controller
{
    public function __construct(
        private readonly UserAccessService $accessService
    ) {
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $loginInput = trim((string) $validated['username']);
        $passwordInput = (string) $validated['password'];

        $user = InternalUser::query()
            ->where('username', $loginInput)
            ->orWhere('email', $loginInput)
            ->first();

        if ($user === null || ! Hash::check($passwordInput, (string) $user->password)) {
            $this->recordLoginAttempt($request, $loginInput, $user, 'FAILED', 'INVALID_CREDENTIALS');

            return response()->json([
                'message' => 'Tên đăng nhập hoặc mật khẩu không đúng.',
            ], 422);
        }

        if ($this->hasColumn('internal_users', 'status')) {
            $normalizedStatus = strtoupper(trim((string) $user->status));
            if ($normalizedStatus !== 'ACTIVE') {
                $this->recordLoginAttempt($request, $loginInput, $user, 'FAILED', 'ACCOUNT_INACTIVE');

                return response()->json([
                    'message' => 'Tài khoản đã bị khóa hoặc tạm ngưng.',
                ], 403);
            }
        }

        $permissions = $this->accessService->permissionKeysForUser((int) $user->id);
        [$accessToken, $refreshToken, $tabToken] = $this->issueSessionTokens($user, $permissions);

        $this->recordLoginAttempt($request, $loginInput, $user, 'SUCCESS');

        $response = response()->json([
            'data' => [
                'user' => $this->serializeUser($user),
                'password_change_required' => $this->isPasswordChangeRequired($user),
            ],
        ]);

        $response->withCookie($this->makeAccessCookie($accessToken, $request));
        $response->withCookie($this->makeRefreshCookie($refreshToken, $request));
        $response->withCookie($this->makeTabTokenCookie($tabToken, $request));

        return $response;
    }

    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = $this->readTokenFromCookie($request, $this->refreshCookieName());
        if ($refreshToken === null) {
            return $this->unauthenticatedRefreshResponse($request);
        }

        $tokenModel = PersonalAccessToken::findToken($refreshToken);
        if (! $tokenModel instanceof PersonalAccessToken) {
            return $this->unauthenticatedRefreshResponse($request);
        }

        if (! $tokenModel->can('auth.refresh')) {
            $tokenModel->delete();

            return $this->unauthenticatedRefreshResponse($request);
        }

        if ($tokenModel->expires_at !== null && $tokenModel->expires_at->isPast()) {
            $tokenModel->delete();

            return $this->unauthenticatedRefreshResponse($request);
        }

        $tokenable = $tokenModel->tokenable;
        if (! $tokenable instanceof InternalUser) {
            $tokenModel->delete();

            return $this->unauthenticatedRefreshResponse($request);
        }

        if ($this->hasColumn('internal_users', 'status')) {
            $normalizedStatus = strtoupper(trim((string) $tokenable->status));
            if ($normalizedStatus !== 'ACTIVE') {
                $this->revokeAllUserTokens($tokenable);

                return $this->unauthenticatedRefreshResponse($request);
            }
        }

        $permissions = $this->accessService->permissionKeysForUser((int) $tokenable->id);
        [$accessToken, $newRefreshToken, $tabToken] = $this->issueSessionTokens($tokenable, $permissions);

        $response = response()->json([
            'data' => [
                'user' => $this->serializeUser($tokenable->fresh() ?? $tokenable),
                'password_change_required' => $this->isPasswordChangeRequired($tokenable),
            ],
        ]);

        $response->withCookie($this->makeAccessCookie($accessToken, $request));
        $response->withCookie($this->makeRefreshCookie($newRefreshToken, $request));
        $response->withCookie($this->makeTabTokenCookie($tabToken, $request));

        return $response;
    }

    public function me(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'data' => $this->serializeUser($user),
            'password_change_required' => $this->isPasswordChangeRequired($user),
        ]);
    }

    public function bootstrap(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $userId     = (int) $user->id;
        $permissions = $this->accessService->permissionKeysForUser($userId);

        // ★ Claim tab token ngay trong bootstrap — loại bỏ race condition TAB_EVICTED
        // Tab mới (hoặc reload) sẽ có active_tab_token hợp lệ trước khi bất kỳ
        // request nào khác được gửi đi từ frontend.
        $tabToken = $this->generateTabToken($user);

        $response = response()->json([
            'data' => [
                'user'        => $this->serializeUser($user),
                'permissions' => $permissions,
                'counters'    => $this->resolveBootstrapCounters(),
            ],
        ]);

        // Gắn cookie tab_token mới (cùng logic với tabClaim / login)
        if ($tabToken !== '') {
            $response->withCookie($this->makeTabTokenCookie($tabToken, $request));
        }

        return $response;
    }

    /**
     * Tab claim: Tab mới claim quyền active mà không cần login lại.
     * Sinh tab_token mới → lưu DB → trả về cookie → tab cũ bị evict.
     */
    public function tabClaim(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $tabToken = $this->generateTabToken($user);

        $response = response()->json([
            'data' => ['claimed' => true],
        ]);

        $response->withCookie($this->makeTabTokenCookie($tabToken, $request));

        return $response;
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user !== null) {
            $this->revokeAllUserTokens($user);
            // Xóa tab token trong DB khi logout
            if ($this->hasColumn('internal_users', 'active_tab_token')) {
                $user->forceFill(['active_tab_token' => null, 'tab_token_set_at' => null])->save();
            }
        }

        $refreshToken = $this->readTokenFromCookie($request, $this->refreshCookieName());
        if ($refreshToken !== null) {
            $refreshTokenModel = PersonalAccessToken::findToken($refreshToken);
            if ($refreshTokenModel instanceof PersonalAccessToken) {
                $refreshTokenModel->delete();
            }
        }

        $response = response()->json([
            'message' => 'Đăng xuất thành công.',
        ]);

        $response->withCookie($this->forgetAccessCookie($request));
        $response->withCookie($this->forgetRefreshCookie($request));
        $response->withCookie($this->forgetTabTokenCookie($request));

        return $response;
    }

    public function changePassword(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'current_password' => ['required', 'string', 'max:255'],
            'new_password' => [
                'required',
                'string',
                'max:255',
                'confirmed',
                PasswordRule::min(12)->mixedCase()->numbers()->symbols(),
            ],
        ]);

        if (! Hash::check((string) $validated['current_password'], (string) $user->password)) {
            return response()->json([
                'message' => 'Mật khẩu hiện tại không đúng.',
                'errors' => [
                    'current_password' => ['Mật khẩu hiện tại không đúng.'],
                ],
            ], 422);
        }

        $updates = [
            'password' => Hash::make((string) $validated['new_password']),
        ];

        if ($this->hasColumn('internal_users', 'must_change_password')) {
            $updates['must_change_password'] = 0;
        }
        if ($this->hasColumn('internal_users', 'password_changed_at')) {
            $updates['password_changed_at'] = now();
        }
        if ($this->hasColumn('internal_users', 'password_reset_required_at')) {
            $updates['password_reset_required_at'] = null;
        }

        $user->forceFill($updates);
        $user->save();

        return response()->json([
            'message' => 'Đổi mật khẩu thành công.',
            'data' => [
                'user' => $this->serializeUser($user->fresh() ?? $user),
                'password_change_required' => false,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(InternalUser $user): array
    {
        $userId = (int) $user->id;

        return [
            'id' => $userId,
            'uuid' => $user->uuid,
            'user_code' => $user->user_code,
            'username' => $user->username,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'status' => $user->status,
            'department_id' => $user->department_id,
            'position_id' => $user->position_id,
            'roles' => $this->accessService->roleCodesForUser($userId),
            'permissions' => $this->accessService->permissionKeysForUser($userId),
            'dept_scopes' => $this->accessService->departmentScopesForUser($userId),
        ];
    }

    private function hasColumn(string $table, string $column): bool
    {
        try {
            return Schema::hasTable($table) && Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return array<string, int>
     */
    private function resolveBootstrapCounters(): array
    {
        return [
            'departments' => $this->safeTableCount('departments'),
            'internal_users' => $this->safeTableCount('internal_users'),
            'customers' => $this->safeTableCount('customers'),
            'projects' => $this->safeTableCount('projects'),
            'contracts' => $this->safeTableCount('contracts'),
        ];
    }

    private function safeTableCount(string $table): int
    {
        try {
            if (! Schema::hasTable($table)) {
                return 0;
            }

            return (int) DB::table($table)->count();
        } catch (\Throwable) {
            return 0;
        }
    }

    private function recordLoginAttempt(
        Request $request,
        string $username,
        ?InternalUser $user,
        string $status,
        ?string $reason = null
    ): void {
        try {
            if (! Schema::hasTable('auth_login_attempts')) {
                return;
            }

            DB::table('auth_login_attempts')->insert([
                'username' => mb_substr($username, 0, 100),
                'internal_user_id' => $user ? (int) $user->id : null,
                'status' => strtoupper(trim($status)) === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
                'reason' => $reason,
                'ip_address' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable) {
            // Ignore logging errors to avoid breaking auth flow.
        }
    }

    private function accessCookieName(): string
    {
        return (string) config('vnpt_auth.access_cookie_name', config('vnpt_auth.cookie_name', 'vnpt_business_auth_token'));
    }

    private function refreshCookieName(): string
    {
        return (string) config('vnpt_auth.refresh_cookie_name', 'vnpt_business_refresh_token');
    }

    private function isPasswordChangeRequired(InternalUser $user): bool
    {
        if (! $this->hasColumn('internal_users', 'must_change_password')) {
            return false;
        }

        return (int) ($user->must_change_password ?? 0) === 1;
    }

    private function makeAccessCookie(string $token, Request $request): HttpCookie
    {
        $minutes = max(1, (int) config('vnpt_auth.access_cookie_minutes', config('vnpt_auth.cookie_minutes', 60)));
        $path = (string) config('vnpt_auth.cookie_path', '/');
        $domain = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));
        $secure = $this->resolveCookieSecure($request);

        return cookie(
            $this->accessCookieName(),
            $token,
            $minutes,
            $path,
            $domain,
            $secure,
            true,
            false,
            $sameSite
        );
    }

    private function makeRefreshCookie(string $token, Request $request): HttpCookie
    {
        $minutes  = max(1, (int) config('vnpt_auth.refresh_cookie_minutes', 10080));
        $path     = (string) config('vnpt_auth.cookie_path', '/');
        $domain   = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));
        $secure   = $this->resolveCookieSecure($request);

        return cookie(
            $this->refreshCookieName(),
            $token,
            $minutes,
            $path,
            $domain,
            $secure,
            true,
            false,
            $sameSite
        );
    }

    private function makeTabTokenCookie(string $token, Request $request): HttpCookie
    {
        // Tab token có cùng lifetime với access token
        $minutes  = max(1, (int) config('vnpt_auth.access_cookie_minutes', config('vnpt_auth.cookie_minutes', 60)));
        $path     = (string) config('vnpt_auth.cookie_path', '/');
        $domain   = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));
        $secure   = $this->resolveCookieSecure($request);

        return cookie(
            'vnpt_tab_token',
            $token,
            $minutes,
            $path,
            $domain,
            $secure,
            true,   // httpOnly
            false,
            $sameSite
        );
    }

    private function forgetTabTokenCookie(Request $request): HttpCookie
    {
        $path     = (string) config('vnpt_auth.cookie_path', '/');
        $domain   = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $secure   = $this->resolveCookieSecure($request);
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));

        return cookie('vnpt_tab_token', '', -2628000, $path, $domain, $secure, true, false, $sameSite);
    }

    private function forgetAccessCookie(Request $request): HttpCookie
    {
        $path     = (string) config('vnpt_auth.cookie_path', '/');
        $domain   = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $secure   = $this->resolveCookieSecure($request);
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));

        return cookie(
            $this->accessCookieName(),
            '',
            -2628000,
            $path,
            $domain,
            $secure,
            true,
            false,
            $sameSite
        );
    }

    private function forgetRefreshCookie(Request $request): HttpCookie
    {
        $path = (string) config('vnpt_auth.cookie_path', '/');
        $domain = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $secure = $this->resolveCookieSecure($request);
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));

        return cookie(
            $this->refreshCookieName(),
            '',
            -2628000,
            $path,
            $domain,
            $secure,
            true,
            false,
            $sameSite
        );
    }

    /**
     * @param array<int, string> $permissions
     * @return array{0:string,1:string,2:string}
     */
    private function issueSessionTokens(InternalUser $user, array $permissions): array
    {
        $this->revokeAllUserTokens($user);

        $accessAbilities = in_array('*', $permissions, true)
            ? ['*']
            : array_values(array_unique(array_merge($permissions, ['api.access'])));
        if ($accessAbilities === []) {
            $accessAbilities = ['dashboard.view', 'api.access'];
        }

        $accessExpiresAt  = now()->addMinutes(max(1, (int) config('sanctum.expiration', 60)));
        $refreshExpiresAt = now()->addMinutes(max(1, (int) config('vnpt_auth.refresh_cookie_minutes', 10080)));

        $accessToken  = $user->createToken('vnpt_business_access', $accessAbilities, $accessExpiresAt)->plainTextToken;
        $refreshToken = $user->createToken('vnpt_business_refresh', ['auth.refresh'], $refreshExpiresAt)->plainTextToken;

        // ★ Sinh tab_token → ghi DB ngay tại đây (login / refresh đều qua đây)
        $tabToken = $this->generateTabToken($user);

        return [$accessToken, $refreshToken, $tabToken];
    }

    /**
     * Sinh tab_token ngẫu nhiên 64 hex chars, lưu vào DB, trả về plain value.
     */
    private function generateTabToken(InternalUser $user): string
    {
        if (! $this->hasColumn('internal_users', 'active_tab_token')) {
            // Feature chưa được bật (migration chưa chạy) — trả về placeholder
            return '';
        }

        $tabToken = bin2hex(random_bytes(32)); // 64 chars

        $user->forceFill([
            'active_tab_token' => $tabToken,
            'tab_token_set_at' => now(),
        ])->save();

        return $tabToken;
    }

    private function revokeAllUserTokens(InternalUser $user): void
    {
        $user->tokens()->delete();
    }

    private function readTokenFromCookie(Request $request, string $cookieName): ?string
    {
        $raw = $request->cookie($cookieName);
        if (! is_string($raw)) {
            return null;
        }

        $decoded = trim(urldecode($raw));
        if ($decoded === '') {
            return null;
        }

        return $decoded;
    }

    private function unauthenticatedRefreshResponse(Request $request): JsonResponse
    {
        $response = response()->json([
            'message' => 'Unauthenticated.',
        ], 401);

        $response->withCookie($this->forgetAccessCookie($request));
        $response->withCookie($this->forgetRefreshCookie($request));

        return $response;
    }

    private function normalizeCookieDomain(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' && strtolower($trimmed) !== 'null'
            ? $trimmed
            : null;
    }

    private function normalizeSameSite(string $sameSite): string
    {
        $normalized = strtolower(trim($sameSite));
        if (! in_array($normalized, ['lax', 'strict', 'none'], true)) {
            return 'lax';
        }

        return $normalized;
    }

    private function resolveCookieSecure(Request $request): bool
    {
        $configured = config('vnpt_auth.cookie_secure');
        if ($configured === null || $configured === '') {
            return $request->isSecure();
        }

        return filter_var($configured, FILTER_VALIDATE_BOOL);
    }
}
