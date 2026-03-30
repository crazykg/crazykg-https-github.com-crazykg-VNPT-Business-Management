<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const FACILITY_PUBLIC_HOSPITAL = 'PUBLIC_HOSPITAL';
    private const FACILITY_PRIVATE_HOSPITAL = 'PRIVATE_HOSPITAL';
    private const FACILITY_MEDICAL_CENTER = 'MEDICAL_CENTER';
    private const FACILITY_PRIVATE_CLINIC = 'PRIVATE_CLINIC';
    private const FACILITY_TYT_PKDK = 'TYT_PKDK';
    private const FACILITY_OTHER = 'OTHER';
    private const BED_CAPACITY_MIN = 100;
    private const BED_CAPACITY_MAX = 500;

    public function up(): void
    {
        if (
            ! Schema::hasTable('customers')
            || ! Schema::hasColumn('customers', 'bed_capacity')
        ) {
            return;
        }

        $hasUpdatedAt = Schema::hasColumn('customers', 'updated_at');
        $selectColumns = array_values(array_filter([
            'id',
            Schema::hasColumn('customers', 'customer_name') ? 'customer_name' : null,
            Schema::hasColumn('customers', 'company_name') ? 'company_name' : null,
            Schema::hasColumn('customers', 'customer_sector') ? 'customer_sector' : null,
            Schema::hasColumn('customers', 'healthcare_facility_type') ? 'healthcare_facility_type' : null,
            'bed_capacity',
        ]));

        DB::table('customers')
            ->select($selectColumns)
            ->whereNull('bed_capacity')
            ->orderBy('id')
            ->chunkById(100, function ($customers) use ($hasUpdatedAt): void {
                foreach ($customers as $customer) {
                    $facilityType = $this->resolveHealthcareFacilityType($customer);
                    if (! $this->supportsBedCapacity($facilityType)) {
                        continue;
                    }

                    $payload = [
                        'bed_capacity' => random_int(self::BED_CAPACITY_MIN, self::BED_CAPACITY_MAX),
                    ];

                    if ($hasUpdatedAt) {
                        $payload['updated_at'] = now();
                    }

                    DB::table('customers')
                        ->where('id', $customer->id)
                        ->update($payload);
                }
            }, 'id');
    }

    public function down(): void
    {
        // Giữ nguyên dữ liệu đã backfill.
    }

    private function resolveHealthcareFacilityType(object $customer): ?string
    {
        $explicit = strtoupper(trim((string) ($customer->healthcare_facility_type ?? '')));
        if (in_array($explicit, [
            self::FACILITY_PUBLIC_HOSPITAL,
            self::FACILITY_PRIVATE_HOSPITAL,
            self::FACILITY_MEDICAL_CENTER,
            self::FACILITY_PRIVATE_CLINIC,
            self::FACILITY_TYT_PKDK,
            self::FACILITY_OTHER,
        ], true)) {
            return $explicit;
        }

        return $this->inferHealthcareFacilityType(
            (string) ($customer->customer_name ?? $customer->company_name ?? '')
        );
    }

    private function supportsBedCapacity(?string $facilityType): bool
    {
        return in_array($facilityType, [
            self::FACILITY_PUBLIC_HOSPITAL,
            self::FACILITY_PRIVATE_HOSPITAL,
            self::FACILITY_MEDICAL_CENTER,
        ], true);
    }

    private function inferHealthcareFacilityType(?string $customerName): ?string
    {
        $normalizedText = $this->normalizeLookupText($customerName);
        $normalizedToken = str_replace(' ', '', $normalizedText);

        if ($normalizedText === '') {
            return null;
        }

        $hasPrivateMarker = str_contains($normalizedText, 'tu nhan')
            || str_contains($normalizedText, 'ngoai cong lap')
            || str_contains($normalizedText, 'private')
            || str_contains($normalizedText, 'quoc te')
            || str_contains($normalizedToken, 'tunhan')
            || str_contains($normalizedToken, 'ngoaiconglap')
            || str_contains($normalizedToken, 'private')
            || str_contains($normalizedToken, 'quocte');

        if (str_contains($normalizedText, 'benh vien') || str_contains($normalizedToken, 'benhvien')) {
            return $hasPrivateMarker
                ? self::FACILITY_PRIVATE_HOSPITAL
                : self::FACILITY_PUBLIC_HOSPITAL;
        }

        if (
            str_contains($normalizedText, 'trung tam y te')
            || str_contains($normalizedToken, 'trungtamyte')
            || str_contains($normalizedToken, 'ttyt')
        ) {
            return self::FACILITY_MEDICAL_CENTER;
        }

        if (
            str_contains($normalizedText, 'phong kham da khoa')
            || str_contains($normalizedText, 'pkdk')
            || str_contains($normalizedText, 'tram y te')
            || str_contains($normalizedToken, 'phongkhamdakhoa')
            || str_contains($normalizedToken, 'pkdk')
            || str_contains($normalizedToken, 'tramyte')
            || $normalizedToken === 'tyt'
        ) {
            return self::FACILITY_TYT_PKDK;
        }

        if (
            str_contains($normalizedText, 'phong kham')
            || str_contains($normalizedToken, 'phongkham')
            || str_contains($normalizedToken, 'clinic')
        ) {
            return self::FACILITY_PRIVATE_CLINIC;
        }

        return null;
    }

    private function normalizeLookupText(?string $value): string
    {
        $normalized = Str::of((string) ($value ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()
            ->value();

        return preg_replace('/\s+/', ' ', $normalized) ?? '';
    }
};
