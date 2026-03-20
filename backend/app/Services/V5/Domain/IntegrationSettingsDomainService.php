<?php

namespace App\Services\V5\Domain;

use App\Http\Controllers\Api\V5MasterDataController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationSettingsDomainService
{
    public function __construct(
        private readonly V5MasterDataController $legacy
    ) {}

    public function backblazeSettings(): JsonResponse
    {
        return $this->legacy->backblazeB2IntegrationSettings();
    }

    public function updateBackblazeSettings(Request $request): JsonResponse
    {
        return $this->legacy->updateBackblazeB2IntegrationSettings($request);
    }

    public function testBackblazeSettings(Request $request): JsonResponse
    {
        return $this->legacy->testBackblazeB2IntegrationSettings($request);
    }

    public function googleDriveSettings(): JsonResponse
    {
        return $this->legacy->googleDriveIntegrationSettings();
    }

    public function updateGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->legacy->updateGoogleDriveIntegrationSettings($request);
    }

    public function testGoogleDriveSettings(Request $request): JsonResponse
    {
        return $this->legacy->testGoogleDriveIntegrationSettings($request);
    }

    public function contractExpiryAlertSettings(): JsonResponse
    {
        return $this->legacy->contractExpiryAlertSettings();
    }

    public function updateContractExpiryAlertSettings(Request $request): JsonResponse
    {
        return $this->legacy->updateContractExpiryAlertSettings($request);
    }

    public function contractPaymentAlertSettings(): JsonResponse
    {
        return $this->legacy->contractPaymentAlertSettings();
    }

    public function updateContractPaymentAlertSettings(Request $request): JsonResponse
    {
        return $this->legacy->updateContractPaymentAlertSettings($request);
    }

    public function reminders(Request $request): JsonResponse
    {
        return $this->legacy->reminders($request);
    }

    public function userDeptHistory(Request $request): JsonResponse
    {
        return $this->legacy->userDeptHistory($request);
    }
}
