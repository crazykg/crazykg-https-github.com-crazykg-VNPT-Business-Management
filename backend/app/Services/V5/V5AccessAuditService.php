<?php

namespace App\Services\V5;

use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class V5AccessAuditService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccessService
    ) {}

    public function resolveAuthenticatedUserId(Request $request): ?int
    {
        return $this->support->parseNullableInt($request->user()?->id ?? null);
    }

    public function authorizeMutationByScope(Request $request, string $resource, ?int $departmentId, ?int $ownerId = null): ?JsonResponse
    {
        $userId = $this->resolveAuthenticatedUserId($request);
        if ($userId === null) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        if ($this->userAccessService->isAdmin($userId)) {
            return null;
        }

        if ($departmentId !== null) {
            $allowedDepartmentIds = $this->userAccessService->resolveDepartmentIdsForUser($userId);
            if ($allowedDepartmentIds === null || in_array($departmentId, $allowedDepartmentIds, true)) {
                return null;
            }

            return $this->denyScopeMutation($resource);
        }

        if ($ownerId !== null && $ownerId === $userId) {
            return null;
        }

        return $this->denyScopeMutation($resource);
    }

    public function assertModelMutationAccess(Request $request, Model $model, string $resource): ?JsonResponse
    {
        $table = (string) $model->getTable();
        $record = $model->getAttributes();

        $departmentId = $this->support->resolveDepartmentIdForTableRecord($table, $record);
        $ownerId = $this->support->extractIntFromRecord($record, ['created_by', 'owner_id', 'updated_by']);

        return $this->authorizeMutationByScope($request, $resource, $departmentId, $ownerId);
    }

    /**
     * @return array<string, mixed>
     */
    public function toAuditArray(mixed $value): array
    {
        if ($value instanceof Model) {
            return $value->getAttributes();
        }

        if (is_object($value)) {
            return (array) $value;
        }

        if (is_array($value)) {
            return $value;
        }

        return [];
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    public function recordAuditEvent(
        Request $request,
        string $event,
        string $auditableType,
        int|string|null $auditableId,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        if (! $this->support->hasTable('audit_logs')) {
            return;
        }

        $eventCode = strtoupper(trim($event));
        if (! in_array($eventCode, ['INSERT', 'UPDATE', 'DELETE', 'RESTORE'], true)) {
            return;
        }

        $auditableIdValue = $this->support->parseNullableInt($auditableId);
        if ($auditableIdValue === null) {
            return;
        }

        try {
            $payload = [
                'uuid' => (string) Str::uuid(),
                'event' => $eventCode,
                'auditable_type' => $auditableType,
                'auditable_id' => $auditableIdValue,
                'old_values' => $this->encodeAuditValues($oldValues),
                'new_values' => $this->encodeAuditValues($newValues),
                'url' => $request->fullUrl(),
                'ip_address' => $request->ip(),
                'user_agent' => $this->support->normalizeNullableString($request->userAgent()),
                'created_at' => now(),
                'created_by' => $this->resolveAuthenticatedUserId($request),
            ];

            $insertPayload = $this->support->filterPayloadByTableColumns('audit_logs', $payload);
            if ($insertPayload === []) {
                return;
            }

            DB::table('audit_logs')->insert($insertPayload);
        } catch (\Throwable) {
            // Không để lỗi audit làm gián đoạn luồng nghiệp vụ.
        }
    }

    public function deleteModel(Request $request, Model $model, string $resource): JsonResponse
    {
        $scopeError = $this->assertModelMutationAccess($request, $model, $resource);
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $before = $this->toAuditArray($model);
        $table = (string) $model->getTable();
        $auditableId = $model->getKey();

        try {
            $model->delete();
            $this->recordAuditEvent($request, 'DELETE', $table, $auditableId, $before, null);

            return response()->json(['message' => "{$resource} deleted."]);
        } catch (QueryException) {
            return response()->json([
                'message' => "{$resource} is referenced by other records and cannot be deleted.",
            ], 422);
        }
    }

    private function denyScopeMutation(string $resource): JsonResponse
    {
        return response()->json([
            'message' => "Bạn không có quyền truy cập {$resource} này.",
        ], 403);
    }

    private function normalizeAuditValue(mixed $value, int $depth = 0): mixed
    {
        if ($depth > 4) {
            return '[max-depth]';
        }

        if ($value === null || is_scalar($value)) {
            return $value;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if (is_array($value)) {
            $normalized = [];
            foreach ($value as $key => $item) {
                $normalized[(string) $key] = $this->normalizeAuditValue($item, $depth + 1);
            }

            return $normalized;
        }

        if (is_object($value)) {
            if (method_exists($value, 'toArray')) {
                return $this->normalizeAuditValue($value->toArray(), $depth + 1);
            }
            if (method_exists($value, '__toString')) {
                return (string) $value;
            }

            return $this->normalizeAuditValue((array) $value, $depth + 1);
        }

        return (string) $value;
    }

    /**
     * @param array<string, mixed>|null $values
     */
    private function encodeAuditValues(?array $values): ?string
    {
        if ($values === null || $values === []) {
            return null;
        }

        $encoded = json_encode(
            $this->normalizeAuditValue($values),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        return is_string($encoded) ? $encoded : null;
    }
}
