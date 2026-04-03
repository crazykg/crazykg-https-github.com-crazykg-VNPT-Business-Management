<?php

namespace App\Services\V5\Domain;

use App\Services\V5\Contract\ContractRenewalService;
use App\Services\V5\IntegrationSettings\BackblazeB2IntegrationService;
use App\Services\V5\IntegrationSettings\EmailSmtpIntegrationService;
use App\Services\V5\IntegrationSettings\GoogleDriveIntegrationService;
use App\Services\V5\IntegrationSettings\IntegrationSettingsOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationSettingsDomainService
{
    public function __construct(
        private readonly BackblazeB2IntegrationService $backblaze,
        private readonly EmailSmtpIntegrationService $emailSmtp,
        private readonly GoogleDriveIntegrationService $googleDrive,
        private readonly IntegrationSettingsOperationsService $operations,
        private readonly ContractRenewalService $renewalService,
    ) {}

    public function backblazeSettings(): JsonResponse
    {
        return $this->backblaze->settings();
    }

    public function updateBackblazeSettings(Request $request): JsonResponse
    {
        return $this->backblaze->updateSettings($request);
    }

    public function testBackblazeSettings(Request $request): JsonResponse
    {
        return $this->backblaze->testSettings($request);
    }

    public function googleDriveSettings(): JsonResponse
    {
        return $this->googleDrive->settings();
    }

    public function updateGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->googleDrive->updateSettings($request);
    }

    public function testGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->googleDrive->testSettings($request);
    }

    public function emailSmtpSettings(): JsonResponse
    {
        return $this->emailSmtp->settings();
    }

    public function updateEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->emailSmtp->updateSettings($request);
    }

    public function testEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->emailSmtp->testSettings($request);
    }

    public function contractExpiryAlertSettings(): JsonResponse
    {
        return $this->operations->contractExpiryAlertSettings();
    }

    public function updateContractExpiryAlertSettings(Request $request): JsonResponse
    {
        return $this->operations->updateContractExpiryAlertSettings($request);
    }

    public function contractPaymentAlertSettings(): JsonResponse
    {
        return $this->operations->contractPaymentAlertSettings();
    }

    public function updateContractPaymentAlertSettings(Request $request): JsonResponse
    {
        return $this->operations->updateContractPaymentAlertSettings($request);
    }

    public function reminders(Request $request): JsonResponse
    {
        return $this->operations->reminders($request);
    }

    public function userDeptHistory(Request $request): JsonResponse
    {
        return $this->operations->userDeptHistory($request);
    }

    public function sendReminderEmail(Request $request, string $id): JsonResponse
    {
        return $this->operations->sendReminderEmail($request, $id);
    }

    public function contractRenewalSettings(): JsonResponse
    {
        return $this->operations->contractRenewalSettings();
    }

    public function updateContractRenewalSettings(Request $request): JsonResponse
    {
        return $this->operations->updateContractRenewalSettings($request);
    }

    /**
     * Admin endpoint: walks every contract with a parent and recomputes
     * gap_days / continuity_status / penalty_rate in one batch.
     * Safe to call repeatedly — idempotent.
     */
    public function recalculateRenewalMeta(Request $request): JsonResponse
    {
        return $this->renewalService->recalculateAllRenewalMeta();
    }
}
