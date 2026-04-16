<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProjectProcedureTemplateSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $now = Carbon::now();

            // ──────────────────────────────────────────────
            // Template 1: DAU_TU
            // ──────────────────────────────────────────────
            $dauTuId = DB::table('project_procedure_templates')->insertGetId([
                'template_code' => 'DAU_TU',
                'template_name' => 'Thủ tục dự án đầu tư',
                'description'   => 'Quy trình thủ tục cho dự án đầu tư công nghệ thông tin',
                'is_active'     => true,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);

            // Template 2: THUE_DICH_VU_DACTHU
            $thueDVId = DB::table('project_procedure_templates')->insertGetId([
                'template_code' => 'THUE_DICH_VU_DACTHU',
                'template_name' => 'Thủ tục dự án thuê dịch vụ CNTT đặc thù',
                'description'   => 'Quy trình thủ tục cho dự án thuê dịch vụ công nghệ thông tin đặc thù',
                'is_active'     => true,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);

            // ──────────────────────────────────────────────
            // DAU_TU – Steps
            // ──────────────────────────────────────────────
            $sortOrder = 0;

            // Phase: CHUAN_BI (Steps 1-8)
            $this->insertStep($dauTuId, 1, null, 'CHUAN_BI', 'Báo cáo đề xuất chủ trương đầu tư', null, 'Chủ đầu tư', null, 'Tờ trình và báo cáo ĐXCT đầu tư', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 2, null, 'CHUAN_BI', 'Báo cáo kết quả thẩm định ĐXCT', null, 'Sở KHĐT', null, null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 3, null, 'CHUAN_BI', 'Phê duyệt chủ trương thực hiện', null, 'UBND Tỉnh Hậu Giang', null, 'Quyết định chủ trương', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 4, null, 'CHUAN_BI', 'Lập dự toán giai đoạn chuẩn bị đầu tư', null, 'Chủ đầu tư', null, null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 5, null, 'CHUAN_BI', 'Phê duyệt dự toán giai đoạn chuẩn bị đầu tư', null, 'Sở KHĐT', null, null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 6, null, 'CHUAN_BI', 'Lập kế hoạch lựa chọn nhà thầu giai đoạn chuẩn bị đầu tư', null, 'Chủ đầu tư', null, null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 7, null, 'CHUAN_BI', 'Tờ trình phê duyệt KHLCNT nhiệm vụ chuẩn bị đầu tư', null, 'Chủ đầu tư', null, null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 8, null, 'CHUAN_BI', 'Phê duyệt kế hoạch lựa chọn nhà thầu giai đoạn chuẩn bị đầu tư', null, 'Chủ đầu tư', null, null, 0, ++$sortOrder, $now);

            // Phase: CHUAN_BI_DAU_TU (Steps 9-17)
            $this->insertStep($dauTuId, 9, null, 'CHUAN_BI_DAU_TU', 'Chọn lựa nhà thầu tư vấn khảo sát, thẩm định giá, tư vấn lập báo cáo kinh tế kỹ thuật, tư vấn thẩm tra báo cáo kinh tế kỹ thuật', null, 'Chủ đầu tư', 'Các đơn vị tư vấn', 'Biên bản thương thảo; Quyết định chỉ định thầu; Các hợp đồng tư vấn', 3, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 10, null, 'CHUAN_BI_DAU_TU', 'Lập nhiệm vụ khảo sát', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Nhiệm vụ khảo sát', 3, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 11, null, 'CHUAN_BI_DAU_TU', 'Phê duyệt nhiệm vụ khảo sát', null, 'Chủ đầu tư', null, null, 3, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 12, null, 'CHUAN_BI_DAU_TU', 'Khảo sát', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Báo cáo khảo sát', 6, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 13, null, 'CHUAN_BI_DAU_TU', 'Lập báo cáo kinh tế kỹ thuật', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Hồ sơ báo cáo kinh tế kỹ thuật', 30, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 14, null, 'CHUAN_BI_DAU_TU', 'Thẩm định giá', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Chứng thư thẩm định giá', 30, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 15, null, 'CHUAN_BI_DAU_TU', 'Thẩm tra báo cáo kinh tế kỹ thuật', null, 'Đơn vị tư vấn thẩm tra', 'Chủ đầu tư', 'Báo cáo thẩm tra báo cáo kinh tế kỹ thuật', 30, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 16, null, 'CHUAN_BI_DAU_TU', 'Trình phê duyệt Hồ sơ báo cáo kinh tế kỹ thuật', null, 'Chủ đầu tư', 'Đơn vị tư vấn', 'Hồ sơ báo cáo kinh tế kỹ thuật - hoàn chỉnh', 5, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 17, null, 'CHUAN_BI_DAU_TU', 'Phê duyệt Hồ sơ báo cáo kinh tế kỹ thuật', null, 'Cơ quan có thẩm quyền', 'Chủ đầu tư', 'Quyết định phê duyệt Hồ sơ báo cáo kinh tế kỹ thuật', 15, ++$sortOrder, $now);

            // Phase: THUC_HIEN_DAU_TU (Steps 18-49)
            $this->insertStep($dauTuId, 18, null, 'THUC_HIEN_DAU_TU', 'Lập kế hoạch lựa chọn nhà thầu', null, 'Chủ đầu tư', null, 'Tờ trình phê duyệt Kế hoạch lựa chọn nhà thầu giai đoạn thực hiện đầu tư', 2, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 19, null, 'THUC_HIEN_DAU_TU', 'Phê duyệt kế hoạch lựa chọn nhà thầu', null, 'Cơ quan có thẩm quyền', 'Chủ đầu tư', 'QĐ phê duyệt kế hoạch lựa chọn nhà thầu', 2, ++$sortOrder, $now);

            // Step 20 – parent for sub-steps 20a, 20b, 20c
            $step20Id = DB::table('project_procedure_template_steps')->insertGetId([
                'template_id'          => $dauTuId,
                'step_number'          => 20,
                'parent_step_id'       => null,
                'phase'                => 'THUC_HIEN_DAU_TU',
                'step_name'            => 'Chọn lựa nhà thầu tư vấn quản lý dự án, tư vấn đấu thầu, tư vấn thẩm định thầu, tư vấn giám sát',
                'step_detail'          => null,
                'lead_unit'            => 'Chủ đầu tư',
                'support_unit'         => 'Các đơn vị tư vấn',
                'expected_result'      => 'Biên bản thương thảo; Quyết định chỉ định; Các hợp đồng tư vấn',
                'default_duration_days' => 3,
                'sort_order'           => ++$sortOrder,
                'created_at'           => $now,
                'updated_at'           => $now,
            ]);

            // Sub-steps 20a, 20b, 20c
            $this->insertStep($dauTuId, 20, $step20Id, 'THUC_HIEN_DAU_TU', 'Thương thảo', null, 'Chủ đầu tư', 'Các đơn vị tư vấn', null, 1, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 20, $step20Id, 'THUC_HIEN_DAU_TU', 'QĐ chỉ định thầu', null, 'Chủ đầu tư', 'Các đơn vị tư vấn', null, 1, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 20, $step20Id, 'THUC_HIEN_DAU_TU', 'Hợp đồng', null, 'Chủ đầu tư', 'Các đơn vị tư vấn', null, 1, ++$sortOrder, $now);

            $this->insertStep($dauTuId, 21, null, 'THUC_HIEN_DAU_TU', 'Tổ chức lập E-HSMT cho các gói thầu', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'E-HSMT', 15, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 22, null, 'THUC_HIEN_DAU_TU', 'Tổ chức thẩm định E-HSMT cho các gói thầu', null, 'Đơn vị tư vấn', null, 'Báo cáo thẩm định', 10, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 23, null, 'THUC_HIEN_DAU_TU', 'Phê duyệt E-HSMT', null, 'Chủ đầu tư', null, 'Quyết định phê duyệt E-HSMT; E-HSMT chính thức', 2, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 24, null, 'THUC_HIEN_DAU_TU', 'Đăng thông báo mời thầu', null, 'Chủ đầu tư', 'Đơn vị tư vấn', null, 1, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 25, null, 'THUC_HIEN_DAU_TU', 'Phát hành E-HSMT', null, 'Chủ đầu tư', null, 'E-HSMT', 18, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 26, null, 'THUC_HIEN_DAU_TU', 'Nhận E-HSDT', null, 'Chủ đầu tư', null, 'E-HSDT', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 27, null, 'THUC_HIEN_DAU_TU', 'Đóng/mở thầu', null, 'Đơn vị tư vấn, nhà thầu', 'Chủ đầu tư', 'Biên bản đóng/mở thầu', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 28, null, 'THUC_HIEN_DAU_TU', 'Đánh giá HSĐXKT', null, 'Đơn vị tư vấn', null, 'Báo cáo đánh giá HSĐXKT', 10, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 29, null, 'THUC_HIEN_DAU_TU', 'Bàn giao Báo cáo Đánh giá HSĐXKT', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Báo cáo Đánh giá HSĐXKT, các QĐ, công văn, tờ trình', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 30, null, 'THUC_HIEN_DAU_TU', 'Bàn giao BC đánh giá HSĐXKT cho ĐV TV thẩm định', null, 'Chủ đầu tư', 'Đơn vị tư vấn thẩm định thầu', null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 31, null, 'THUC_HIEN_DAU_TU', 'Tổ chức thẩm định báo cáo đánh giá HSĐXKT', null, 'Đơn vị tư vấn thẩm định thầu', null, 'Báo cáo thẩm định kết quả đánh giá HSĐXKT', 10, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 32, null, 'THUC_HIEN_DAU_TU', 'Bàn giao BC thẩm định kết quả đánh giá HSĐXKT', null, 'Đơn vị tư vấn thẩm định thầu', 'Chủ đầu tư', 'Báo cáo thẩm định, các QĐ, công văn, tờ trình', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 33, null, 'THUC_HIEN_DAU_TU', 'Phê duyệt danh sách nhà thầu đáp ứng yêu cầu kỹ thuật', null, 'Chủ đầu tư', null, 'Quyết định phê duyệt danh sách nhà thầu đáp ứng YCKT', 1, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 34, null, 'THUC_HIEN_DAU_TU', 'Mở HSĐXTC', null, 'Đơn vị tư vấn, nhà thầu', 'Chủ đầu tư', 'Biên bản mở thầu', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 35, null, 'THUC_HIEN_DAU_TU', 'Đánh giá HSĐXTC', null, 'Đơn vị tư vấn', null, 'Báo cáo đánh giá HSĐXTC', 5, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 36, null, 'THUC_HIEN_DAU_TU', 'Bàn giao Báo cáo Đánh giá HSĐXTC', null, 'Đơn vị tư vấn', 'Chủ đầu tư', 'Báo cáo Đánh giá HSĐXTC, các QĐ, công văn, tờ trình', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 37, null, 'THUC_HIEN_DAU_TU', 'Mời thương thảo', null, 'Chủ đầu tư', 'Nhà thầu', null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 38, null, 'THUC_HIEN_DAU_TU', 'Thương thảo hợp đồng', null, 'Chủ đầu tư, Nhà thầu đạt', null, null, 1, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 39, null, 'THUC_HIEN_DAU_TU', 'Bàn giao BC đánh giá HSĐXTC và BB thương thảo', null, 'Chủ đầu tư', 'Đơn vị tư vấn thẩm định thầu', null, 2, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 40, null, 'THUC_HIEN_DAU_TU', 'Tổ chức thẩm định kết quả lựa chọn nhà thầu', null, 'Đơn vị tư vấn thẩm định thầu', null, 'Báo cáo thẩm định kết quả lựa chọn nhà thầu', 5, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 41, null, 'THUC_HIEN_DAU_TU', 'Bàn giao BC thẩm định kết quả lựa chọn nhà thầu', null, 'Đơn vị tư vấn thẩm định thầu', 'Chủ đầu tư', 'Báo cáo thẩm định, công văn, tờ trình', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 42, null, 'THUC_HIEN_DAU_TU', 'Phê duyệt kết quả lựa chọn nhà thầu', null, 'Chủ đầu tư', 'Đơn vị tư vấn', 'Quyết định phê duyệt kết quả lựa chọn nhà thầu', 2, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 43, null, 'THUC_HIEN_DAU_TU', 'Thông báo phê duyệt kết quả lựa chọn nhà thầu', null, 'Chủ đầu tư', 'Đơn vị tư vấn', null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 44, null, 'THUC_HIEN_DAU_TU', 'Đăng tải KQLCNT', null, 'Chủ đầu tư', 'Đơn vị tư vấn', null, 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 45, null, 'THUC_HIEN_DAU_TU', 'Thương thảo hoàn thiện hợp đồng, ký kết hợp đồng và tổ chức triển khai', null, 'Chủ đầu tư, Nhà thầu đạt', 'Đơn vị tư vấn', 'Hợp đồng', 7, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 46, null, 'THUC_HIEN_DAU_TU', 'Triển khai hợp đồng', null, 'Chủ đầu tư, Nhà thầu, Đơn vị tư vấn', 'Đơn vị tư vấn', 'Nhật ký thi công', 120, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 47, null, 'THUC_HIEN_DAU_TU', 'Quản lý dự án', null, 'Chủ đầu tư, Nhà thầu, Đơn vị tư vấn', 'Đơn vị tư vấn', 'Báo cáo quản lý dự án', 120, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 48, null, 'THUC_HIEN_DAU_TU', 'Giám sát', null, 'Chủ đầu tư, Nhà thầu, Đơn vị tư vấn', 'Đơn vị tư vấn', 'Báo cáo giám sát, nhật ký giám sát', 120, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 49, null, 'THUC_HIEN_DAU_TU', 'Dự phòng', null, 'Chủ đầu tư', 'Đơn vị tư vấn', null, 30, ++$sortOrder, $now);

            // Phase: KET_THUC_DAU_TU (Steps 50-52)
            $this->insertStep($dauTuId, 50, null, 'KET_THUC_DAU_TU', 'Bàn giao/nghiệm thu sản phẩm và dự án', null, 'Chủ đầu tư, Nhà thầu, Đơn vị tư vấn', 'Đơn vị tư vấn', 'Hồ sơ nghiệm thu và bàn giao', 30, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 51, null, 'KET_THUC_DAU_TU', 'Tổng nghiệm thu', null, 'Chủ đầu tư, Nhà thầu, Đơn vị tư vấn', 'Đơn vị tư vấn', 'Hồ sơ tổng nghiệm thu', 0, ++$sortOrder, $now);
            $this->insertStep($dauTuId, 52, null, 'KET_THUC_DAU_TU', 'Quyết toán vốn đầu tư', null, 'Chủ đầu tư', 'Các đơn vị tư vấn, nhà thầu', 'Hồ sơ quyết toán', 0, ++$sortOrder, $now);

            // ──────────────────────────────────────────────
            // THUE_DICH_VU_DACTHU – Steps
            // ──────────────────────────────────────────────
            $sortOrder = 0;
            $thueDvDacThuSteps = [
                ['phase' => 'Phê duyệt chủ trương', 'step_name' => 'Đề án'],
                ['phase' => 'Phê duyệt chủ trương', 'step_name' => 'Báo cáo đề xuất chủ trương'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Lập đề cương và dự toán chi tiết'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Báo cáo kinh tế kỹ thuật'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Kế hoạch thuê dịch vụ'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Báo cáo nghiên cứu khả thi'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Thiết kế chi tiết và dự toán'],
                ['phase' => 'Phê duyệt dự án', 'step_name' => 'Kế hoạch mua sắm'],
                ['phase' => 'Đấu thầu', 'step_name' => 'Xây dựng HSMT (Hồ sơ mời thầu)'],
                ['phase' => 'Đấu thầu', 'step_name' => 'Xây dựng HSDT (Hồ sơ dự thầu)'],
                ['phase' => 'Đấu thầu', 'step_name' => 'Đánh giá HSDT'],
                ['phase' => 'Đàm phán thương thảo', 'step_name' => 'Đàm phán thương thảo'],
                ['phase' => 'Ký hợp đồng', 'step_name' => 'Ký hợp đồng'],
                ['phase' => 'Triển khai hợp đồng', 'step_name' => 'Khảo sát hiện trạng'],
                ['phase' => 'Triển khai hợp đồng', 'step_name' => 'Phân tích nghiệp vụ; Thiết kế UI/UX, hệ thống; Lập trình'],
                ['phase' => 'Triển khai hợp đồng', 'step_name' => 'Lắp đặt, cài đặt, Kiểm thử, vận hành thử hệ thống'],
                ['phase' => 'Triển khai hợp đồng', 'step_name' => 'Đào tạo'],
                ['phase' => 'Nghiệm thu', 'step_name' => 'Nghiệm thu hoàn thành đưa vào sử dụng'],
                ['phase' => 'Thanh quyết toán', 'step_name' => 'Thanh toán theo đợt'],
                ['phase' => 'Thanh quyết toán', 'step_name' => 'Hoàn thành quyết toán'],
                ['phase' => 'Bảo hành', 'step_name' => 'Bảo hành, hỗ trợ kỹ thuật'],
            ];

            foreach ($thueDvDacThuSteps as $index => $step) {
                $sortOrder += 10;
                $this->insertStep(
                    $thueDVId,
                    $index + 1,
                    null,
                    $step['phase'],
                    $step['step_name'],
                    null,
                    null,
                    null,
                    null,
                    0,
                    $sortOrder,
                    $now,
                );
            }
        });
    }

    /**
     * Helper to insert a single template step row.
     */
    private function insertStep(
        int $templateId,
        int $stepNumber,
        ?int $parentStepId,
        ?string $phase,
        string $stepName,
        ?string $stepDetail,
        ?string $leadUnit,
        ?string $supportUnit,
        ?string $expectedResult,
        int $defaultDurationDays,
        int $sortOrder,
        Carbon $now,
    ): void {
        DB::table('project_procedure_template_steps')->insert([
            'template_id'           => $templateId,
            'step_number'           => $stepNumber,
            'parent_step_id'        => $parentStepId,
            'phase'                 => $phase,
            'step_name'             => $stepName,
            'step_detail'           => $stepDetail,
            'lead_unit'             => $leadUnit,
            'support_unit'          => $supportUnit,
            'expected_result'       => $expectedResult,
            'default_duration_days' => $defaultDurationDays,
            'sort_order'            => $sortOrder,
            'created_at'            => $now,
            'updated_at'            => $now,
        ]);
    }
}
