<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * CustomerInsightService
 *
 * Builds a "Customer 360" insight payload for a given customer:
 *   - contracts_summary
 *   - services_used
 *   - opportunities_summary
 *   - crc_summary
 *   - upsell_candidates
 */
class CustomerInsightService
{
    public const CACHE_VERSION = 'v2';

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
    private const OPEN_CRC_STATUSES = [
        'new_intake',
        'analysis',
        'in_progress',
        'coding',
        'dms_transfer',
        'waiting_customer_feedback',
        'returned_to_manager',
    ];

    private const ACTIVE_CONTRACT_STATUSES = ['SIGNED', 'RENEWED'];
    private const TOTAL_LIMIT = 12;
    private const TARGETED_LIMIT = 10;
    private const REFERENCE_LIMIT = 5;

    private const SERVICE_GROUP_LABELS = [
        'GROUP_A' => 'Dịch vụ nhóm A',
        'GROUP_B' => 'Dịch vụ nhóm B',
        'GROUP_C' => 'Dịch vụ nhóm C',
    ];

    private const CUSTOMER_SECTOR_LABELS = [
        'HEALTHCARE' => 'Y tế',
        'GOVERNMENT' => 'Chính quyền',
        'INDIVIDUAL' => 'Cá nhân',
        'OTHER' => 'Khác',
    ];

    private const FACILITY_TYPE_LABELS = [
        'PUBLIC_HOSPITAL' => 'Bệnh viện công lập',
        'PRIVATE_HOSPITAL' => 'Bệnh viện tư nhân',
        'MEDICAL_CENTER' => 'Trung tâm y tế',
        'PRIVATE_CLINIC' => 'Phòng khám tư nhân',
        'TYT_PKDK' => 'TYT và PKĐK',
        'HOSPITAL_TTYT' => 'Bệnh viện / TTYT',
        'TYT_CLINIC' => 'Trạm y tế / Phòng khám',
        'OTHER' => 'Khác',
    ];

    private const DISPLAY_TEXT_REPLACEMENTS = [
        'Phan mem Benh an dien tu' => 'Phần mềm Bệnh án điện tử',
        'Phan mem VNPT-HIS khong giuong' => 'Phần mềm VNPT-HIS không giường',
        'Dich vu nhom A' => 'Dịch vụ nhóm A',
        'Dich vu nhom B' => 'Dịch vụ nhóm B',
        'Dich vu nhom C' => 'Dịch vụ nhóm C',
        'De xuat phu hop' => 'Đề xuất phù hợp',
        'San pham pho bien' => 'Sản phẩm phổ biến',
        'San pham dang su dung' => 'Sản phẩm đang sử dụng',
        'Giai phap quan ly benh vien.' => 'Giải pháp quản lý bệnh viện.',
        'Giai phap pho bien.' => 'Giải pháp phổ biến.',
        'Den 10 giuong benh' => 'Đến 10 giường bệnh',
        'So luong luot kham toi da thang < 1500' => 'Số lượng lượt khám tối đa/tháng < 1500',
        'Benh an dien tu phu hop co so y te tu 100 giuong tro len.' => 'Bệnh án điện tử phù hợp cơ sở y tế từ 100 giường trở lên.',
        'Phu hop benh vien cong lap quy mo lon, nhan manh tich hop BHYT.' => 'Phù hợp bệnh viện công lập quy mô lớn, nhấn mạnh tích hợp BHYT.',
        'Gon nhe cho phong kham tu nhan, de trien khai nhanh.' => 'Gọn nhẹ cho phòng khám tư nhân, dễ triển khai nhanh.',
        'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.' => 'Phù hợp TYT và PKĐK không có giường, nhấn mạnh quy trình tiếp đón và lượt khám.',
        'HIS khong giuong cho TYT va PKDK' => 'HIS không giường cho TYT và PKĐK',
        'Kham benh' => 'Khám bệnh',
        'Dang ky kham' => 'Đăng ký khám',
        'Tiep nhan benh nhan' => 'Tiếp nhận bệnh nhân',
        'Cham soc KH' => 'Chăm sóc khách hàng',
        'Lich su tuong tac' => 'Lịch sử tương tác',
        'Theo doi lien he' => 'Theo dõi liên hệ',
    ];

    /**
     * @var array<string, float>|null
     */
    private ?array $vatRateMap = null;

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function invalidateCache(int $customerId): void
    {
        $this->invalidateCustomerCaches($customerId);
    }

    public function invalidateCustomerCaches(int $customerId): void
    {
        Cache::forget("v5:customer-insight:{$customerId}:" . self::CACHE_VERSION);
        $this->redisScanDelete($this->cachePattern("v5:customer-insight:{$customerId}:pd:*:" . self::CACHE_VERSION));
    }

    public function invalidateProductDetailCaches(int $productId): void
    {
        $this->redisScanDelete($this->cachePattern("v5:customer-insight:*:pd:{$productId}:" . self::CACHE_VERSION));
    }

    public function invalidateAllInsightCaches(): void
    {
        $this->redisScanDelete($this->cachePattern('v5:customer-insight:*'));
    }

    public function buildInsight(int $customerId): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customerQuery = DB::table('customers')->where('id', $customerId);
        if ($this->support->hasColumn('customers', 'deleted_at')) {
            $customerQuery->whereNull('deleted_at');
        }

        $customer = $customerQuery->first();

        if (! $customer) {
            return response()->json(['message' => 'Khong tim thay khach hang.'], 404);
        }

