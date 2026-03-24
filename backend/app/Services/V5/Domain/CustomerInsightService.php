<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * CustomerInsightService
 *
 * Builds a "Customer 360" insight payload for a given customer:
 *   - contracts_summary  : count, total value, active value, breakdown by status
 *   - services_used      : products the customer already has in contracts
 *   - opportunities_summary : pipeline counts/amounts by stage
 *   - crc_summary        : open/total support-case counts by status
 *   - upsell_candidates  : active products NOT in the customer's contracts,
 *                          sorted by popularity (usage across all customers)
 */
class CustomerInsightService
{
    // CRC statuses considered "open/active" for the summary card
    private const OPEN_CRC_STATUSES = [
        'new_intake',
        'analysis', 'in_progress', 'coding',
        'dms_transfer', 'waiting_customer_feedback',
        'returned_to_manager',
    ];

    // Contracts with these statuses count as "active"
    private const ACTIVE_CONTRACT_STATUSES = ['SIGNED', 'RENEWED'];

    // How many upsell suggestions to surface
    private const UPSELL_LIMIT = 8;

    // Nhãn tiếng Việt cho nhóm dịch vụ sản phẩm.
    // Phải khớp với PRODUCT_SERVICE_GROUP_META_LIST trong frontend/utils/productServiceGroup.ts
    private const SERVICE_GROUP_LABELS = [
        'GROUP_A' => 'Dịch vụ nhóm A',
        'GROUP_B' => 'Dịch vụ nhóm B',
        'GROUP_C' => 'Dịch vụ nhóm C',
    ];

    /**
     * VAT multiplier per domain_code suffix.
     * business_domains là bảng tĩnh (~10-20 rows), load 1 lần vào PHP map thay vì
     * LEFT JOIN trong mọi query tính giá trị.
     * Key = domain_code, Value = multiplier (1.10 / 1.08 / 1.00)
     *
     * @var array<string, float>|null  null = chưa load
     */
    private ?array $vatRateMap = null;

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    // ── Public entry-point ────────────────────────────────────────────────────

    /**
     * Xoá cache insight cho một khách hàng.
     * Gọi từ ContractDomainService, CustomerRequestCaseWriteService, v.v.
     * sau khi lưu/xoá dữ liệu ảnh hưởng đến insight.
     */
    public function invalidateCache(int $customerId): void
    {
        Cache::forget("v5:customer-insight:{$customerId}:v1");
    }

