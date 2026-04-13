<?php

namespace Tests\Feature;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tests\TestCase;

class BackendArchitectureGuardrailsTest extends TestCase
{
    private const MAX_LEGACY_SERVICE_LINES = 25;
    private const MAX_PROJECT_PROCEDURE_CONTROLLER_LINES = 300;
    private const MAX_V5_DOMAIN_SUPPORT_LINES = 1280;
    private const MAX_CUSTOMER_REQUEST_CASE_DOMAIN_LINES = 1650;

    public function test_only_allowlisted_domain_services_delegate_to_legacy(): void
    {
        $expected = [];

        $actual = $this->relativePhpFilesContaining(
            app_path('Services/V5/Domain'),
            'legacy->'
        );

        sort($expected);
        sort($actual);

        $this->assertSame(
            $expected,
            $actual,
            'Unexpected legacy delegation detected in backend/app/Services/V5/Domain.'
        );
    }

    public function test_domain_services_do_not_use_legacy_adapters(): void
    {
        $actual = $this->relativePhpFilesContaining(
            app_path('Services/V5/Domain'),
            'legacyAdapter->'
        );

        $this->assertSame(
            [],
            $actual,
            'Domain services should not call legacy adapters directly.'
        );
    }

    public function test_customer_request_compatibility_service_no_longer_uses_legacy_directly(): void
    {
        $content = file_get_contents(app_path('Services/V5/Compatibility/CustomerRequestCompatibilityService.php'));
        $this->assertIsString($content);
        $this->assertStringNotContainsString('V5MasterDataLegacyService', $content);
        $this->assertStringNotContainsString('legacy->', $content);
    }

    public function test_runtime_code_does_not_reference_legacy_service_class(): void
    {
        $runtimePaths = [
            app_path(),
            base_path('routes'),
        ];

        foreach ($runtimePaths as $path) {
            $files = $this->relativePhpFilesContaining($path, 'V5MasterDataLegacyService');
            $files = array_values(array_filter(
                $files,
                fn (string $file): bool => $file !== 'app/Services/V5/Legacy/V5MasterDataLegacyService.php'
            ));

            $this->assertSame(
                [],
                $files,
                sprintf('Runtime code should not reference V5MasterDataLegacyService under %s.', $path)
            );
        }
    }

    public function test_legacy_service_no_longer_contains_customer_request_compatibility_entry_points(): void
    {
        $content = file_get_contents(app_path('Services/V5/Legacy/V5MasterDataLegacyService.php'));
        $this->assertIsString($content);

        foreach ([
            'public function customerRequests(',
            'public function customerRequestDashboardSummary(',
            'public function storeCustomerRequest(',
            'public function updateCustomerRequest(',
            'public function deleteCustomerRequest(',
            'public function customerRequestHistory(',
            'public function customerRequestHistories(',
            'public function importCustomerRequests(',
            'public function exportCustomerRequests(',
            'public function exportCustomerRequestDashboardSummary(',
            'public function customerRequestReceivers(',
            'public function supportRequestReceivers(',
            'public function customerRequestProjectItems(',
            'public function supportRequestReferenceSearch(',
        ] as $needle) {
            $this->assertStringNotContainsString($needle, $content);
        }
    }

    public function test_legacy_service_no_longer_contains_extracted_support_integration_document_or_contract_payment_entry_points(): void
    {
        $content = file_get_contents(app_path('Services/V5/Legacy/V5MasterDataLegacyService.php'));
        $this->assertIsString($content);

        foreach ([
            'public function documents(',
            'public function storeDocument(',
            'public function updateDocument(',
            'public function deleteDocument(',
            'public function uploadDocumentAttachment(',
            'public function deleteUploadedDocumentAttachment(',
            'public function downloadDocumentAttachment(',
            'public function downloadAttachment(',
            'public function downloadTemporaryDocumentAttachment(',
            'public function backblazeB2IntegrationSettings(',
            'public function updateBackblazeB2IntegrationSettings(',
            'public function testBackblazeB2IntegrationSettings(',
            'public function googleDriveIntegrationSettings(',
            'public function updateGoogleDriveIntegrationSettings(',
            'public function testGoogleDriveIntegrationSettings(',
            'public function contractExpiryAlertSettings(',
            'public function updateContractExpiryAlertSettings(',
            'public function contractPaymentAlertSettings(',
            'public function updateContractPaymentAlertSettings(',
            'public function paymentSchedules(',
            'public function updatePaymentSchedule(',
            'public function generateContractPayments(',
            'public function supportServiceGroups(',
            'public function availableSupportServiceGroups(',
            'public function storeSupportServiceGroup(',
            'public function storeSupportServiceGroupsBulk(',
            'public function updateSupportServiceGroup(',
            'public function supportRequestStatuses(',
            'public function storeSupportRequestStatus(',
            'public function storeSupportRequestStatusesBulk(',
            'public function updateSupportRequestStatusDefinition(',
            'public function worklogActivityTypes(',
            'public function storeWorklogActivityType(',
            'public function updateWorklogActivityType(',
            'public function supportSlaConfigs(',
            'public function storeSupportSlaConfig(',
            'public function updateSupportSlaConfig(',
        ] as $needle) {
            $this->assertStringNotContainsString($needle, $content);
        }
    }

    public function test_business_services_do_not_extend_controller_inside_app_services(): void
    {
        $expected = [];

        $actual = $this->relativePhpFilesContaining(
            app_path('Services'),
            'extends Controller'
        );

        sort($expected);
        sort($actual);

        $this->assertSame(
            $expected,
            $actual,
            'Business services should not extend Controller.'
        );
    }

    public function test_backend_refactor_baseline_metrics_do_not_regress(): void
    {
        $this->assertFileLineCountAtMost(
            app_path('Services/V5/Legacy/V5MasterDataLegacyService.php'),
            self::MAX_LEGACY_SERVICE_LINES
        );
        $this->assertFileLineCountAtMost(
            app_path('Http/Controllers/Api/V5/ProjectProcedureController.php'),
            self::MAX_PROJECT_PROCEDURE_CONTROLLER_LINES
        );
        $this->assertFileLineCountAtMost(
            app_path('Services/V5/V5DomainSupportService.php'),
            self::MAX_V5_DOMAIN_SUPPORT_LINES
        );
        $this->assertFileLineCountAtMost(
            app_path('Services/V5/Domain/CustomerRequestCaseDomainService.php'),
            self::MAX_CUSTOMER_REQUEST_CASE_DOMAIN_LINES
        );
    }

    /**
     * @return array<int, string>
     */
    private function relativePhpFilesContaining(string $directory, string $needle): array
    {
        $files = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory));

        foreach ($iterator as $entry) {
            if (! $entry->isFile() || $entry->getExtension() !== 'php') {
                continue;
            }

            $content = file_get_contents($entry->getPathname());
            if ($content === false || ! str_contains($content, $needle)) {
                continue;
            }

            $files[] = str_replace(base_path().DIRECTORY_SEPARATOR, '', $entry->getPathname());
        }

        sort($files);

        return $files;
    }

    private function assertFileLineCountAtMost(string $path, int $maxLines): void
    {
        $lineCount = count(file($path) ?: []);

        $this->assertLessThanOrEqual(
            $maxLines,
            $lineCount,
            sprintf('File %s grew to %d lines (max allowed: %d).', $path, $lineCount, $maxLines)
        );
    }
}
