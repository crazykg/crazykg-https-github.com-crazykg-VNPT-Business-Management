<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STATUS_TABLE = 'workflow_status_catalogs';
    private const FIELD_TABLE = 'workflow_form_field_configs';
    private const TARGET_LABEL = 'Ngày trao đổi với khách hàng';

    public function up(): void
    {
        if (! Schema::hasTable(self::STATUS_TABLE) || ! Schema::hasTable(self::FIELD_TABLE)) {
            return;
        }

        if (! Schema::hasColumn(self::FIELD_TABLE, 'field_key') || ! Schema::hasColumn(self::FIELD_TABLE, 'field_label')) {
            return;
        }

        $statusId = $this->resolveWaitingCustomerFeedbackStatusId();
        if ($statusId === null) {
            return;
        }

        $payload = ['field_label' => self::TARGET_LABEL];
        if (Schema::hasColumn(self::FIELD_TABLE, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table(self::FIELD_TABLE)
            ->where('status_catalog_id', $statusId)
            ->where('field_key', 'exchange_date')
            ->update($payload);
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::STATUS_TABLE) || ! Schema::hasTable(self::FIELD_TABLE)) {
            return;
        }

        if (! Schema::hasColumn(self::FIELD_TABLE, 'field_key') || ! Schema::hasColumn(self::FIELD_TABLE, 'field_label')) {
            return;
        }

        $statusId = $this->resolveWaitingCustomerFeedbackStatusId();
        if ($statusId === null) {
            return;
        }

        $payload = ['field_label' => 'Ngày trao đổi lại với khách hàng'];
        if (Schema::hasColumn(self::FIELD_TABLE, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table(self::FIELD_TABLE)
            ->where('status_catalog_id', $statusId)
            ->where('field_key', 'exchange_date')
            ->update($payload);
    }

    private function resolveWaitingCustomerFeedbackStatusId(): ?int
    {
        if (! Schema::hasColumn(self::STATUS_TABLE, 'status_code')) {
            return null;
        }

        $query = DB::table(self::STATUS_TABLE)->where('status_code', 'DOI_PHAN_HOI_KH');
        if (Schema::hasColumn(self::STATUS_TABLE, 'canonical_status')) {
            $query->orWhere('canonical_status', 'DOI_PHAN_HOI_KH');
        }

        $value = $query->orderBy('id')->value('id');
        if ($value === null || $value === '') {
            return null;
        }

        $intValue = (int) $value;
        return $intValue > 0 ? $intValue : null;
    }
};
