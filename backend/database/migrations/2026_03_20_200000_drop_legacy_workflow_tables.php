<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Drop all legacy workflow tables.
 *
 * Phase 0 (yeu_cau legacy - 25 tables):
 *   yeu_cau, yc_nguoi_lien_quan, yc_lich_su_trang_thai, tt_giao_yc_pm, tt_giao_yc_r,
 *   tt_tra_yc_pm, tt_cho_kh_cung_cap, tt_thuc_hien, tt_hoan_thanh, tt_chuyen_ba,
 *   tt_chuyen_pm_ba, tt_chuyen_dms, tt_trao_doi_dms, tt_tao_task, tt_dms_nhan_task,
 *   tt_dms_dang_thuc_hien, tt_tam_ngung, tt_hoan_thanh_dms, tt_lap_trinh,
 *   tt_dang_lap_trinh, tt_hoan_thanh_lap_trinh, tt_upcode, tt_khong_tiep_nhan,
 *   tt_thong_bao_kh, tt_ket_thuc
 *
 * Phase 1 (customer_requests + workflow engine - 8 tables):
 *   customer_requests, workflow_status_catalogs, workflow_form_field_configs,
 *   request_raci_assignments, workflow_status_transitions, workflow_status_view_rules,
 *   workflow_notification_logs, (request_transitions added later)
 *
 * Superseded by Phase 2: customer_request_cases (16 tables, currently active).
 */
return new class extends Migration
{
    // Phase 0: legacy yeu_cau tables (25 tables)
    private const LEGACY_YEU_CAU_TABLES = [
        'tt_ket_thuc',
        'tt_thong_bao_kh',
        'tt_khong_tiep_nhan',
        'tt_upcode',
        'tt_hoan_thanh_lap_trinh',
        'tt_dang_lap_trinh',
        'tt_lap_trinh',
        'tt_hoan_thanh_dms',
        'tt_tam_ngung',
        'tt_dms_dang_thuc_hien',
        'tt_dms_nhan_task',
        'tt_tao_task',
        'tt_trao_doi_dms',
        'tt_chuyen_dms',
        'tt_chuyen_pm_ba',
        'tt_chuyen_ba',
        'tt_hoan_thanh',
        'tt_thuc_hien',
        'tt_cho_kh_cung_cap',
        'tt_tra_yc_pm',
        'tt_giao_yc_r',
        'tt_giao_yc_pm',
        'yc_lich_su_trang_thai',
        'yc_nguoi_lien_quan',
        'yeu_cau',
    ];

    // Phase 1: workflow engine tables (8 tables)
    private const LEGACY_WORKFLOW_ENGINE_TABLES = [
        'workflow_notification_logs',
        'workflow_status_view_rules',
        'workflow_status_transitions',
        'request_raci_assignments',
        'request_transitions',
        'workflow_form_field_configs',
        'workflow_status_catalogs',
        'customer_requests',
    ];

    public function up(): void
    {
        foreach (self::LEGACY_YEU_CAU_TABLES as $table) {
            Schema::dropIfExists($table);
        }

        foreach (self::LEGACY_WORKFLOW_ENGINE_TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    public function down(): void
    {
        // These tables are permanently decommissioned.
        // Restore from backup or re-run the original creation migrations if needed.
    }
};
