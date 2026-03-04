<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('workflow_form_field_configs')) {
            return;
        }

        $requiredColumns = ['id', 'status_catalog_id', 'field_key', 'field_label'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('workflow_form_field_configs', $column)) {
                return;
            }
        }

        $hasSortOrder = Schema::hasColumn('workflow_form_field_configs', 'sort_order');
        $hasIsActive = Schema::hasColumn('workflow_form_field_configs', 'is_active');
        $hasUpdatedAt = Schema::hasColumn('workflow_form_field_configs', 'updated_at');

        $rows = DB::table('workflow_form_field_configs')
            ->select(array_filter([
                'id',
                'status_catalog_id',
                'field_key',
                'field_label',
                $hasSortOrder ? 'sort_order' : null,
                $hasIsActive ? 'is_active' : null,
            ]))
            ->orderBy('status_catalog_id')
            ->when($hasSortOrder, fn ($query) => $query->orderBy('sort_order'))
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        $rowsByStatusCatalog = [];
        foreach ($rows as $row) {
            $statusCatalogId = (int) ($row['status_catalog_id'] ?? 0);
            if (! isset($rowsByStatusCatalog[$statusCatalogId])) {
                $rowsByStatusCatalog[$statusCatalogId] = [];
            }
            $rowsByStatusCatalog[$statusCatalogId][] = $row;
        }

        foreach ($rowsByStatusCatalog as $statusCatalogId => $statusRows) {
            foreach ($statusRows as $index => $row) {
                $rowId = (int) ($row['id'] ?? 0);
                if ($rowId <= 0) {
                    continue;
                }

                $canonicalKey = $this->resolveCanonicalKeyByLabel((string) ($row['field_label'] ?? ''));
                if ($canonicalKey === null) {
                    continue;
                }

                $currentKeyToken = $this->normalizeToken((string) ($row['field_key'] ?? ''));
                $canonicalKeyToken = $this->normalizeToken($canonicalKey);
                if ($currentKeyToken === $canonicalKeyToken) {
                    if ((string) ($row['field_key'] ?? '') !== $canonicalKey) {
                        $payload = ['field_key' => $canonicalKey];
                        if ($hasUpdatedAt) {
                            $payload['updated_at'] = now();
                        }
                        DB::table('workflow_form_field_configs')->where('id', $rowId)->update($payload);
                        $statusRows[$index]['field_key'] = $canonicalKey;
                    }
                    continue;
                }

                $canonicalKeyExists = false;
                foreach ($statusRows as $existing) {
                    $existingId = (int) ($existing['id'] ?? 0);
                    if ($existingId === $rowId) {
                        continue;
                    }

                    if ($this->normalizeToken((string) ($existing['field_key'] ?? '')) === $canonicalKeyToken) {
                        $canonicalKeyExists = true;
                        break;
                    }
                }

                if ($canonicalKeyExists) {
                    if ($hasIsActive) {
                        $payload = ['is_active' => 0];
                        if ($hasUpdatedAt) {
                            $payload['updated_at'] = now();
                        }
                        DB::table('workflow_form_field_configs')->where('id', $rowId)->update($payload);
                        $statusRows[$index]['is_active'] = 0;
                    }
                    continue;
                }

                $payload = ['field_key' => $canonicalKey];
                if ($hasUpdatedAt) {
                    $payload['updated_at'] = now();
                }
                DB::table('workflow_form_field_configs')->where('id', $rowId)->update($payload);
                $statusRows[$index]['field_key'] = $canonicalKey;
            }

            $rowsByStatusCatalog[$statusCatalogId] = $statusRows;
        }
    }

    public function down(): void
    {
        // no-op: cleanup migration only normalizes aliases to canonical keys and deactivates duplicates.
    }

    private function resolveCanonicalKeyByLabel(string $fieldLabel): ?string
    {
        $token = $this->normalizeToken($fieldLabel);
        if ($token === '') {
            return null;
        }

        $mapping = [
            'idyeucau' => 'request_code',
            'mayeucau' => 'request_code',
            'mayc' => 'request_code',
            'noidung' => 'summary',
            'noidungyeucau' => 'summary',
            'donvi' => 'customer_id',
            'nguoiyeucau' => 'reporter_contact_id',
            'nhomhotro' => 'service_group_id',
            'nguoitiepnhan' => 'receiver_user_id',
            'nguoixuly' => 'assignee_id',
            'ngaytiepnhan' => 'requested_date',
        ];

        return $mapping[$token] ?? null;
    }

    private function normalizeToken(string $value): string
    {
        $normalized = trim(mb_strtolower($value));
        $normalized = str_replace(['đ', 'Đ'], 'd', $normalized);
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized) ?: $normalized;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($normalized)) ?: '';
    }
};
