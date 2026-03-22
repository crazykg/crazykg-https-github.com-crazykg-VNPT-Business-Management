<?php

namespace App\Services\V5\Domain;

use App\Services\V5\IntegrationSettings\BackblazeB2IntegrationService;
use App\Services\V5\IntegrationSettings\GoogleDriveIntegrationService;
use App\Services\V5\IntegrationSettings\IntegrationSettingsOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationSettingsDomainService
{
    public function __construct(
        private readonly BackblazeB2IntegrationService $backblaze,
        private readonly GoogleDriveIntegrationService $googleDrive,
        private readonly IntegrationSettingsOperationsService $operations,
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
}
