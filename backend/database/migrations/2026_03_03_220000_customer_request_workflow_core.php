<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->createCustomerRequestsTable();
        $this->createWorkflowStatusCatalogsTable();
        $this->createWorkflowFormFieldConfigsTable();
        $this->ensureRequestRaciAssignmentsTable();
        $this->ensureWorklogActivityTypesTable();
        $this->ensureSlaConfigsStatusDrivenColumns();
        $this->ensureAttachmentsWorkflowColumns();

        $this->seedWorklogActivityTypes();
        $this->seedWorkflowCatalogAndFields();
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_form_field_configs');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('customer_requests');
    }

    private function createCustomerRequestsTable(): void
    {
        if (Schema::hasTable('customer_requests')) {
            return;
        }

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('request_code', 80)->unique();
            $table->unsignedBigInteger('status_catalog_id')->nullable();
            $table->string('summary', 500);
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('requester_name', 120)->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->unsignedBigInteger('receiver_user_id')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
            $table->enum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'])->default('MEDIUM');
            $table->date('requested_date')->nullable();
            $table->unsignedBigInteger('latest_transition_id')->nullable();
            $table->json('transition_metadata')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();

            $table->index(['status', 'sub_status', 'priority'], 'idx_cr_status_flow');
            $table->index(['customer_id', 'service_group_id'], 'idx_cr_customer_group');
            $table->index(['assignee_id', 'deleted_at'], 'idx_cr_assignee');
            $table->index(['requested_date', 'deleted_at'], 'idx_cr_requested_date');
            $table->index(['status_catalog_id'], 'idx_cr_status_catalog');
        });
    }

    private function createWorkflowStatusCatalogsTable(): void
    {
        if (Schema::hasTable('workflow_status_catalogs')) {
            return;
        }

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedTinyInteger('level');
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('canonical_status', 50)->nullable();
            $table->string('canonical_sub_status', 50)->nullable();
            $table->string('flow_step', 20)->nullable();
            $table->string('form_key', 120)->nullable();
            $table->boolean('is_leaf')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['level', 'status_code', 'parent_id'], 'uq_wsc_level_code_parent');
            $table->index(['parent_id', 'level', 'sort_order'], 'idx_wsc_parent');
            $table->index(['canonical_status', 'canonical_sub_status'], 'idx_wsc_canonical');
            $table->index(['is_active', 'sort_order'], 'idx_wsc_active_sort');
        });
    }

    private function createWorkflowFormFieldConfigsTable(): void
    {
        if (Schema::hasTable('workflow_form_field_configs')) {
            return;
        }

        Schema::create('workflow_form_field_configs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('status_catalog_id');
            $table->string('field_key', 120);
            $table->string('field_label', 190);
            $table->string('field_type', 50)->default('text');
            $table->boolean('required')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('excel_column', 5)->nullable();
            $table->json('options_json')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['status_catalog_id', 'field_key'], 'uq_wffc_status_field');
            $table->index(['status_catalog_id', 'sort_order'], 'idx_wffc_status_sort');
            $table->index(['is_active', 'field_type'], 'idx_wffc_active_type');
        });
    }

    private function ensureRequestRaciAssignmentsTable(): void
    {
        if (Schema::hasTable('request_raci_assignments')) {
            return;
        }

        Schema::create('request_raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->enum('raci_role', ['R', 'A', 'C', 'I']);
            $table->timestamp('last_notified_at')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();

            $table->unique(['request_code', 'user_id', 'raci_role'], 'uq_req_raci_active');
            $table->index(['request_code', 'raci_role', 'deleted_at'], 'idx_raci_notify');
            $table->index(['user_id', 'raci_role', 'deleted_at'], 'idx_raci_user_role');
            $table->index(['created_by'], 'idx_raci_created_by');
        });
    }

    private function ensureWorklogActivityTypesTable(): void
    {
        if (Schema::hasTable('worklog_activity_types')) {
            return;
        }

        Schema::create('worklog_activity_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->string('description', 255)->nullable();
            $table->boolean('default_is_billable')->default(true);
            $table->string('phase_hint', 50)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->index(['is_active', 'sort_order'], 'idx_activity_active_sort');
        });
    }

    private function ensureSlaConfigsStatusDrivenColumns(): void
    {
        if (! Schema::hasTable('sla_configs')) {
            Schema::create('sla_configs', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('status', 50);
                $table->string('sub_status', 50)->nullable();
                $table->string('priority', 20);
                $table->decimal('sla_hours', 6, 2);
                $table->string('request_type_prefix', 20)->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
                $table->unsignedBigInteger('updated_by')->nullable();
            });
        } else {
            Schema::table('sla_configs', function (Blueprint $table): void {
                if (! Schema::hasColumn('sla_configs', 'status')) {
                    $table->string('status', 50)->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'sub_status')) {
                    $table->string('sub_status', 50)->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'priority')) {
                    $table->string('priority', 20)->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'sla_hours')) {
                    $table->decimal('sla_hours', 6, 2)->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'request_type_prefix')) {
                    $table->string('request_type_prefix', 20)->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'is_active')) {
                    $table->boolean('is_active')->default(true);
                }
                if (! Schema::hasColumn('sla_configs', 'sort_order')) {
                    $table->unsignedSmallInteger('sort_order')->default(0);
                }
                if (! Schema::hasColumn('sla_configs', 'created_by')) {
                    $table->unsignedBigInteger('created_by')->nullable();
                }
                if (! Schema::hasColumn('sla_configs', 'updated_by')) {
                    $table->unsignedBigInteger('updated_by')->nullable();
                }
            });
        }

        if (Schema::hasColumn('sla_configs', 'to_status') && Schema::hasColumn('sla_configs', 'status')) {
            DB::table('sla_configs')
                ->where(function ($query): void {
                    $query->whereNull('status')->orWhereRaw('TRIM(status) = ?', ['']);
                })
                ->update(['status' => DB::raw('to_status')]);
        }

        if (Schema::hasColumn('sla_configs', 'resolution_hours') && Schema::hasColumn('sla_configs', 'sla_hours')) {
            DB::table('sla_configs')
                ->whereNull('sla_hours')
                ->update(['sla_hours' => DB::raw('resolution_hours')]);
        }

        if (Schema::hasColumn('sla_configs', 'status')) {
            DB::table('sla_configs')
                ->where(function ($query): void {
                    $query->whereNull('status')->orWhereRaw('TRIM(status) = ?', ['']);
                })
                ->update(['status' => 'IN_PROGRESS']);
        }

        if (Schema::hasColumn('sla_configs', 'priority')) {
            DB::table('sla_configs')
                ->where(function ($query): void {
                    $query->whereNull('priority')->orWhereRaw('TRIM(priority) = ?', ['']);
                })
                ->update(['priority' => 'MEDIUM']);
        }

        if (Schema::hasColumn('sla_configs', 'sla_hours')) {
            DB::table('sla_configs')->whereNull('sla_hours')->update(['sla_hours' => 24]);
        }

        if (! $this->indexExists('sla_configs', 'idx_sla_status_lookup')) {
            DB::statement('CREATE INDEX `idx_sla_status_lookup` ON `sla_configs` (`status`, `sub_status`, `priority`, `is_active`)');
        }

        if (! $this->indexExists('sla_configs', 'idx_sla_prefix_fallback')) {
            DB::statement('CREATE INDEX `idx_sla_prefix_fallback` ON `sla_configs` (`request_type_prefix`, `priority`, `is_active`)');
        }
    }

    private function ensureAttachmentsWorkflowColumns(): void
    {
        if (! Schema::hasTable('attachments')) {
            return;
        }

        if (DB::getDriverName() !== 'sqlite') {
            $column = DB::selectOne(
                "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attachments' AND COLUMN_NAME = 'reference_type'"
            );
        } else {
            $column = null;
        }

        if ($column && is_string($column->COLUMN_TYPE ?? null)) {
            $enumValues = $this->parseEnumValues($column->COLUMN_TYPE);
            if (! in_array('TRANSITION', $enumValues, true)) {
                $enumValues[] = 'TRANSITION';
            }
            if (! in_array('WORKLOG', $enumValues, true)) {
                $enumValues[] = 'WORKLOG';
            }

            $enumSql = implode(',', array_map(
                static fn (string $value): string => "'".str_replace("'", "''", $value)."'",
                $enumValues
            ));

            DB::statement("ALTER TABLE `attachments` MODIFY COLUMN `reference_type` enum({$enumSql}) NOT NULL COMMENT 'Bảng cha của file đính kèm'");
        }

        Schema::table('attachments', function (Blueprint $table): void {
            if (! Schema::hasColumn('attachments', 'mime_type')) {
                $table->string('mime_type', 100)->nullable();
            }
            if (! Schema::hasColumn('attachments', 'is_primary')) {
                $table->boolean('is_primary')->default(false);
            }
        });

        if (! $this->indexExists('attachments', 'idx_attach_primary')) {
            DB::statement('CREATE INDEX `idx_attach_primary` ON `attachments` (`reference_type`, `reference_id`, `is_primary`)');
        }
    }

    private function seedWorklogActivityTypes(): void
    {
        if (! Schema::hasTable('worklog_activity_types')) {
            return;
        }

        $rows = [
            ['code' => 'CODING', 'name' => 'Viết / review code', 'description' => 'Lập trình, code review, refactor', 'default_is_billable' => 1, 'phase_hint' => 'CODE', 'sort_order' => 10],
            ['code' => 'TESTING', 'name' => 'Kiểm thử & QA', 'description' => 'Test case, unit test, UAT, kiểm thử hồi quy', 'default_is_billable' => 1, 'phase_hint' => 'CODE', 'sort_order' => 20],
            ['code' => 'DEPLOYMENT', 'name' => 'Deploy / Upcode', 'description' => 'Deploy lên môi trường, cấu hình server, upcode', 'default_is_billable' => 1, 'phase_hint' => 'UPCODE', 'sort_order' => 30],
            ['code' => 'SUPPORT', 'name' => 'Hỗ trợ trực tiếp', 'description' => 'Xử lý yêu cầu hỗ trợ, hướng dẫn người dùng', 'default_is_billable' => 1, 'phase_hint' => 'SUPPORT_HANDLE', 'sort_order' => 40],
            ['code' => 'RESEARCH', 'name' => 'Nghiên cứu & Phân tích', 'description' => 'Phân tích yêu cầu, nghiên cứu giải pháp kỹ thuật', 'default_is_billable' => 1, 'phase_hint' => 'ANALYZE', 'sort_order' => 50],
            ['code' => 'DOCUMENTATION', 'name' => 'Viết tài liệu', 'description' => 'Tài liệu kỹ thuật, hướng dẫn sử dụng, đặc tả', 'default_is_billable' => 1, 'phase_hint' => null, 'sort_order' => 60],
            ['code' => 'MEETING', 'name' => 'Họp & trao đổi', 'description' => 'Họp nội bộ, trao đổi với khách hàng', 'default_is_billable' => 0, 'phase_hint' => null, 'sort_order' => 70],
            ['code' => 'OTHER', 'name' => 'Khác', 'description' => null, 'default_is_billable' => 1, 'phase_hint' => null, 'sort_order' => 99],
        ];

        foreach ($rows as $row) {
            $existingId = DB::table('worklog_activity_types')->whereRaw('UPPER(code) = ?', [strtoupper($row['code'])])->value('id');
            $payload = [
                'name' => $row['name'],
                'description' => $row['description'],
                'default_is_billable' => $row['default_is_billable'],
                'phase_hint' => $row['phase_hint'],
                'sort_order' => $row['sort_order'],
                'is_active' => 1,
                'updated_at' => now(),
            ];

            if ($existingId === null) {
                $payload['code'] = $row['code'];
                $payload['created_at'] = now();
                DB::table('worklog_activity_types')->insert($this->filterColumns('worklog_activity_types', $payload));
            } else {
                DB::table('worklog_activity_types')
                    ->where('id', $existingId)
                    ->update($this->filterColumns('worklog_activity_types', $payload));
            }
        }
    }

    private function seedWorkflowCatalogAndFields(): void
    {
        if (! Schema::hasTable('workflow_status_catalogs') || ! Schema::hasTable('workflow_form_field_configs')) {
            return;
        }

        $catalogRows = [
            'MOI_TIEP_NHAN' => ['level' => 1, 'name' => 'Mới tiếp nhận', 'parent' => null, 'canonical_status' => 'MOI_TIEP_NHAN', 'canonical_sub_status' => null, 'flow_step' => 'GD1', 'form_key' => 'support.moi_tiep_nhan', 'is_leaf' => true, 'sort_order' => 20],
            'DOI_PHAN_HOI_KH' => ['level' => 1, 'name' => 'Đợi phản hồi từ khách hàng', 'parent' => null, 'canonical_status' => 'DOI_PHAN_HOI_KH', 'canonical_sub_status' => null, 'flow_step' => 'GD2', 'form_key' => 'support.doi_phan_hoi_kh', 'is_leaf' => true, 'sort_order' => 30],
            'DANG_XU_LY' => ['level' => 1, 'name' => 'Đang xử lý', 'parent' => null, 'canonical_status' => 'DANG_XU_LY', 'canonical_sub_status' => null, 'flow_step' => 'GD3', 'form_key' => 'support.dang_xu_ly', 'is_leaf' => true, 'sort_order' => 40],
            'KHONG_THUC_HIEN' => ['level' => 1, 'name' => 'Không thực hiện', 'parent' => null, 'canonical_status' => 'KHONG_THUC_HIEN', 'canonical_sub_status' => null, 'flow_step' => 'GD4', 'form_key' => 'support.khong_thuc_hien', 'is_leaf' => true, 'sort_order' => 50],
            'HOAN_THANH' => ['level' => 1, 'name' => 'Hoàn thành', 'parent' => null, 'canonical_status' => 'HOAN_THANH', 'canonical_sub_status' => null, 'flow_step' => 'GD5', 'form_key' => 'support.hoan_thanh', 'is_leaf' => true, 'sort_order' => 60],
            'BAO_KHACH_HANG' => ['level' => 1, 'name' => 'Báo khách hàng', 'parent' => null, 'canonical_status' => 'BAO_KHACH_HANG', 'canonical_sub_status' => null, 'flow_step' => 'GD6', 'form_key' => 'support.bao_khach_hang', 'is_leaf' => true, 'sort_order' => 70],
            'CHUYEN_TRA_QL' => ['level' => 1, 'name' => 'Chuyển trả người quản lý', 'parent' => null, 'canonical_status' => 'CHUYEN_TRA_QL', 'canonical_sub_status' => null, 'flow_step' => 'GD7', 'form_key' => 'support.chuyen_tra_ql', 'is_leaf' => true, 'sort_order' => 80],
            'PHAN_TICH' => ['level' => 1, 'name' => 'Phân tích', 'parent' => null, 'canonical_status' => 'PHAN_TICH', 'canonical_sub_status' => null, 'flow_step' => 'GD8', 'form_key' => 'programming.phan_tich', 'is_leaf' => true, 'sort_order' => 90],
            'LAP_TRINH_GROUP' => ['level' => 2, 'name' => 'Lập trình', 'parent' => 'PHAN_TICH', 'canonical_status' => 'LAP_TRINH', 'canonical_sub_status' => null, 'flow_step' => 'GD9', 'form_key' => 'programming.lap_trinh', 'is_leaf' => false, 'sort_order' => 100],
            'LAP_TRINH_DANG_THUC_HIEN' => ['level' => 3, 'name' => 'Đang thực hiện', 'parent' => 'LAP_TRINH_GROUP', 'canonical_status' => 'LAP_TRINH', 'canonical_sub_status' => 'DANG_THUC_HIEN', 'flow_step' => 'GD10', 'form_key' => 'programming.lap_trinh.dang_thuc_hien', 'is_leaf' => true, 'sort_order' => 110],
            'LAP_TRINH_HOAN_THANH' => ['level' => 3, 'name' => 'Hoàn thành', 'parent' => 'LAP_TRINH_GROUP', 'canonical_status' => 'LAP_TRINH', 'canonical_sub_status' => 'HOAN_THANH', 'flow_step' => 'GD11', 'form_key' => 'programming.lap_trinh.hoan_thanh', 'is_leaf' => true, 'sort_order' => 120],
            'LAP_TRINH_UPCODE' => ['level' => 3, 'name' => 'Upcode', 'parent' => 'LAP_TRINH_GROUP', 'canonical_status' => 'LAP_TRINH', 'canonical_sub_status' => 'UPCODE', 'flow_step' => 'GD12', 'form_key' => 'programming.lap_trinh.upcode', 'is_leaf' => true, 'sort_order' => 130],
            'LAP_TRINH_TAM_NGUNG' => ['level' => 3, 'name' => 'Tạm ngưng', 'parent' => 'LAP_TRINH_GROUP', 'canonical_status' => 'LAP_TRINH', 'canonical_sub_status' => 'TAM_NGUNG', 'flow_step' => 'GD13', 'form_key' => 'programming.lap_trinh.tam_ngung', 'is_leaf' => true, 'sort_order' => 140],
            'CHUYEN_DMS_GROUP' => ['level' => 2, 'name' => 'Chuyển DMS', 'parent' => 'PHAN_TICH', 'canonical_status' => 'CHUYEN_DMS', 'canonical_sub_status' => null, 'flow_step' => 'GD14', 'form_key' => 'programming.chuyen_dms', 'is_leaf' => false, 'sort_order' => 150],
            'CHUYEN_DMS_TRAO_DOI' => ['level' => 3, 'name' => 'Trao đổi', 'parent' => 'CHUYEN_DMS_GROUP', 'canonical_status' => 'CHUYEN_DMS', 'canonical_sub_status' => 'TRAO_DOI', 'flow_step' => 'GD15', 'form_key' => 'programming.chuyen_dms.trao_doi', 'is_leaf' => true, 'sort_order' => 160],
            'CHUYEN_DMS_TAO_TASK' => ['level' => 3, 'name' => 'Tạo task', 'parent' => 'CHUYEN_DMS_GROUP', 'canonical_status' => 'CHUYEN_DMS', 'canonical_sub_status' => 'TAO_TASK', 'flow_step' => 'GD16', 'form_key' => 'programming.chuyen_dms.tao_task', 'is_leaf' => true, 'sort_order' => 170],
            'CHUYEN_DMS_TAM_NGUNG' => ['level' => 3, 'name' => 'Tạm ngưng', 'parent' => 'CHUYEN_DMS_GROUP', 'canonical_status' => 'CHUYEN_DMS', 'canonical_sub_status' => 'TAM_NGUNG', 'flow_step' => 'GD17', 'form_key' => 'programming.chuyen_dms.tam_ngung', 'is_leaf' => true, 'sort_order' => 180],
            'CHUYEN_DMS_HOAN_THANH' => ['level' => 3, 'name' => 'Hoàn thành', 'parent' => 'CHUYEN_DMS_GROUP', 'canonical_status' => 'CHUYEN_DMS', 'canonical_sub_status' => 'HOAN_THANH', 'flow_step' => 'GD18', 'form_key' => 'programming.chuyen_dms.hoan_thanh', 'is_leaf' => true, 'sort_order' => 190],
        ];

        $nodeIds = [];
        foreach ($catalogRows as $key => $row) {
            $parentId = null;
            if (is_string($row['parent']) && $row['parent'] !== '') {
                $parentId = $nodeIds[$row['parent']] ?? null;
            }
            $nodeIds[$key] = $this->upsertWorkflowCatalogNode($key, $row, $parentId);
        }

        $fieldRows = [
            'MOI_TIEP_NHAN' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Mã task tham chiếu'],['N','Ghi chú']],
            'DOI_PHAN_HOI_KH' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày trao đổi lại với khách hàng'],['N','Nội dung trao đổi'],['O','Ngày khách hàng phản hồi'],['P','Nội dung khách hàng phản hồi'],['Q','Mã task tham chiếu'],['R','Ghi chú']],
            'DANG_XU_LY' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày trao đổi lại với khách hàng'],['N','Nội dung trao đổi'],['O','Ngày khách hàng phản hồi'],['P','Nội dung khách hàng phản hồi'],['Q','Worklog xử lý'],['R','Ngày xử lý']],
            'KHONG_THUC_HIEN' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Nguyên nhân không thực hiện'],['N','Ngày xử lý']],
            'HOAN_THANH' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày trao đổi lại với khách hàng'],['N','Nội dung trao đổi'],['O','Ngày khách hàng phản hồi'],['P','Nội dung khách hàng phản hồi'],['Q','Ngày hoàn thành thực tế'],['R','Mã task']],
            'BAO_KHACH_HANG' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày báo kháng hàng'],['N','Người báo khách hàng']],
            'CHUYEN_TRA_QL' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày chuyển trả'],['N','Nội dung chuyển trả']],
            'PHAN_TICH' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Nội dung phân tích đính kèm'],['I','Người thực hiện'],['J','Ngày hoàn thành']],
            'LAP_TRINH_DANG_THUC_HIEN' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Tiến độ'],['I','Từ ngày'],['J','Đến ngày'],['K','Ngày gia hạn'],['L','Người thực hiện'],['M','Worklog'],['N','Mã task tham chiếu'],['O','Ghi chú']],
            'LAP_TRINH_HOAN_THANH' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người hoàn thành']],
            'LAP_TRINH_UPCODE' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Tiến độ'],['I','Ngày upcode'],['J','Người upcode'],['K','Trạng thái upcode'],['L','Worklog']],
            'LAP_TRINH_TAM_NGUNG' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Ngày tạm ngưng'],['I','Người tạm ngưng'],['J','Nội dung tạm ngưng']],
            'CHUYEN_DMS_TRAO_DOI' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người yêu cầu'],['I','Nhóm hỗ trợ'],['J','Người tiếp nhận'],['K','Ngày tiếp nhân'],['L','Người xử lý'],['M','Ngày trao đổi lại với DMS'],['N','Nội dung trao đổi'],['O','Ngày DMS phản hồi'],['P','Nội dung DMS phản hồi'],['Q','Mã task tham chiếu'],['R','Ghi chú']],
            'CHUYEN_DMS_TAO_TASK' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','List task']],
            'CHUYEN_DMS_TAM_NGUNG' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','List task'],['I','Ngày tạm ngưng'],['J','Người tạm ngưng'],['K','Nội dung tạm ngưng']],
            'CHUYEN_DMS_HOAN_THANH' => [['E','ID yêu cầu'],['F','Nội dung'],['G','Đơn vị'],['H','Người hoàn thành']],
        ];

        foreach ($fieldRows as $nodeKey => $columns) {
            $statusCatalogId = $nodeIds[$nodeKey] ?? null;
            if ($statusCatalogId === null) {
                continue;
            }

            foreach ($columns as $index => $columnDef) {
                [$excelColumn, $label] = $columnDef;
                $mapped = $this->mapFieldMetadata($label);
                $this->upsertWorkflowFieldConfig(
                    $statusCatalogId,
                    $mapped['field_key'],
                    $label,
                    $mapped['field_type'],
                    $mapped['required'],
                    ($index + 1) * 10,
                    $excelColumn,
                    $mapped['options_json']
                );
            }
        }
    }

    /**
     * @param array<string,mixed> $row
     */
    private function upsertWorkflowCatalogNode(string $statusCode, array $row, ?int $parentId): int
    {
        $query = DB::table('workflow_status_catalogs')
            ->where('level', (int) $row['level'])
            ->whereRaw('UPPER(status_code) = ?', [strtoupper($statusCode)]);

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        $existing = $query->first();
        $payload = $this->filterColumns('workflow_status_catalogs', [
            'level' => (int) $row['level'],
            'status_code' => $statusCode,
            'status_name' => $row['name'],
            'parent_id' => $parentId,
            'canonical_status' => $row['canonical_status'],
            'canonical_sub_status' => $row['canonical_sub_status'],
            'flow_step' => $row['flow_step'],
            'form_key' => $row['form_key'],
            'is_leaf' => $row['is_leaf'] ? 1 : 0,
            'sort_order' => (int) $row['sort_order'],
            'is_active' => 1,
            'updated_at' => now(),
        ]);

        if ($existing === null) {
            $payload['created_at'] = now();
            return (int) DB::table('workflow_status_catalogs')->insertGetId($payload);
        }

        DB::table('workflow_status_catalogs')->where('id', (int) $existing->id)->update($payload);
        return (int) $existing->id;
    }

    private function upsertWorkflowFieldConfig(
        int $statusCatalogId,
        string $fieldKey,
        string $fieldLabel,
        string $fieldType,
        bool $required,
        int $sortOrder,
        string $excelColumn,
        ?array $optionsJson
    ): void {
        $existing = DB::table('workflow_form_field_configs')
            ->where('status_catalog_id', $statusCatalogId)
            ->whereRaw('UPPER(field_key) = ?', [strtoupper($fieldKey)])
            ->first();

        $payload = $this->filterColumns('workflow_form_field_configs', [
            'status_catalog_id' => $statusCatalogId,
            'field_key' => $fieldKey,
            'field_label' => $fieldLabel,
            'field_type' => $fieldType,
            'required' => $required ? 1 : 0,
            'sort_order' => $sortOrder,
            'excel_column' => $excelColumn,
            'options_json' => $optionsJson === null ? null : json_encode($optionsJson, JSON_UNESCAPED_UNICODE),
            'is_active' => 1,
            'updated_at' => now(),
        ]);

        if ($existing === null) {
            $payload['created_at'] = now();
            DB::table('workflow_form_field_configs')->insert($payload);
            return;
        }

        DB::table('workflow_form_field_configs')
            ->where('id', (int) $existing->id)
            ->update($payload);
    }

    /**
     * @return array{field_key:string,field_type:string,required:bool,options_json:?array<int,array<string,string>>}
     */
    private function mapFieldMetadata(string $label): array
    {
        $normalized = $this->normalizeToken($label);
        $map = [
            'idyeucau' => ['request_code', 'text', false, null],
            'noidung' => ['summary', 'textarea', true, null],
            'donvi' => ['customer_id', 'customer', true, null],
            'nguoiyeucau' => ['requester_name', 'text', false, null],
            'nhomhotro' => ['service_group_id', 'service_group', false, null],
            'nguoitiepnhan' => ['receiver_user_id', 'user', false, null],
            'ngaytiepnhan' => ['requested_date', 'date', false, null],
            'nguoixuly' => ['assignee_id', 'user', false, null],
            'mataskthamchieu' => ['task_ref', 'task_ref', false, null],
            'ghichu' => ['notes', 'textarea', false, null],
            'ngaytraodoilaivoikhachhang' => ['exchange_date', 'date', false, null],
            'noidungtraodoi' => ['exchange_content', 'textarea', false, null],
            'ngaykhachhangphanhoi' => ['customer_feedback_date', 'date', false, null],
            'noidungkhachhangphanhoi' => ['customer_feedback_content', 'textarea', false, null],
            'worklogxuly' => ['worklog_processing', 'worklog', false, null],
            'ngayxuly' => ['processing_date', 'date', false, null],
            'nguyennhankhongthuchien' => ['cancel_reason', 'textarea', false, null],
            'ngayhoanthanthucte' => ['actual_completion_date', 'date', false, null],
            'matask' => ['task_code', 'task_ref', false, null],
            'ngaybaokhanghang' => ['notify_date', 'date', false, null],
            'nguoibaokhachhang' => ['notifier_id', 'user', false, null],
            'ngaychuyentra' => ['transfer_date', 'date', false, null],
            'noidungchuyentra' => ['transfer_content', 'textarea', false, null],
            'noidungphantichdinhkem' => ['analysis_content', 'textarea', false, null],
            'nguoithuchien' => ['performer_id', 'user', false, null],
            'ngayhoanthanh' => ['completion_date', 'date', false, null],
            'tiendo' => ['progress', 'number', false, null],
            'tungay' => ['start_date', 'date', false, null],
            'denngay' => ['end_date', 'date', false, null],
            'ngaygiahan' => ['extend_date', 'date', false, null],
            'worklog' => ['worklog', 'worklog', false, null],
            'nguoihoanthanh' => ['completion_user_id', 'user', false, null],
            'ngayupcode' => ['upcode_date', 'date', false, null],
            'nguoiupcode' => ['upcoder_id', 'user', false, null],
            'trangthaiupcode' => ['upcode_status', 'select', false, [
                ['value' => 'SUCCESS', 'label' => 'SUCCESS'],
                ['value' => 'FAILED', 'label' => 'FAILED'],
            ]],
            'ngaytamngung' => ['pause_date', 'date', false, null],
            'nguoitamngung' => ['pause_user_id', 'user', false, null],
            'noidungtamngung' => ['pause_reason', 'textarea', false, null],
            'ngaytraodoilaivoidms' => ['dms_exchange_date', 'date', false, null],
            'ngaydmsphanhoi' => ['dms_feedback_date', 'date', false, null],
            'noidungdmsphanhoi' => ['dms_feedback_content', 'textarea', false, null],
            'listtask' => ['task_list', 'task_list', false, null],
        ];

        if (isset($map[$normalized])) {
            [$key, $type, $required, $options] = $map[$normalized];
            return [
                'field_key' => $key,
                'field_type' => $type,
                'required' => (bool) $required,
                'options_json' => $options,
            ];
        }

        return [
            'field_key' => 'field_'.$normalized,
            'field_type' => 'text',
            'required' => false,
            'options_json' => null,
        ];
    }

    private function normalizeToken(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = str_replace(['đ', 'Đ'], 'd', $value);
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($value)) ?: '';
    }

    /**
     * @return array<int,string>
     */
    private function parseEnumValues(string $columnType): array
    {
        if (! preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $columnType, $matches)) {
            return [];
        }

        return array_values(array_unique(array_map(
            static fn (string $value): string => str_replace("\\'", "'", $value),
            $matches[1]
        )));
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function filterColumns(string $table, array $payload): array
    {
        $columns = Schema::getColumnListing($table);

        return array_filter(
            $payload,
            static fn ($_, string $key): bool => in_array($key, $columns, true),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private function indexExists(string $table, string $indexName): bool
    {
        if (DB::getDriverName() === 'sqlite') {
            foreach (DB::select("PRAGMA index_list('{$table}')") as $row) {
                if (($row->name ?? null) === $indexName) {
                    return true;
                }
            }

            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }
};
