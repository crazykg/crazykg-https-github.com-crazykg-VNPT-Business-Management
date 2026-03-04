<?php

namespace App\Services\V5\Workflow;

final class WorkflowFlowResolver
{
    public const FALLBACK_FLOW_STEP = 'UNMAPPED';
    public const FALLBACK_FORM_KEY = 'unmapped';

    /**
     * @return array{flow_step:string, form_key:string}
     */
    public function resolve(string $status, ?string $subStatus): array
    {
        $normalizedStatus = $this->normalizeToken($status);
        $normalizedSubStatus = $this->normalizeToken($subStatus);

        if ($normalizedStatus === '') {
            return [
                'flow_step' => self::FALLBACK_FLOW_STEP,
                'form_key' => self::FALLBACK_FORM_KEY,
            ];
        }

        $statusSubStatusMap = $this->statusSubStatusMap();
        $statusSubStatusKey = $normalizedStatus.'|'.$normalizedSubStatus;
        if (isset($statusSubStatusMap[$statusSubStatusKey])) {
            return $statusSubStatusMap[$statusSubStatusKey];
        }

        $statusMap = $this->statusMap();
        if (isset($statusMap[$normalizedStatus])) {
            return $statusMap[$normalizedStatus];
        }

        return [
            'flow_step' => self::FALLBACK_FLOW_STEP,
            'form_key' => self::FALLBACK_FORM_KEY,
        ];
    }

    /**
     * @return array<string, array{flow_step:string, form_key:string}>
     */
    private function statusMap(): array
    {
        return [
            // Support flow (legacy + status-driven)
            'NEW' => ['flow_step' => 'GD1', 'form_key' => 'support.moi_tiep_nhan'],
            'MOI_TIEP_NHAN' => ['flow_step' => 'GD1', 'form_key' => 'support.moi_tiep_nhan'],
            'WAITING_CUSTOMER' => ['flow_step' => 'GD2', 'form_key' => 'support.doi_phan_hoi_kh'],
            'DOI_PHAN_HOI_KH' => ['flow_step' => 'GD2', 'form_key' => 'support.doi_phan_hoi_kh'],
            'IN_PROGRESS' => ['flow_step' => 'GD3', 'form_key' => 'support.dang_xu_ly'],
            'DANG_XU_LY' => ['flow_step' => 'GD3', 'form_key' => 'support.dang_xu_ly'],
            'UNABLE_TO_EXECUTE' => ['flow_step' => 'GD4', 'form_key' => 'support.khong_thuc_hien'],
            'KHONG_THUC_HIEN' => ['flow_step' => 'GD4', 'form_key' => 'support.khong_thuc_hien'],
            'COMPLETED' => ['flow_step' => 'GD5', 'form_key' => 'support.hoan_thanh'],
            'HOAN_THANH' => ['flow_step' => 'GD5', 'form_key' => 'support.hoan_thanh'],
            'NOTIFIED' => ['flow_step' => 'GD6', 'form_key' => 'support.bao_khach_hang'],
            'BAO_KHACH_HANG' => ['flow_step' => 'GD6', 'form_key' => 'support.bao_khach_hang'],
            'TRANSFER_BACK' => ['flow_step' => 'GD7', 'form_key' => 'support.chuyen_tra_ql'],
            'CHUYEN_TRA_QL' => ['flow_step' => 'GD7', 'form_key' => 'support.chuyen_tra_ql'],
            // Programming flow (legacy + status-driven)
            'ANALYZING' => ['flow_step' => 'GD8', 'form_key' => 'programming.phan_tich'],
            'PHAN_TICH' => ['flow_step' => 'GD8', 'form_key' => 'programming.phan_tich'],
            'LAP_TRINH' => ['flow_step' => 'GD9', 'form_key' => 'programming.lap_trinh'],
            'CODING' => ['flow_step' => 'GD10', 'form_key' => 'programming.lap_trinh.dang_thuc_hien'],
            'PENDING_UPCODE' => ['flow_step' => 'GD12', 'form_key' => 'programming.lap_trinh.upcode'],
            'UPCODED' => ['flow_step' => 'GD11', 'form_key' => 'programming.lap_trinh.hoan_thanh'],
            'CHUYEN_DMS' => ['flow_step' => 'GD14', 'form_key' => 'programming.chuyen_dms'],
            'CLOSED' => ['flow_step' => 'GD18', 'form_key' => 'programming.chuyen_dms.hoan_thanh'],
            'CANCELLED' => ['flow_step' => 'GD13', 'form_key' => 'programming.lap_trinh.tam_ngung'],
        ];
    }

    /**
     * @return array<string, array{flow_step:string, form_key:string}>
     */
    private function statusSubStatusMap(): array
    {
        return [
            'LAP_TRINH|DANG_THUC_HIEN' => ['flow_step' => 'GD10', 'form_key' => 'programming.lap_trinh.dang_thuc_hien'],
            'LAP_TRINH|HOAN_THANH' => ['flow_step' => 'GD11', 'form_key' => 'programming.lap_trinh.hoan_thanh'],
            'LAP_TRINH|UPCODE' => ['flow_step' => 'GD12', 'form_key' => 'programming.lap_trinh.upcode'],
            'LAP_TRINH|TAM_NGUNG' => ['flow_step' => 'GD13', 'form_key' => 'programming.lap_trinh.tam_ngung'],
            'CHUYEN_DMS|TRAO_DOI' => ['flow_step' => 'GD15', 'form_key' => 'programming.chuyen_dms.trao_doi'],
            'CHUYEN_DMS|TAO_TASK' => ['flow_step' => 'GD16', 'form_key' => 'programming.chuyen_dms.tao_task'],
            'CHUYEN_DMS|TAM_NGUNG' => ['flow_step' => 'GD17', 'form_key' => 'programming.chuyen_dms.tam_ngung'],
            'CHUYEN_DMS|HOAN_THANH' => ['flow_step' => 'GD18', 'form_key' => 'programming.chuyen_dms.hoan_thanh'],
        ];
    }

    private function normalizeToken(?string $value): string
    {
        return strtoupper(trim((string) ($value ?? '')));
    }
}
