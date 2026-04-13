<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\IntegrationSettingsDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationSettingsController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly IntegrationSettingsDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function backblazeSettings(): JsonResponse
    {
        return $this->service->backblazeSettings();
    }

    public function updateBackblazeSettings(Request $request): JsonResponse
    {
        return $this->service->updateBackblazeSettings($request);
    }

    public function testBackblazeSettings(Request $request): JsonResponse
    {
        return $this->service->testBackblazeSettings($request);
    }

    public function googleDriveSettings(): JsonResponse
    {
        return $this->service->googleDriveSettings();
    }

    public function updateGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->service->updateGoogleDriveSettings($request);
    }

    public function testGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->service->testGoogleDriveSettings($request);
    }

    public function contractExpiryAlertSettings(): JsonResponse
    {
        return $this->service->contractExpiryAlertSettings();
    }

    public function updateContractExpiryAlertSettings(Request $request): JsonResponse
    {
        return $this->service->updateContractExpiryAlertSettings($request);
    }

    public function contractPaymentAlertSettings(): JsonResponse
    {
        return $this->service->contractPaymentAlertSettings();
    }

    public function updateContractPaymentAlertSettings(Request $request): JsonResponse
    {
        return $this->service->updateContractPaymentAlertSettings($request);
    }

    public function reminders(Request $request): JsonResponse
    {
        return $this->service->reminders($request);
    }

    public function storeReminder(Request $request): JsonResponse
    {
        return $this->service->storeReminder($request);
    }

    public function updateReminder(Request $request, string $id): JsonResponse
    {
        return $this->service->updateReminder($request, $id);
    }

    public function destroyReminder(string $id): JsonResponse
    {
        return $this->service->destroyReminder($id);
    }

    public function userDeptHistory(Request $request): JsonResponse
    {
        return $this->service->userDeptHistory($request);
    }

    public function storeUserDeptHistory(Request $request): JsonResponse
    {
        return $this->service->storeUserDeptHistory($request);
    }

    public function updateUserDeptHistory(Request $request, string $id): JsonResponse
    {
        return $this->service->updateUserDeptHistory($request, $id);
    }

    public function destroyUserDeptHistory(Request $request, string $id): JsonResponse
    {
        return $this->service->destroyUserDeptHistory($request, $id);
    }

    public function contractRenewalSettings(): JsonResponse
    {
        return $this->service->contractRenewalSettings();
    }

    public function updateContractRenewalSettings(Request $request): JsonResponse
    {
        return $this->service->updateContractRenewalSettings($request);
    }

    public function recalculateRenewalMeta(Request $request): JsonResponse
    {
        return $this->service->recalculateRenewalMeta($request);
    }

    public function emailSmtpSettings(): JsonResponse
    {
        return $this->service->emailSmtpSettings();
    }

    public function updateEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->service->updateEmailSmtpSettings($request);
    }

    public function testEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->service->testEmailSmtpSettings($request);
    }

    public function sendReminderEmail(Request $request, string $id): JsonResponse
    {
        return $this->service->sendReminderEmail($request, $id);
    }
}
