<?php

namespace App\Services\V5\Support;

use App\Shared\Services\StatusMappingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LifecycleSupport
{
    private const DEFAULT_OPPORTUNITY_STAGE_DEFINITIONS = [
        [
            'stage_code' => 'NEW',
            'stage_name' => 'Mới',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 10,
        ],
        [
            'stage_code' => 'PROPOSAL',
            'stage_name' => 'Đề xuất',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 20,
        ],
        [
            'stage_code' => 'NEGOTIATION',
            'stage_name' => 'Đàm phán',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 30,
        ],
        [
            'stage_code' => 'WON',
            'stage_name' => 'Thắng',
            'description' => null,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 40,
        ],
        [
            'stage_code' => 'LOST',
            'stage_name' => 'Thất bại',
            'description' => null,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 50,
        ],
    ];

    public function __construct(
        private readonly SchemaCapabilityService $schema,
        private readonly StatusMappingService $statusMapping,
    ) {}

    public function isProjectDateRangeInvalid(?string $startDate, ?string $endDate): bool
    {
        if ($startDate === null || trim($startDate) === '' || $endDate === null || trim($endDate) === '') {
            return false;
        }

        $startTimestamp = strtotime($startDate);
        $endTimestamp = strtotime($endDate);

        if ($startTimestamp === false || $endTimestamp === false) {
            return false;
        }

        return $startTimestamp > $endTimestamp;
    }

    public function normalizePaymentCycle(string $cycle): string
    {
        return $this->statusMapping->normalizePaymentCycle($cycle);
    }

    public function toProjectStorageStatus(string $status): string
    {
        return $this->statusMapping->toProjectStorageStatus($status, $this->usesLegacyProjectSchema());
    }

    public function fromProjectStorageStatus(string $status): string
    {
        return $this->statusMapping->fromProjectStorageStatus($status);
    }

    public function toContractStorageStatus(string $status): string
    {
        return $this->statusMapping->toContractStorageStatus($status, $this->usesLegacyContractSchema());
    }

    public function fromContractStorageStatus(string $status): string
    {
        return $this->statusMapping->fromContractStorageStatus($status);
    }

    public function toOpportunityStorageStage(string $stage): string
    {
        return $this->statusMapping->toOpportunityStorageStage($stage, $this->usesLegacyOpportunitySchema());
    }

    public function fromOpportunityStorageStage(string $stage): string
    {
        return $this->statusMapping->fromOpportunityStorageStage($stage);
    }

    public function sanitizeOpportunityStageCode(string $stageCode): string
    {
        return $this->statusMapping->sanitizeOpportunityStageCode($stageCode);
    }

    public function normalizeOpportunityStage(string $stage, bool $includeInactive = false): ?string
    {
        $lookup = $this->opportunityStageLookup($includeInactive);
        if ($lookup === []) {
            return null;
        }

        $normalized = $this->canonicalOpportunityStageCode($stage);
        if ($normalized !== '' && isset($lookup[$normalized])) {
            return $lookup[$normalized];
        }

        $token = $this->normalizeOpportunityStageLookupToken($stage);
        if ($token !== '' && isset($lookup[$token])) {
            return $lookup[$token];
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function opportunityStageDefinitions(bool $includeInactive = false): array
    {
        if (
            $this->schema->hasTable('opportunity_stages')
            && $this->schema->hasColumn('opportunity_stages', 'stage_code')
            && $this->schema->hasColumn('opportunity_stages', 'stage_name')
        ) {
            $query = DB::table('opportunity_stages')
                ->select($this->schema->selectColumns('opportunity_stages', [
                    'id',
                    'stage_code',
                    'stage_name',
                    'description',
                    'is_terminal',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->schema->hasColumn('opportunity_stages', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->schema->hasColumn('opportunity_stages', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->schema->hasColumn('opportunity_stages', 'stage_name')) {
                $query->orderBy('stage_name');
            } elseif ($this->schema->hasColumn('opportunity_stages', 'stage_code')) {
                $query->orderBy('stage_code');
            }
            if ($this->schema->hasColumn('opportunity_stages', 'id')) {
                $query->orderBy('id');
            }

            $rows = $query->get()->map(function (object $item): array {
                return $this->serializeOpportunityStageRecord((array) $item);
            })->filter(fn (array $record): bool => ((string) ($record['stage_code'] ?? '')) !== '')
                ->values()
                ->all();

            if ($rows !== []) {
                return $rows;
            }
        }

        $definitions = array_map(
            fn (array $definition): array => $this->serializeOpportunityStageRecord($definition),
            self::DEFAULT_OPPORTUNITY_STAGE_DEFINITIONS
        );

        if (! $includeInactive) {
            $definitions = array_values(array_filter(
                $definitions,
                fn (array $definition): bool => (bool) ($definition['is_active'] ?? true)
            ));
        }

        return $definitions;
    }

    /**
     * @return array<string, string>
     */
    private function opportunityStageLookup(bool $includeInactive = false): array
    {
        $lookup = [];
        foreach ($this->opportunityStageDefinitions($includeInactive) as $definition) {
            $stageCode = $this->canonicalOpportunityStageCode((string) ($definition['stage_code'] ?? ''));
            if ($stageCode === '') {
                continue;
            }

            $lookup[$stageCode] = $stageCode;

            $codeToken = $this->normalizeOpportunityStageLookupToken($stageCode);
            if ($codeToken !== '') {
                $lookup[$codeToken] = $stageCode;
            }

            $nameToken = $this->normalizeOpportunityStageLookupToken((string) ($definition['stage_name'] ?? ''));
            if ($nameToken !== '') {
                $lookup[$nameToken] = $stageCode;
            }
        }

        return $lookup;
    }

    private function normalizeOpportunityStageLookupToken(string $value): string
    {
        $ascii = Str::upper(Str::ascii(trim($value)));
        $token = preg_replace('/[^A-Z0-9]+/', '', $ascii);

        return (string) $token;
    }

    private function canonicalOpportunityStageCode(string $stageCode): string
    {
        $sanitized = $this->statusMapping->sanitizeOpportunityStageCode($stageCode);
        if ($sanitized === '') {
            return '';
        }

        return $this->statusMapping->fromOpportunityStorageStage($sanitized);
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeOpportunityStageRecord(array $record): array
    {
        $stageCode = $this->canonicalOpportunityStageCode((string) ($record['stage_code'] ?? ''));
        $stageName = trim((string) ($record['stage_name'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'stage_code' => $stageCode !== '' ? $stageCode : 'NEW',
            'stage_name' => $stageName !== '' ? $stageName : ($stageCode !== '' ? $stageCode : 'NEW'),
            'description' => $record['description'] ?? null,
            'is_terminal' => (bool) ($record['is_terminal'] ?? in_array($stageCode, ['WON', 'LOST'], true)),
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function usesLegacyProjectSchema(): bool
    {
        $statusEnumValues = $this->projectStatusEnumValues();
        if ($statusEnumValues !== null && $statusEnumValues !== []) {
            if (in_array('PLANNING', $statusEnumValues, true) || in_array('ONGOING', $statusEnumValues, true)) {
                return false;
            }

            if (in_array('ACTIVE', $statusEnumValues, true) || in_array('TERMINATED', $statusEnumValues, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, string>|null
     */
    private function projectStatusEnumValues(): ?array
    {
        if (! $this->schema->hasTable('projects') || ! $this->schema->hasColumn('projects', 'status')) {
            return null;
        }

        try {
            $database = DB::connection()->getDatabaseName();
            if (! is_string($database) || $database === '') {
                return null;
            }

            $columnType = DB::table('information_schema.columns')
                ->where('table_schema', $database)
                ->where('table_name', 'projects')
                ->where('column_name', 'status')
                ->value('column_type');

            if (! is_string($columnType) || ! str_starts_with(strtolower($columnType), 'enum(')) {
                return null;
            }

            preg_match_all("/'([^']+)'/", $columnType, $matches);

            if (! isset($matches[1]) || ! is_array($matches[1])) {
                return null;
            }

            $values = array_values(array_unique(array_map(
                static fn (string $value): string => strtoupper(trim($value)),
                $matches[1]
            )));

            return $values === [] ? null : $values;
        } catch (\Throwable) {
            return null;
        }
    }

    private function usesLegacyContractSchema(): bool
    {
        return $this->schema->hasColumn('contracts', 'contract_number')
            || $this->schema->hasColumn('contracts', 'total_value');
    }

    private function usesLegacyOpportunitySchema(): bool
    {
        return $this->schema->hasColumn('opportunities', 'expected_value')
            || $this->schema->hasColumn('opportunities', 'owner_id');
    }
}
