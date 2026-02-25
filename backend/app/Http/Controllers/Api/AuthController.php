<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InternalUser;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

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
            return response()->json([
                'message' => 'Tên đăng nhập hoặc mật khẩu không đúng.',
            ], 422);
        }

        if ($this->hasColumn('internal_users', 'status')) {
            $normalizedStatus = strtoupper(trim((string) $user->status));
            if ($normalizedStatus !== 'ACTIVE') {
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

        $token = $user->createToken('vnpt_business_web', $abilities)->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
                'user' => $this->serializeUser($user),
            ],
        ]);
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

    public function logout(Request $request): JsonResponse
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $token = $user->currentAccessToken();
        if ($token !== null) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Đăng xuất thành công.',
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
}

