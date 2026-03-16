<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STATUS_TABLE = 'workflow_status_catalogs';
    private const TRANSITION_TABLE = 'workflow_status_transitions';
    private const VIEW_RULE_TABLE = 'workflow_status_view_rules';

    public function up(): void
    {
        $this->createWorkflowStatusTransitionsTable();
        $this->createWorkflowStatusViewRulesTable();
        $this->seedPhaseOneStatuses();
        $this->seedPhaseOneTransitions();
        $this->seedPhaseOneViewRules();
    }

    public function down(): void
    {
        if (Schema::hasTable(self::VIEW_RULE_TABLE)) {
            Schema::dropIfExists(self::VIEW_RULE_TABLE);
        }

        if (Schema::hasTable(self::TRANSITION_TABLE)) {
            Schema::dropIfExists(self::TRANSITION_TABLE);
        }

        if (! Schema::hasTable(self::STATUS_TABLE)) {
            return;
        }

        DB::table(self::STATUS_TABLE)
            ->whereIn('status_code', ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'TRA_LAI', 'DONG'])
            ->delete();
    }

    private function createWorkflowStatusTransitionsTable(): void
    {
        if (Schema::hasTable(self::TRANSITION_TABLE)) {
            return;
        }

        Schema::create(self::TRANSITION_TABLE, function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('from_status_catalog_id');
            $table->unsignedBigInteger('to_status_catalog_id');
            $table->string('action_code', 80);
            $table->string('action_name', 150);
            $table->string('required_role', 50)->nullable();
            $table->json('condition_json')->nullable();
            $table->json('notify_targets_json')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(
                ['from_status_catalog_id', 'to_status_catalog_id', 'action_code'],
                'uq_wst_from_to_action'
            );
            $table->index(['from_status_catalog_id', 'sort_order'], 'idx_wst_from_sort');
            $table->index(['to_status_catalog_id', 'is_active'], 'idx_wst_to_active');
        });
    }

    private function createWorkflowStatusViewRulesTable(): void
    {
        if (Schema::hasTable(self::VIEW_RULE_TABLE)) {
            return;
        }

        Schema::create(self::VIEW_RULE_TABLE, function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('status_catalog_id');
            $table->string('viewer_role', 50);
            $table->boolean('can_view')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['status_catalog_id', 'viewer_role'], 'uq_wsvr_status_role');
            $table->index(['status_catalog_id', 'sort_order'], 'idx_wsvr_status_sort');
        });
    }

    private function seedPhaseOneStatuses(): void
    {
        if (! Schema::hasTable(self::STATUS_TABLE)) {
            return;
        }

        $rows = [
            [
                'status_code' => 'CHO_DUYET',
                'status_name' => 'Chờ duyệt',
                'canonical_status' => 'CHO_DUYET',
                'canonical_sub_status' => null,
                'flow_step' => 'GD1A',
                'form_key' => 'support.cho_duyet',
                'level' => 1,
                'parent_id' => null,
                'is_leaf' => 1,
                'sort_order' => 25,
            ],
            [
                'status_code' => 'DA_DUYET',
                'status_name' => 'Đã duyệt',
                'canonical_status' => 'DA_DUYET',
                'canonical_sub_status' => null,
                'flow_step' => 'GD1B',
                'form_key' => 'support.da_duyet',
                'level' => 1,
                'parent_id' => null,
                'is_leaf' => 1,
                'sort_order' => 35,
            ],
            [
                'status_code' => 'TU_CHOI',
                'status_name' => 'Từ chối',
                'canonical_status' => 'TU_CHOI',
                'canonical_sub_status' => null,
                'flow_step' => 'GD4A',
                'form_key' => 'support.tu_choi',
                'level' => 1,
                'parent_id' => null,
                'is_leaf' => 1,
                'sort_order' => 55,
            ],
            [
                'status_code' => 'TRA_LAI',
                'status_name' => 'Trả lại',
                'canonical_status' => 'TRA_LAI',
                'canonical_sub_status' => null,
                'flow_step' => 'GD6A',
                'form_key' => 'support.tra_lai',
                'level' => 1,
                'parent_id' => null,
                'is_leaf' => 1,
                'sort_order' => 75,
            ],
            [
                'status_code' => 'DONG',
                'status_name' => 'Đóng',
                'canonical_status' => 'DONG',
                'canonical_sub_status' => null,
                'flow_step' => 'GD19',
                'form_key' => 'support.dong',
                'level' => 1,
                'parent_id' => null,
                'is_leaf' => 1,
                'sort_order' => 200,
            ],
        ];

        foreach ($rows as $row) {
            $attributes = [
                'status_code' => $row['status_code'],
                'level' => $row['level'],
                'parent_id' => $row['parent_id'],
            ];

            $payload = [
                'status_name' => $row['status_name'],
                'canonical_status' => $row['canonical_status'],
                'canonical_sub_status' => $row['canonical_sub_status'],
                'flow_step' => $row['flow_step'],
                'form_key' => $row['form_key'],
                'is_leaf' => $row['is_leaf'],
                'sort_order' => $row['sort_order'],
                'is_active' => 1,
                'updated_at' => now(),
            ];

            if (Schema::hasColumn(self::STATUS_TABLE, 'allow_pending_selection')) {
                $payload['allow_pending_selection'] = 0;
            }

            $existingId = DB::table(self::STATUS_TABLE)
                ->where($attributes)
                ->value('id');

            if ($existingId === null) {
                $payload['created_at'] = now();
                DB::table(self::STATUS_TABLE)->insert(array_merge($attributes, $payload));
                continue;
            }

            DB::table(self::STATUS_TABLE)
                ->where('id', $existingId)
                ->update($payload);
        }
    }

    private function seedPhaseOneTransitions(): void
    {
        if (! Schema::hasTable(self::TRANSITION_TABLE) || ! Schema::hasTable(self::STATUS_TABLE)) {
            return;
        }

        $statusIds = $this->resolveStatusIds([
            'MOI_TIEP_NHAN',
            'CHO_DUYET',
            'DA_DUYET',
            'TU_CHOI',
            'TRA_LAI',
            'DANG_XU_LY',
            'HOAN_THANH',
            'DONG',
            'PHAN_TICH',
        ]);

        $rows = [
            ['from' => 'MOI_TIEP_NHAN', 'to' => 'CHO_DUYET', 'action_code' => 'SUBMIT_APPROVAL', 'action_name' => 'Gửi duyệt', 'required_role' => 'CREATOR', 'sort_order' => 10, 'notify_targets_json' => ['PM']],
            ['from' => 'CHO_DUYET', 'to' => 'DA_DUYET', 'action_code' => 'APPROVE', 'action_name' => 'Duyệt', 'required_role' => 'PM', 'sort_order' => 20, 'notify_targets_json' => ['CREATOR', 'EXECUTOR']],
            ['from' => 'CHO_DUYET', 'to' => 'TU_CHOI', 'action_code' => 'REJECT', 'action_name' => 'Từ chối', 'required_role' => 'PM', 'sort_order' => 30, 'notify_targets_json' => ['CREATOR']],
            ['from' => 'CHO_DUYET', 'to' => 'TRA_LAI', 'action_code' => 'RETURN', 'action_name' => 'Trả lại bổ sung', 'required_role' => 'PM', 'sort_order' => 40, 'notify_targets_json' => ['CREATOR']],
            ['from' => 'TRA_LAI', 'to' => 'CHO_DUYET', 'action_code' => 'RESUBMIT', 'action_name' => 'Gửi lại', 'required_role' => 'CREATOR', 'sort_order' => 50, 'notify_targets_json' => ['PM']],
            ['from' => 'DA_DUYET', 'to' => 'PHAN_TICH', 'action_code' => 'START_ANALYSIS', 'action_name' => 'Bắt đầu phân tích', 'required_role' => 'PM', 'sort_order' => 60, 'notify_targets_json' => ['EXECUTOR']],
            ['from' => 'DA_DUYET', 'to' => 'DANG_XU_LY', 'action_code' => 'START_PROCESSING', 'action_name' => 'Bắt đầu xử lý', 'required_role' => 'PM', 'sort_order' => 70, 'notify_targets_json' => ['EXECUTOR']],
            ['from' => 'DANG_XU_LY', 'to' => 'HOAN_THANH', 'action_code' => 'COMPLETE', 'action_name' => 'Hoàn thành', 'required_role' => 'EXECUTOR', 'sort_order' => 80, 'notify_targets_json' => ['PM', 'CREATOR']],
            ['from' => 'HOAN_THANH', 'to' => 'DONG', 'action_code' => 'CLOSE', 'action_name' => 'Đóng yêu cầu', 'required_role' => 'PM', 'sort_order' => 90, 'notify_targets_json' => ['CREATOR', 'EXECUTOR']],
        ];

        foreach ($rows as $row) {
            $fromId = $statusIds[$row['from']] ?? null;
            $toId = $statusIds[$row['to']] ?? null;
            if ($fromId === null || $toId === null) {
                throw new RuntimeException("Unable to seed workflow transition from {$row['from']} to {$row['to']}.");
            }

            $attributes = [
                'from_status_catalog_id' => $fromId,
                'to_status_catalog_id' => $toId,
                'action_code' => $row['action_code'],
            ];

            $payload = [
                'action_name' => $row['action_name'],
                'required_role' => $row['required_role'],
                'condition_json' => null,
                'notify_targets_json' => json_encode($row['notify_targets_json'], JSON_UNESCAPED_UNICODE),
                'sort_order' => $row['sort_order'],
                'is_active' => 1,
                'updated_at' => now(),
            ];

            $existingId = DB::table(self::TRANSITION_TABLE)
                ->where($attributes)
                ->value('id');

            if ($existingId === null) {
                $payload['created_at'] = now();
                DB::table(self::TRANSITION_TABLE)->insert(array_merge($attributes, $payload));
                continue;
            }

            DB::table(self::TRANSITION_TABLE)
                ->where('id', $existingId)
                ->update($payload);
        }
    }

    private function seedPhaseOneViewRules(): void
    {
        if (! Schema::hasTable(self::VIEW_RULE_TABLE) || ! Schema::hasTable(self::STATUS_TABLE)) {
            return;
        }

        $statusIds = $this->resolveStatusIds([
            'MOI_TIEP_NHAN',
            'CHO_DUYET',
            'DA_DUYET',
            'DANG_XU_LY',
            'HOAN_THANH',
            'TU_CHOI',
            'TRA_LAI',
            'DONG',
        ]);

        $roleSortOrder = [
            'CUSTOMER' => 10,
            'CREATOR' => 20,
            'PM' => 30,
            'EXECUTOR' => 40,
            'ADMIN' => 50,
        ];

        $matrix = [
            'MOI_TIEP_NHAN' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => false, 'ADMIN' => true],
            'CHO_DUYET' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => false, 'ADMIN' => true],
            'DA_DUYET' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => true, 'ADMIN' => true],
            'DANG_XU_LY' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => true, 'ADMIN' => true],
            'HOAN_THANH' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => true, 'ADMIN' => true],
            'TU_CHOI' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => false, 'ADMIN' => true],
            'TRA_LAI' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => false, 'ADMIN' => true],
            'DONG' => ['CUSTOMER' => true, 'CREATOR' => true, 'PM' => true, 'EXECUTOR' => true, 'ADMIN' => true],
        ];

        foreach ($matrix as $statusCode => $roles) {
            $statusId = $statusIds[$statusCode] ?? null;
            if ($statusId === null) {
                throw new RuntimeException("Unable to seed workflow view rules for {$statusCode}.");
            }

            foreach ($roles as $viewerRole => $canView) {
                $attributes = [
                    'status_catalog_id' => $statusId,
                    'viewer_role' => $viewerRole,
                ];

                $payload = [
                    'can_view' => $canView ? 1 : 0,
                    'sort_order' => $roleSortOrder[$viewerRole] ?? 0,
                    'is_active' => 1,
                    'updated_at' => now(),
                ];

                $existingId = DB::table(self::VIEW_RULE_TABLE)
                    ->where($attributes)
                    ->value('id');

                if ($existingId === null) {
                    $payload['created_at'] = now();
                    DB::table(self::VIEW_RULE_TABLE)->insert(array_merge($attributes, $payload));
                    continue;
                }

                DB::table(self::VIEW_RULE_TABLE)
                    ->where('id', $existingId)
                    ->update($payload);
            }
        }
    }

    /**
     * @param array<int, string> $statusCodes
     * @return array<string, int>
     */
    private function resolveStatusIds(array $statusCodes): array
    {
        return DB::table(self::STATUS_TABLE)
            ->whereIn('status_code', $statusCodes)
            ->pluck('id', 'status_code')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();
    }
};
