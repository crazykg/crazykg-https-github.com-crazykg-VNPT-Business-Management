<?php

namespace App\Services\V5\Support;

use Illuminate\Support\Facades\DB;

class SettingsResolver
{
    private const CONTRACT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_ALERT';
    private const CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_PAYMENT_ALERT';
    private const DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS = 30;
    private const DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS = 30;
    private const MIN_CONTRACT_EXPIRY_WARNING_DAYS = 1;
    private const MAX_CONTRACT_EXPIRY_WARNING_DAYS = 365;

    public function __construct(
        private readonly SchemaCapabilityService $schema
    ) {}

    public function resolveContractExpiryWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS;
        if (
            ! $this->schema->hasTable('integration_settings')
            || ! $this->schema->hasColumn('integration_settings', 'contract_expiry_warning_days')
        ) {
            return $fallback;
        }

        $rawValue = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_ALERT_INTEGRATION_PROVIDER)
            ->value('contract_expiry_warning_days');

        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }

    public function resolveContractPaymentWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS;
        if (
            ! $this->schema->hasTable('integration_settings')
            || ! $this->schema->hasColumn('integration_settings', 'contract_payment_warning_days')
        ) {
            return $fallback;
        }

        $rawValue = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER)
            ->value('contract_payment_warning_days');

        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }
}