    public function buildInsight(int $customerId): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customer = DB::table('customers')
            ->whereNull('deleted_at')
            ->where('id', $customerId)
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Không tìm thấy khách hàng.'], 404);
        }

        return response()->json([
            'data' => [
                'customer'              => $customer,
                'contracts_summary'     => $this->buildContractsSummary($customerId),
                'services_used'         => $this->buildServicesUsed($customerId),
                'opportunities_summary' => $this->buildOpportunitiesSummary($customerId),
                'crc_summary'           => $this->buildCrcSummary($customerId),
                'upsell_candidates'     => $this->buildUpsellCandidates($customerId),
            ],
        ]);
    }

    // ── Private section builders ──────────────────────────────────────────────

    /**
     * Contracts summary: total count, total value, active value, by_status breakdown.
     */
    private function buildContractsSummary(int $customerId): array
    {
        if (! $this->support->hasTable('contracts') ||
            ! $this->support->hasColumn('contracts', 'customer_id')) {
            return $this->emptyContractsSummary();
        }

        $hasSoftDelete        = $this->support->hasColumn('contracts', 'deleted_at');
        $hasItems             = $this->support->hasTable('contract_items');
        $hasProducts          = $this->support->hasTable('products');
        $hasBusinessDomains   = $this->support->hasTable('business_domains');

        // ── Tính tổng từ contract_items + VAT ──────────────────────────────
        // VAT lấy từ business_domains.domain_code, nhưng đây là bảng tĩnh ~10 rows.
        // Thay vì LEFT JOIN mỗi query, load 1 lần vào PHP map → loại bỏ 1 JOIN.
        // Covering index mới idx_cont_cust_insight đủ cho fallback path.
        if ($hasItems && $hasProducts) {
            $vatMap = $hasBusinessDomains ? $this->resolveVatRateMap() : [];

            $rows = DB::table('contracts as c')
                ->leftJoin('contract_items as ci', 'ci.contract_id', '=', 'c.id')
                ->leftJoin('products as p', 'p.id', '=', 'ci.product_id')
                ->when($hasSoftDelete, fn ($q) => $q->whereNull('c.deleted_at'))
                ->where('c.customer_id', $customerId)
                ->groupBy('c.id', 'c.status', 'p.domain_id')
                ->select(
                    'c.id as contract_id',
                    'c.status',
                    'p.domain_id',
                    DB::raw('COALESCE(SUM(ci.unit_price * ci.quantity), 0) as raw_val'),
                    DB::raw('COUNT(DISTINCT c.id) as cnt'),
                )
                ->get();

            // Áp VAT trong PHP — tránh CASE LIKE trong SQL chạy trên từng row
            $contractSums = [];  // [contract_id => [status, value]]
            foreach ($rows as $row) {
                $multiplier = $vatMap[(string) ($row->domain_id ?? '')] ?? 1.00;
                $val        = (float) $row->raw_val * $multiplier;

                if (! isset($contractSums[$row->contract_id])) {
                    $contractSums[$row->contract_id] = ['status' => $row->status, 'value' => 0.0];
                }
                $contractSums[$row->contract_id]['value'] += $val;
            }

            // Tổng hợp theo status
            $grouped = [];
            foreach ($contractSums as ['status' => $status, 'value' => $value]) {
                $grouped[$status]['cnt']   = ($grouped[$status]['cnt'] ?? 0) + 1;
                $grouped[$status]['total'] = ($grouped[$status]['total'] ?? 0.0) + $value;
            }

            $totalCount  = 0;
            $totalValue  = 0.0;
            $activeValue = 0.0;
            $byStatus    = [];

            foreach ($grouped as $status => ['cnt' => $cnt, 'total' => $total]) {
                $totalCount += $cnt;
                $totalValue += $total;
                $byStatus[$status] = $cnt;

                if (in_array($status, self::ACTIVE_CONTRACT_STATUSES, true)) {
                    $activeValue += $total;
                }
            }

            return compact('totalCount', 'totalValue', 'activeValue', 'byStatus') + [
                'total_count'  => $totalCount,
                'total_value'  => $totalValue,
                'active_value' => $activeValue,
                'by_status'    => $byStatus,
            ];
        }

        // ── Fallback: contracts.total_value — dùng covering index ────────────
        // idx_cont_cust_insight(customer_id, deleted_at, status, total_value)
        $rows = DB::table('contracts')
            ->when($hasSoftDelete, fn ($q) => $q->whereNull('deleted_at'))
            ->where('customer_id', $customerId)
            ->select('status', DB::raw('COUNT(*) as cnt'), DB::raw('SUM(total_value) as total_val'))
            ->groupBy('status')
            ->get();
    }

    /**
     * Services used: products that appear in this customer's contracts.
     * Returns list sorted by total_value DESC.
     */
    private function buildServicesUsed(int $customerId): array
    {
        if (! $this->support->hasTable('contracts') ||
            ! $this->support->hasTable('contract_items') ||
            ! $this->support->hasTable('products')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');
        $hasBusinessDomains    = $this->support->hasTable('business_domains');

        // Kéo thêm domain_id để áp VAT trong PHP (tránh LEFT JOIN business_domains)
        $vatMap = $hasBusinessDomains ? $this->resolveVatRateMap() : [];

        $query = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('products as p', 'p.id', '=', 'ci.product_id')
            ->when($contractHasSoftDelete, fn ($q) => $q->whereNull('c.deleted_at'))
            ->whereNull('p.deleted_at')
            ->where('c.customer_id', $customerId)
            ->groupBy('p.id', 'p.product_name', 'p.unit', 'p.service_group', 'p.domain_id')
            ->select(
                'p.id as product_id',
                'p.product_name',
                'p.unit',
                'p.service_group',
                'p.domain_id',
                DB::raw('COUNT(DISTINCT ci.contract_id) as contract_count'),
                DB::raw('SUM(ci.unit_price * ci.quantity) as raw_value'),
            );

        $rows = $query->orderByDesc('raw_value')->get();

        return $rows->map(function ($r) use ($vatMap) {
            $multiplier  = $vatMap[(string) ($r->domain_id ?? '')] ?? 1.00;
            $totalValue  = (float) $r->raw_value * $multiplier;

            return [
                'product_id'     => $r->product_id,
                'product_name'   => $r->product_name,
                'unit'           => $r->unit,
                'service_group'  => $r->service_group,
                'contract_count' => (int) $r->contract_count,
                'total_value'    => $totalValue,
            ];
        })->toArray();
    }

    /**
     * Opportunities summary: total count, total amount, pipeline breakdown by stage.
     */
    private function buildOpportunitiesSummary(int $customerId): array
    {
        if (! $this->support->hasTable('opportunities') ||
            ! $this->support->hasColumn('opportunities', 'customer_id')) {
            return $this->emptyOpportunitiesSummary();
        }

        $rows = DB::table('opportunities')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->select('stage', DB::raw('COUNT(*) as cnt'), DB::raw('SUM(expected_value) as total_amt'))
            ->groupBy('stage')
            ->get();

        $totalCount  = 0;
        $totalAmount = 0.0;
        $byStage     = [];

        foreach ($rows as $row) {
            $totalCount  += (int) $row->cnt;
            $totalAmount += (float) $row->total_amt;
            $byStage[$row->stage] = [
                'count'  => (int) $row->cnt,
                'amount' => (float) $row->total_amt,
            ];
        }

        return [
            'total_count'  => $totalCount,
            'total_amount' => $totalAmount,
            'by_stage'     => $byStage,
        ];
    }

    /**
     * CRC summary: total cases, open cases, breakdown by status code.
     */
    private function buildCrcSummary(int $customerId): array
    {
        if (! $this->support->hasTable('customer_request_cases') ||
            ! $this->support->hasColumn('customer_request_cases', 'customer_id')) {
            return $this->emptyCrcSummary();
        }

        $rows = DB::table('customer_request_cases')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->select(
                'current_status_code',
                DB::raw('COUNT(*) as cnt')
            )
            ->groupBy('current_status_code')
            ->get();

        $totalCases = 0;
        $openCases  = 0;
        $byStatus   = [];

        foreach ($rows as $row) {
            $totalCases += (int) $row->cnt;
            $byStatus[$row->current_status_code] = (int) $row->cnt;

            if (in_array($row->current_status_code, self::OPEN_CRC_STATUSES, true)) {
                $openCases += (int) $row->cnt;
            }
        }

        return [
            'total_cases' => $totalCases,
            'open_cases'  => $openCases,
            'by_status'   => $byStatus,
        ];
    }

    /**
     * Upsell candidates: active products NOT already in this customer's contracts,
     * sorted by GROUP_A priority first, then cross-customer popularity.
     *
     * Rules:
     *  - Nếu KH đã có bất kỳ sản phẩm HIS nào → loại toàn bộ HIS khỏi gợi ý
     *  - GROUP_A ("Dịch vụ nhóm A") ưu tiên lên đầu
     *  - Mỗi sản phẩm kèm reference_customers: ≤3 KH đang dùng (minh chứng)
     */
    private function buildUpsellCandidates(int $customerId): array
    {
        if (! $this->support->hasTable('products') ||
            ! $this->support->hasTable('contract_items') ||
            ! $this->support->hasTable('contracts')) {
            return [];
        }

        $contractHasSoftDelete = $this->support->hasColumn('contracts', 'deleted_at');

        // ── Bước 1: Sản phẩm KH này đã dùng ────────────────────────────────
        $usedRows = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('products as p', 'p.id', '=', 'ci.product_id')
            ->when($contractHasSoftDelete, fn ($q) => $q->whereNull('c.deleted_at'))
            ->where('c.customer_id', $customerId)
            ->select('ci.product_id', 'p.product_code', 'p.product_name')
            ->get();

        $usedProductIds = $usedRows->pluck('product_id')->unique()->all();

        // ── Bước 2: Kiểm tra KH đã có HIS chưa ─────────────────────────────
        // Nếu có → loại toàn bộ sản phẩm mang tên/mã HIS ra khỏi gợi ý
        $hasHisProduct = $usedRows->contains(function ($row) {
            return str_contains(strtoupper((string) ($row->product_code ?? '')), 'HIS')
                || str_contains(strtoupper((string) ($row->product_name ?? '')), 'HIS');
        });

        // ── Bước 3: Pre-aggregate popularity — CHỈ CHẠY 1 LẦN ────────────────
        //
        // VẤN ĐỀ CŨ (correlated subquery):
        //   SELECT ... (SELECT COUNT DISTINCT ... WHERE ci2.product_id = p.id) as popularity
        //   MySQL phải chạy subquery này CHO MỖI sản phẩm vượt qua WHERE, rồi
        //   mới ORDER BY → tức là N lần query khi có N sản phẩm active.
        //   Ở 1 triệu contract_items × 500 sản phẩm = 500 lần scan bảng.
        //
        // GIẢI PHÁP (pre-aggregated derived table):
        //   Tính popularity tất cả sản phẩm trong 1 subquery duy nhất,
        //   rồi LEFT JOIN vào products.
        //   Sử dụng index idx_ci_product_contract(product_id, contract_id)
        //   để covering scan — không cần đọc row data.
        $popularitySubquery = DB::table('contract_items as ci2')
            ->join('contracts as c2', 'c2.id', '=', 'ci2.contract_id')
            ->when($contractHasSoftDelete, fn ($q) => $q->whereNull('c2.deleted_at'))
            ->where('c2.customer_id', '!=', $customerId)
            ->select(
                'ci2.product_id',
                DB::raw('COUNT(DISTINCT c2.customer_id) as pop_count'),
            )
            ->groupBy('ci2.product_id');

        // ── Bước 4: Truy vấn sản phẩm gợi ý ────────────────────────────────
        $query = DB::table('products as p')
            ->leftJoinSub($popularitySubquery, 'pop', 'pop.product_id', '=', 'p.id')
            ->whereNull('p.deleted_at')
            ->where('p.is_active', true)
            ->select(
                'p.id as product_id',
                'p.product_code',
                'p.product_name',
                'p.standard_price',
                'p.unit',
                'p.service_group',
                DB::raw('COALESCE(pop.pop_count, 0) as popularity'),
            )
            // GROUP_A lên trước, rồi theo độ phổ biến giảm dần
            ->orderByRaw("CASE WHEN p.service_group = 'GROUP_A' THEN 0 ELSE 1 END ASC")
            ->orderByDesc('popularity')
            ->limit(self::UPSELL_LIMIT);

        // Loại sản phẩm đã dùng
        if (! empty($usedProductIds)) {
            $query->whereNotIn('p.id', $usedProductIds);
        }

        // Loại toàn bộ HIS nếu KH đã có HIS
        if ($hasHisProduct) {
            $query->where(function ($q) {
                $q->where('p.product_code', 'NOT LIKE', '%HIS%')
                  ->where('p.product_name', 'NOT LIKE', '%HIS%');
            });
        }

        $candidates = $query->get();

        if ($candidates->isEmpty()) {
            return [];
        }

        // ── Bước 5: Lấy reference_customers (≤3 KH đang dùng mỗi SP) ────────
        $candidateIds = $candidates->pluck('product_id')->all();
        $hasCustomers = $this->support->hasTable('customers') &&
                        $this->support->hasColumn('customers', 'customer_name');

        $referenceMap = [];
        if ($hasCustomers && ! empty($candidateIds)) {
            $refs = DB::table('contract_items as ci')
                ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
                ->join('customers as cu', 'cu.id', '=', 'c.customer_id')
                ->when($contractHasSoftDelete, fn ($q) => $q->whereNull('c.deleted_at'))
                ->whereNull('cu.deleted_at')
                ->whereIn('ci.product_id', $candidateIds)
                ->where('c.customer_id', '!=', $customerId)
                ->select('ci.product_id', 'cu.customer_name')
                ->distinct()
                ->get()
                ->groupBy('product_id');

            foreach ($refs as $productId => $rows) {
                $referenceMap[(string) $productId] = $rows->take(3)->pluck('customer_name')->toArray();
            }
        }

        // ── Bước 6: Build kết quả ────────────────────────────────────────────
        return $candidates->map(function ($r) use ($referenceMap) {
            $group   = $r->service_group ?? '';
            $label   = self::SERVICE_GROUP_LABELS[$group] ?? 'Sản phẩm phổ biến';

            return [
                'product_id'          => $r->product_id,
                'product_name'        => $r->product_name,
                'standard_price'      => (float) $r->standard_price,
                'unit'                => $r->unit,
                'service_group'       => $group ?: null,
                'service_group_label' => $label,
                'reason'              => $label,          // backward-compat với frontend cũ
                'popularity'          => (int) $r->popularity,
                'is_priority'         => $group === 'GROUP_A',
                'reference_customers' => $referenceMap[(string) $r->product_id] ?? [],
            ];
        })->toArray();
    }

    // ── Empty-state helpers ───────────────────────────────────────────────────

    /**
     * Load business_domains một lần duy nhất trong vòng đời request,
     * trả về map [domain_id => vat_multiplier].
     *
     * business_domains là bảng tĩnh (~10-20 dòng, hiếm khi thay đổi).
     * Memoized trong $vatRateMap để buildContractsSummary và buildServicesUsed
     * dùng chung mà không cần thêm query hay LEFT JOIN trong SQL.
     *
     * @return array<string, float>  key = domain_id (string), value = 1.10 | 1.08 | 1.00
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
        foreach ($domains as $d) {
            $code = strtoupper((string) $d->domain_code);
            $map[(string) $d->id] = match (true) {
                str_ends_with($code, '_PM') => 1.10,
                str_ends_with($code, '_PC') => 1.08,
                default                     => 1.00,
            };
        }

        return $this->vatRateMap = $map;
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
