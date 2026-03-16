<?php

namespace App\Services\V5\Domain;

final class YeuCauProcessRegistry
{
    /**
     * @return array<string, mixed>
     */
    public static function catalog(): array
    {
        static $catalog = null;
        if ($catalog !== null) {
            return $catalog;
        }

        $catalog = [];
        foreach (self::definitions() as $definition) {
            $catalog[$definition['process_code']] = $definition;
        }

        return $catalog;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function all(): array
    {
        return array_values(self::catalog());
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $processCode): ?array
    {
        return self::catalog()[$processCode] ?? null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function groups(): array
    {
        $groups = [];
        foreach (self::all() as $definition) {
            $groupCode = $definition['group_code'];
            if (! isset($groups[$groupCode])) {
                $groups[$groupCode] = [
                    'group_code' => $groupCode,
                    'group_label' => $definition['group_label'],
                    'processes' => [],
                ];
            }

            $groups[$groupCode]['processes'][] = $definition;
        }

        return array_values($groups);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function masterFields(): array
    {
        return [
            self::field('khach_hang_id', 'Khách hàng', 'customer_select', true),
            self::field('tieu_de', 'Tiêu đề', 'text', true),
            self::field('mo_ta', 'Mô tả', 'textarea'),
            self::field('do_uu_tien', 'Độ ưu tiên', 'priority', true),
            self::field('loai_yc', 'Loại yêu cầu', 'text'),
            self::field('kenh_tiep_nhan', 'Kênh tiếp nhận', 'text'),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function definitions(): array
    {
        $commonListColumns = [
            ['key' => 'ma_yc', 'label' => 'Mã YC'],
            ['key' => 'tieu_de', 'label' => 'Tiêu đề'],
            ['key' => 'khach_hang_name', 'label' => 'Khách hàng'],
            ['key' => 'trang_thai', 'label' => 'Trạng thái'],
            ['key' => 'updated_at', 'label' => 'Cập nhật'],
        ];

        return [
            self::process('tt_giao_yc_pm', 'Giao YC cho PM', 'tiep_nhan', 'Tiếp nhận', 'moi_tiep_nhan', ['nguoi_nhap', 'pm'], ['nguoi_nhap', 'pm'], ['tt_giao_yc_r', 'tt_chuyen_ba', 'tt_chuyen_pm_ba', 'tt_khong_tiep_nhan'], [
                self::field('pm_nhan_id', 'PM nhận', 'user_select', true),
                self::field('deadline_phan_hoi', 'Hạn phản hồi', 'datetime'),
                self::field('pm_co_nhan', 'PM có nhận', 'boolean_nullable'),
                self::field('ly_do_tu_choi', 'Lý do từ chối', 'textarea'),
                self::field('pm_phan_hoi_luc', 'PM phản hồi lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_nhan_id' => 'pm_id'], [
                ['field' => 'pm_nhan_id', 'role' => 'pm'],
            ]),
            self::process('tt_giao_yc_r', 'Giao YC cho R', 'tiep_nhan', 'Tiếp nhận', 'moi_tiep_nhan', ['nguoi_nhap', 'pm', 'nguoi_thuc_hien'], ['pm', 'nguoi_thuc_hien'], ['tt_thuc_hien', 'tt_tra_yc_pm'], [
                self::field('pm_id', 'PM giao', 'user_select', true),
                self::field('r_nhan_id', 'R nhận', 'user_select', true),
                self::field('mo_ta_cong_viec', 'Mô tả công việc', 'textarea'),
                self::field('deadline', 'Deadline', 'datetime'),
                self::field('r_co_the', 'R có thể thực hiện', 'boolean_nullable'),
                self::field('r_phan_hoi_luc', 'R phản hồi lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_id' => 'pm_id', 'r_nhan_id' => 'r_id'], [
                ['field' => 'pm_id', 'role' => 'pm'],
                ['field' => 'r_nhan_id', 'role' => 'nguoi_thuc_hien'],
            ]),
            self::process('tt_tra_yc_pm', 'R trả YC lại PM', 'tra_lai_bo_sung', 'Trả lại / bổ sung', 'chuyen_tra_nguoi_quan_ly', ['nguoi_nhap', 'pm', 'nguoi_thuc_hien'], ['pm', 'nguoi_thuc_hien'], ['tt_cho_kh_cung_cap', 'tt_chuyen_pm_ba', 'tt_khong_tiep_nhan'], [
                self::field('r_tra_id', 'R trả lại', 'user_select', true),
                self::field('pm_nhan_id', 'PM nhận lại', 'user_select', true),
                self::field('ly_do_tra', 'Lý do trả', 'textarea', true),
                self::field('lan_tra', 'Lần trả', 'number'),
                self::field('nguyen_nhan', 'Nguyên nhân', 'enum', false, ['do_kh_thieu_tt', 'do_vuot_nang_luc', 'chua_xac_dinh']),
                self::field('pm_danh_gia_luc', 'PM đánh giá lúc', 'datetime'),
                self::field('can_kh_bo_sung', 'Cần KH bổ sung', 'boolean_nullable'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_nhan_id' => 'pm_id', 'r_tra_id' => 'r_id'], [
                ['field' => 'pm_nhan_id', 'role' => 'pm'],
                ['field' => 'r_tra_id', 'role' => 'nguoi_thuc_hien'],
            ]),
            self::process('tt_cho_kh_cung_cap', 'Chờ KH cung cấp', 'tra_lai_bo_sung', 'Trả lại / bổ sung', 'doi_kh_cung_cap', ['nguoi_nhap', 'pm', 'nguoi_thuc_hien'], ['nguoi_nhap', 'pm'], ['tt_giao_yc_r', 'tt_thuc_hien', 'tt_khong_tiep_nhan'], [
                self::field('tt_tra_yc_id', 'Phiếu trả YC', 'number', true),
                self::field('noi_dung_can_bo', 'Nội dung cần bổ sung', 'textarea', true),
                self::field('gui_yc_cho_kh_luc', 'Gửi YC cho KH lúc', 'datetime'),
                self::field('deadline_kh', 'Hạn KH', 'datetime'),
                self::field('kh_phan_hoi_luc', 'KH phản hồi lúc', 'datetime'),
                self::field('kh_da_cung_cap', 'KH đã cung cấp', 'boolean_nullable'),
                self::field('noi_dung_kh_cung_cap', 'Nội dung KH cung cấp', 'textarea'),
                self::field('thong_tin_da_du', 'Thông tin đã đủ', 'boolean_nullable'),
                self::field('nguoi_danh_gia_id', 'Người đánh giá', 'user_select'),
                self::field('danh_gia_luc', 'Đánh giá lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_thuc_hien', 'R đang thực hiện', 'tra_lai_bo_sung', 'Trả lại / bổ sung', 'dang_thuc_hien', ['nguoi_nhap', 'pm', 'nguoi_thuc_hien'], ['nguoi_thuc_hien', 'pm'], ['tt_hoan_thanh', 'tt_tra_yc_pm'], [
                self::field('r_id', 'Người thực hiện', 'user_select', true),
                self::field('bat_dau_luc', 'Bắt đầu lúc', 'datetime'),
                self::field('du_kien_xong', 'Dự kiến xong', 'datetime'),
                self::field('tien_do', 'Tiến độ (%)', 'number'),
                self::field('cap_nhat_tien_do_luc', 'Cập nhật tiến độ lúc', 'datetime'),
                self::field('da_hoan_thanh', 'Đã hoàn thành', 'boolean_nullable'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['r_id' => 'r_id'], [
                ['field' => 'r_id', 'role' => 'nguoi_thuc_hien'],
            ]),
            self::process('tt_hoan_thanh', 'Hoàn thành', 'tra_lai_bo_sung', 'Trả lại / bổ sung', 'hoan_thanh', ['nguoi_nhap', 'pm', 'nguoi_thuc_hien'], ['nguoi_thuc_hien', 'pm'], ['tt_thong_bao_kh', 'tt_thuc_hien'], [
                self::field('r_id', 'Người thực hiện', 'user_select', true),
                self::field('ket_qua', 'Kết quả', 'textarea', true),
                self::field('file_dinh_kem', 'File đính kèm (JSON)', 'json_textarea'),
                self::field('pm_chap_nhan', 'PM chấp nhận', 'boolean_nullable'),
                self::field('pm_danh_gia_id', 'PM đánh giá', 'user_select'),
                self::field('pm_danh_gia_luc', 'PM đánh giá lúc', 'datetime'),
                self::field('ly_do_khong_chap', 'Lý do không chấp nhận', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['r_id' => 'r_id'], [
                ['field' => 'r_id', 'role' => 'nguoi_thuc_hien'],
            ]),
            self::process('tt_chuyen_ba', 'Chuyển BA phân tích', 'phan_tich', 'Phân tích', 'phan_tich', ['nguoi_nhap', 'pm', 'ba'], ['pm', 'ba'], ['tt_chuyen_pm_ba', 'tt_lap_trinh', 'tt_chuyen_dms', 'tt_khong_tiep_nhan'], [
                self::field('pm_id', 'PM', 'user_select', true),
                self::field('ba_nhan_id', 'BA nhận', 'user_select', true),
                self::field('yeu_cau_phan_tich', 'Yêu cầu phân tích', 'textarea'),
                self::field('deadline_phan_tich', 'Deadline phân tích', 'datetime'),
                self::field('ket_qua_phan_tich', 'Kết quả phân tích', 'textarea'),
                self::field('ba_hoan_thanh', 'BA hoàn thành', 'boolean_nullable'),
                self::field('ba_hoan_thanh_luc', 'BA hoàn thành lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_id' => 'pm_id', 'ba_nhan_id' => 'ba_id'], [
                ['field' => 'pm_id', 'role' => 'pm'],
                ['field' => 'ba_nhan_id', 'role' => 'ba'],
            ]),
            self::process('tt_chuyen_pm_ba', 'PM/BA phân tích hướng xử lý', 'phan_tich', 'Phân tích', 'cho_danh_gia_huong_xu_ly', ['nguoi_nhap', 'pm', 'ba'], ['pm', 'ba'], ['tt_chuyen_dms', 'tt_lap_trinh', 'tt_khong_tiep_nhan'], [
                self::field('pm_id', 'PM', 'user_select', true),
                self::field('ba_id', 'BA', 'user_select'),
                self::field('mo_ta_van_de', 'Mô tả vấn đề', 'textarea'),
                self::field('huong_dms', 'Hướng DMS', 'boolean_nullable'),
                self::field('huong_lap_trinh', 'Hướng lập trình', 'boolean_nullable'),
                self::field('huong_khong_xu_ly', 'Không xử lý', 'boolean_nullable'),
                self::field('nguoi_danh_gia_id', 'Người đánh giá', 'user_select'),
                self::field('danh_gia_luc', 'Đánh giá lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_id' => 'pm_id', 'ba_id' => 'ba_id'], [
                ['field' => 'pm_id', 'role' => 'pm'],
                ['field' => 'ba_id', 'role' => 'ba'],
            ]),
            self::process('tt_chuyen_dms', 'Chuyển DMS', 'dms', 'DMS', 'chuyen_dms', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi'], ['pm', 'ba', 'nguoi_trao_doi'], ['tt_trao_doi_dms', 'tt_tao_task'], [
                self::field('nguoi_chuyen_id', 'Người chuyển', 'user_select', true),
                self::field('dms_dau_moi_id', 'Đầu mối DMS', 'user_select'),
                self::field('mo_ta_yc_dms', 'Mô tả YC DMS', 'textarea'),
                self::field('tai_lieu', 'Tài liệu (JSON)', 'json_textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['nguoi_chuyen_id' => 'pm_id', 'dms_dau_moi_id' => 'nguoi_trao_doi_id'], [
                ['field' => 'dms_dau_moi_id', 'role' => 'nguoi_trao_doi'],
            ]),
            self::process('tt_trao_doi_dms', 'Trao đổi với DMS', 'dms', 'DMS', 'chuyen_dms_trao_doi', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi'], ['pm', 'ba', 'nguoi_trao_doi'], ['tt_tao_task', 'tt_tam_ngung'], [
                self::field('nguoi_trao_doi_id', 'Người trao đổi', 'user_select', true),
                self::field('tt_chuyen_dms_id', 'Phiếu chuyển DMS', 'number', true),
                self::field('so_lan_trao_doi', 'Số lần trao đổi', 'number'),
                self::field('tom_tat_trao_doi', 'Tóm tắt trao đổi', 'textarea'),
                self::field('ket_luan_huong', 'Kết luận hướng', 'text'),
                self::field('phai_tao_task', 'Phải tạo task', 'boolean_nullable'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['nguoi_trao_doi_id' => 'nguoi_trao_doi_id'], [
                ['field' => 'nguoi_trao_doi_id', 'role' => 'nguoi_trao_doi'],
            ]),
            self::process('tt_tao_task', 'Tạo task DMS', 'dms', 'DMS', 'chuyen_dms_tao_task', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi'], ['pm', 'ba', 'nguoi_trao_doi'], ['tt_dms_nhan_task'], [
                self::field('nguoi_tao_id', 'Người tạo task', 'user_select', true),
                self::field('ma_task_ngoai', 'Mã task ngoài', 'text'),
                self::field('ten_task', 'Tên task', 'text', true),
                self::field('mo_ta_task', 'Mô tả task', 'textarea'),
                self::field('do_uu_tien', 'Độ ưu tiên', 'priority'),
                self::field('deadline_task', 'Deadline task', 'datetime'),
                self::field('dms_nhan_id', 'DMS nhận', 'user_select'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], [
                ['field' => 'dms_nhan_id', 'role' => 'nguoi_phan_cong'],
            ]),
            self::process('tt_dms_nhan_task', 'DMS nhận task', 'dms', 'DMS', 'cho_dms_nhan', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi', 'nguoi_phan_cong'], ['nguoi_phan_cong', 'pm', 'ba'], ['tt_dms_dang_thuc_hien', 'tt_tam_ngung'], [
                self::field('tt_tao_task_id', 'Task đã tạo', 'number', true),
                self::field('dms_nguoi_nhan_id', 'DMS người nhận', 'user_select'),
                self::field('nhan_luc', 'Nhận lúc', 'datetime'),
                self::field('co_nhan', 'Có nhận', 'boolean_nullable'),
                self::field('ly_do_khong_nhan', 'Lý do không nhận', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_dms_dang_thuc_hien', 'DMS đang thực hiện', 'dms', 'DMS', 'chuyen_dms_dang_thuc_hien', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi', 'nguoi_phan_cong'], ['nguoi_phan_cong', 'pm', 'ba'], ['tt_hoan_thanh_dms', 'tt_tam_ngung'], [
                self::field('tt_tao_task_id', 'Task đã tạo', 'number', true),
                self::field('dms_nguoi_thuc_hien_id', 'DMS thực hiện', 'user_select', true),
                self::field('bat_dau_luc', 'Bắt đầu lúc', 'datetime'),
                self::field('du_kien_xong', 'Dự kiến xong', 'datetime'),
                self::field('tien_do', 'Tiến độ (%)', 'number'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_tam_ngung', 'Tạm ngưng', 'dms', 'DMS', 'chuyen_dms_tam_ngung', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi', 'dev', 'nguoi_phan_cong'], ['pm', 'ba', 'nguoi_trao_doi', 'dev', 'nguoi_phan_cong'], ['tt_dms_dang_thuc_hien', 'tt_dang_lap_trinh', 'tt_giao_yc_r', 'tt_ket_thuc'], [
                self::field('nguoi_tao_id', 'Người tạo', 'user_select', true),
                self::field('tu_tien_trinh', 'Từ tiến trình', 'text', true),
                self::field('tu_tt_id', 'Từ TT ID', 'number', true),
                self::field('ly_do', 'Lý do', 'textarea', true),
                self::field('ngay_tam_ngung', 'Ngày tạm ngưng', 'datetime'),
                self::field('du_kien_phuc_hoi', 'Dự kiến phục hồi', 'datetime'),
                self::field('ngay_phuc_hoi_thuc', 'Ngày phục hồi thực', 'datetime'),
                self::field('nguoi_phuc_hoi_id', 'Người phục hồi', 'user_select'),
                self::field('ghi_chu_phuc_hoi', 'Ghi chú phục hồi', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_hoan_thanh_dms', 'Hoàn thành DMS', 'dms', 'DMS', 'chuyen_dms_hoan_thanh', ['nguoi_nhap', 'pm', 'ba', 'nguoi_trao_doi'], ['pm', 'ba', 'nguoi_trao_doi'], ['tt_thong_bao_kh'], [
                self::field('dms_nguoi_hoan_thanh_id', 'DMS hoàn thành', 'user_select', true),
                self::field('tt_tao_task_id', 'Task đã tạo', 'number', true),
                self::field('ket_qua', 'Kết quả', 'textarea', true),
                self::field('file_dinh_kem', 'File đính kèm (JSON)', 'json_textarea'),
                self::field('hoan_thanh_luc', 'Hoàn thành lúc', 'datetime'),
                self::field('pm_xac_nhan', 'PM xác nhận', 'boolean_nullable'),
                self::field('pm_xac_nhan_id', 'PM xác nhận bởi', 'user_select'),
                self::field('pm_xac_nhan_luc', 'PM xác nhận lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_lap_trinh', 'Lập trình', 'lap_trinh', 'Lập trình', 'lap_trinh', ['nguoi_nhap', 'pm', 'ba', 'dev'], ['pm', 'ba', 'dev'], ['tt_dang_lap_trinh'], [
                self::field('pm_id', 'PM', 'user_select', true),
                self::field('ba_id', 'BA', 'user_select'),
                self::field('dac_ta_ky_thuat', 'Đặc tả kỹ thuật', 'textarea'),
                self::field('module_lien_quan', 'Module liên quan', 'text'),
                self::field('pham_vi_anh_huong', 'Phạm vi ảnh hưởng', 'text'),
                self::field('dev_duoc_assign', 'Dev được assign', 'user_select'),
                self::field('deadline_dev', 'Deadline Dev', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['pm_id' => 'pm_id', 'ba_id' => 'ba_id', 'dev_duoc_assign' => 'dev_id'], [
                ['field' => 'pm_id', 'role' => 'pm'],
                ['field' => 'ba_id', 'role' => 'ba'],
                ['field' => 'dev_duoc_assign', 'role' => 'dev'],
            ]),
            self::process('tt_dang_lap_trinh', 'Dev đang lập trình', 'lap_trinh', 'Lập trình', 'lap_trinh_dang_thuc_hien', ['nguoi_nhap', 'pm', 'ba', 'dev'], ['dev', 'pm', 'ba'], ['tt_hoan_thanh_lap_trinh', 'tt_tam_ngung'], [
                self::field('dev_id', 'Dev', 'user_select', true),
                self::field('tt_lap_trinh_id', 'Phiếu lập trình', 'number', true),
                self::field('branch', 'Branch', 'text'),
                self::field('tien_do', 'Tiến độ (%)', 'number'),
                self::field('dev_lam_duoc', 'Dev làm được', 'boolean_nullable'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['dev_id' => 'dev_id'], [
                ['field' => 'dev_id', 'role' => 'dev'],
            ]),
            self::process('tt_hoan_thanh_lap_trinh', 'Hoàn thành lập trình', 'lap_trinh', 'Lập trình', 'lap_trinh_hoan_thanh', ['nguoi_nhap', 'pm', 'ba', 'dev'], ['dev', 'pm', 'ba'], ['tt_upcode'], [
                self::field('dev_id', 'Dev', 'user_select', true),
                self::field('tt_lap_trinh_id', 'Phiếu lập trình', 'number', true),
                self::field('pull_request_url', 'Pull request URL', 'text'),
                self::field('mo_ta_thay_doi', 'Mô tả thay đổi', 'textarea'),
                self::field('test_cases', 'Test cases', 'textarea'),
                self::field('reviewer_id', 'Reviewer', 'user_select'),
                self::field('da_review', 'Đã review', 'boolean_nullable'),
                self::field('review_luc', 'Review lúc', 'datetime'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['dev_id' => 'dev_id'], [
                ['field' => 'dev_id', 'role' => 'dev'],
            ]),
            self::process('tt_upcode', 'Upcode', 'lap_trinh', 'Lập trình', 'lap_trinh_upcode', ['nguoi_nhap', 'pm', 'ba', 'dev'], ['dev', 'pm', 'ba'], ['tt_thong_bao_kh', 'tt_tam_ngung'], [
                self::field('dev_id', 'Dev', 'user_select', true),
                self::field('moi_truong', 'Môi trường', 'enum', true, ['staging', 'uat', 'production']),
                self::field('phien_ban', 'Phiên bản', 'text'),
                self::field('commit_hash', 'Commit hash', 'text'),
                self::field('thoi_gian_up', 'Thời gian up', 'datetime'),
                self::field('ket_qua_up', 'Kết quả up', 'boolean_nullable'),
                self::field('log_up', 'Log up', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, ['dev_id' => 'dev_id'], [
                ['field' => 'dev_id', 'role' => 'dev'],
            ]),
            self::process('tt_khong_tiep_nhan', 'Không tiếp nhận', 'ket_thuc', 'Kết thúc', 'khong_tiep_nhan', ['nguoi_nhap', 'pm', 'ba'], ['pm', 'ba'], ['tt_ket_thuc'], [
                self::field('nguoi_xac_nhan_id', 'Người xác nhận', 'user_select', true),
                self::field('nguyen_nhan', 'Nguyên nhân', 'enum', true, ['pm_tu_choi_tu_dau', 'kh_khong_cung_cap_tt', 'vuot_kha_nang_ho_tro', 'khac']),
                self::field('ly_do_chi_tiet', 'Lý do chi tiết', 'textarea', true),
                self::field('tu_tien_trinh', 'Từ tiến trình', 'text', true),
                self::field('de_xuat_phuong_an', 'Đề xuất phương án', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_thong_bao_kh', 'Thông báo khách hàng', 'ket_thuc', 'Kết thúc', 'bao_khach_hang', ['nguoi_nhap', 'pm'], ['nguoi_nhap', 'pm'], ['tt_ket_thuc'], [
                self::field('nguoi_gui_id', 'Người gửi', 'user_select', true),
                self::field('kenh', 'Kênh', 'text', true),
                self::field('noi_dung', 'Nội dung', 'textarea', true),
                self::field('gui_luc', 'Gửi lúc', 'datetime'),
                self::field('kh_xac_nhan', 'KH xác nhận', 'boolean_nullable'),
                self::field('kh_xac_nhan_luc', 'KH xác nhận lúc', 'datetime'),
                self::field('kh_hai_long', 'KH hài lòng', 'boolean_nullable'),
                self::field('kh_phan_hoi', 'KH phản hồi', 'textarea'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
            self::process('tt_ket_thuc', 'Kết thúc', 'ket_thuc', 'Kết thúc', 'ket_thuc', ['nguoi_nhap', 'pm', 'ba', 'nguoi_thuc_hien', 'nguoi_trao_doi', 'dev', 'nguoi_phan_cong'], ['nguoi_nhap', 'pm', 'ba'], [], [
                self::field('nguoi_dong_id', 'Người đóng', 'user_select', true),
                self::field('ket_qua_cuoi', 'Kết quả cuối', 'enum', true, ['hoan_thanh', 'khong_tiep_nhan', 'ket_thuc_khac']),
                self::field('tu_tien_trinh', 'Từ tiến trình', 'text', true),
                self::field('tom_tat', 'Tóm tắt', 'textarea'),
                self::field('tong_gio', 'Tổng giờ', 'number'),
                self::field('diem_noi_bo', 'Điểm nội bộ', 'number'),
                self::field('ghi_chu', 'Ghi chú', 'textarea'),
            ], $commonListColumns, [], []),
        ];
    }

    /**
     * @param array<int, string> $readRoles
     * @param array<int, string> $writeRoles
     * @param array<int, string> $allowedNext
     * @param array<int, array<string, mixed>> $formFields
     * @param array<int, array<string, mixed>> $listColumns
     * @param array<string, string> $syncColumns
     * @param array<int, array<string, string>> $roleAssignments
     * @return array<string, mixed>
     */
    private static function process(
        string $processCode,
        string $processLabel,
        string $groupCode,
        string $groupLabel,
        string $defaultStatus,
        array $readRoles,
        array $writeRoles,
        array $allowedNext,
        array $formFields,
        array $listColumns,
        array $syncColumns,
        array $roleAssignments
    ): array {
        return [
            'process_code' => $processCode,
            'process_label' => $processLabel,
            'group_code' => $groupCode,
            'group_label' => $groupLabel,
            'table_name' => $processCode,
            'default_status' => $defaultStatus,
            'list_columns' => $listColumns,
            'form_fields' => $formFields,
            'read_roles' => $readRoles,
            'write_roles' => $writeRoles,
            'allowed_next_processes' => $allowedNext,
            'sync_master_columns' => $syncColumns,
            'role_assignments' => $roleAssignments,
        ];
    }

    /**
     * @param array<int, string> $options
     * @return array<string, mixed>
     */
    private static function field(
        string $name,
        string $label,
        string $type,
        bool $required = false,
        array $options = []
    ): array {
        return [
            'name' => $name,
            'label' => $label,
            'type' => $type,
            'required' => $required,
            'options' => $options,
        ];
    }
}