        return response()->json([
            'data' => [
                'customer' => $customer,
                'contracts_summary' => $this->buildContractsSummary($customerId),
                'services_used' => $this->buildServicesUsed($customerId),
                'opportunities_summary' => $this->buildOpportunitiesSummary($customerId),
                'crc_summary' => $this->buildCrcSummary($customerId),
                'upsell_candidates' => $this->buildUpsellCandidates($customerId),
            ],
        ]);
    }

    public function buildUpsellProductDetail(int $customerId, int $productId): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $productSelects = [
            'id',
            'product_code',
            'product_name',
            'standard_price',
            'unit',
            'service_group',
        ];

        $productQuery = DB::table('products')
            ->select($this->support->selectColumns('products', $productSelects))
            ->where('id', $productId);

        if ($this->support->hasColumn('products', 'description')) {
            $productQuery->addSelect('description');
        }
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $productQuery->whereNull('deleted_at');
        }

        $product = $productQuery->first();
        if (! $product) {
            return response()->json(['message' => 'Khong tim thay san pham.'], 404);
        }

        $customer = $this->loadCustomerSegmentProfile($customerId);
        $customerProfile = $this->buildResolvedCustomerProfile($customer);
        $featureGroups = $this->buildUpsellFeatureGroups($productId);
        $sectorCustomers = $this->buildDetailedSectorCustomers($customerId, $productId, $customer, $customerProfile);
        $segmentMatch = $this->findMatchingSegment($productId, $customerProfile);

        return response()->json([
            'data' => [
                'product' => [
                    'id' => $product->id,
                    'product_code' => (string) ($product->product_code ?? ''),
                    'product_name' => $this->localizeDisplayText((string) ($product->product_name ?? '')) ?? '',
                    'description' => $this->support->hasColumn('products', 'description')
                        ? $this->localizeDisplayText($this->support->normalizeNullableString($product->description ?? null))
                        : null,
                    'standard_price' => (float) ($product->standard_price ?? 0),
                    'unit' => $this->support->normalizeNullableString($product->unit ?? null),
                    'service_group' => $this->support->normalizeNullableString($product->service_group ?? null),
                ],
                'feature_groups' => $featureGroups,
                'sector_customers' => $sectorCustomers,
                'segment_match' => $segmentMatch,
            ],
        ]);
    }

    private function buildContractsSummary(int $customerId): array
    {
        if (! $this->support->hasTable('contracts')
            || ! $this->support->hasColumn('contracts', 'customer_id')) {
            return $this->emptyContractsSummary();
        }

        $hasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $hasItems = $this->support->hasTable('contract_items');
        $hasProducts = $this->support->hasTable('products');
        $hasBusinessDomains = $this->support->hasTable('business_domains');

        if ($hasItems && $hasProducts) {
            $vatMap = $hasBusinessDomains ? $this->resolveVatRateMap() : [];

            $rows = DB::table('contracts as c')
                ->leftJoin('contract_items as ci', 'ci.contract_id', '=', 'c.id')
                ->leftJoin('products as p', 'p.id', '=', 'ci.product_id')
                ->when($hasSoftDelete, fn (Builder $query) => $query->whereNull('c.deleted_at'))
                ->where('c.customer_id', $customerId)
                ->groupBy('c.id', 'c.status', 'p.domain_id')
                ->select(
                    'c.id as contract_id',
                    'c.status',
                    'p.domain_id',
                    DB::raw('COALESCE(SUM(ci.unit_price * ci.quantity), 0) as raw_val')
                )
                ->get();

            $contractSums = [];
            foreach ($rows as $row) {
                $multiplier = $vatMap[(string) ($row->domain_id ?? '')] ?? 1.00;
                $value = (float) ($row->raw_val ?? 0) * $multiplier;

                if (! isset($contractSums[$row->contract_id])) {
                    $contractSums[$row->contract_id] = [
                        'status' => (string) ($row->status ?? ''),
                        'value' => 0.0,
                    ];
                }

                $contractSums[$row->contract_id]['value'] += $value;
            }

            $grouped = [];
            foreach ($contractSums as $contract) {
                $status = (string) ($contract['status'] ?? '');
                $grouped[$status]['cnt'] = ($grouped[$status]['cnt'] ?? 0) + 1;
                $grouped[$status]['total'] = ($grouped[$status]['total'] ?? 0.0) + (float) ($contract['value'] ?? 0);
            }

            return $this->formatContractsSummaryRows($grouped);
        }

        $rows = DB::table('contracts')
            ->when($hasSoftDelete, fn (Builder $query) => $query->whereNull('deleted_at'))
            ->where('customer_id', $customerId)
            ->select(
                'status',
                DB::raw('COUNT(*) as cnt'),
                DB::raw('COALESCE(SUM(total_value), 0) as total_val')
            )
            ->groupBy('status')
            ->get();

        $grouped = [];
        foreach ($rows as $row) {
            $status = (string) ($row->status ?? '');
            $grouped[$status] = [
                'cnt' => (int) ($row->cnt ?? 0),
                'total' => (float) ($row->total_val ?? 0),
            ];
        }

        return $this->formatContractsSummaryRows($grouped);
    }

    private function buildServicesUsed(int $customerId): array
    {
        if (! $this->support->hasTable('contracts')
            || ! $this->support->hasTable('contract_items')
            || ! $this->support->hasTable('products')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $productHasSoftDelete = $this->support->hasColumn('products', 'deleted_at');
        $hasBusinessDomains = $this->support->hasTable('business_domains');
        $vatMap = $hasBusinessDomains ? $this->resolveVatRateMap() : [];

        $rows = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('products as p', 'p.id', '=', 'ci.product_id')
            ->when($contractHasSoftDelete, fn (Builder $query) => $query->whereNull('c.deleted_at'))
            ->when($productHasSoftDelete, fn (Builder $query) => $query->whereNull('p.deleted_at'))
            ->where('c.customer_id', $customerId)
            ->groupBy('p.id', 'p.product_name', 'p.unit', 'p.service_group', 'p.domain_id')
            ->select(
                'p.id as product_id',
                'p.product_name',
                'p.unit',
                'p.service_group',
                'p.domain_id',
                DB::raw('COUNT(DISTINCT ci.contract_id) as contract_count'),
                DB::raw('SUM(ci.unit_price * ci.quantity) as raw_value')
            )
            ->orderByDesc('raw_value')
            ->get();

        return $rows->map(function (object $row) use ($vatMap): array {
            $multiplier = $vatMap[(string) ($row->domain_id ?? '')] ?? 1.00;

            return [
                'product_id' => $row->product_id,
                'product_name' => (string) ($row->product_name ?? ''),
                'unit' => $this->support->normalizeNullableString($row->unit ?? null),
                'service_group' => $this->support->normalizeNullableString($row->service_group ?? null),
                'contract_count' => (int) ($row->contract_count ?? 0),
                'total_value' => (float) ($row->raw_value ?? 0) * $multiplier,
            ];
        })->toArray();
    }

    private function buildOpportunitiesSummary(int $customerId): array
    {
        if (! $this->support->hasTable('opportunities')
            || ! $this->support->hasColumn('opportunities', 'customer_id')) {
            return $this->emptyOpportunitiesSummary();
        }

        $rows = DB::table('opportunities')
            ->when(
                $this->support->hasColumn('opportunities', 'deleted_at'),
                fn (Builder $query) => $query->whereNull('deleted_at')
            )
            ->where('customer_id', $customerId)
            ->select(
                'stage',
                DB::raw('COUNT(*) as cnt'),
                DB::raw('SUM(expected_value) as total_amt')
            )
            ->groupBy('stage')
            ->get();

        $totalCount = 0;
        $totalAmount = 0.0;
        $byStage = [];

        foreach ($rows as $row) {
            $count = (int) ($row->cnt ?? 0);
            $amount = (float) ($row->total_amt ?? 0);
            $totalCount += $count;
            $totalAmount += $amount;
            $byStage[(string) ($row->stage ?? '')] = [
                'count' => $count,
                'amount' => $amount,
            ];
        }

        return [
            'total_count' => $totalCount,
            'total_amount' => $totalAmount,
            'by_stage' => $byStage,
        ];
    }

    private function buildCrcSummary(int $customerId): array
    {
        if (! $this->support->hasTable('customer_request_cases')
            || ! $this->support->hasColumn('customer_request_cases', 'customer_id')) {
            return $this->emptyCrcSummary();
        }

        $rows = DB::table('customer_request_cases')
            ->when(
                $this->support->hasColumn('customer_request_cases', 'deleted_at'),
                fn (Builder $query) => $query->whereNull('deleted_at')
            )
            ->where('customer_id', $customerId)
            ->select(
                'current_status_code',
                DB::raw('COUNT(*) as cnt')
            )
            ->groupBy('current_status_code')
            ->get();

        $totalCases = 0;
        $openCases = 0;
        $byStatus = [];

        foreach ($rows as $row) {
            $count = (int) ($row->cnt ?? 0);
            $status = (string) ($row->current_status_code ?? '');
            $totalCases += $count;
            $byStatus[$status] = $count;

            if (in_array($status, self::OPEN_CRC_STATUSES, true)) {
                $openCases += $count;
            }
        }

        return [
            'total_cases' => $totalCases,
            'open_cases' => $openCases,
            'by_status' => $byStatus,
        ];
    }

    private function buildUpsellCandidates(int $customerId): array
    {
        if (! $this->support->hasTable('products')
            || ! $this->support->hasTable('contract_items')
            || ! $this->support->hasTable('contracts')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $productHasSoftDelete = $this->support->hasColumn('products', 'deleted_at');
        $customer = $this->loadCustomerSegmentProfile($customerId);
        $customerProfile = $this->buildResolvedCustomerProfile($customer);

        $usedRows = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('products as p', 'p.id', '=', 'ci.product_id')
            ->when($contractHasSoftDelete, fn (Builder $query) => $query->whereNull('c.deleted_at'))
            ->when($productHasSoftDelete, fn (Builder $query) => $query->whereNull('p.deleted_at'))
            ->where('c.customer_id', $customerId)
            ->select('ci.product_id', 'p.product_code', 'p.product_name')
            ->get();

        $usedProductIds = $usedRows->pluck('product_id')->map(fn (mixed $id): int => (int) $id)->unique()->values()->all();
        $hasHisProduct = $usedRows->contains(function (object $row): bool {
            return str_contains(strtoupper((string) ($row->product_code ?? '')), 'HIS')
                || str_contains(strtoupper((string) ($row->product_name ?? '')), 'HIS');
        });

        $popularitySubquery = $this->buildPopularitySubquery($customerId, $contractHasSoftDelete);

        $targetedCandidates = collect();
        $winnerSegments = $this->buildWinnerSegmentsSubquery($customerProfile);
        if ($winnerSegments !== null) {
            $targetedQuery = $this->buildUpsellProductBaseQuery($popularitySubquery)
                ->joinSub($winnerSegments, 'winner', fn ($join) => $join->on('winner.product_id', '=', 'p.id'))
                ->addSelect(
                    'winner.segment_priority',
                    'winner.sales_notes'
                )
                ->orderBy('winner.segment_priority')
                ->orderByDesc('popularity')
                ->limit(self::TARGETED_LIMIT);

            $this->applyUpsellExclusions($targetedQuery, $usedProductIds, $hasHisProduct, $customerProfile);
            $targetedCandidates = $targetedQuery->get();
        }

        $popularLimit = max(0, self::TOTAL_LIMIT - $targetedCandidates->count());
        $popularCandidates = collect();
        if ($popularLimit > 0) {
            $excludeIds = array_values(array_unique(array_merge(
                $usedProductIds,
                $targetedCandidates->pluck('product_id')->map(fn (mixed $id): int => (int) $id)->all()
            )));

            $popularQuery = $this->buildUpsellProductBaseQuery($popularitySubquery)
                ->selectRaw('NULL as segment_priority')
                ->selectRaw('NULL as sales_notes')
                ->whereRaw('COALESCE(pop.pop_count, 0) > 0')
                ->orderByDesc('popularity')
                ->orderBy('p.id')
                ->limit($popularLimit);

            $this->applyUpsellExclusions($popularQuery, $excludeIds, $hasHisProduct, $customerProfile);
            $popularCandidates = $popularQuery->get();
        }

        $allCandidateIds = $targetedCandidates
            ->pluck('product_id')
            ->merge($popularCandidates->pluck('product_id'))
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $referenceMap = $this->buildSectorPrioritizedReferences($customerId, $allCandidateIds, $customer, $customerProfile);

        $results = [];
        foreach ($targetedCandidates as $candidate) {
            $results[] = $this->formatUpsellCandidate($candidate, $referenceMap, 'targeted');
        }
        foreach ($popularCandidates as $candidate) {
            $results[] = $this->formatUpsellCandidate($candidate, $referenceMap, 'popular');
        }

        return $results;
    }

    private function buildUpsellFeatureGroups(int $productId): array
    {
        $hasFeatureGroupsTable = $this->support->hasTable('product_feature_groups');
        $hasFeaturesTable = $this->support->hasTable('product_features');

        if (! $hasFeatureGroupsTable) {
            return [];
        }

        $catalogProductIds = $this->resolveCatalogProductIds($productId);
        $groupQuery = DB::table('product_feature_groups')
            ->whereIn('product_id', $catalogProductIds)
            ->orderBy('display_order')
            ->orderBy('id');

        if ($this->support->hasColumn('product_feature_groups', 'deleted_at')) {
            $groupQuery->whereNull('deleted_at');
        }

        $groups = $groupQuery
            ->select($this->support->selectColumns('product_feature_groups', ['id', 'group_name']))
            ->get();

        if ($groups->isEmpty()) {
            return [];
        }

        $featuresByGroup = [];
        if ($hasFeaturesTable) {
            $featureQuery = DB::table('product_features')
                ->whereIn('group_id', $groups->pluck('id')->all())
                ->orderBy('display_order')
                ->orderBy('id');

            if ($this->support->hasColumn('product_features', 'deleted_at')) {
                $featureQuery->whereNull('deleted_at');
            }
            if ($this->support->hasColumn('product_features', 'status')) {
                $featureQuery->where('status', 'ACTIVE');
            }

            $featureRows = $featureQuery
                ->select($this->support->selectColumns('product_features', ['group_id', 'feature_name', 'detail_description']))
                ->get();

            foreach ($featureRows as $feature) {
                $groupId = (string) ($feature->group_id ?? '');
                if ($groupId === '') {
                    continue;
                }

                $featuresByGroup[$groupId][] = [
                    'feature_name' => $this->localizeDisplayText((string) ($feature->feature_name ?? '')) ?? '',
                    'detail_description' => $this->localizeDisplayText(
                        $this->support->normalizeNullableString($feature->detail_description ?? null)
                    ),
                ];
            }
        }

        return $groups->map(function (object $group) use ($featuresByGroup): array {
            return [
                'id' => $group->id,
                'group_name' => $this->localizeDisplayText((string) ($group->group_name ?? '')) ?? '',
                'features' => $featuresByGroup[(string) $group->id] ?? [],
            ];
        })->toArray();
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function buildDetailedSectorCustomers(int $customerId, int $productId, ?object $customer, ?array $customerProfile = null): array
    {
        if (! $this->support->hasTable('customers')
            || ! $this->support->hasTable('contracts')
            || ! $this->support->hasTable('contract_items')
            || ! $this->support->hasColumn('customers', 'customer_name')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $customerHasSoftDelete = $this->support->hasColumn('customers', 'deleted_at');
        $hasSectorColumn = $this->support->hasColumn('customers', 'customer_sector');
        $hasFacilityColumn = $this->support->hasColumn('customers', 'healthcare_facility_type');

        $selects = [
            'cu.id as customer_id',
            'cu.customer_name',
            DB::raw('COUNT(DISTINCT c.id) as contract_count'),
            DB::raw('COALESCE(SUM(ci.unit_price * ci.quantity), 0) as total_value'),
        ];
        if ($hasSectorColumn) {
            $selects[] = 'cu.customer_sector';
        }
        if ($hasFacilityColumn) {
            $selects[] = 'cu.healthcare_facility_type';
        }

        $rows = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('customers as cu', 'cu.id', '=', 'c.customer_id')
            ->when($contractHasSoftDelete, fn (Builder $query) => $query->whereNull('c.deleted_at'))
            ->when($customerHasSoftDelete, fn (Builder $query) => $query->whereNull('cu.deleted_at'))
            ->where('ci.product_id', $productId)
            ->where('c.customer_id', '!=', $customerId)
            ->groupBy(...array_filter([
                'cu.id',
                'cu.customer_name',
                $hasSectorColumn ? 'cu.customer_sector' : null,
                $hasFacilityColumn ? 'cu.healthcare_facility_type' : null,
            ]))
            ->select($selects)
            ->get();

        return $this->sortRelatedCustomers($rows->map(function (object $row): array {
            return [
                'customer_name' => (string) ($row->customer_name ?? ''),
                'customer_sector' => $this->support->normalizeNullableString($row->customer_sector ?? null),
                'healthcare_facility_type' => $this->support->normalizeNullableString($row->healthcare_facility_type ?? null),
                'is_same_type' => false,
                'contract_count' => (int) ($row->contract_count ?? 0),
                'total_value' => (float) ($row->total_value ?? 0),
            ];
        })->all(), $customerProfile ?? $this->buildResolvedCustomerProfile($customer), true);
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function buildSectorPrioritizedReferences(int $customerId, array $candidateIds, ?object $customer, ?array $customerProfile = null): array
    {
        if ($candidateIds === []
            || ! $this->support->hasTable('customers')
            || ! $this->support->hasTable('contracts')
            || ! $this->support->hasTable('contract_items')
            || ! $this->support->hasColumn('customers', 'customer_name')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $customerHasSoftDelete = $this->support->hasColumn('customers', 'deleted_at');
        $hasSectorColumn = $this->support->hasColumn('customers', 'customer_sector');
        $hasFacilityColumn = $this->support->hasColumn('customers', 'healthcare_facility_type');

        $selects = [
            'ci.product_id',
            'cu.id as customer_id',
            'cu.customer_name',
        ];
        if ($hasSectorColumn) {
            $selects[] = 'cu.customer_sector';
        }
        if ($hasFacilityColumn) {
            $selects[] = 'cu.healthcare_facility_type';
        }

        $rows = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('customers as cu', 'cu.id', '=', 'c.customer_id')
            ->when($contractHasSoftDelete, fn (Builder $query) => $query->whereNull('c.deleted_at'))
            ->when($customerHasSoftDelete, fn (Builder $query) => $query->whereNull('cu.deleted_at'))
            ->whereIn('ci.product_id', $candidateIds)
            ->where('c.customer_id', '!=', $customerId)
            ->select($selects)
            ->distinct()
            ->get();

        $referenceMap = [];
        foreach ($rows->groupBy('product_id') as $productId => $productRows) {
            $sorted = $this->sortRelatedCustomers($productRows->map(function (object $row): array {
                return [
                    'customer_name' => (string) ($row->customer_name ?? ''),
                    'customer_sector' => $this->support->normalizeNullableString($row->customer_sector ?? null),
                    'healthcare_facility_type' => $this->support->normalizeNullableString($row->healthcare_facility_type ?? null),
                    'is_same_type' => false,
                ];
            })->all(), $customerProfile ?? $this->buildResolvedCustomerProfile($customer), false);

            $referenceMap[(string) $productId] = array_slice($sorted, 0, self::REFERENCE_LIMIT);
        }

        return $referenceMap;
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function sortRelatedCustomers(array $rows, ?array $customerProfile, bool $keepMetrics): array
    {
        $currentSector = strtoupper(trim((string) ($customerProfile['customer_sector'] ?? '')));
        $currentFacility = strtoupper(trim((string) ($customerProfile['healthcare_facility_type'] ?? '')));

        foreach ($rows as &$row) {
            $resolvedRow = $this->buildResolvedCustomerProfile((object) $row);
            $row['customer_sector'] = $resolvedRow['customer_sector'] ?? $row['customer_sector'] ?? null;
            $row['healthcare_facility_type'] = $resolvedRow['healthcare_facility_type'] ?? $row['healthcare_facility_type'] ?? null;

            $rowSector = strtoupper(trim((string) ($row['customer_sector'] ?? '')));
            $rowFacility = strtoupper(trim((string) ($row['healthcare_facility_type'] ?? '')));

            $sameSector = $currentSector !== '' && $rowSector !== '' && $currentSector === $rowSector;
            $sameType = $sameSector;
            if ($sameType && $currentSector === self::CUSTOMER_SECTOR_HEALTHCARE && $currentFacility !== '') {
                $sameType = $rowFacility !== '' && $rowFacility === $currentFacility;
            } elseif ($currentSector === self::CUSTOMER_SECTOR_HEALTHCARE && $currentFacility === '') {
                $sameType = false;
            }

            $row['is_same_type'] = $sameType;
            $row['_same_sector'] = $sameSector;
        }
        unset($row);

        usort($rows, function (array $left, array $right): int {
            $leftSameType = $left['is_same_type'] ? 1 : 0;
            $rightSameType = $right['is_same_type'] ? 1 : 0;
            if ($leftSameType !== $rightSameType) {
                return $rightSameType <=> $leftSameType;
            }

            $leftSameSector = $left['_same_sector'] ? 1 : 0;
            $rightSameSector = $right['_same_sector'] ? 1 : 0;
            if ($leftSameSector !== $rightSameSector) {
                return $rightSameSector <=> $leftSameSector;
            }

            $leftValue = (float) ($left['total_value'] ?? 0);
            $rightValue = (float) ($right['total_value'] ?? 0);
            if ($leftValue !== $rightValue) {
                return $rightValue <=> $leftValue;
            }

            $leftContracts = (int) ($left['contract_count'] ?? 0);
            $rightContracts = (int) ($right['contract_count'] ?? 0);
            if ($leftContracts !== $rightContracts) {
                return $rightContracts <=> $leftContracts;
            }

            return strcasecmp((string) ($left['customer_name'] ?? ''), (string) ($right['customer_name'] ?? ''));
        });

        return array_map(function (array $row) use ($keepMetrics): array {
            $result = [
                'customer_name' => (string) ($row['customer_name'] ?? ''),
                'customer_sector' => $this->support->normalizeNullableString($row['customer_sector'] ?? null),
                'healthcare_facility_type' => $this->support->normalizeNullableString($row['healthcare_facility_type'] ?? null),
                'is_same_type' => (bool) ($row['is_same_type'] ?? false),
            ];

            if ($keepMetrics) {
                $result['contract_count'] = (int) ($row['contract_count'] ?? 0);
                $result['total_value'] = (float) ($row['total_value'] ?? 0);
            }

            return $result;
        }, $rows);
    }

    private function formatUpsellCandidate(object $row, array $referenceMap, string $recommendationType): array
    {
        $group = $this->support->normalizeNullableString($row->service_group ?? null);
        $label = self::SERVICE_GROUP_LABELS[$group ?? ''] ?? 'Sản phẩm phổ biến';
        $similarCustomers = $referenceMap[(string) ($row->product_id ?? '')] ?? [];

        return [
            'product_id' => $row->product_id,
            'product_code' => (string) ($row->product_code ?? ''),
            'product_name' => $this->localizeDisplayText((string) ($row->product_name ?? '')) ?? '',
            'product_description' => $this->localizeDisplayText(
                $this->support->normalizeNullableString($row->product_description ?? null)
            ),
            'standard_price' => (float) ($row->standard_price ?? 0),
            'unit' => $this->support->normalizeNullableString($row->unit ?? null),
            'service_group' => $group,
            'service_group_label' => $label,
            'reason' => $recommendationType === 'targeted' ? 'Đề xuất phù hợp' : $label,
            'popularity' => (int) ($row->popularity ?? 0),
            'is_priority' => $group === 'GROUP_A',
            'recommendation_type' => $recommendationType,
            'segment_priority' => $row->segment_priority !== null ? (int) $row->segment_priority : null,
            'sales_notes' => $this->localizeDisplayText($this->support->normalizeNullableString($row->sales_notes ?? null)),
            'similar_customers' => $similarCustomers,
            'reference_customers' => array_values(array_map(
                static fn (array $customer): string => (string) ($customer['customer_name'] ?? ''),
                $similarCustomers
            )),
        ];
    }

    private function buildPopularitySubquery(int $customerId, bool $contractHasSoftDelete): Builder
    {
        $query = DB::table('contract_items as ci2')
            ->join('contracts as c2', 'c2.id', '=', 'ci2.contract_id')
            ->when($contractHasSoftDelete, fn (Builder $query) => $query->whereNull('c2.deleted_at'))
            ->where('c2.customer_id', '!=', $customerId)
            ->select(
                'ci2.product_id',
                DB::raw('COUNT(DISTINCT c2.customer_id) as pop_count')
            )
            ->groupBy('ci2.product_id');

        if ($this->support->hasColumn('contracts', 'status')) {
            $query->whereIn('c2.status', self::ACTIVE_CONTRACT_STATUSES);
        }

        return $query;
    }

    private function buildUpsellProductBaseQuery(Builder $popularitySubquery): Builder
    {
        $productHasSoftDelete = $this->support->hasColumn('products', 'deleted_at');
        $hasDescription = $this->support->hasColumn('products', 'description');

        $query = DB::table('products as p')
            ->leftJoinSub($popularitySubquery, 'pop', 'pop.product_id', '=', 'p.id')
            ->when($productHasSoftDelete, fn (Builder $builder) => $builder->whereNull('p.deleted_at'))
            ->where('p.is_active', true)
            ->select(
                'p.id as product_id',
                'p.product_code',
                'p.product_name',
                'p.standard_price',
                'p.unit',
                'p.service_group',
                DB::raw('COALESCE(pop.pop_count, 0) as popularity')
            );

        if ($hasDescription) {
            $query->addSelect('p.description as product_description');
        } else {
            $query->selectRaw('NULL as product_description');
        }

        return $query;
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function applyUpsellExclusions(
        Builder $query,
        array $excludeProductIds,
        bool $hasHisProduct,
        ?array $customerProfile = null
    ): void
    {
        if ($excludeProductIds !== []) {
            $query->whereNotIn('p.id', $excludeProductIds);
        }

        if ($hasHisProduct) {
            $query->where(function (Builder $builder): void {
                $builder->where('p.product_code', 'NOT LIKE', '%HIS%')
                    ->where('p.product_name', 'NOT LIKE', '%HIS%');
            });

            return;
        }

        if ($this->shouldPreferNonBedHis($customerProfile)) {
            $query->where(function (Builder $builder): void {
                $builder->where(function (Builder $nonHis): void {
                    $nonHis->where('p.product_code', 'NOT LIKE', '%HIS%')
                        ->where('p.product_name', 'NOT LIKE', '%HIS%');
                })->orWhere(function (Builder $nonBedHis): void {
                    $nonBedHis->where(function (Builder $his): void {
                        $his->where('p.product_code', 'LIKE', '%HIS%')
                            ->orWhere('p.product_name', 'LIKE', '%HIS%');
                    })->where(function (Builder $marker): void {
                        $marker->where('p.product_code', 'LIKE', '%HIS KG%')
                            ->orWhere('p.product_code', 'LIKE', '%HIS_KG%')
                            ->orWhere('p.product_code', 'LIKE', '%HIS-KG%');
                    });
                });
            });

            return;
        }

        if ($this->shouldPreferBedBasedHis($customerProfile)) {
            $query->where(function (Builder $builder): void {
                $builder->where(function (Builder $nonHis): void {
                    $nonHis->where('p.product_code', 'NOT LIKE', '%HIS%')
                        ->where('p.product_name', 'NOT LIKE', '%HIS%');
                })->orWhere(function (Builder $bedBasedHis): void {
                    $bedBasedHis->where(function (Builder $his): void {
                        $his->where('p.product_code', 'LIKE', '%HIS%')
                            ->orWhere('p.product_name', 'LIKE', '%HIS%');
                    })->where('p.product_code', 'NOT LIKE', '%HIS KG%')
                        ->where('p.product_code', 'NOT LIKE', '%HIS_KG%')
                        ->where('p.product_code', 'NOT LIKE', '%HIS-KG%');
                });
            });
        }
    }

    private function loadCustomerSegmentProfile(int $customerId): ?object
    {
        if (! $this->support->hasTable('customers')) {
            return null;
        }

        $selects = ['id'];
        foreach (['customer_name', 'company_name', 'customer_sector', 'healthcare_facility_type', 'bed_capacity'] as $column) {
            if ($this->support->hasColumn('customers', $column)) {
                $selects[] = $column;
            }
        }

        $query = DB::table('customers')
            ->where('id', $customerId)
            ->select($selects);

        if ($this->support->hasColumn('customers', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->first();
    }

    /**
     * @return array<int, string>
     */
    private function normalizeSegmentFacilityTypes(mixed $value, mixed $legacyFacilityType = null): array
    {
        $values = [];
        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded) && $decoded !== []) {
                $values = $decoded;
            }
        }

        if ($values === [] && $legacyFacilityType !== null && $legacyFacilityType !== '') {
            $values = [$legacyFacilityType];
        }

        $normalized = [];
        foreach ($values as $item) {
            $candidate = strtoupper(trim((string) $item));
            if ($candidate === '') {
                continue;
            }
            $normalized[] = $candidate;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function buildWinnerSegmentsSubquery(?array $customerProfile): ?Builder
    {
        if ($customerProfile === null
            || ! $this->support->hasTable('product_target_segments')
            || ! $this->support->hasColumn('customers', 'customer_sector')) {
            return null;
        }

        $customerSector = strtoupper(trim((string) ($customerProfile['customer_sector'] ?? '')));
        if ($customerSector === '') {
            return null;
        }

        $facilityType = $this->support->normalizeNullableString($customerProfile['healthcare_facility_type'] ?? null);
        $bedCapacity = is_numeric($customerProfile['bed_capacity'] ?? null)
            ? (int) $customerProfile['bed_capacity']
            : null;
        $hasFacilityTypesColumn = $this->support->hasColumn('product_target_segments', 'facility_types');
        $facilityTypeJsonLike = '%"' . strtoupper(trim((string) ($facilityType ?? ''))) . '"%';

        $ranked = DB::table('product_target_segments as pts')
            ->where('pts.is_active', true)
            ->whereNull('pts.deleted_at')
            ->where('pts.customer_sector', $customerSector);

        if ($hasFacilityTypesColumn) {
            $ranked
                ->select(
                    'pts.product_id',
                    'pts.customer_sector',
                    'pts.facility_type',
                    'pts.facility_types',
                    'pts.bed_capacity_min',
                    'pts.bed_capacity_max',
                    'pts.priority',
                    'pts.sales_notes'
                )
                ->selectRaw(
                    'ROW_NUMBER() OVER (
                        PARTITION BY pts.product_id
                        ORDER BY
                            CASE
                                WHEN pts.facility_type = ? THEN 0
                                WHEN ? <> \'\' AND pts.facility_types LIKE ? THEN 0
                                ELSE 1
                            END,
                            pts.priority ASC,
                            CASE
                                WHEN pts.bed_capacity_min IS NOT NULL AND pts.bed_capacity_max IS NOT NULL THEN 0
                                WHEN pts.bed_capacity_min IS NOT NULL OR pts.bed_capacity_max IS NOT NULL THEN 1
                                ELSE 2
                            END ASC,
                            pts.id DESC
                    ) as rn',
                    [$facilityType ?? '', $facilityType ?? '', $facilityTypeJsonLike]
                );
        } else {
            $ranked
                ->select(
                    'pts.product_id',
                    'pts.customer_sector',
                    'pts.facility_type',
                    'pts.bed_capacity_min',
                    'pts.bed_capacity_max',
                    'pts.priority',
                    'pts.sales_notes'
                )
                ->selectRaw(
                    'ROW_NUMBER() OVER (
                        PARTITION BY pts.product_id
                        ORDER BY
                            CASE WHEN pts.facility_type = ? THEN 0 ELSE 1 END,
                            pts.priority ASC,
                            CASE
                                WHEN pts.bed_capacity_min IS NOT NULL AND pts.bed_capacity_max IS NOT NULL THEN 0
                                WHEN pts.bed_capacity_min IS NOT NULL OR pts.bed_capacity_max IS NOT NULL THEN 1
                                ELSE 2
                            END ASC,
                            pts.id DESC
                    ) as rn',
                    [$facilityType ?? '']
                );
        }

        if ($facilityType !== null && $facilityType !== '') {
            $ranked->where(function (Builder $query) use ($facilityType, $hasFacilityTypesColumn, $facilityTypeJsonLike): void {
                if ($hasFacilityTypesColumn) {
                    $query->where(function (Builder $nested) use ($facilityType, $facilityTypeJsonLike): void {
                        $nested->where('pts.facility_type', $facilityType)
                            ->orWhere('pts.facility_types', 'like', $facilityTypeJsonLike)
                            ->orWhere(function (Builder $wildcard): void {
                                $wildcard->whereNull('pts.facility_type')
                                    ->where(function (Builder $emptyTypes): void {
                                        $emptyTypes->whereNull('pts.facility_types')
                                            ->orWhere('pts.facility_types', '')
                                            ->orWhere('pts.facility_types', '[]');
                                    });
                            });
                    });
                    return;
                }

                $query->whereNull('pts.facility_type')
                    ->orWhere('pts.facility_type', $facilityType);
            });
        }

        if ($bedCapacity !== null) {
            $ranked->where(function (Builder $query) use ($bedCapacity): void {
                $query->whereNull('pts.bed_capacity_min')
                    ->orWhere('pts.bed_capacity_min', '<=', $bedCapacity);
            })->where(function (Builder $query) use ($bedCapacity): void {
                $query->whereNull('pts.bed_capacity_max')
                    ->orWhere('pts.bed_capacity_max', '>=', $bedCapacity);
            });
        }

        $winnerSegments = DB::query()
            ->fromSub($ranked, 'winner_segments')
            ->select(
                'winner_segments.product_id',
                'winner_segments.customer_sector',
                'winner_segments.facility_type',
                'winner_segments.bed_capacity_min',
                'winner_segments.bed_capacity_max',
                'winner_segments.priority as segment_priority',
                'winner_segments.sales_notes'
            );

        if ($hasFacilityTypesColumn) {
            $winnerSegments->addSelect('winner_segments.facility_types');
        } else {
            $winnerSegments->selectRaw('NULL as facility_types');
        }

        return $winnerSegments->where('winner_segments.rn', 1);
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function findMatchingSegment(int $productId, ?array $customerProfile): ?array
    {
        $winnerSegments = $this->buildWinnerSegmentsSubquery($customerProfile);
        if ($winnerSegments === null) {
            return null;
        }

        $segment = $winnerSegments
            ->where('winner_segments.product_id', $productId)
            ->first();

        if (! $segment) {
            return null;
        }

        return [
            'priority' => (int) ($segment->segment_priority ?? 0),
            'sales_notes' => $this->localizeDisplayText($this->support->normalizeNullableString($segment->sales_notes ?? null)),
            'match_criteria' => $this->buildMatchCriteria($segment),
        ];
    }

    /**
     * @return array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null
     */
    private function buildResolvedCustomerProfile(?object $customer): ?array
    {
        if ($customer === null) {
            return null;
        }

        $customerName = trim((string) ($customer->customer_name ?? $customer->company_name ?? ''));
        $customerSector = $this->resolveCustomerSector(
            $this->support->normalizeNullableString($customer->customer_sector ?? null),
            $customerName
        );
        $facilityType = $customerSector === self::CUSTOMER_SECTOR_HEALTHCARE
            ? $this->resolveHealthcareFacilityType(
                $this->support->normalizeNullableString($customer->healthcare_facility_type ?? null),
                $customerName
            )
            : null;
        $bedCapacity = is_numeric($customer->bed_capacity ?? null)
            ? max(0, (int) $customer->bed_capacity)
            : null;

        if (! $this->supportsBedCapacity($facilityType)) {
            $bedCapacity = null;
        }

        return [
            'customer_sector' => $customerSector,
            'healthcare_facility_type' => $facilityType,
            'bed_capacity' => $bedCapacity,
        ];
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

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function shouldPreferNonBedHis(?array $customerProfile): bool
    {
        return ($customerProfile['customer_sector'] ?? null) === self::CUSTOMER_SECTOR_HEALTHCARE
            && in_array($customerProfile['healthcare_facility_type'] ?? null, [
                self::FACILITY_TYT_PKDK,
                self::FACILITY_PRIVATE_CLINIC,
                self::FACILITY_OTHER,
            ], true);
    }

    /**
     * @param array{customer_sector:string,healthcare_facility_type:?string,bed_capacity:?int}|null $customerProfile
     */
    private function shouldPreferBedBasedHis(?array $customerProfile): bool
    {
        return ($customerProfile['customer_sector'] ?? null) === self::CUSTOMER_SECTOR_HEALTHCARE
            && $this->supportsBedCapacity($customerProfile['healthcare_facility_type'] ?? null)
            && (int) ($customerProfile['bed_capacity'] ?? 0) > 0;
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

    private function buildMatchCriteria(object $segment): string
    {
        $parts = [];
        $sector = strtoupper(trim((string) ($segment->customer_sector ?? '')));
        if ($sector !== '') {
            $parts[] = 'Lĩnh vực: ' . (self::CUSTOMER_SECTOR_LABELS[$sector] ?? $sector);
        }

        $facilityTypes = $this->normalizeSegmentFacilityTypes(
            $segment->facility_types ?? null,
            $segment->facility_type ?? null
        );
        $parts[] = 'Loại hình: ' . ($facilityTypes === []
            ? 'Tất cả'
            : implode(', ', array_map(
                static fn (string $value): string => self::FACILITY_TYPE_LABELS[$value] ?? $value,
                $facilityTypes
            )));

        $capacity = $this->formatBedCapacityRange($segment->bed_capacity_min ?? null, $segment->bed_capacity_max ?? null);
        if ($capacity !== null) {
            $parts[] = $capacity;
        }

        return implode(' | ', $parts);
    }

    private function formatBedCapacityRange(mixed $min, mixed $max): ?string
    {
        $normalizedMin = is_numeric($min) ? (int) $min : null;
        $normalizedMax = is_numeric($max) ? (int) $max : null;

        if ($normalizedMin === null && $normalizedMax === null) {
            return null;
        }
        if ($normalizedMin !== null && $normalizedMax !== null) {
            return "Quy mô: {$normalizedMin}-{$normalizedMax} giường";
        }
        if ($normalizedMin !== null) {
            return "Quy mô: từ {$normalizedMin} giường";
        }

        return "Quy mô: đến {$normalizedMax} giường";
    }

    private function localizeDisplayText(?string $value): ?string
    {
        $normalized = $this->support->normalizeNullableString($value);
        if ($normalized === null || $normalized === '') {
            return $normalized;
        }

        return strtr($normalized, self::DISPLAY_TEXT_REPLACEMENTS);
    }

    private function resolveCatalogProductIds(int $productId): array
    {
        if (! $this->support->hasTable('products')) {
            return [$productId];
        }

        $selectColumns = $this->support->selectColumns('products', [
            'id',
            'product_name',
            'service_group',
            'domain_id',
            'vendor_id',
        ]);

        $currentQuery = DB::table('products')
            ->select($selectColumns)
            ->where('id', $productId);
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $currentQuery->whereNull('deleted_at');
        }

        $current = $currentQuery->first();
        if (! $current) {
            return [$productId];
        }

        $productName = trim((string) ($current->product_name ?? ''));
        if ($productName === '') {
            return [$productId];
        }

        $query = DB::table('products')
            ->where('product_name', $productName)
            ->orderBy('id');

        if ($this->support->hasColumn('products', 'service_group') && $current->service_group !== null) {
            $query->where('service_group', $current->service_group);
        }
        if ($this->support->hasColumn('products', 'domain_id') && $current->domain_id !== null) {
            $query->where('domain_id', $current->domain_id);
        }
        if ($this->support->hasColumn('products', 'vendor_id') && $current->vendor_id !== null) {
            $query->where('vendor_id', $current->vendor_id);
        }
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $ids = $query
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        return $ids !== [] ? $ids : [$productId];
    }

    /**
     * @param array<string, array{cnt:int,total:float}> $grouped
     */
    private function formatContractsSummaryRows(array $grouped): array
    {
        $totalCount = 0;
        $totalValue = 0.0;
        $activeValue = 0.0;
        $byStatus = [];

        foreach ($grouped as $status => $payload) {
            $count = (int) ($payload['cnt'] ?? 0);
            $total = (float) ($payload['total'] ?? 0);
            $totalCount += $count;
            $totalValue += $total;
            $byStatus[$status] = $count;

            if (in_array($status, self::ACTIVE_CONTRACT_STATUSES, true)) {
                $activeValue += $total;
            }
        }

        return [
            'total_count' => $totalCount,
            'total_value' => $totalValue,
            'active_value' => $activeValue,
            'by_status' => $byStatus,
        ];
    }

    /**
     * @return array<string, float>
     */
    private function resolveVatRateMap(): array
    {
        if ($this->vatRateMap !== null) {
            return $this->vatRateMap;
        }

        if (! $this->support->hasTable('business_domains')) {
            return $this->vatRateMap = [];
        }

        $domains = DB::table('business_domains')->select('id', 'domain_code')->get();
        $map = [];

        foreach ($domains as $domain) {
            $code = strtoupper((string) ($domain->domain_code ?? ''));
            $map[(string) ($domain->id ?? '')] = match (true) {
                str_ends_with($code, '_PM') => 1.10,
                str_ends_with($code, '_PC') => 1.08,
                default => 1.00,
            };
        }

        return $this->vatRateMap = $map;
    }

    private function cachePattern(string $suffix): string
    {
        $prefix = trim((string) config('cache.prefix', ''));
        return $prefix !== '' ? "{$prefix}:{$suffix}" : $suffix;
    }

    private function redisScanDelete(string $pattern): void
    {
        try {
            $redis = Cache::getRedis();
            $cursor = '0';

            do {
                $result = $redis->scan($cursor, ['MATCH' => $pattern, 'COUNT' => 100]);
                if (! is_array($result) || count($result) !== 2) {
                    break;
                }

                [$cursor, $keys] = $result;
                if (is_array($keys) && $keys !== []) {
                    $redis->del(...$keys);
                }
            } while ((string) $cursor !== '0');
        } catch (Throwable) {
            // Non-Redis drivers (array/file) skip pattern invalidation.
        }
    }

    private function emptyContractsSummary(): array
    {
        return ['total_count' => 0, 'total_value' => 0, 'active_value' => 0, 'by_status' => []];
    }

    private function emptyOpportunitiesSummary(): array
    {
        return ['total_count' => 0, 'total_amount' => 0, 'by_stage' => []];
    }

    private function emptyCrcSummary(): array
    {
        return ['total_cases' => 0, 'open_cases' => 0, 'by_status' => []];
    }
}
