<?php

namespace App\Services\V5\Document;

use App\Models\InternalUser;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DocumentCatalogService
{
    use ResolvesValidatedInput;

    /**
     * @var array<int, string>
     */
    private const DOCUMENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'EXPIRED'];
    private const DOCUMENT_SCOPE_DEFAULT = 'DEFAULT';
    private const DOCUMENT_SCOPE_PRODUCT_PRICING = 'PRODUCT_PRICING';
    private const PRODUCT_PRICING_DOCUMENT_TYPE_CODE = 'DT_PRICING';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly UserAccessService $userAccessService,
        private readonly DocumentAttachmentService $attachments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('documents')) {
            return $this->support->missingTable('documents');
        }

        $query = DB::table('documents')
            ->select($this->support->selectColumns('documents', [
                'id',
                'document_code',
                'document_name',
                'commission_policy_text',
                'document_type_id',
                'customer_id',
                'project_id',
                'expiry_date',
                'status',
                'created_at',
            ]));

        if ($this->support->hasColumn('documents', 'deleted_at')) {
            $query->whereNull('documents.deleted_at');
        }

        $this->applyDocumentReadScope($request, $query);

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['id', 'document_code', 'document_name'] as $column) {
                    if ($this->support->hasColumn('documents', $column)) {
                        $builder->orWhere("documents.{$column}", 'like', $like);
                    }
                }
            });
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::DOCUMENT_STATUSES, true) && $this->support->hasColumn('documents', 'status')) {
            $query->where('documents.status', $status);
        }

        $customerId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->support->hasColumn('documents', 'customer_id')) {
            $query->where('documents.customer_id', $customerId);
        }

        $projectId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'project_id'));
        if ($projectId !== null && $this->support->hasColumn('documents', 'project_id')) {
            $query->where('documents.project_id', $projectId);
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'documents.id',
            'document_code' => 'documents.document_code',
            'document_name' => 'documents.document_name',
            'status' => 'documents.status',
            'expiry_date' => 'documents.expiry_date',
            'created_at' => 'documents.created_at',
        ], 'documents.id');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'documents.id' && $this->support->hasColumn('documents', 'id')) {
            $query->orderBy('documents.id', 'desc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $serializedRows = $this->serializeDocumentRows(
                    collect($paginator->items())->map(fn (object $item): array => (array) $item)->values()->all()
                );

                return response()->json([
                    'data' => $serializedRows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) count($serializedRows), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $serializedRows = $this->serializeDocumentRows(
                collect($paginator->items())->map(fn (object $item): array => (array) $item)->values()->all()
            );

            return response()->json([
                'data' => $serializedRows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values()
            ->all();

        return response()->json([
            'data' => $this->serializeDocumentRows($rows),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('documents')) {
            return $this->support->missingTable('documents');
        }

        $scope = $this->normalizeDocumentScope((string) ($request->input('scope') ?? self::DOCUMENT_SCOPE_DEFAULT));
        $isProductPricingScope = $scope === self::DOCUMENT_SCOPE_PRODUCT_PRICING;

        $rules = [
            'id' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => [$isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => [$isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['nullable', 'integer'],
            'commissionPolicyText' => ['nullable', 'string', 'max:5000'],
            'expiryDate' => ['nullable', 'date'],
            'releaseDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['nullable', 'array'],
            'productIds.*' => ['integer'],
            'attachments' => ['nullable', 'array'],
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

        if ($this->support->hasColumn('documents', 'document_code')) {
            $uniqueRule = Rule::unique('documents', 'document_code');
            if ($this->support->hasColumn('documents', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['id'][] = $uniqueRule;
        }

        $validated = $this->validatedInput($request, $rules);

        $documentTypeId = null;
        if ($isProductPricingScope) {
            $documentTypeId = $this->resolveOrCreateProductPricingDocumentTypeId();
            if ($this->support->hasColumn('documents', 'document_type_id') && $documentTypeId === null) {
                return response()->json(['message' => 'Không thể xác định loại tài liệu giá sản phẩm.'], 422);
            }
        } else {
            $documentTypeId = $this->resolveDocumentTypeIdFromInput($validated['typeId'] ?? null);
            if ($documentTypeId === null) {
                return response()->json(['message' => 'Loại tài liệu không hợp lệ.'], 422);
            }
        }

        $customerId = null;
        if ($isProductPricingScope) {
            $customerId = $this->resolveProductPricingDocumentCustomerId();
            if ($this->requiresProductPricingDocumentCustomerId() && $customerId === null) {
                return response()->json(['message' => 'Không thể xác định customerId cho tài liệu giá sản phẩm.'], 422);
            }
        } else {
            $customerId = $this->support->parseNullableInt($validated['customerId'] ?? null);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customerId is invalid.'], 422);
            }
        }

        $projectId = null;
        if (! $isProductPricingScope) {
            $projectId = $this->support->parseNullableInt($validated['projectId'] ?? null);
            if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
                return response()->json(['message' => 'projectId is invalid.'], 422);
            }
        }

        $productIds = $this->normalizeDocumentProductIds($validated['productIds'] ?? []);
        if ($productIds !== [] && ! $this->validateProductIds($productIds)) {
            return response()->json(['message' => 'productIds chứa giá trị không hợp lệ.'], 422);
        }

        $documentCode = trim((string) ($validated['id'] ?? ''));
        $documentName = trim((string) ($validated['name'] ?? ''));
        $commissionPolicyText = $this->support->normalizeNullableString($validated['commissionPolicyText'] ?? null);
        $status = $this->normalizeDocumentStatus((string) ($validated['status'] ?? 'ACTIVE'));
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $attachments = is_array($validated['attachments'] ?? null) ? $validated['attachments'] : [];
        $documentDate = $validated['releaseDate'] ?? ($validated['expiryDate'] ?? null);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->support->resolveProjectDepartmentIdById($projectId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $documentId = DB::transaction(function () use (
            $documentCode,
            $documentName,
            $documentTypeId,
            $customerId,
            $projectId,
            $status,
            $actorId,
            $productIds,
            $attachments,
            $documentDate,
            $commissionPolicyText
        ): int {
            $payload = $this->support->filterPayloadByTableColumns('documents', [
                'document_code' => $documentCode,
                'document_name' => $documentName,
                'commission_policy_text' => $commissionPolicyText,
                'document_type_id' => $documentTypeId,
                'customer_id' => $customerId,
                'project_id' => $projectId,
                'expiry_date' => $documentDate,
                'status' => $status,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $createdId = DB::table('documents')->insertGetId($payload);
            $createdNumericId = $this->support->parseNullableInt($createdId) ?? 0;

            $this->syncDocumentProductLinks($createdNumericId, $productIds, $actorId);
            $this->attachments->syncDocumentAttachments($createdNumericId, $attachments, $actorId);

            return $createdNumericId;
        });

        $record = $this->loadDocumentByNumericId($documentId);
        if ($record === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu tài liệu sau khi lưu.'], 500);
        }

        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'documents',
            $documentId,
            null,
            $this->accessAudit->toAuditArray($record)
        );

        return response()->json(['data' => $record], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('documents')) {
            return $this->support->missingTable('documents');
        }

        $scope = $this->normalizeDocumentScope((string) ($request->input('scope') ?? self::DOCUMENT_SCOPE_DEFAULT));
        $isProductPricingScope = $scope === self::DOCUMENT_SCOPE_PRODUCT_PRICING;

        $existingRecord = $this->findDocumentRowByIdentifier($id);
        if ($existingRecord === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $documentId = $this->support->parseNullableInt($existingRecord['id'] ?? null);
        if ($documentId === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $beforeRecord = $this->accessAudit->toAuditArray($existingRecord);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->support->resolveDepartmentIdForTableRecord('documents', $beforeRecord),
            $this->support->extractIntFromRecord($beforeRecord, ['created_by', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $rules = [
            'id' => ['sometimes', 'required', 'string', 'max:100'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['sometimes', 'nullable', 'integer'],
            'commissionPolicyText' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'expiryDate' => ['sometimes', 'nullable', 'date'],
            'releaseDate' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['sometimes', 'nullable', 'array'],
            'productIds.*' => ['integer'],
            'attachments' => ['sometimes', 'nullable', 'array'],
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

        if ($this->support->hasColumn('documents', 'document_code')) {
            $uniqueRule = Rule::unique('documents', 'document_code')->ignore($documentId);
            if ($this->support->hasColumn('documents', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['id'][] = $uniqueRule;
        }

        $validated = $this->validatedInput($request, $rules);

        if (! $isProductPricingScope && array_key_exists('customerId', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customerId']);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customerId is invalid.'], 422);
            }
        }

        if (! $isProductPricingScope && array_key_exists('projectId', $validated)) {
            $projectId = $this->support->parseNullableInt($validated['projectId']);
            if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
                return response()->json(['message' => 'projectId is invalid.'], 422);
            }

            $scopeError = $this->accessAudit->authorizeMutationByScope(
                $request,
                'tài liệu',
                $this->support->resolveProjectDepartmentIdById($projectId),
                $this->accessAudit->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }

        $documentTypeId = null;
        if ($isProductPricingScope) {
            $documentTypeId = $this->resolveOrCreateProductPricingDocumentTypeId();
            if ($this->support->hasColumn('documents', 'document_type_id') && $documentTypeId === null) {
                return response()->json(['message' => 'Không thể xác định loại tài liệu giá sản phẩm.'], 422);
            }
        } elseif (array_key_exists('typeId', $validated)) {
            $documentTypeId = $this->resolveDocumentTypeIdFromInput($validated['typeId']);
            if ($documentTypeId === null) {
                return response()->json(['message' => 'Loại tài liệu không hợp lệ.'], 422);
            }
        }

        $customerIdForProductPricing = null;
        if ($isProductPricingScope) {
            $customerIdForProductPricing = $this->resolveProductPricingDocumentCustomerId();
            if ($this->requiresProductPricingDocumentCustomerId() && $customerIdForProductPricing === null) {
                return response()->json(['message' => 'Không thể xác định customerId cho tài liệu giá sản phẩm.'], 422);
            }
        }

        $productIds = null;
        if (array_key_exists('productIds', $validated)) {
            $productIds = $this->normalizeDocumentProductIds($validated['productIds'] ?? []);
            if ($productIds !== [] && ! $this->validateProductIds($productIds)) {
                return response()->json(['message' => 'productIds chứa giá trị không hợp lệ.'], 422);
            }
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);

        DB::transaction(function () use (
            $documentId,
            $validated,
            $documentTypeId,
            $actorId,
            $productIds,
            $isProductPricingScope,
            $customerIdForProductPricing
        ): void {
            $updates = [];
            if (array_key_exists('id', $validated)) {
                $updates['document_code'] = trim((string) $validated['id']);
            }
            if (array_key_exists('name', $validated)) {
                $updates['document_name'] = trim((string) $validated['name']);
            }
            if (array_key_exists('commissionPolicyText', $validated)) {
                $updates['commission_policy_text'] = $this->support->normalizeNullableString($validated['commissionPolicyText']);
            }
            if ($isProductPricingScope || array_key_exists('typeId', $validated)) {
                $updates['document_type_id'] = $documentTypeId;
            }
            if ($isProductPricingScope) {
                $updates['customer_id'] = $customerIdForProductPricing;
                $updates['project_id'] = null;
            } elseif (array_key_exists('customerId', $validated)) {
                $updates['customer_id'] = $this->support->parseNullableInt($validated['customerId']);
            }
            if (! $isProductPricingScope && array_key_exists('projectId', $validated)) {
                $updates['project_id'] = $this->support->parseNullableInt($validated['projectId']);
            }
            if (array_key_exists('expiryDate', $validated)) {
                $updates['expiry_date'] = $validated['expiryDate'];
            }
            if (array_key_exists('releaseDate', $validated)) {
                $updates['expiry_date'] = $validated['releaseDate'];
            }
            if (array_key_exists('status', $validated)) {
                $updates['status'] = $this->normalizeDocumentStatus((string) $validated['status']);
            }
            if ($this->support->hasColumn('documents', 'updated_by') && $actorId !== null) {
                $updates['updated_by'] = $actorId;
            }

            $filteredUpdates = $this->support->filterPayloadByTableColumns('documents', $updates);
            if ($filteredUpdates !== []) {
                DB::table('documents')->where('id', $documentId)->update($filteredUpdates);
            }

            if ($productIds !== null) {
                $this->syncDocumentProductLinks($documentId, $productIds, $actorId);
            }

            if (array_key_exists('attachments', $validated)) {
                $attachments = is_array($validated['attachments']) ? $validated['attachments'] : [];
                $this->attachments->syncDocumentAttachments($documentId, $attachments, $actorId);
            }
        });

        $record = $this->loadDocumentByNumericId($documentId);
        if ($record === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu tài liệu sau khi cập nhật.'], 500);
        }

        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'documents',
            $documentId,
            $beforeRecord,
            $this->accessAudit->toAuditArray($record)
        );

        return response()->json(['data' => $record]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('documents')) {
            return $this->support->missingTable('documents');
        }

        $existingRecord = $this->findDocumentRowByIdentifier($id);
        if ($existingRecord === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $documentId = $this->support->parseNullableInt($existingRecord['id'] ?? null);
        if ($documentId === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $beforeRecord = $this->accessAudit->toAuditArray($existingRecord);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->support->resolveDepartmentIdForTableRecord('documents', $beforeRecord),
            $this->support->extractIntFromRecord($beforeRecord, ['created_by', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        DB::transaction(function () use ($documentId, $request): void {
            if ($this->support->hasColumn('documents', 'deleted_at')) {
                $payload = ['deleted_at' => now()];
                $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
                if ($actorId !== null && $this->support->hasColumn('documents', 'updated_by')) {
                    $payload['updated_by'] = $actorId;
                }
                if ($this->support->hasColumn('documents', 'updated_at')) {
                    $payload['updated_at'] = now();
                }

                DB::table('documents')
                    ->where('id', $documentId)
                    ->whereNull('deleted_at')
                    ->update($this->support->filterPayloadByTableColumns('documents', $payload));

                return;
            }

            if ($this->support->hasTable('attachments') && $this->support->hasColumn('attachments', 'reference_type') && $this->support->hasColumn('attachments', 'reference_id')) {
                DB::table('attachments')
                    ->where('reference_type', 'DOCUMENT')
                    ->where('reference_id', $documentId)
                    ->delete();
            }

            if ($this->support->hasTable('document_product_links')) {
                DB::table('document_product_links')
                    ->where('document_id', $documentId)
                    ->delete();
            }

            DB::table('documents')->where('id', $documentId)->delete();
        });

        $this->accessAudit->recordAuditEvent(
            $request,
            'DELETE',
            'documents',
            $documentId,
            $beforeRecord,
            null
        );

        return response()->json(['message' => 'Document deleted.']);
    }

    private function applyDocumentReadScope(Request $request, $query): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId): void {
            $applied = false;

            if ($this->support->hasColumn('documents', 'dept_id')) {
                $scope->whereIn('documents.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('documents', 'department_id')) {
                $scope->whereIn('documents.department_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('documents', 'project_id') && $this->support->hasTable('projects')) {
                if ($this->support->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'documents.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->support->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'documents.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if ($this->support->hasColumn('documents', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere('documents.created_by', $userId);
                } else {
                    $scope->where('documents.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    /**
     * @return array<int, int>|null
     */
    private function resolveAllowedDepartmentIdsForRequest(Request $request): ?array
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof InternalUser) {
            return [];
        }

        return $this->userAccessService->resolveDepartmentIdsForUser((int) $authenticatedUser->id);
    }

    private function normalizeDocumentStatus(string $status): string
    {
        $normalized = strtoupper(trim($status));

        return in_array($normalized, self::DOCUMENT_STATUSES, true) ? $normalized : 'ACTIVE';
    }

    private function normalizeDocumentScope(string $scope): string
    {
        $normalized = strtoupper(trim($scope));
        if ($normalized === self::DOCUMENT_SCOPE_PRODUCT_PRICING) {
            return self::DOCUMENT_SCOPE_PRODUCT_PRICING;
        }

        return self::DOCUMENT_SCOPE_DEFAULT;
    }

    private function resolveOrCreateProductPricingDocumentTypeId(): ?int
    {
        if (! $this->support->hasTable('document_types')) {
            if (! $this->support->hasColumn('documents', 'document_type_id')) {
                return null;
            }

            return $this->support->parseNullableInt(
                DB::table('documents')
                    ->whereNotNull('document_type_id')
                    ->value('document_type_id')
            );
        }

        $columns = $this->support->selectColumns('document_types', ['id', 'type_code', 'type_name', 'created_at']);
        if (! in_array('id', $columns, true) || ! in_array('type_code', $columns, true)) {
            return null;
        }

        $existingId = DB::table('document_types')
            ->where('type_code', self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE)
            ->value('id');
        $existingNumericId = $this->support->parseNullableInt($existingId);
        if ($existingNumericId !== null) {
            return $existingNumericId;
        }

        $payload = $this->support->filterPayloadByTableColumns('document_types', [
            'type_code' => self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE,
            'type_name' => 'Văn bản giá sản phẩm',
            'created_at' => now(),
        ]);

        try {
            $createdId = DB::table('document_types')->insertGetId($payload);
            $createdNumericId = $this->support->parseNullableInt($createdId);
            if ($createdNumericId !== null) {
                return $createdNumericId;
            }
        } catch (\Throwable) {
            // Ignore unique-race and re-query.
        }

        return $this->support->parseNullableInt(
            DB::table('document_types')
                ->where('type_code', self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE)
                ->value('id')
        );
    }

    private function resolveProductPricingDocumentCustomerId(): ?int
    {
        if (! $this->support->hasColumn('documents', 'customer_id')) {
            return null;
        }

        if ($this->isColumnNullable('documents', 'customer_id')) {
            return null;
        }

        if (! $this->support->hasTable('customers')) {
            return 0;
        }

        return 0;
    }

    private function requiresProductPricingDocumentCustomerId(): bool
    {
        return $this->support->hasColumn('documents', 'customer_id')
            && ! $this->isColumnNullable('documents', 'customer_id');
    }

    private function resolveDocumentTypeIdFromInput(mixed $input): ?int
    {
        if (! $this->support->hasTable('document_types')) {
            return $this->support->parseNullableInt($input);
        }

        $numeric = $this->support->parseNullableInt($input);
        if ($numeric !== null && DB::table('document_types')->where('id', $numeric)->exists()) {
            return $numeric;
        }

        $typeCode = trim((string) ($input ?? ''));
        if ($typeCode === '') {
            return null;
        }

        $resolved = DB::table('document_types')
            ->where('type_code', $typeCode)
            ->value('id');

        if ($resolved === null) {
            $resolved = DB::table('document_types')
                ->whereRaw('UPPER(type_code) = ?', [strtoupper($typeCode)])
                ->value('id');
        }

        return $this->support->parseNullableInt($resolved);
    }

    private function findDocumentRowByIdentifier(string $identifier): ?array
    {
        if (! $this->support->hasTable('documents')) {
            return null;
        }

        $token = trim($identifier);
        if ($token === '') {
            return null;
        }

        $numericId = $this->support->parseNullableInt($token);
        if ($numericId !== null) {
            $byIdQuery = DB::table('documents')->where('id', $numericId);
            if ($this->support->hasColumn('documents', 'deleted_at')) {
                $byIdQuery->whereNull('deleted_at');
            }
            $byId = $byIdQuery->first();
            if ($byId !== null) {
                return (array) $byId;
            }
        }

        if ($this->support->hasColumn('documents', 'document_code')) {
            $byCodeQuery = DB::table('documents')->where('document_code', $token);
            if ($this->support->hasColumn('documents', 'deleted_at')) {
                $byCodeQuery->whereNull('deleted_at');
            }
            $byCode = $byCodeQuery->first();
            if ($byCode !== null) {
                return (array) $byCode;
            }
        }

        return null;
    }

    private function loadDocumentByNumericId(int $documentId): ?array
    {
        if ($documentId <= 0 || ! $this->support->hasTable('documents')) {
            return null;
        }

        $record = DB::table('documents')
            ->select($this->support->selectColumns('documents', [
                'id',
                'document_code',
                'document_name',
                'commission_policy_text',
                'document_type_id',
                'customer_id',
                'project_id',
                'expiry_date',
                'status',
                'created_at',
            ]))
            ->where('id', $documentId)
            ->when($this->support->hasColumn('documents', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        if ($record === null) {
            return null;
        }

        $typeCodeMap = $this->buildDocumentTypeCodeMap();
        $attachmentMap = $this->attachments->loadDocumentAttachmentMap([$documentId]);
        $productIdsMap = $this->loadDocumentProductIdsMap([$documentId]);

        return $this->serializeDocumentRecord((array) $record, $typeCodeMap, $attachmentMap, $productIdsMap);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function serializeDocumentRows(array $rows): array
    {
        $documentTypeCodeById = $this->buildDocumentTypeCodeMap();
        $documentIds = collect($rows)
            ->map(fn (array $row): ?int => $this->support->parseNullableInt($row['id'] ?? null))
            ->filter(fn (?int $id): bool => $id !== null)
            ->values()
            ->all();

        $attachmentMap = $this->attachments->loadDocumentAttachmentMap($documentIds);
        $productIdsMap = $this->loadDocumentProductIdsMap($documentIds);

        return collect($rows)
            ->map(fn (array $row): array => $this->serializeDocumentRecord(
                $row,
                $documentTypeCodeById,
                $attachmentMap,
                $productIdsMap
            ))
            ->values()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function buildDocumentTypeCodeMap(): array
    {
        if (! $this->support->hasTable('document_types')) {
            return [];
        }

        $rows = DB::table('document_types')
            ->select($this->support->selectColumns('document_types', ['id', 'type_code']))
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            if (! array_key_exists('id', $row) || ! array_key_exists('type_code', $row)) {
                continue;
            }

            $map[(string) $row['id']] = (string) $row['type_code'];
        }

        return $map;
    }

    /**
     * @param array<int, int> $documentIds
     * @return array<string, array<int, string>>
     */
    private function loadDocumentProductIdsMap(array $documentIds): array
    {
        if (
            $documentIds === []
            || ! $this->support->hasTable('document_product_links')
            || ! $this->support->hasColumn('document_product_links', 'document_id')
            || ! $this->support->hasColumn('document_product_links', 'product_id')
        ) {
            return [];
        }

        $query = DB::table('document_product_links')
            ->select($this->support->selectColumns('document_product_links', [
                'document_id',
                'product_id',
            ]))
            ->whereIn('document_id', $documentIds);

        if ($this->support->hasColumn('document_product_links', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $documentId = (string) ($row['document_id'] ?? '');
            $productId = (string) ($row['product_id'] ?? '');
            if ($documentId === '' || $productId === '') {
                continue;
            }

            $map[$documentId] ??= [];
            if (! in_array($productId, $map[$documentId], true)) {
                $map[$documentId][] = $productId;
            }
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $productIds
     * @return array<int, int>
     */
    private function normalizeDocumentProductIds(array $productIds): array
    {
        $normalized = [];
        foreach ($productIds as $value) {
            $productId = $this->support->parseNullableInt($value);
            if ($productId === null || $productId <= 0) {
                continue;
            }

            $normalized[] = $productId;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param array<int, int> $productIds
     */
    private function validateProductIds(array $productIds): bool
    {
        if ($productIds === []) {
            return true;
        }

        if (! $this->support->hasTable('products')) {
            return false;
        }

        $query = DB::table('products')->whereIn('id', $productIds);
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->count() === count($productIds);
    }

    /**
     * @param array<int, int> $productIds
     */
    private function syncDocumentProductLinks(int $documentId, array $productIds, ?int $actorId): void
    {
        if (
            ! $this->support->hasTable('document_product_links')
            || ! $this->support->hasColumn('document_product_links', 'document_id')
            || ! $this->support->hasColumn('document_product_links', 'product_id')
        ) {
            return;
        }

        DB::table('document_product_links')
            ->where('document_id', $documentId)
            ->delete();

        if ($productIds === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($productIds as $productId) {
            $payload = $this->support->filterPayloadByTableColumns('document_product_links', [
                'document_id' => $documentId,
                'product_id' => $productId,
                'created_at' => $now,
                'created_by' => $actorId,
            ]);

            if (
                array_key_exists('document_id', $payload)
                && array_key_exists('product_id', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('document_product_links')->insert($records);
        }
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, string> $documentTypeCodeById
     * @param array<string, array<int, array<string, mixed>>> $attachmentMap
     * @param array<string, array<int, string>> $productIdsMap
     * @return array<string, mixed>
     */
    private function serializeDocumentRecord(
        array $row,
        array $documentTypeCodeById,
        array $attachmentMap,
        array $productIdsMap
    ): array {
        $status = $this->normalizeDocumentStatus((string) ($row['status'] ?? 'ACTIVE'));
        $documentId = (string) ($row['id'] ?? '');
        $documentCode = (string) ($this->support->firstNonEmpty($row, ['document_code', 'id'], ''));
        $documentTypeId = (string) ($row['document_type_id'] ?? '');
        $typeId = $documentTypeCodeById[$documentTypeId] ?? $documentTypeId;
        $productIds = $productIdsMap[$documentId] ?? [];
        $customerId = $this->support->parseNullableInt($row['customer_id'] ?? null);
        $normalizedCustomerId = ($customerId !== null && $customerId > 0) ? (string) $customerId : '';

        return [
            'id' => $documentCode,
            'name' => (string) ($row['document_name'] ?? ''),
            'commissionPolicyText' => $this->support->normalizeNullableString($row['commission_policy_text'] ?? null),
            'typeId' => (string) $typeId,
            'customerId' => $normalizedCustomerId,
            'projectId' => $row['project_id'] === null ? null : (string) $row['project_id'],
            'productId' => $productIds[0] ?? null,
            'productIds' => $productIds,
            'expiryDate' => $this->formatDateColumn($row['expiry_date'] ?? null),
            'status' => $status,
            'attachments' => $attachmentMap[$documentId] ?? [],
            'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
        ];
    }

    private function formatDateColumn(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $text, $matches) === 1) {
            return $matches[0];
        }

        return $text;
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

    private function isColumnNullable(string $table, string $column): bool
    {
        if (! $this->support->hasColumn($table, $column)) {
            return false;
        }

        try {
            $connection = DB::connection();
            $driver = $connection->getDriverName();

            if ($driver === 'sqlite') {
                $columns = $connection->select(sprintf("PRAGMA table_info('%s')", str_replace("'", "''", $table)));
                foreach ($columns as $columnInfo) {
                    if (strcasecmp((string) ($columnInfo->name ?? ''), $column) !== 0) {
                        continue;
                    }

                    return (int) ($columnInfo->notnull ?? 1) === 0;
                }

                return false;
            }

            $databaseName = $connection->getDatabaseName();
            $columnInfo = $connection->table('information_schema.COLUMNS')
                ->select(['IS_NULLABLE'])
                ->where('TABLE_SCHEMA', $databaseName)
                ->where('TABLE_NAME', $table)
                ->where('COLUMN_NAME', $column)
                ->first();

            if ($columnInfo === null) {
                return false;
            }

            return strtoupper((string) ($columnInfo->IS_NULLABLE ?? 'NO')) === 'YES';
        } catch (\Throwable) {
            return false;
        }
    }
}
