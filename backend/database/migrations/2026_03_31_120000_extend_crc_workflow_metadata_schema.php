<?php

use App\Services\V5\Domain\CustomerRequestCaseRegistry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->ensureCustomerRequestCasesWorkflowDefinitionId();
        $this->extendStatusCatalogSchema();
        $this->extendTransitionSchema();
        $this->createWorkflowMetadataTable();

        $workflowId = $this->resolveDefaultCustomerRequestWorkflowId();

        $this->backfillWorkflowDefinitionIds($workflowId);
        $this->seedWorkflowMetadata($workflowId);
        $this->seedStatusCatalogMetadata($workflowId);
        $this->seedTransitionMetadata($workflowId);
        $this->normalizeIndexes();
    }

    public function down(): void
    {
        if (Schema::hasTable('customer_request_workflow_metadata')) {
            Schema::dropIfExists('customer_request_workflow_metadata');
        }

        if (Schema::hasTable('customer_request_status_transitions')) {
            $this->dropIndexIfExists('customer_request_status_transitions', 'uq_crc_status_transitions_workflow');

            Schema::table('customer_request_status_transitions', function (Blueprint $table): void {
                if (Schema::hasColumn('customer_request_status_transitions', 'transition_meta_json')) {
                    $table->dropColumn('transition_meta_json');
                }
            });
        }

        if (Schema::hasTable('customer_request_status_catalogs')) {
            $this->dropIndexIfExists('customer_request_status_catalogs', 'uq_customer_request_status_catalogs_workflow_status');
            $this->dropIndexIfExists('customer_request_status_catalogs', 'idx_crc_status_catalogs_workflow_group');

            Schema::table('customer_request_status_catalogs', function (Blueprint $table): void {
                foreach ([
                    'workflow_definition_id',
                    'group_code',
                    'group_label',
                    'list_columns_json',
                    'form_fields_json',
                    'ui_meta_json',
                    'storage_mode',
                ] as $column) {
                    if (Schema::hasColumn('customer_request_status_catalogs', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('customer_request_cases')) {
            $this->dropIndexIfExists('customer_request_cases', 'idx_crc_workflow_definition_id');

            Schema::table('customer_request_cases', function (Blueprint $table): void {
                if (Schema::hasColumn('customer_request_cases', 'workflow_definition_id')) {
                    $table->dropColumn('workflow_definition_id');
                }
            });
        }
    }

    private function ensureCustomerRequestCasesWorkflowDefinitionId(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_cases', 'workflow_definition_id')) {
                $table->unsignedBigInteger('workflow_definition_id')->nullable()->after('nguoi_xu_ly_id')->index('idx_crc_workflow_definition_id');
            }
        });
    }

    private function extendStatusCatalogSchema(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        Schema::table('customer_request_status_catalogs', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_status_catalogs', 'workflow_definition_id')) {
                $table->unsignedBigInteger('workflow_definition_id')->nullable()->after('id');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'group_code')) {
                $table->string('group_code', 80)->nullable()->after('status_name_vi');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'group_label')) {
                $table->string('group_label', 255)->nullable()->after('group_code');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'list_columns_json')) {
                $table->json('list_columns_json')->nullable()->after('handler_field');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'form_fields_json')) {
                $table->json('form_fields_json')->nullable()->after('list_columns_json');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'ui_meta_json')) {
                $table->json('ui_meta_json')->nullable()->after('form_fields_json');
            }
            if (! Schema::hasColumn('customer_request_status_catalogs', 'storage_mode')) {
                $table->string('storage_mode', 40)->nullable()->after('ui_meta_json');
            }
        });
    }

    private function extendTransitionSchema(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        Schema::table('customer_request_status_transitions', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_status_transitions', 'workflow_definition_id')) {
                $table->unsignedBigInteger('workflow_definition_id')->nullable()->first();
            }
            if (! Schema::hasColumn('customer_request_status_transitions', 'transition_meta_json')) {
                $table->json('transition_meta_json')->nullable()->after('notes');
            }
        });
    }

    private function createWorkflowMetadataTable(): void
    {
        if (Schema::hasTable('customer_request_workflow_metadata')) {
            return;
        }

        Schema::create('customer_request_workflow_metadata', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('workflow_definition_id')->unique('uq_crc_workflow_metadata_workflow_id');
            $table->json('master_fields_json')->nullable();
            $table->json('catalog_ui_meta_json')->nullable();
            $table->timestamps();
            $table->comment('Metadata runtime cấp workflow cho CRC');
        });
    }

    private function backfillWorkflowDefinitionIds(?int $workflowId): void
    {
        if ($workflowId === null) {
            return;
        }

        if (Schema::hasTable('customer_request_cases') && Schema::hasColumn('customer_request_cases', 'workflow_definition_id')) {
            DB::table('customer_request_cases')
                ->whereNull('workflow_definition_id')
                ->update([
                    'workflow_definition_id' => $workflowId,
                    'updated_at' => now(),
                ]);
        }

        if (Schema::hasTable('customer_request_status_catalogs') && Schema::hasColumn('customer_request_status_catalogs', 'workflow_definition_id')) {
            DB::table('customer_request_status_catalogs')
                ->whereNull('workflow_definition_id')
                ->update([
                    'workflow_definition_id' => $workflowId,
                    'updated_at' => now(),
                ]);
        }

        if (Schema::hasTable('customer_request_status_transitions') && Schema::hasColumn('customer_request_status_transitions', 'workflow_definition_id')) {
            DB::table('customer_request_status_transitions')
                ->whereNull('workflow_definition_id')
                ->update([
                    'workflow_definition_id' => $workflowId,
                    'updated_at' => now(),
                ]);
        }
    }

    private function seedWorkflowMetadata(?int $workflowId): void
    {
        if ($workflowId === null || ! Schema::hasTable('customer_request_workflow_metadata')) {
            return;
        }

        DB::table('customer_request_workflow_metadata')->updateOrInsert(
            ['workflow_definition_id' => $workflowId],
            [
                'master_fields_json' => json_encode(CustomerRequestCaseRegistry::masterFields(), JSON_UNESCAPED_UNICODE),
                'catalog_ui_meta_json' => json_encode([
                    'groups' => [
                        ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
                        ['group_code' => 'processing', 'group_label' => 'Xử lý'],
                        ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
                        ['group_code' => 'closure', 'group_label' => 'Kết thúc'],
                    ],
                ], JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function seedStatusCatalogMetadata(?int $workflowId): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        $definitions = collect(CustomerRequestCaseRegistry::all())->keyBy('status_code');
        $groupMap = $this->statusGroupMap();
        $uiMetaMap = $this->statusUiMetaMap();
        $handlerMap = $this->handlerFieldMap();

        $existingStatuses = DB::table('customer_request_status_catalogs')
            ->select(['status_code', 'workflow_definition_id'])
            ->get();

        foreach ($definitions as $statusCode => $definition) {
            $group = $groupMap[$statusCode] ?? ['group_code' => null, 'group_label' => null];
            $uiMeta = $uiMetaMap[$statusCode] ?? [];
            $handlerField = $handlerMap[$statusCode] ?? null;
            $storageMode = $definition['table_name'] === 'customer_request_cases' ? 'master' : 'detail';

            $match = ['status_code' => $statusCode];
            if (Schema::hasColumn('customer_request_status_catalogs', 'workflow_definition_id')) {
                $match['workflow_definition_id'] = $workflowId;
            }

            $baseRow = [
                'status_code' => $statusCode,
                'status_name_vi' => $definition['status_name_vi'],
                'group_code' => $group['group_code'],
                'group_label' => $group['group_label'],
                'table_name' => $definition['table_name'],
                'handler_field' => $handlerField,
                'list_columns_json' => json_encode($definition['list_columns'], JSON_UNESCAPED_UNICODE),
                'form_fields_json' => json_encode($definition['form_fields'], JSON_UNESCAPED_UNICODE),
                'ui_meta_json' => json_encode($uiMeta, JSON_UNESCAPED_UNICODE),
                'storage_mode' => $storageMode,
                'is_active' => true,
                'updated_at' => now(),
            ];

            if ($workflowId !== null) {
                $baseRow['workflow_definition_id'] = $workflowId;
            }

            $existingRow = $existingStatuses->first(function (object $row) use ($statusCode, $workflowId): bool {
                if ($row->status_code !== $statusCode) {
                    return false;
                }

                if ($workflowId === null) {
                    return true;
                }

                return (int) ($row->workflow_definition_id ?? 0) === $workflowId;
            });

            if ($existingRow) {
                DB::table('customer_request_status_catalogs')
                    ->where('status_code', $statusCode)
                    ->when(
                        $workflowId !== null && Schema::hasColumn('customer_request_status_catalogs', 'workflow_definition_id'),
                        fn ($query) => $query->where('workflow_definition_id', $workflowId)
                    )
                    ->update($baseRow);

                continue;
            }

            $maxSortOrder = (int) DB::table('customer_request_status_catalogs')->max('sort_order');

            DB::table('customer_request_status_catalogs')->insert([
                ...$baseRow,
                'sort_order' => $this->defaultSortOrder($statusCode, $maxSortOrder + 10),
                'created_at' => now(),
            ]);
        }
    }

    private function seedTransitionMetadata(?int $workflowId): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        $transitionMetaMap = $this->transitionMetaMap();

        foreach ($transitionMetaMap as $key => $meta) {
            [$fromStatus, $toStatus, $direction] = explode('|', $key);

            $query = DB::table('customer_request_status_transitions')
                ->where('from_status_code', $fromStatus)
                ->where('to_status_code', $toStatus)
                ->where('direction', $direction);

            if ($workflowId !== null && Schema::hasColumn('customer_request_status_transitions', 'workflow_definition_id')) {
                $query->where('workflow_definition_id', $workflowId);
            }

            $query->update([
                'transition_meta_json' => json_encode($meta, JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);
        }
    }

    private function normalizeIndexes(): void
    {
        if (Schema::hasTable('customer_request_status_catalogs')) {
            $this->dropIndexIfExists('customer_request_status_catalogs', 'customer_request_status_catalogs_status_code_unique');
            $this->dropIndexIfExists('customer_request_status_catalogs', 'uq_customer_request_status_catalogs_workflow_status');
            $this->createIndexIfMissing(
                'customer_request_status_catalogs',
                'CREATE UNIQUE INDEX `uq_customer_request_status_catalogs_workflow_status` ON `customer_request_status_catalogs` (`workflow_definition_id`, `status_code`)'
            );
            $this->dropIndexIfExists('customer_request_status_catalogs', 'idx_crc_status_catalogs_workflow_group');
            $this->createIndexIfMissing(
                'customer_request_status_catalogs',
                'CREATE INDEX `idx_crc_status_catalogs_workflow_group` ON `customer_request_status_catalogs` (`workflow_definition_id`, `group_code`, `sort_order`)'
            );
        }

        if (Schema::hasTable('customer_request_status_transitions')) {
            $this->dropIndexIfExists('customer_request_status_transitions', 'uq_customer_request_status_transitions');
            $this->dropIndexIfExists('customer_request_status_transitions', 'uq_crc_status_transitions_workflow');
            $this->createIndexIfMissing(
                'customer_request_status_transitions',
                'CREATE UNIQUE INDEX `uq_crc_status_transitions_workflow` ON `customer_request_status_transitions` (`workflow_definition_id`, `from_status_code`, `to_status_code`, `direction`)'
            );
            $this->dropIndexIfExists('customer_request_status_transitions', 'idx_customer_request_status_transitions_from');
            $this->createIndexIfMissing(
                'customer_request_status_transitions',
                'CREATE INDEX `idx_customer_request_status_transitions_workflow_from` ON `customer_request_status_transitions` (`workflow_definition_id`, `from_status_code`, `is_active`, `sort_order`)'
            );
        }
    }

    private function resolveDefaultCustomerRequestWorkflowId(): ?int
    {
        if (! Schema::hasTable('workflow_definitions')) {
            return null;
        }

        $defaultWorkflow = DB::table('workflow_definitions')
            ->where('process_type', 'customer_request')
            ->whereNull('deleted_at')
            ->where('is_default', true)
            ->orderByDesc('id')
            ->first();

        if ($defaultWorkflow) {
            return (int) $defaultWorkflow->id;
        }

        $activeWorkflow = DB::table('workflow_definitions')
            ->where('process_type', 'customer_request')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->orderByDesc('id')
            ->first();

        return $activeWorkflow ? (int) $activeWorkflow->id : null;
    }

    /**
     * @return array<string, array{group_code: string, group_label: string}>
     */
    private function statusGroupMap(): array
    {
        $labels = [
            'intake' => 'Tiếp nhận',
            'processing' => 'Xử lý',
            'analysis' => 'Phân tích',
            'closure' => 'Kết thúc',
        ];

        $map = [];
        foreach (CustomerRequestCaseRegistry::statusGroups() as $groupCode => $statusCodes) {
            foreach ($statusCodes as $statusCode) {
                $map[$statusCode] = [
                    'group_code' => $groupCode,
                    'group_label' => $labels[$groupCode] ?? ucfirst($groupCode),
                ];
            }
        }

        return $map;
    }

    /**
     * @return array<string, string>
     */
    private function handlerFieldMap(): array
    {
        return [
            'new_intake' => 'received_by_user_id',
            'pending_dispatch' => 'dispatcher_user_id',
            'assigned_to_receiver' => 'receiver_user_id',
            'receiver_in_progress' => 'receiver_user_id',
            'in_progress' => 'performer_user_id',
            'analysis' => 'performer_user_id',
            'coding' => 'developer_user_id',
            'dms_transfer' => 'dms_contact_user_id',
            'completed' => 'completed_by_user_id',
            'customer_notified' => 'notified_by_user_id',
            'returned_to_manager' => 'returned_by_user_id',
            'not_executed' => 'decision_by_user_id',
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function statusUiMetaMap(): array
    {
        return [
            'new_intake' => [
                'color_token' => 'sky',
                'bucket_code' => 'intake',
                'owner_mode' => 'creator',
                'primary_action' => ['kind' => 'transition', 'label' => 'Điều phối'],
            ],
            'assigned_to_receiver' => [
                'color_token' => 'amber',
                'bucket_code' => 'pending',
                'owner_mode' => 'receiver',
                'primary_action' => ['kind' => 'transition', 'label' => 'R nhận xử lý'],
            ],
            'pending_dispatch' => [
                'color_token' => 'amber',
                'bucket_code' => 'dispatch',
                'owner_mode' => 'dispatcher',
                'primary_action' => ['kind' => 'transition', 'label' => 'PM điều phối'],
            ],
            'receiver_in_progress' => [
                'color_token' => 'indigo',
                'bucket_code' => 'active',
                'owner_mode' => 'receiver',
                'primary_action' => ['kind' => 'worklog', 'label' => 'Cập nhật xử lý'],
            ],
            'waiting_customer_feedback' => [
                'color_token' => 'yellow',
                'bucket_code' => 'feedback',
                'owner_mode' => 'creator',
                'primary_action' => ['kind' => 'detail', 'label' => 'Theo dõi phản hồi'],
            ],
            'in_progress' => [
                'color_token' => 'blue',
                'bucket_code' => 'active',
                'owner_mode' => 'performer',
                'primary_action' => ['kind' => 'worklog', 'label' => 'Cập nhật xử lý'],
            ],
            'analysis' => [
                'color_token' => 'violet',
                'bucket_code' => 'analysis',
                'owner_mode' => 'performer',
                'primary_action' => ['kind' => 'transition', 'label' => 'Cập nhật phân tích'],
            ],
            'coding' => [
                'color_token' => 'indigo',
                'bucket_code' => 'coding',
                'owner_mode' => 'performer',
                'primary_action' => ['kind' => 'worklog', 'label' => 'Cập nhật lập trình'],
            ],
            'dms_transfer' => [
                'color_token' => 'cyan',
                'bucket_code' => 'dms',
                'owner_mode' => 'performer',
                'primary_action' => ['kind' => 'transition', 'label' => 'Cập nhật DMS'],
            ],
            'completed' => [
                'color_token' => 'emerald',
                'bucket_code' => 'done',
                'owner_mode' => 'performer',
                'is_terminal' => false,
                'primary_action' => ['kind' => 'transition', 'label' => 'Báo khách hàng'],
            ],
            'customer_notified' => [
                'color_token' => 'green',
                'bucket_code' => 'closed',
                'owner_mode' => 'creator',
                'is_terminal' => true,
            ],
            'returned_to_manager' => [
                'color_token' => 'orange',
                'bucket_code' => 'returned',
                'owner_mode' => 'dispatcher',
                'primary_action' => ['kind' => 'transition', 'label' => 'Xử lý trả lại'],
            ],
            'not_executed' => [
                'color_token' => 'rose',
                'bucket_code' => 'closed',
                'owner_mode' => 'dispatcher',
                'is_terminal' => true,
            ],
            'dispatched' => [
                'color_token' => 'sky',
                'hidden_in_ui' => true,
                'alias_of' => 'new_intake',
                'is_runtime_only' => true,
                'bucket_code' => 'intake',
                'owner_mode' => 'performer',
            ],
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function transitionMetaMap(): array
    {
        return [
            'new_intake|pending_dispatch|forward' => [
                'action_label' => 'Giao PM điều phối',
                'lane_key' => 'dispatcher',
            ],
            'new_intake|dispatched|forward' => [
                'action_label' => 'Giao thẳng người xử lý',
                'lane_key' => 'performer',
            ],
            'pending_dispatch|waiting_customer_feedback|forward' => [
                'action_label' => 'Yêu cầu KH bổ sung',
                'decision_context_code' => 'pm_missing_customer_info_review',
                'decision_outcome_code' => 'request_feedback',
                'synthetic_group_key' => 'pm_missing_customer_info_review',
            ],
            'pending_dispatch|not_executed|forward' => [
                'action_label' => 'Từ chối yêu cầu',
                'decision_context_code' => 'pm_missing_customer_info_review',
                'decision_outcome_code' => 'reject',
                'synthetic_group_key' => 'pm_missing_customer_info_review',
            ],
            'pending_dispatch|in_progress|forward' => [
                'action_label' => 'PM tự xử lý',
                'lane_key' => 'self_handle',
            ],
            'pending_dispatch|analysis|forward' => [
                'action_label' => 'Chuyển phân tích',
            ],
            'dispatched|in_progress|forward' => [
                'action_label' => 'Nhận việc',
            ],
            'dispatched|returned_to_manager|forward' => [
                'action_label' => 'Trả lại PM',
            ],
            'analysis|coding|forward' => [
                'action_label' => 'Chuyển lập trình',
            ],
            'analysis|dms_transfer|forward' => [
                'action_label' => 'Chuyển DMS',
            ],
            'coding|completed|forward' => [
                'action_label' => 'Hoàn thành lập trình',
            ],
            'coding|returned_to_manager|forward' => [
                'action_label' => 'Dev trả lại PM',
            ],
            'dms_transfer|completed|forward' => [
                'action_label' => 'Hoàn thành DMS',
            ],
            'dms_transfer|returned_to_manager|forward' => [
                'action_label' => 'DMS trả lại PM',
            ],
            'completed|customer_notified|forward' => [
                'action_label' => 'Báo khách hàng',
            ],
            'in_progress|completed|forward' => [
                'action_label' => 'Hoàn thành xử lý',
            ],
            'in_progress|receiver_in_progress|forward' => [
                'action_label' => 'Chuyển R xử lý',
            ],
            'returned_to_manager|dispatched|forward' => [
                'action_label' => 'Giao lại người xử lý',
            ],
        ];
    }

    private function defaultSortOrder(string $statusCode, int $fallback): int
    {
        return match ($statusCode) {
            'new_intake' => 10,
            'assigned_to_receiver' => 12,
            'pending_dispatch' => 15,
            'dispatched' => 18,
            'receiver_in_progress' => 25,
            'waiting_customer_feedback' => 20,
            'in_progress' => 30,
            'coding' => 35,
            'dms_transfer' => 38,
            'not_executed' => 40,
            'completed' => 50,
            'customer_notified' => 60,
            'returned_to_manager' => 70,
            'analysis' => 80,
            default => $fallback,
        };
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        if (! $this->indexExists($table, $index)) {
            return;
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::statement(sprintf('DROP INDEX `%s`', $index));
        } else {
            DB::statement(sprintf('DROP INDEX `%s` ON `%s`', $index, $table));
        }
    }

    private function createIndexIfMissing(string $table, string $sql): void
    {
        preg_match('/`([^`]+)` ON `([^`]+)`/', $sql, $matches);
        $index = $matches[1] ?? null;
        $resolvedTable = $matches[2] ?? null;

        if ($index === null || $resolvedTable === null || $resolvedTable !== $table) {
            return;
        }

        if (! $this->indexExists($table, $index)) {
            DB::statement($sql);
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        return match (DB::getDriverName()) {
            'sqlite' => $this->sqliteIndexExists($table, $index),
            'mysql' => $this->mysqlIndexExists($table, $index),
            'pgsql' => ! empty(DB::select(
                'SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ? AND indexname = ?',
                [$table, $index]
            )),
            default => false,
        };
    }

    private function mysqlIndexExists(string $table, string $index): bool
    {
        $exists = DB::selectOne(
            'SELECT COUNT(*) AS aggregate FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
            [$table, $index]
        );

        return (int) ($exists->aggregate ?? 0) > 0;
    }

    private function sqliteIndexExists(string $table, string $index): bool
    {
        foreach (DB::select("PRAGMA index_list('{$table}')") as $row) {
            if (($row->name ?? null) === $index) {
                return true;
            }
        }

        return false;
    }
};
