<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            if (! Schema::hasColumn('customers', 'customer_code_auto_generated')) {
                $table->boolean('customer_code_auto_generated')->default(false)->after('customer_code');
            }
        });

        if (! Schema::hasColumn('customers', 'customer_code') || ! Schema::hasColumn('customers', 'customer_code_auto_generated')) {
            return;
        }

        $selects = ['id', 'customer_code'];
        if (Schema::hasColumn('customers', 'customer_name')) {
            $selects[] = 'customer_name';
        }
        if (Schema::hasColumn('customers', 'company_name')) {
            $selects[] = 'company_name';
        }

        $usedCodes = [];
        DB::table('customers')
            ->select($selects)
            ->chunkById(500, function ($rows) use (&$usedCodes): void {
                foreach ($rows as $row) {
                    $existingCode = $this->normalizeCustomerCode($row->customer_code ?? null);
                    if ($existingCode === null) {
                        continue;
                    }

                    $usedCodes[$this->normalizeCodeKey($existingCode)] = true;
                    DB::table('customers')
                        ->where('id', $row->id)
                        ->update(['customer_code_auto_generated' => false]);
                }
            });

        DB::table('customers')
            ->select($selects)
            ->where(function ($query): void {
                $query->whereNull('customer_code')
                    ->orWhereRaw('TRIM(customer_code) = ?', ['']);
            })
            ->chunkById(500, function ($rows) use (&$usedCodes): void {
                foreach ($rows as $row) {
                    $customerName = trim((string) ($row->customer_name ?? $row->company_name ?? ''));
                    $generatedCode = $this->resolveUniqueCustomerCode(
                        $this->buildAutoCustomerCodeBase($customerName),
                        $usedCodes,
                    );

                    DB::table('customers')
                        ->where('id', $row->id)
                        ->update([
                            'customer_code' => $generatedCode,
                            'customer_code_auto_generated' => true,
                        ]);
                }
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            if (Schema::hasColumn('customers', 'customer_code_auto_generated')) {
                $table->dropColumn('customer_code_auto_generated');
            }
        });
    }

    private function normalizeCustomerCode(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeCodeKey(string $value): string
    {
        return mb_strtoupper(trim($value), 'UTF-8');
    }

    private function normalizeCodeFragment(?string $value): string
    {
        $normalized = Str::of((string) ($value ?? ''))
            ->ascii()
            ->upper()
            ->replaceMatches('/[^A-Z0-9]+/', '_')
            ->trim('_')
            ->value();

        return preg_replace('/_+/', '_', $normalized) ?? '';
    }

    private function buildAutoCustomerCodeBase(?string $customerName): string
    {
        $normalizedName = $this->normalizeCodeFragment($customerName);
        if ($normalizedName === '') {
            return 'KHACH_HANG';
        }

        $prefixRules = [
            ['TRUNG_TAM_Y_TE', 'TTYT'],
            ['TTYT', 'TTYT'],
            ['BENH_VIEN_DA_KHOA', 'BVĐK'],
            ['TRAM_Y_TE', 'TYT'],
            ['PHONG_KHAM_DA_KHOA', 'PKDK'],
            ['PKDK', 'PKDK'],
            ['PHONG_KHAM', 'PK'],
            ['BENH_VIEN', 'BV'],
        ];

        foreach ($prefixRules as [$pattern, $prefix]) {
            if ($normalizedName === $pattern) {
                return $prefix;
            }

            $needle = $pattern.'_';
            if (str_starts_with($normalizedName, $needle)) {
                $tail = trim(substr($normalizedName, strlen($needle)), '_');

                return $tail !== '' ? $prefix.'_'.$tail : $prefix;
            }
        }

        return $normalizedName;
    }

    /**
     * @param array<string, bool> $usedCodes
     */
    private function resolveUniqueCustomerCode(string $baseCode, array &$usedCodes): string
    {
        $seed = $baseCode !== '' ? $baseCode : 'KHACH_HANG';
        $candidate = $seed;
        $counter = 1;

        while (isset($usedCodes[$this->normalizeCodeKey($candidate)])) {
            $counter += 1;
            $suffix = '_'.$counter;
            $prefixLength = 100 - mb_strlen($suffix, 'UTF-8');
            $candidate = mb_substr($seed, 0, max(1, $prefixLength), 'UTF-8').$suffix;
        }

        $usedCodes[$this->normalizeCodeKey($candidate)] = true;

        return $candidate;
    }
};
