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
        $abilities = in_array('*', $permissions, true) ? ['*'] : $permissions;
        if ($abilities === []) {
            $abilities = ['dashboard.view'];
        }

        $expiresAt = now()->addMinutes(max(1, (int) config('sanctum.expiration', 480)));
        $token = $user->createToken('vnpt_business_web', $abilities, $expiresAt)->plainTextToken;

        $this->recordLoginAttempt($request, $loginInput, $user, 'SUCCESS');

        $response = response()->json([
            'data' => [
                'user' => $this->serializeUser($user),
            ],
        ]);

        $response->withCookie($this->makeAuthCookie($token, $request));

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
        ]);
    }

    public function bootstrap(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $userId = (int) $user->id;
        $permissions = $this->accessService->permissionKeysForUser($userId);

        return response()->json([
            'data' => [
                'user' => $this->serializeUser($user),
                'permissions' => $permissions,
                'counters' => $this->resolveBootstrapCounters(),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user !== null) {
            $token = $user->currentAccessToken();
            if ($token !== null) {
                $token->delete();
            }
        }

        $response = response()->json([
            'message' => 'Đăng xuất thành công.',
        ]);

        $response->withCookie($this->forgetAuthCookie($request));

        return $response;
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
            'support_requests' => $this->safeTableCount('support_requests'),
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

    private function authCookieName(): string
    {
        return (string) config('vnpt_auth.cookie_name', 'vnpt_business_auth_token');
    }

    private function makeAuthCookie(string $token, Request $request): HttpCookie
    {
        $minutes = max(1, (int) config('vnpt_auth.cookie_minutes', 480));
        $path = (string) config('vnpt_auth.cookie_path', '/');
        $domain = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));
        $secure = $this->resolveCookieSecure($request);

        return cookie(
            $this->authCookieName(),
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

    private function forgetAuthCookie(Request $request): HttpCookie
    {
        $path = (string) config('vnpt_auth.cookie_path', '/');
        $domain = $this->normalizeCookieDomain(config('vnpt_auth.cookie_domain'));
        $secure = $this->resolveCookieSecure($request);
        $sameSite = $this->normalizeSameSite((string) config('vnpt_auth.cookie_same_site', 'lax'));

        return cookie(
            $this->authCookieName(),
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
