<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const WORKFLOW_FIELD_TABLE = 'workflow_form_field_configs';
    private const CUSTOMER_REQUEST_TABLE = 'customer_requests';
    private const DATE_ORDER_CONSTRAINT = 'chk_cr_exchange_feedback_date_order';

    public function up(): void
    {
        $this->normalizeWorkflowExchangeFeedbackFieldConfigs();
        $this->addDateOrderConstraintIfMissing();
    }

    public function down(): void
    {
        $this->dropDateOrderConstraintIfExists();
    }

    private function normalizeWorkflowExchangeFeedbackFieldConfigs(): void
    {
        if (! Schema::hasTable(self::WORKFLOW_FIELD_TABLE)) {
            return;
        }

        $requiredColumns = ['id', 'field_label', 'field_key', 'field_type'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn(self::WORKFLOW_FIELD_TABLE, $column)) {
                return;
            }
        }

        $hasUpdatedAt = Schema::hasColumn(self::WORKFLOW_FIELD_TABLE, 'updated_at');

        $mapping = [
            'ngaytraodoilaivoikhachhang' => ['field_key' => 'exchange_date', 'field_type' => 'date'],
            'ngaytraodilivikhachhang' => ['field_key' => 'exchange_date', 'field_type' => 'date'],
            'fieldngaytraodoilaivoikhachhang' => ['field_key' => 'exchange_date', 'field_type' => 'date'],
            'fieldngaytraodilivikhachhang' => ['field_key' => 'exchange_date', 'field_type' => 'date'],
            'ngaykhachhangphanhoi' => ['field_key' => 'customer_feedback_date', 'field_type' => 'date'],
            'ngaykhacahangphnhi' => ['field_key' => 'customer_feedback_date', 'field_type' => 'date'],
            'fieldngaykhachhangphanhoi' => ['field_key' => 'customer_feedback_date', 'field_type' => 'date'],
            'fieldngaykhacahangphnhi' => ['field_key' => 'customer_feedback_date', 'field_type' => 'date'],
            'noidungtraodoi' => ['field_key' => 'exchange_content', 'field_type' => 'textarea'],
            'nidungtraodi' => ['field_key' => 'exchange_content', 'field_type' => 'textarea'],
            'fieldnoidungtraodoi' => ['field_key' => 'exchange_content', 'field_type' => 'textarea'],
            'fieldnidungtraodi' => ['field_key' => 'exchange_content', 'field_type' => 'textarea'],
            'noidungkhachhangphanhoi' => ['field_key' => 'customer_feedback_content', 'field_type' => 'textarea'],
            'nidungkhachhangphnhi' => ['field_key' => 'customer_feedback_content', 'field_type' => 'textarea'],
            'fieldnoidungkhachhangphanhoi' => ['field_key' => 'customer_feedback_content', 'field_type' => 'textarea'],
            'fieldnidungkhachhangphnhi' => ['field_key' => 'customer_feedback_content', 'field_type' => 'textarea'],
        ];

        $rows = DB::table(self::WORKFLOW_FIELD_TABLE)
            ->select('id', 'field_label', 'field_key', 'field_type')
            ->get();

        foreach ($rows as $row) {
            $labelToken = $this->normalizeToken((string) ($row->field_label ?? ''));
            $keyToken = $this->normalizeToken((string) ($row->field_key ?? ''));
            $target = $mapping[$labelToken] ?? $mapping[$keyToken] ?? null;
            if ($target === null) {
                continue;
            }
            $nextPayload = [];
            if ((string) ($row->field_key ?? '') !== $target['field_key']) {
                $nextPayload['field_key'] = $target['field_key'];
            }

            if (strtolower((string) ($row->field_type ?? '')) !== strtolower($target['field_type'])) {
                $nextPayload['field_type'] = $target['field_type'];
            }

            if ($nextPayload === []) {
                continue;
            }

            if ($hasUpdatedAt) {
                $nextPayload['updated_at'] = now();
            }

            DB::table(self::WORKFLOW_FIELD_TABLE)
                ->where('id', (int) $row->id)
                ->update($nextPayload);
        }
    }

    private function addDateOrderConstraintIfMissing(): void
    {
        if (! $this->shouldApplyConstraint()) {
            return;
        }

        if ($this->constraintExists(self::DATE_ORDER_CONSTRAINT)) {
            return;
        }

        $exchangeDateExpr = "COALESCE(
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.exchange_date')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.field_ngaytraodoilaivoikhachhang')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.field_ngaytraodilivikhachhang')), '')
        )";
        $feedbackDateExpr = "COALESCE(
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.customer_feedback_date')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.field_ngaykhachhangphanhoi')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`transition_metadata`, '$.field_ngaykhacahangphnhi')), '')
        )";

        $checkExpression = sprintf(
            "((%1\$s IS NULL OR %1\$s REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
              AND (%2\$s IS NULL OR %2\$s REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
              AND (%1\$s IS NULL OR %2\$s IS NULL OR %1\$s <= %2\$s))",
            $exchangeDateExpr,
            $feedbackDateExpr
        );

        DB::statement(sprintf(
            'ALTER TABLE `%s` ADD CONSTRAINT `%s` CHECK (%s)',
            self::CUSTOMER_REQUEST_TABLE,
            self::DATE_ORDER_CONSTRAINT,
            $checkExpression
        ));
    }

    private function dropDateOrderConstraintIfExists(): void
    {
        if (! $this->shouldApplyConstraint()) {
            return;
        }

        if (! $this->constraintExists(self::DATE_ORDER_CONSTRAINT)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP CHECK `%s`',
            self::CUSTOMER_REQUEST_TABLE,
            self::DATE_ORDER_CONSTRAINT
        ));
    }

    private function shouldApplyConstraint(): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        if (! Schema::hasTable(self::CUSTOMER_REQUEST_TABLE)) {
            return false;
        }

        return Schema::hasColumn(self::CUSTOMER_REQUEST_TABLE, 'transition_metadata');
    }

    private function constraintExists(string $constraint): bool
    {
        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', self::CUSTOMER_REQUEST_TABLE)
            ->where('constraint_name', $constraint)
            ->where('constraint_type', 'CHECK')
            ->exists();
    }

    private function normalizeToken(string $value): string
    {
        $normalized = trim(mb_strtolower($value));
        $normalized = str_replace(['đ', 'Đ'], 'd', $normalized);
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized) ?: $normalized;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($normalized)) ?: '';
    }
};
