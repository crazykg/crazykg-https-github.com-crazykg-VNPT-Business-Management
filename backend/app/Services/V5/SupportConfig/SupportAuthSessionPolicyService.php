<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportAuthSessionPolicyService
{
    private const PROVIDER = 'AUTH_SESSION_POLICY';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    public function authSessionPolicy(): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return $this->support->missingTable('integration_settings');
        }

        return response()->json([
            'data' => $this->serializePolicyRecord($this->loadPolicyRecord()),
        ]);
    }

    public function updateAuthSessionPolicy(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return $this->support->missingTable('integration_settings');
        }

        $validated = $request->validate([
            'same_browser_multi_tab_enabled' => ['required', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }

        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json([
                'message' => 'updated_by is invalid.',
            ], 422);
        }

        $existing = $this->loadPolicyRecord();
        $now = now();

        $payload = [
            'provider' => self::PROVIDER,
            'is_enabled' => (bool) $validated['same_browser_multi_tab_enabled'],
            'updated_at' => $now,
            'updated_by' => $updatedById,
        ];

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('integration_settings', $payload);

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::PROVIDER],
            $payload
        );

        return response()->json([
            'data' => $this->serializePolicyRecord($this->loadPolicyRecord()),
        ]);
    }

    private function loadPolicyRecord(): ?object
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $query = DB::table('integration_settings')
            ->select([
                'integration_settings.provider',
                'integration_settings.is_enabled',
                DB::raw('integration_settings.created_at as created_at'),
                DB::raw('integration_settings.created_by as created_by'),
                DB::raw('integration_settings.updated_at as updated_at'),
                DB::raw('integration_settings.updated_by as updated_by'),
            ]);

        if ($this->support->hasTable('internal_users')) {
            $query
                ->leftJoin('internal_users as updater', 'updater.id', '=', 'integration_settings.updated_by')
                ->addSelect(DB::raw('COALESCE(updater.full_name, updater.username) as updated_by_name'));
        } else {
            $query->addSelect(DB::raw('NULL as updated_by_name'));
        }

        return $query
            ->where('integration_settings.provider', self::PROVIDER)
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePolicyRecord(?object $record): array
    {
        return [
            'provider' => self::PROVIDER,
            'same_browser_multi_tab_enabled' => $record === null
                ? true
                : (bool) ($record->is_enabled ?? true),
            'updated_at' => $record?->updated_at,
            'updated_by' => isset($record?->updated_by) ? (int) $record->updated_by : null,
            'updated_by_name' => $this->support->normalizeNullableString($record?->updated_by_name ?? null),
            'source' => $record === null ? 'DEFAULT' : 'DB',
        ];
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table)) {
            return false;
        }

        return DB::table($table)->where('id', $id)->exists();
    }
}
