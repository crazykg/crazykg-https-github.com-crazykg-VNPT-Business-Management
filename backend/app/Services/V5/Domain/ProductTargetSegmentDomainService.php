<?php

namespace App\Services\V5\Domain;

use App\Models\Product;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductTargetSegmentDomainService
{
    private const TABLE = 'product_target_segments';
    private const SECTOR_VALUES = ['HEALTHCARE', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];
    private const FACILITY_TYPE_VALUES = [
        'PUBLIC_HOSPITAL',
        'PRIVATE_HOSPITAL',
        'MEDICAL_CENTER',
        'PRIVATE_CLINIC',
        'TYT_PKDK',
        'OTHER',
    ];
    private const MAX_PRIORITY = 255;
    private const MAX_SEGMENTS_PER_PRODUCT = 20;

    private function hasFacilityTypesColumn(): bool
    {
        return $this->support->hasColumn(self::TABLE, 'facility_types');
    }

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
    ) {}

    public function index(Request $request, int $productId): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return response()->json([
                'data' => [],
                'meta' => ['table_available' => false],
            ]);
        }

        $product = $this->findActiveProduct($productId);
        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return response()->json([
            'data' => $this->serializeSegments($this->segmentQuery($productId)->get()),
            'meta' => ['table_available' => true],
        ]);
    }

    public function bulkSync(Request $request, int $productId): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return response()->json([
                'message' => 'Target segments table is not available in this environment.',
            ], 503);
        }

        $product = $this->findActiveProduct($productId);
        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $validated = $this->validateSegmentsPayload($request);
        $segments = $this->normalizeSegments(is_array($validated['segments'] ?? null) ? $validated['segments'] : []);
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $beforeSnapshot = $this->serializeSegments($this->segmentQuery($productId)->get());

        DB::transaction(function () use ($productId, $segments, $actorId): void {
            $timestamp = now();

            DB::table(self::TABLE)
                ->where('product_id', $productId)
                ->whereNull('deleted_at')
                ->update([
                    'deleted_at' => $timestamp,
                    'updated_at' => $timestamp,
                    'updated_by' => $actorId,
                ]);

            foreach ($segments as $segment) {
                $payload = [
                    'uuid' => (string) Str::uuid(),
                    'product_id' => $productId,
                    'customer_sector' => $segment['customer_sector'],
                    'facility_type' => $segment['facility_type'],
                    'bed_capacity_min' => $segment['bed_capacity_min'],
                    'bed_capacity_max' => $segment['bed_capacity_max'],
                    'priority' => $segment['priority'],
                    'sales_notes' => $segment['sales_notes'],
                    'is_active' => $segment['is_active'],
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];

                if ($this->hasFacilityTypesColumn()) {
                    $payload['facility_types'] = $this->encodeFacilityTypes($segment['facility_types'] ?? []);
                }

                DB::table(self::TABLE)->insert($payload);
            }
        });

        $afterSnapshot = $this->serializeSegments($this->segmentQuery($productId)->get());

        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            self::TABLE,
            $productId,
            ['segments' => $beforeSnapshot],
            ['segments' => $afterSnapshot],
        );

        $this->insightService->invalidateAllInsightCaches();

        return response()->json([
            'data' => $afterSnapshot,
        ]);
    }

    private function findActiveProduct(int $productId): ?Product
    {
        return Product::query()->find($productId);
    }

    private function segmentQuery(int $productId)
    {
        $selects = [
            'id',
            'uuid',
            'product_id',
            'customer_sector',
            'facility_type',
            'bed_capacity_min',
            'bed_capacity_max',
            'priority',
            'sales_notes',
            'is_active',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
        ];

        if ($this->hasFacilityTypesColumn()) {
            $selects[] = 'facility_types';
        }

        return DB::table(self::TABLE)
            ->where('product_id', $productId)
            ->whereNull('deleted_at')
            ->orderBy('priority')
            ->orderBy('customer_sector')
            ->orderBy('id')
            ->select($selects);
    }

    /**
     * @return array{segments: array<int, array<string, mixed>>}
     */
    private function validateSegmentsPayload(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'segments' => ['present', 'array', 'max:' . self::MAX_SEGMENTS_PER_PRODUCT],
            'segments.*.customer_sector' => ['required', 'string', Rule::in(self::SECTOR_VALUES)],
            'segments.*.facility_type' => ['nullable', 'string', Rule::in(self::FACILITY_TYPE_VALUES)],
            'segments.*.facility_types' => ['nullable', 'array'],
            'segments.*.facility_types.*' => ['string', Rule::in(self::FACILITY_TYPE_VALUES)],
            'segments.*.bed_capacity_min' => ['nullable', 'integer', 'min:0'],
            'segments.*.bed_capacity_max' => ['nullable', 'integer', 'min:0'],
            'segments.*.priority' => ['nullable', 'integer', 'min:1', 'max:' . self::MAX_PRIORITY],
            'segments.*.sales_notes' => ['nullable', 'string', 'max:2000'],
            'segments.*.is_active' => ['nullable', 'boolean'],
        ]);

        $validator->after(function ($validator) use ($request): void {
            $segments = $request->input('segments', []);
            if (! is_array($segments)) {
                return;
            }

            foreach ($segments as $index => $segment) {
                if (! is_array($segment)) {
                    continue;
                }

                $sector = strtoupper(trim((string) ($segment['customer_sector'] ?? '')));
                $facilityType = $this->support->normalizeNullableString($segment['facility_type'] ?? null);
                $facilityTypes = $this->normalizeFacilityTypes(
                    $segment['facility_types'] ?? null,
                    $facilityType
                );
                $bedCapacityMin = $this->support->parseNullableInt($segment['bed_capacity_min'] ?? null);
                $bedCapacityMax = $this->support->parseNullableInt($segment['bed_capacity_max'] ?? null);

                if ($bedCapacityMin !== null && $bedCapacityMax !== null && $bedCapacityMin > $bedCapacityMax) {
                    $validator->errors()->add(
                        "segments.{$index}.bed_capacity_max",
                        'Giường bệnh tối đa phải lớn hơn hoặc bằng giường bệnh tối thiểu.'
                    );
                }

                if ($sector !== 'HEALTHCARE') {
                    if ($facilityType !== null || $facilityTypes !== []) {
                        $validator->errors()->add(
                            "segments.{$index}.facility_types",
                            'Loại hình chỉ áp dụng cho nhóm khách hàng Y tế.'
                        );
                    }

                    if ($bedCapacityMin !== null || $bedCapacityMax !== null) {
                        $validator->errors()->add(
                            "segments.{$index}.bed_capacity_min",
                            'Số giường bệnh chỉ áp dụng cho nhóm khách hàng Y tế.'
                        );
                    }
                }
            }
        });

        return $validator->validate();
    }

    /**
     * @param array<int, array<string, mixed>> $segments
     * @return array<int, array<string, mixed>>
     */
    private function normalizeSegments(array $segments): array
    {
        return array_values(array_map(function (array $segment): array {
            $sector = strtoupper(trim((string) ($segment['customer_sector'] ?? '')));
            $facilityTypes = $this->normalizeFacilityTypes(
                $segment['facility_types'] ?? null,
                $segment['facility_type'] ?? null
            );

            return [
                'customer_sector' => $sector,
                'facility_type' => $sector === 'HEALTHCARE' && count($facilityTypes) === 1 ? $facilityTypes[0] : null,
                'facility_types' => $sector === 'HEALTHCARE' ? $facilityTypes : [],
                'bed_capacity_min' => $sector === 'HEALTHCARE'
                    ? $this->support->parseNullableInt($segment['bed_capacity_min'] ?? null)
                    : null,
                'bed_capacity_max' => $sector === 'HEALTHCARE'
                    ? $this->support->parseNullableInt($segment['bed_capacity_max'] ?? null)
                    : null,
                'priority' => max(1, min(
                    self::MAX_PRIORITY,
                    $this->support->parseNullableInt($segment['priority'] ?? null) ?? 1
                )),
                'sales_notes' => $this->support->normalizeNullableString($segment['sales_notes'] ?? null),
                'is_active' => array_key_exists('is_active', $segment)
                    ? filter_var($segment['is_active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false
                    : true,
            ];
        }, $segments));
    }

    /**
     * @return array<int, string>
     */
    private function normalizeFacilityTypes(mixed $facilityTypes, mixed $legacyFacilityType = null): array
    {
        $values = [];
        if (is_array($facilityTypes) && $facilityTypes !== []) {
            $values = $facilityTypes;
        } elseif ($legacyFacilityType !== null && $legacyFacilityType !== '') {
            $values = [$legacyFacilityType];
        }

        $normalized = [];
        foreach ($values as $value) {
            $candidate = strtoupper(trim((string) $value));
            if ($candidate === '' || ! in_array($candidate, self::FACILITY_TYPE_VALUES, true)) {
                continue;
            }
            $normalized[] = $candidate;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param array<int, string> $facilityTypes
     */
    private function encodeFacilityTypes(array $facilityTypes): ?string
    {
        if ($facilityTypes === []) {
            return null;
        }

        return json_encode(array_values($facilityTypes), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: null;
    }

    /**
     * @return array<int, string>
     */
    private function decodeFacilityTypes(mixed $value, mixed $legacyFacilityType = null): array
    {
        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return $this->normalizeFacilityTypes($decoded, $legacyFacilityType);
            }
        }

        return $this->normalizeFacilityTypes(null, $legacyFacilityType);
    }

    /**
     * @param Collection<int, object> $rows
     * @return array<int, array<string, mixed>>
     */
    private function serializeSegments(Collection $rows): array
    {
        return $rows->map(fn (object $row): array => [
            'id' => $this->support->parseNullableInt($row->id ?? null),
            'uuid' => $this->support->normalizeNullableString($row->uuid ?? null),
            'product_id' => $this->support->parseNullableInt($row->product_id ?? null),
            'customer_sector' => strtoupper(trim((string) ($row->customer_sector ?? ''))),
            'facility_type' => $this->support->normalizeNullableString($row->facility_type ?? null),
            'facility_types' => $this->decodeFacilityTypes(
                $row->facility_types ?? null,
                $row->facility_type ?? null
            ),
            'bed_capacity_min' => $this->support->parseNullableInt($row->bed_capacity_min ?? null),
            'bed_capacity_max' => $this->support->parseNullableInt($row->bed_capacity_max ?? null),
            'priority' => $this->support->parseNullableInt($row->priority ?? null) ?? 1,
            'sales_notes' => $this->support->normalizeNullableString($row->sales_notes ?? null),
            'is_active' => (bool) ($row->is_active ?? false),
            'created_at' => $row->created_at ? (string) $row->created_at : null,
            'updated_at' => $row->updated_at ? (string) $row->updated_at : null,
            'created_by' => $this->support->parseNullableInt($row->created_by ?? null),
            'updated_by' => $this->support->parseNullableInt($row->updated_by ?? null),
        ])->values()->all();
    }
}
