<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SupportContactPositionDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_contact_positions')) {
            return $this->support->missingTable('support_contact_positions');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByPositionId = $this->supportContactPositionUsageSummaryById();
        $query = DB::table('support_contact_positions')
            ->select($this->support->selectColumns('support_contact_positions', [
                'id',
                'position_code',
                'position_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->support->hasColumn('support_contact_positions', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->support->hasColumn('support_contact_positions', 'position_name')) {
            $query->orderBy('position_name');
        }
        if ($this->support->hasColumn('support_contact_positions', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendSupportContactPositionUsageMetadata(
                $this->serializeSupportContactPositionRecord((array) $item),
                $usageByPositionId
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_contact_positions')) {
            return $this->support->missingTable('support_contact_positions');
        }

        $validated = $request->validate([
            'position_code' => ['required', 'string', 'max:50'],
            'position_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($validated['position_code'] ?? ''));
        if ($positionCode === '') {
            return response()->json(['message' => 'position_code is invalid.'], 422);
        }
        if ($this->supportContactPositionCodeExists($positionCode)) {
            return response()->json(['message' => 'position_code has already been taken.'], 422);
        }

        $positionName = trim((string) ($validated['position_name'] ?? ''));
        if ($positionName === '') {
            return response()->json(['message' => 'position_name is required.'], 422);
        }
        if ($this->supportContactPositionNameExists($positionName)) {
            return response()->json(['message' => 'position_name has already been taken.'], 422);
        }

        $payload = [
            'position_code' => $positionCode,
            'position_name' => $positionName,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        $payload = $this->support->filterPayloadByTableColumns('support_contact_positions', $payload);
        if ($this->support->hasColumn('support_contact_positions', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('support_contact_positions', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_contact_positions')->insertGetId($payload);
        $record = $this->loadSupportContactPositionById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Support contact position created but cannot be reloaded.'], 500);
        }

        $record = $this->appendSupportContactPositionUsageMetadata(
            $record,
            $this->supportContactPositionUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_contact_positions')) {
            return $this->support->missingTable('support_contact_positions');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-contact-positions', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->store($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo chức vụ liên hệ.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo chức vụ liên hệ.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
            } catch (ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể tạo chức vụ liên hệ.',
                ];
            }
        }

        $failedCount = count(array_filter(
            $results,
            fn (array $item): bool => ($item['success'] ?? false) !== true
        ));

        return response()->json([
            'data' => [
                'results' => array_values($results),
                'created' => array_values($created),
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('support_contact_positions')) {
            return $this->support->missingTable('support_contact_positions');
        }

        $current = DB::table('support_contact_positions')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support contact position not found.'], 404);
        }

        $validated = $request->validate([
            'position_code' => ['required', 'string', 'max:50'],
            'position_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($validated['position_code'] ?? ''));
        if ($positionCode === '') {
            return response()->json(['message' => 'position_code is invalid.'], 422);
        }
        if ($this->supportContactPositionCodeExists($positionCode, $id)) {
            return response()->json(['message' => 'position_code has already been taken.'], 422);
        }

        $positionName = trim((string) ($validated['position_name'] ?? ''));
        if ($positionName === '') {
            return response()->json(['message' => 'position_name is required.'], 422);
        }
        if ($this->supportContactPositionNameExists($positionName, $id)) {
            return response()->json(['message' => 'position_name has already been taken.'], 422);
        }

        $payload = [
            'position_code' => $positionCode,
            'position_name' => $positionName,
        ];
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('support_contact_positions', $payload);
        if ($this->support->hasColumn('support_contact_positions', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_contact_positions')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportContactPositionById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support contact position not found.'], 404);
        }

        $record = $this->appendSupportContactPositionUsageMetadata(
            $record,
            $this->supportContactPositionUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    private function sanitizeSupportContactPositionCode(string $positionCode): string
    {
        $trimmed = trim($positionCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function supportContactPositionCodeExists(string $positionCode, ?int $ignoreId = null): bool
    {
        if (
            $positionCode === ''
            || ! $this->support->hasTable('support_contact_positions')
            || ! $this->support->hasColumn('support_contact_positions', 'position_code')
        ) {
            return false;
        }

        $query = DB::table('support_contact_positions')
            ->whereRaw('UPPER(TRIM(position_code)) = ?', [$positionCode]);

        if ($ignoreId !== null && $this->support->hasColumn('support_contact_positions', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportContactPositionNameExists(string $positionName, ?int $ignoreId = null): bool
    {
        if (
            trim($positionName) === ''
            || ! $this->support->hasTable('support_contact_positions')
            || ! $this->support->hasColumn('support_contact_positions', 'position_name')
        ) {
            return false;
        }

        $normalizedName = function_exists('mb_strtolower')
            ? mb_strtolower(trim($positionName), 'UTF-8')
            : strtolower(trim($positionName));

        $query = DB::table('support_contact_positions')
            ->whereRaw('LOWER(TRIM(position_name)) = ?', [$normalizedName]);

        if ($ignoreId !== null && $this->support->hasColumn('support_contact_positions', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    /**
     * @return array<int, int>
     */
    private function supportContactPositionUsageSummaryById(): array
    {
        $usageByPositionId = [];

        if (! $this->support->hasTable('customer_personnel') || ! $this->support->hasColumn('customer_personnel', 'position_id')) {
            return $usageByPositionId;
        }

        $query = DB::table('customer_personnel')
            ->selectRaw('position_id, COUNT(*) as total')
            ->whereNotNull('position_id');

        if ($this->support->hasColumn('customer_personnel', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        foreach ($query->groupBy('position_id')->get() as $row) {
            $positionId = $this->support->parseNullableInt($row->position_id ?? null);
            if ($positionId === null) {
                continue;
            }

            $usageByPositionId[$positionId] = (int) ($row->total ?? 0);
        }

        return $usageByPositionId;
    }

    /**
     * @param array<int, int> $usageByPositionId
     * @return array<string, mixed>
     */
    private function appendSupportContactPositionUsageMetadata(array $record, array $usageByPositionId): array
    {
        $positionId = $this->support->parseNullableInt($record['id'] ?? null);
        $usedInCustomerPersonnel = $positionId !== null ? (int) ($usageByPositionId[$positionId] ?? 0) : 0;

        $record['used_in_customer_personnel'] = $usedInCustomerPersonnel;
        $record['is_code_editable'] = $usedInCustomerPersonnel === 0;

        return $record;
    }

    private function loadSupportContactPositionById(int $id): ?array
    {
        if (! $this->support->hasTable('support_contact_positions')) {
            return null;
        }

        $record = DB::table('support_contact_positions')
            ->select($this->support->selectColumns('support_contact_positions', [
                'id',
                'position_code',
                'position_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        return $record !== null ? $this->serializeSupportContactPositionRecord((array) $record) : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSupportContactPositionRecord(array $record): array
    {
        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($record['position_code'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'position_code' => $positionCode,
            'position_name' => (string) ($record['position_name'] ?? $positionCode),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'used_in_customer_personnel' => isset($record['used_in_customer_personnel']) ? (int) $record['used_in_customer_personnel'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = $payload['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        if (is_array($payload['errors'] ?? null)) {
            foreach ($payload['errors'] as $fieldErrors) {
                if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                    return trim($fieldErrors[0]);
                }
            }
        }

        return $fallback;
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $fieldErrors) {
            if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                return trim($fieldErrors[0]);
            }
        }

        return 'Dữ liệu không hợp lệ.';
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table)) {
            return false;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }
}
