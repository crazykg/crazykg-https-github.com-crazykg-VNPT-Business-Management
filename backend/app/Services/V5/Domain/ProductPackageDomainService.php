<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

class ProductPackageDomainService
{
    use ResolvesValidatedInput;

    private const ATTACHMENT_REFERENCE_TYPE = 'PRODUCT_PACKAGE';
    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;
    private const BACKBLAZE_B2_STORAGE_DISK = 'backblaze_b2';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly ProductDomainService $productService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }

        $query = $this->baseQuery()->orderBy('product_packages.id');

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->support->hasColumn('product_packages', 'package_code')) {
                    $builder->orWhere('product_packages.package_code', 'like', $like);
                }
                if ($this->support->hasColumn('product_packages', 'package_name')) {
                    $builder->orWhere('product_packages.package_name', 'like', $like);
                }
                if ($this->support->hasColumn('products', 'product_code')) {
                    $builder->orWhere('products.product_code', 'like', $like);
                }
                if ($this->support->hasColumn('products', 'product_name')) {
                    $builder->orWhere('products.product_name', 'like', $like);
                }
            });
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $attachmentMap = $this->loadAttachmentMap(
            $rows
                ->pluck('id')
                ->map(fn (mixed $value): int => (int) $value)
                ->filter(fn (int $value): bool => $value > 0)
                ->values()
                ->all()
        );

        $data = $rows
            ->map(fn (array $row): array => $this->serializeRecord(
                $row,
                $attachmentMap[(string) ($row['id'] ?? '')] ?? []
            ))
            ->values();

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }

        $validated = $this->validatedInput($request, $this->validationRules());

        $productId = $this->support->parseNullableInt($validated['product_id'] ?? null);
        if ($productId === null || ! $this->activeProductExists($productId)) {
            return response()->json(['message' => 'product_id is invalid.'], 422);
        }

        $attachments = is_array($validated['attachments'] ?? null) ? $validated['attachments'] : [];
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $payload = $this->support->filterPayloadByTableColumns('product_packages', [
            'product_id' => $productId,
            'package_code' => trim((string) ($validated['package_code'] ?? '')),
            'package_name' => trim((string) ($validated['package_name'] ?? '')),
            'standard_price' => max(0, (float) ($validated['standard_price'] ?? 0)),
            'unit' => $this->support->normalizeNullableString($validated['unit'] ?? null),
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        if ($this->support->hasColumn('product_packages', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('product_packages', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        try {
            $insertId = (int) DB::table('product_packages')->insertGetId($payload);
            $this->syncAttachments($insertId, $attachments, $actorId);
            $this->productService->syncProductHasPackageFlags([$productId]);
        } catch (QueryException $exception) {
            return response()->json([
                'message' => $this->isUniqueConstraintViolation($exception)
                    ? 'Mã gói cước đã tồn tại.'
                    : 'Không thể tạo gói cước sản phẩm.',
            ], 422);
        }

        $record = $this->loadById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Product package created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:1000'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/product-packages', 'POST', (array) $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());

                $response = $this->store($subRequest);
                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể lưu gói cước từ file import.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo gói cước.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
            } catch (\Illuminate\Validation\ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể lưu gói cước từ file import.',
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
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }

        $current = $this->baseQuery()
            ->where('product_packages.id', $id)
            ->first();

        if ($current === null) {
            return response()->json(['message' => 'Product package not found.'], 404);
        }

        $currentRow = (array) $current;
        $currentProductId = $this->support->parseNullableInt($currentRow['product_id'] ?? null);
        $validated = $this->validatedInput($request, $this->validationRules(true, $id));
        $attachmentsProvided = array_key_exists('attachments', $validated);
        $attachments = $attachmentsProvided && is_array($validated['attachments'] ?? null)
            ? $validated['attachments']
            : [];

        $payload = [];
        $nextProductId = $currentProductId;

        if (array_key_exists('product_id', $validated)) {
            $nextProductId = $this->support->parseNullableInt($validated['product_id']);
            if ($nextProductId === null || ! $this->activeProductExists($nextProductId)) {
                return response()->json(['message' => 'product_id is invalid.'], 422);
            }
            $payload['product_id'] = $nextProductId;
        }
        if (array_key_exists('package_code', $validated)) {
            $payload['package_code'] = trim((string) $validated['package_code']);
        }
        if (array_key_exists('package_name', $validated)) {
            $payload['package_name'] = trim((string) $validated['package_name']);
        }
        if (array_key_exists('standard_price', $validated)) {
            $payload['standard_price'] = max(0, (float) $validated['standard_price']);
        }
        if (array_key_exists('unit', $validated)) {
            $payload['unit'] = $this->support->normalizeNullableString($validated['unit']);
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }

        if ($payload === [] && ! $attachmentsProvided) {
            $record = $this->loadById($id);

            return response()->json(['data' => $record ?? $this->serializeRecord($currentRow)]);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null && $this->support->hasColumn('product_packages', 'updated_by')) {
            $payload['updated_by'] = $actorId;
        }
        if (($payload !== [] || $attachmentsProvided) && $this->support->hasColumn('product_packages', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $payload = $this->support->filterPayloadByTableColumns('product_packages', $payload);

        if ($payload !== []) {
            try {
                DB::table('product_packages')->where('id', $id)->update($payload);
            } catch (QueryException $exception) {
                return response()->json([
                    'message' => $this->isUniqueConstraintViolation($exception)
                        ? 'Mã gói cước đã tồn tại.'
                        : 'Không thể cập nhật gói cước sản phẩm.',
                ], 422);
            }
        }

        if ($attachmentsProvided) {
            $this->syncAttachments($id, $attachments, $actorId);
        }

        $syncProductIds = array_values(array_unique(array_filter([$currentProductId, $nextProductId])));
        if ($syncProductIds !== []) {
            $this->productService->syncProductHasPackageFlags($syncProductIds);
        }

        $record = $this->loadById($id);
        if ($record === null) {
            return response()->json(['message' => 'Product package updated but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }

        $record = DB::table('product_packages')
            ->select($this->support->selectColumns('product_packages', ['id', 'product_id']))
            ->where('id', $id)
            ->when($this->support->hasColumn('product_packages', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        if ($record === null) {
            return response()->json(['message' => 'Product package not found.'], 404);
        }

        $productId = $this->support->parseNullableInt($record->product_id ?? null);
        if ($this->support->hasColumn('product_packages', 'deleted_at')) {
            $payload = ['deleted_at' => now()];
            $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
            if ($actorId !== null && $this->support->hasColumn('product_packages', 'updated_by')) {
                $payload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn('product_packages', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            DB::table('product_packages')
                ->where('id', $id)
                ->update($this->support->filterPayloadByTableColumns('product_packages', $payload));
        } else {
            DB::table('product_packages')->where('id', $id)->delete();
        }

        if ($productId !== null) {
            $this->productService->syncProductHasPackageFlags([$productId]);
        }

        return response()->json(['message' => 'Product package deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validationRules(bool $partial = false, ?int $ignoreId = null): array
    {
        $rules = [
            'product_id' => $partial ? ['sometimes', 'integer'] : ['required', 'integer'],
            'package_code' => $partial ? ['sometimes', 'string', 'max:100'] : ['required', 'string', 'max:100'],
            'package_name' => $partial ? ['sometimes', 'nullable', 'string', 'max:255'] : ['nullable', 'string', 'max:255'],
            'standard_price' => $partial ? ['sometimes', 'numeric', 'min:0'] : ['nullable', 'numeric', 'min:0'],
            'unit' => $partial ? ['sometimes', 'nullable', 'string', 'max:50'] : ['nullable', 'string', 'max:50'],
            'description' => $partial ? ['sometimes', 'nullable', 'string', 'max:2000'] : ['nullable', 'string', 'max:2000'],
            'is_active' => $partial ? ['sometimes', 'boolean'] : ['nullable', 'boolean'],
            'attachments' => $partial ? ['sometimes', 'nullable', 'array'] : ['nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
        ];

        if ($this->support->hasColumn('product_packages', 'package_code')) {
            $uniqueRule = \Illuminate\Validation\Rule::unique('product_packages', 'package_code');
            if ($ignoreId !== null) {
                $uniqueRule = $uniqueRule->ignore($ignoreId);
            }
            if ($this->support->hasColumn('product_packages', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['package_code'][] = $uniqueRule;
        }

        return $rules;
    }

    private function baseQuery()
    {
        $query = DB::table('product_packages')
            ->leftJoin('products', 'products.id', '=', 'product_packages.product_id')
            ->select($this->selectColumns());

        if ($this->support->hasColumn('product_packages', 'deleted_at')) {
            $query->whereNull('product_packages.deleted_at');
        }
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $query->whereNull('products.deleted_at');
        }

        return $query;
    }

    /**
     * @return array<int, string>
     */
    private function selectColumns(): array
    {
        $columns = [];

        foreach ([
            'id',
            'product_id',
            'package_code',
            'package_name',
            'standard_price',
            'unit',
            'description',
            'is_active',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
        ] as $column) {
            if ($this->support->hasColumn('product_packages', $column)) {
                $columns[] = "product_packages.{$column}";
            }
        }

        if ($this->support->hasColumn('products', 'product_code')) {
            $columns[] = 'products.product_code as parent_product_code';
        }
        if ($this->support->hasColumn('products', 'product_name')) {
            $columns[] = 'products.product_name';
        }
        if ($this->support->hasColumn('products', 'service_group')) {
            $columns[] = 'products.service_group';
        }
        if ($this->support->hasColumn('products', 'domain_id')) {
            $columns[] = 'products.domain_id';
        }
        if ($this->support->hasColumn('products', 'vendor_id')) {
            $columns[] = 'products.vendor_id';
        }

        return $columns;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<int, array<string, mixed>> $attachments
     * @return array<string, mixed>
     */
    private function serializeRecord(array $record, array $attachments = []): array
    {
        return [
            'id' => $record['id'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'package_code' => (string) ($record['package_code'] ?? ''),
            'package_name' => (string) ($record['package_name'] ?? ''),
            'product_name' => (string) ($record['product_name'] ?? ''),
            'parent_product_code' => $this->support->normalizeNullableString($record['parent_product_code'] ?? null),
            'service_group' => $this->support->normalizeNullableString($record['service_group'] ?? null),
            'domain_id' => $record['domain_id'] ?? null,
            'vendor_id' => $record['vendor_id'] ?? null,
            'standard_price' => (float) ($record['standard_price'] ?? 0),
            'unit' => $this->support->normalizeNullableString($record['unit'] ?? null),
            'description' => $this->support->normalizeNullableString($record['description'] ?? null),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'attachments' => array_values($attachments),
        ];
    }

    private function loadById(int $id): ?array
    {
        $record = $this->baseQuery()
            ->where('product_packages.id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        $attachmentMap = $this->loadAttachmentMap([$id]);

        return $this->serializeRecord(
            (array) $record,
            $attachmentMap[(string) $id] ?? []
        );
    }

    private function activeProductExists(int $id): bool
    {
        if (! $this->support->hasTable('products')) {
            return false;
        }

        return DB::table('products')
            ->where('id', $id)
            ->when($this->support->hasColumn('products', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->exists();
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = is_array($payload) ? ($payload['message'] ?? null) : null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        $errors = is_array($payload) ? ($payload['errors'] ?? null) : null;
        if (is_array($errors)) {
            foreach ($errors as $error) {
                if (is_array($error) && isset($error[0]) && is_string($error[0]) && trim($error[0]) !== '') {
                    return trim($error[0]);
                }
                if (is_string($error) && trim($error) !== '') {
                    return trim($error);
                }
            }
        }

        return $fallback;
    }

    private function firstValidationMessage(\Illuminate\Validation\ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $errorMessages) {
            if (is_array($errorMessages) && isset($errorMessages[0]) && is_string($errorMessages[0]) && trim($errorMessages[0]) !== '') {
                return trim($errorMessages[0]);
            }
        }

        return 'Dữ liệu không hợp lệ.';
    }

    /**
     * @param array<int, int> $packageIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadAttachmentMap(array $packageIds): array
    {
        if (
            $packageIds === []
            || ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $rows = DB::table('attachments')
            ->select($this->support->selectColumns('attachments', [
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ]))
            ->where('reference_type', self::ATTACHMENT_REFERENCE_TYPE)
            ->whereIn('reference_id', $packageIds)
            ->when($this->support->hasColumn('attachments', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->orderBy('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }
            $map[$referenceId][] = $this->serializeAttachmentRecord($row);
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncAttachments(int $packageId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', self::ATTACHMENT_REFERENCE_TYPE)
            ->where('reference_id', $packageId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) $this->support->firstNonEmpty($item, ['fileName', 'file_name'], ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->support->parseNullableInt($this->support->firstNonEmpty($item, ['fileSize', 'file_size'], 0)) ?? 0;
            $storagePath = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storagePath', 'storage_path']));
            $storageDisk = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageDisk', 'storage_disk']));
            $storageVisibility = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageVisibility', 'storage_visibility']));
            $payload = $this->support->filterPayloadByTableColumns('attachments', [
                'reference_type' => self::ATTACHMENT_REFERENCE_TYPE,
                'reference_id' => $packageId,
                'file_name' => $fileName,
                'file_url' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['fileUrl', 'file_url'])),
                'drive_file_id' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['driveFileId', 'drive_file_id'])),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['mimeType', 'mime_type'])),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeAttachmentRecord(array $record): array
    {
        return [
            'id' => (string) ($record['id'] ?? ''),
            'fileName' => (string) ($record['file_name'] ?? ''),
            'mimeType' => (string) ($this->support->firstNonEmpty($record, ['mime_type'], 'application/octet-stream')),
            'fileSize' => (int) ($record['file_size'] ?? 0),
            'fileUrl' => $this->resolveAttachmentFileUrl($record),
            'driveFileId' => (string) ($record['drive_file_id'] ?? ''),
            'createdAt' => $this->formatDateColumn($record['created_at'] ?? null) ?? '',
            'storagePath' => $this->support->normalizeNullableString($record['storage_path'] ?? null),
            'storageDisk' => $this->support->normalizeNullableString($record['storage_disk'] ?? null),
            'storageVisibility' => $this->support->normalizeNullableString($record['storage_visibility'] ?? null),
            'storageProvider' => $this->support->normalizeNullableString($record['drive_file_id'] ?? null) !== null
                ? 'GOOGLE_DRIVE'
                : (($this->support->normalizeNullableString($record['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
        ];
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function resolveAttachmentFileUrl(array $attachment): string
    {
        $storedPath = $this->support->normalizeNullableString($attachment['storage_path'] ?? null);
        $storedDisk = $this->support->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->support->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';
        $attachmentId = $this->support->parseNullableInt($attachment['id'] ?? null);

        if ($storedPath !== null) {
            if ($attachmentId !== null) {
                $signedUrl = $this->buildSignedAttachmentDownloadUrl($attachmentId);
                if ($signedUrl !== '') {
                    return $signedUrl;
                }
            }

            $temporaryUrl = $this->buildSignedTempAttachmentDownloadUrl($storedDisk, $storedPath, $fileName);
            if ($temporaryUrl !== '') {
                return $temporaryUrl;
            }
        }

        return (string) ($attachment['file_url'] ?? '');
    }

    private function buildSignedAttachmentDownloadUrl(int $attachmentId): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.attachments.download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                ['id' => $attachmentId],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function buildSignedTempAttachmentDownloadUrl(string $disk, string $path, string $name): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.temp-download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                [
                    'disk' => $disk,
                    'path' => $path,
                    'name' => $name,
                ],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function formatDateColumn(mixed $value): ?string
    {
        $normalized = $this->support->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return \Illuminate\Support\Carbon::parse($normalized)->toDateString();
        } catch (\Throwable) {
            return $normalized;
        }
    }

    private function isUniqueConstraintViolation(QueryException $exception): bool
    {
        $sqlState = $exception->errorInfo[0] ?? null;
        $driverCode = $exception->errorInfo[1] ?? null;

        return $sqlState === '23000' || $driverCode === 1062;
    }
}
