<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const CUSTOMER_SECTOR_HEALTHCARE = 'HEALTHCARE';
    private const CUSTOMER_SECTOR_OTHER = 'OTHER';
    private const FACILITY_PUBLIC_HOSPITAL = 'PUBLIC_HOSPITAL';
    private const FACILITY_PRIVATE_HOSPITAL = 'PRIVATE_HOSPITAL';
    private const FACILITY_MEDICAL_CENTER = 'MEDICAL_CENTER';
    private const FACILITY_PRIVATE_CLINIC = 'PRIVATE_CLINIC';
    private const FACILITY_TYT_PKDK = 'TYT_PKDK';
    private const FACILITY_OTHER = 'OTHER';
    private const LEGACY_FACILITY_HOSPITAL_TTYT = 'HOSPITAL_TTYT';
    private const LEGACY_FACILITY_TYT_CLINIC = 'TYT_CLINIC';

    public function up(): void
    {
        $this->backfillHealthcareClassification();
        $this->seedHisNonBedTargetSegments();
    }

    public function down(): void
    {
        // Forward-only data backfill/seed.
    }

    private function backfillHealthcareClassification(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        $requiredColumns = ['customer_sector', 'healthcare_facility_type', 'bed_capacity'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('customers', $column)) {
                return;
            }
        }

        $hasUpdatedAt = Schema::hasColumn('customers', 'updated_at');
        $selectColumns = array_values(array_filter([
            'id',
            Schema::hasColumn('customers', 'customer_name') ? 'customer_name' : null,
            Schema::hasColumn('customers', 'company_name') ? 'company_name' : null,
            'customer_sector',
            'healthcare_facility_type',
            'bed_capacity',
        ]));

        DB::table('customers')
            ->select($selectColumns)
            ->orderBy('id')
            ->chunkById(100, function ($customers) use ($hasUpdatedAt): void {
                foreach ($customers as $customer) {
                    $customerName = trim((string) ($customer->customer_name ?? $customer->company_name ?? ''));
                    $customerSector = $this->resolveCustomerSector(
                        $this->normalizeNullableString($customer->customer_sector ?? null),
                        $customerName
                    );
                    $facilityType = $customerSector === self::CUSTOMER_SECTOR_HEALTHCARE
                        ? $this->resolveHealthcareFacilityType(
                            $this->normalizeNullableString($customer->healthcare_facility_type ?? null),
                            $customerName
                        )
                        : null;
                    $bedCapacity = is_numeric($customer->bed_capacity ?? null)
                        ? max(0, (int) $customer->bed_capacity)
                        : null;

                    if (! $this->supportsBedCapacity($facilityType)) {
                        $bedCapacity = null;
                    }

                    $payload = [];
                    if (($customer->customer_sector ?? null) !== $customerSector) {
                        $payload['customer_sector'] = $customerSector;
                    }
                    if (($customer->healthcare_facility_type ?? null) !== $facilityType) {
                        $payload['healthcare_facility_type'] = $facilityType;
                    }
                    if (($customer->bed_capacity ?? null) !== $bedCapacity) {
                        $payload['bed_capacity'] = $bedCapacity;
                    }

                    if ($payload === []) {
                        continue;
                    }

                    if ($hasUpdatedAt) {
                        $payload['updated_at'] = now();
                    }

                    DB::table('customers')
                        ->where('id', $customer->id)
                        ->update($payload);
                }
            }, 'id');
    }

    private function seedHisNonBedTargetSegments(): void
    {
        if (! Schema::hasTable('products') || ! Schema::hasTable('product_target_segments')) {
            return;
        }

        $hasDeletedProducts = Schema::hasColumn('products', 'deleted_at');
        $hasUuid = Schema::hasColumn('product_target_segments', 'uuid');
        $hasCreatedAt = Schema::hasColumn('product_target_segments', 'created_at');
        $hasUpdatedAt = Schema::hasColumn('product_target_segments', 'updated_at');

        $products = DB::table('products')
            ->select(['id', 'product_code'])
            ->when($hasDeletedProducts, fn ($query) => $query->whereNull('deleted_at'))
            ->where(function ($query): void {
                $query->where('product_code', 'LIKE', '%HIS KG%')
                    ->orWhere('product_code', 'LIKE', '%HIS_KG%')
                    ->orWhere('product_code', 'LIKE', '%HIS-KG%');
            })
            ->orderBy('id')
            ->get();

        foreach ($products as $product) {
            $exists = DB::table('product_target_segments')
                ->where('product_id', $product->id)
                ->where('customer_sector', self::CUSTOMER_SECTOR_HEALTHCARE)
                ->where('facility_type', self::FACILITY_TYT_PKDK)
                ->whereNull('bed_capacity_min')
                ->whereNull('bed_capacity_max')
                ->whereNull('deleted_at')
                ->exists();

            if ($exists) {
                continue;
            }

            $payload = [
                'product_id' => $product->id,
                'customer_sector' => self::CUSTOMER_SECTOR_HEALTHCARE,
                'facility_type' => self::FACILITY_TYT_PKDK,
                'bed_capacity_min' => null,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.',
                'is_active' => true,
                'deleted_at' => null,
            ];

            if ($hasUuid) {
                $payload['uuid'] = (string) Str::uuid();
            }
            if ($hasCreatedAt) {
                $payload['created_at'] = now();
            }
            if ($hasUpdatedAt) {
                $payload['updated_at'] = now();
            }

            DB::table('product_target_segments')->insert($payload);
        }
    }

    private function resolveCustomerSector(?string $value, ?string $customerName): string
    {
        $normalized = strtoupper(trim((string) ($value ?? '')));

        if (in_array($normalized, ['HEALTHCARE', 'GOVERNMENT', 'INDIVIDUAL'], true)) {
            return $normalized;
        }

        $inferred = $this->inferCustomerSector($customerName);

        return $inferred ?? self::CUSTOMER_SECTOR_OTHER;
    }

    private function resolveHealthcareFacilityType(?string $value, ?string $customerName): ?string
    {
        $normalized = strtoupper(trim((string) ($value ?? '')));
        $inferred = $this->inferHealthcareFacilityType($customerName);

        return match ($normalized) {
            self::FACILITY_PUBLIC_HOSPITAL => self::FACILITY_PUBLIC_HOSPITAL,
            self::FACILITY_PRIVATE_HOSPITAL => self::FACILITY_PRIVATE_HOSPITAL,
            self::FACILITY_MEDICAL_CENTER => self::FACILITY_MEDICAL_CENTER,
            self::FACILITY_PRIVATE_CLINIC => self::FACILITY_PRIVATE_CLINIC,
            self::FACILITY_TYT_PKDK => self::FACILITY_TYT_PKDK,
            self::FACILITY_OTHER => self::FACILITY_OTHER,
            self::LEGACY_FACILITY_HOSPITAL_TTYT => $inferred ?? self::FACILITY_PUBLIC_HOSPITAL,
            self::LEGACY_FACILITY_TYT_CLINIC => $inferred ?? self::FACILITY_TYT_PKDK,
            default => $inferred,
        };
    }

    private function inferCustomerSector(?string $customerName): ?string
    {
        $normalized = $this->normalizeLookupText($customerName);
        if ($normalized === '') {
            return null;
        }

        foreach (['benh vien', 'trung tam y te', 'tram y te', 'phong kham', 'pkdk'] as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return self::CUSTOMER_SECTOR_HEALTHCARE;
            }
        }

        return null;
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

    private function supportsBedCapacity(?string $facilityType): bool
    {
        return in_array($facilityType, [
            self::FACILITY_PUBLIC_HOSPITAL,
            self::FACILITY_PRIVATE_HOSPITAL,
            self::FACILITY_MEDICAL_CENTER,
        ], true);
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized === '' ? null : $normalized;
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
