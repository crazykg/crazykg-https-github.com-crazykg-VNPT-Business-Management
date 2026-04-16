<?php

namespace App\Services\V5\Domain;

use App\Models\ProductQuotationDefaultSetting;
use App\Models\ProductQuotation;
use App\Models\ProductQuotationEvent;
use App\Models\ProductQuotationItem;
use App\Models\ProductQuotationVersion;
use App\Models\ProductQuotationVersionItem;
use App\Services\V5\IntegrationSettings\EmailSmtpIntegrationService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

class ProductQuotationDomainService
{
    private const STATUS_DRAFT = 'DRAFT';
    private const VERSION_STATUS_PENDING = 'PENDING';
    private const VERSION_STATUS_SUCCESS = 'SUCCESS';
    private const VERSION_STATUS_FAILED = 'FAILED';
    private const TEMPLATE_KEY_DEFAULT = 'default';
    private const TEMPLATE_KEY_MULTI_VAT = 'multi_vat';
    private const EVENT_DRAFT_CREATED = 'DRAFT_CREATED';
    private const EVENT_DRAFT_UPDATED = 'DRAFT_UPDATED';
    private const EVENT_PRINT_CONFIRMED = 'PRINT_CONFIRMED';
    private const EVENT_PRINT_FAILED = 'PRINT_FAILED';
    private const DEFAULT_SCOPE_SUMMARY = 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị';
    private const DEFAULT_NOTES = [
        'Giá cước trên đã bao gồm chi phí vận hành cơ bản và các dịch vụ có liên quan.',
        'Giá cước trên chưa bao gồm chi phí tích hợp với các phần mềm khác, tùy chỉnh chức năng đang có, phát triển chức năng mới hoặc chuyển đổi dữ liệu.',
        'Các yêu cầu ngoài phạm vi tiêu chuẩn sẽ được khảo sát và báo giá bổ sung theo khối lượng thực tế.',
        'Báo giá có hiệu lực trong vòng 90 ngày kể từ ngày ký.',
    ];
    private const DEFAULT_CONTACT_LINE = 'Ông Phan Văn Rở - Giám đốc - Phòng Giải pháp 2 - Trung tâm Kinh doanh Giải pháp, số điện thoại: 0945.200.052./.';
    private const DEFAULT_CLOSING_MESSAGE = 'Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ rất mong nhận được sự ủng hộ từ Quý đơn vị và hân hạnh phục vụ!';
    private const DEFAULT_SIGNATORY_TITLE = 'GIÁM ĐỐC';
    private const DEFAULT_SIGNATORY_UNIT = 'TRUNG TÂM KINH DOANH GIẢI PHÁP';
    private const DEFAULT_SIGNATORY_NAME = '';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly ProductQuotationExportService $quotationExportService,
        private readonly EmailSmtpIntegrationService $emailSmtp
    ) {}

    public function defaultSettings(Request $request): JsonResponse
    {
        if ($missingTableResponse = $this->missingDefaultSettingsTableResponse()) {
            return $missingTableResponse;
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $settings = $actorId === null
            ? null
            : ProductQuotationDefaultSetting::query()->where('user_id', $actorId)->first();

        return response()->json([
            'data' => $this->serializeDefaultSettings($settings, $actorId),
        ]);
    }

    public function updateDefaultSettings(Request $request): JsonResponse
    {
        if ($missingTableResponse = $this->missingDefaultSettingsTableResponse()) {
            return $missingTableResponse;
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId === null) {
            return response()->json(['message' => 'Bạn cần đăng nhập để lưu cấu hình mặc định báo giá.'], 401);
        }

        $normalized = $this->normalizeDefaultSettingsPayload($request);

        $settings = DB::transaction(function () use ($request, $actorId, $normalized): ProductQuotationDefaultSetting {
            $settings = ProductQuotationDefaultSetting::query()->firstOrNew(['user_id' => $actorId]);
            $beforeSnapshot = $settings->exists ? $this->serializeDefaultSettingsAuditSnapshot($settings) : null;

            $settings->fill([
                'scope_summary' => $normalized['scope_summary'],
                'validity_days' => $normalized['validity_days'],
                'notes_text' => $normalized['notes_text'],
                'contact_line' => $normalized['contact_line'],
                'closing_message' => $normalized['closing_message'],
                'signatory_title' => $normalized['signatory_title'],
                'signatory_unit' => $normalized['signatory_unit'],
                'signatory_name' => $normalized['signatory_name'],
                'updated_by' => $actorId,
            ]);

            if (! $settings->exists) {
                $settings->created_by = $actorId;
            }

            $settings->save();

            $this->accessAudit->recordAuditEvent(
                $request,
                $beforeSnapshot === null ? 'INSERT' : 'UPDATE',
                'product_quotation_default_settings',
                $settings->id,
                $beforeSnapshot,
                $this->serializeDefaultSettingsAuditSnapshot($settings)
            );

            return $settings->fresh();
        });

        return response()->json([
            'data' => $this->serializeDefaultSettings($settings, $actorId),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        $query = ProductQuotation::query()
            ->select([
                'id',
                'uuid',
                'customer_id',
                'recipient_name',
                'sender_city',
                'quote_date',
                'subtotal',
                'vat_amount',
                'total_amount',
                'uses_multi_vat_template',
                'latest_version_no',
                'last_printed_at',
                'last_printed_by',
                'status',
                'created_at',
                'updated_at',
            ])
            ->withCount(['items', 'versions', 'events']);

        $mineOnly = filter_var((string) ($this->support->readFilterParam($request, 'mine', $request->query('mine', '')) ?? ''), FILTER_VALIDATE_BOOL);
        if ($mineOnly) {
            $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
            if ($actorId === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where('created_by', $actorId);
            }
        }

        $historyOnly = filter_var((string) ($this->support->readFilterParam($request, 'history_only', $request->query('history_only', '')) ?? ''), FILTER_VALIDATE_BOOL);
        if ($historyOnly) {
            $query->where('total_amount', '>', 0);
        }

        $customerIdInput = $this->support->readFilterParam($request, 'customer_id');
        $customerId = $this->support->parseNullableInt($customerIdInput);
        if ($customerId !== null) {
            $query->where('customer_id', $customerId);
        }

        $updatedFromRaw = trim((string) ($this->support->readFilterParam($request, 'updated_from', '') ?? ''));
        if ($updatedFromRaw !== '') {
            try {
                $updatedFrom = Carbon::parse($updatedFromRaw);
                $query->where('updated_at', '>=', $updatedFrom);
            } catch (Throwable) {
                return response()->json(['message' => 'updated_from is invalid.'], 422);
            }
        }

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($builder) use ($like): void {
                foreach (['recipient_name', 'sender_city', 'status', 'signatory_name'] as $column) {
                    $builder->orWhere($column, 'like', $like);
                }

                $builder->orWhere('id', 'like', $like)
                    ->orWhere('uuid', 'like', $like);
            });
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'product_quotations.id',
            'recipient_name' => 'product_quotations.recipient_name',
            'latest_version_no' => 'product_quotations.latest_version_no',
            'last_printed_at' => 'product_quotations.last_printed_at',
            'created_at' => 'product_quotations.created_at',
            'updated_at' => 'product_quotations.updated_at',
        ], 'product_quotations.updated_at');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'product_quotations.id') {
            $query->orderBy('product_quotations.id', 'desc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
            $latestVersionMap = $this->resolveLatestVersionMap(
                $rows->map(fn (ProductQuotation $quotation): int => (int) $quotation->id)->all()
            );

            return response()->json([
                'data' => $rows
                    ->map(fn (ProductQuotation $quotation): array => $this->serializeQuotationListItem($quotation, $latestVersionMap))
                    ->values(),
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query->get();
        $latestVersionMap = $this->resolveLatestVersionMap(
            $rows->map(fn (ProductQuotation $quotation): int => (int) $quotation->id)->all()
        );

        return response()->json([
            'data' => $rows
                ->map(fn (ProductQuotation $quotation): array => $this->serializeQuotationListItem($quotation, $latestVersionMap))
                ->values(),
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        $quotation = ProductQuotation::query()
            ->with(['items'])
            ->withCount(['versions', 'events'])
            ->find($id);

        if (! $quotation instanceof ProductQuotation) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        return response()->json([
            'data' => $this->serializeQuotationDetail($quotation),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        $normalized = $this->normalizeDraftPayload($request);
        if ($draftValidation = $this->validatePersistableDraftPayload($normalized)) {
            return $draftValidation;
        }
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $customerId = $this->resolveCustomerId($request);
        if ($customerId instanceof JsonResponse) {
            return $customerId;
        }

        $draftPayload = $this->buildDraftPayload(
            $normalized,
            $customerId,
            $request->input('quote_date'),
            $actorId,
            true
        );
        $itemPayloads = $this->buildDraftItemPayloads($normalized['items']);

        $quotation = DB::transaction(function () use ($request, $draftPayload, $itemPayloads): ProductQuotation {
            $quotation = ProductQuotation::create($draftPayload);
            $quotation->items()->createMany($itemPayloads);
            $quotation->load(['items']);
            $quotation->loadCount(['versions', 'events']);

            $this->recordQuotationEvent(
                $request,
                (int) $quotation->id,
                null,
                self::EVENT_DRAFT_CREATED,
                'SUCCESS',
                null,
                null,
                $quotation->content_hash,
                ['source' => 'api']
            );

            $this->accessAudit->recordAuditEvent(
                $request,
                'INSERT',
                'product_quotations',
                $quotation->id,
                null,
                $this->serializeQuotationAuditSnapshot($quotation)
            );

            return $quotation;
        });

        return response()->json([
            'data' => $this->serializeQuotationDetail($quotation),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        $quotation = ProductQuotation::query()->with(['items'])->find($id);
        if (! $quotation instanceof ProductQuotation) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        $beforeSnapshot = $this->serializeQuotationAuditSnapshot($quotation);
        $normalized = $this->normalizeDraftPayload($request);
        if ($draftValidation = $this->validatePersistableDraftPayload($normalized)) {
            return $draftValidation;
        }
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $customerId = $this->resolveCustomerId($request);
        if ($customerId instanceof JsonResponse) {
            return $customerId;
        }

        $draftPayload = $this->buildDraftPayload(
            $normalized,
            $customerId,
            $request->input('quote_date'),
            $actorId,
            false
        );
        $itemPayloads = $this->buildDraftItemPayloads($normalized['items']);

        $quotation = DB::transaction(function () use ($request, $quotation, $draftPayload, $itemPayloads, $beforeSnapshot): ProductQuotation {
            $quotation->fill($draftPayload);
            $quotation->save();

            ProductQuotationItem::query()
                ->where('quotation_id', $quotation->id)
                ->delete();

            $quotation->items()->createMany($itemPayloads);
            $quotation->load(['items']);
            $quotation->loadCount(['versions', 'events']);

            $this->recordQuotationEvent(
                $request,
                (int) $quotation->id,
                null,
                self::EVENT_DRAFT_UPDATED,
                'SUCCESS',
                null,
                null,
                $quotation->content_hash,
                ['source' => 'api']
            );

            $this->accessAudit->recordAuditEvent(
                $request,
                'UPDATE',
                'product_quotations',
                $quotation->id,
                $beforeSnapshot,
                $this->serializeQuotationAuditSnapshot($quotation)
            );

            return $quotation;
        });

        return response()->json([
            'data' => $this->serializeQuotationDetail($quotation),
        ]);
    }

    public function versions(Request $request, int $id): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        if (! ProductQuotation::query()->whereKey($id)->exists()) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        $query = ProductQuotationVersion::query()
            ->where('quotation_id', $id)
            ->orderByDesc('version_no');

        $hardCap = now()->subDays(90)->startOfDay();
        $createdFrom = trim((string) ($this->support->readFilterParam($request, 'created_from', '') ?? ''));
        $parsedFrom = $createdFrom !== '' ? \Carbon\Carbon::parse($createdFrom) : null;
        $effectiveFrom = ($parsedFrom !== null && $parsedFrom->gt($hardCap)) ? $parsedFrom : $hardCap;
        $query->where('created_at', '>=', $effectiveFrom);

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
            $actorMap = $this->resolveActorMap(
                $rows->map(fn (ProductQuotationVersion $version): ?int => $this->support->parseNullableInt($version->printed_by))
                    ->filter(fn (?int $actorId): bool => $actorId !== null)
                    ->values()
                    ->all()
            );

            return response()->json([
                'data' => $rows
                    ->map(fn (ProductQuotationVersion $version): array => $this->serializeVersion($version, $actorMap))
                    ->values(),
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query->get();
        $actorMap = $this->resolveActorMap(
            $rows->map(fn (ProductQuotationVersion $version): ?int => $this->support->parseNullableInt($version->printed_by))
                ->filter(fn (?int $actorId): bool => $actorId !== null)
                ->values()
                ->all()
        );

        return response()->json([
            'data' => $rows
                ->map(fn (ProductQuotationVersion $version): array => $this->serializeVersion($version, $actorMap))
                ->values(),
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function showVersion(Request $request, int $quotationId, int $versionId): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        if (! ProductQuotation::query()->whereKey($quotationId)->exists()) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        $version = ProductQuotationVersion::query()
            ->where('quotation_id', $quotationId)
            ->whereKey($versionId)
            ->with(['items'])
            ->first();

        if (! $version instanceof ProductQuotationVersion) {
            return response()->json(['message' => 'Version báo giá không tồn tại.'], 404);
        }

        $actorMap = $this->resolveActorMap([
            $this->support->parseNullableInt($version->printed_by),
        ]);

        return response()->json([
            'data' => $this->serializeVersionDetail($version, $actorMap),
        ]);
    }

    public function events(Request $request, int $id): JsonResponse
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        if (! ProductQuotation::query()->whereKey($id)->exists()) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        $query = ProductQuotationEvent::query()
            ->where('quotation_id', $id)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $eventType = trim((string) ($this->support->readFilterParam($request, 'event_type', '') ?? ''));
        if ($eventType !== '') {
            $query->where('event_type', $eventType);
        }

        $hardCap = now()->subDays(90)->startOfDay();
        $createdFrom = trim((string) ($this->support->readFilterParam($request, 'created_from', '') ?? ''));
        $parsedFrom = $createdFrom !== '' ? \Carbon\Carbon::parse($createdFrom) : null;
        $effectiveFrom = ($parsedFrom !== null && $parsedFrom->gt($hardCap)) ? $parsedFrom : $hardCap;
        $query->where('created_at', '>=', $effectiveFrom);

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
            $actorMap = $this->resolveActorMap(
                $rows->map(fn (ProductQuotationEvent $event): ?int => $this->support->parseNullableInt($event->created_by))
                    ->filter(fn (?int $actorId): bool => $actorId !== null)
                    ->values()
                    ->all()
            );

            return response()->json([
                'data' => $rows
                    ->map(fn (ProductQuotationEvent $event): array => $this->serializeEvent($event, $actorMap))
                    ->values(),
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query->get();
        $actorMap = $this->resolveActorMap(
            $rows->map(fn (ProductQuotationEvent $event): ?int => $this->support->parseNullableInt($event->created_by))
                ->filter(fn (?int $actorId): bool => $actorId !== null)
                ->values()
                ->all()
        );

        return response()->json([
            'data' => $rows
                ->map(fn (ProductQuotationEvent $event): array => $this->serializeEvent($event, $actorMap))
                ->values(),
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function printWord(Request $request, int $id): \Symfony\Component\HttpFoundation\Response
    {
        if ($missingTableResponse = $this->missingTableResponse()) {
            return $missingTableResponse;
        }

        $existing = ProductQuotation::query()->with(['items'])->find($id);
        if (! $existing instanceof ProductQuotation) {
            return response()->json(['message' => 'Báo giá không tồn tại.'], 404);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $confirmedAt = Carbon::now();
        $normalized = null;
        $version = null;
        $filename = null;
        $emailNotification = [
            'status' => 'SKIPPED',
            'message' => null,
        ];

        DB::transaction(function () use (
            $request,
            $id,
            $actorId,
            $confirmedAt,
            &$normalized,
            &$version,
            &$filename
        ): void {
            $quotation = ProductQuotation::query()
                ->with(['items'])
                ->lockForUpdate()
                ->find($id);

            if (! $quotation instanceof ProductQuotation) {
                throw new \RuntimeException('Báo giá không tồn tại.');
            }

            $beforeSnapshot = $this->serializeQuotationAuditSnapshot($quotation);
            $normalized = $this->quotationExportService->normalizeQuotationPayload(
                $this->buildExportPayloadArrayFromQuotation($quotation)
            );

            $contentHash = $this->buildVersionContentHash($normalized);
            $templateKey = $this->resolveTemplateKey((bool) $normalized['uses_multi_vat_template']);
            $versionNo = max(
                (int) $quotation->latest_version_no,
                (int) ProductQuotationVersion::query()
                    ->where('quotation_id', $quotation->id)
                    ->max('version_no')
            ) + 1;
            $filename = $this->quotationExportService->buildExportFilename(
                $normalized['recipient_name'],
                $normalized['date'],
                'docx'
            );

            $version = ProductQuotationVersion::create([
                'quotation_id' => $quotation->id,
                'version_no' => $versionNo,
                'template_key' => $templateKey,
                'status' => self::VERSION_STATUS_PENDING,
                'filename' => $filename,
                'quote_date' => $normalized['date']->format('Y-m-d'),
                'recipient_name' => $normalized['recipient_name'],
                'sender_city' => $normalized['sender_city'],
                'scope_summary' => $normalized['scope_summary'],
                'vat_rate' => $normalized['vat_rate'],
                'validity_days' => $normalized['validity_days'],
                'notes_text' => implode("\n", $normalized['notes']),
                'contact_line' => $normalized['contact_line'],
                'closing_message' => $normalized['closing_message'],
                'signatory_title' => $normalized['signatory_title'],
                'signatory_unit' => $normalized['signatory_unit'],
                'signatory_name' => $normalized['signatory_name'],
                'subtotal' => $normalized['subtotal'],
                'vat_amount' => $normalized['vat_amount'],
                'total_amount' => $normalized['total'],
                'total_in_words' => $normalized['total_in_words'],
                'uses_multi_vat_template' => $normalized['uses_multi_vat_template'],
                'content_hash' => $contentHash,
                'printed_at' => $confirmedAt,
                'printed_by' => $actorId,
                'metadata' => [
                    'source' => 'confirmed_print',
                    'generated_extension' => 'docx',
                ],
                'created_at' => $confirmedAt,
            ]);

            ProductQuotationVersionItem::query()
                ->where('version_id', $version->id)
                ->delete();
            ProductQuotationVersionItem::query()->insert($this->buildVersionItemPayloads((int) $version->id, $normalized['items']));

            $quotation->latest_version_no = $versionNo;
            $quotation->last_printed_at = $confirmedAt;
            $quotation->last_printed_by = $actorId;
            $quotation->subtotal = $normalized['subtotal'];
            $quotation->vat_amount = $normalized['vat_amount'];
            $quotation->total_amount = $normalized['total'];
            $quotation->total_in_words = $normalized['total_in_words'];
            $quotation->uses_multi_vat_template = $normalized['uses_multi_vat_template'];
            $quotation->content_hash = $this->buildDraftContentHash(
                $normalized,
                $quotation->quote_date?->format('Y-m-d')
            );
            $quotation->updated_by = $actorId;
            $quotation->save();
            $quotation->load(['items']);

            $this->recordQuotationEvent(
                $request,
                (int) $quotation->id,
                (int) $version->id,
                self::EVENT_PRINT_CONFIRMED,
                'SUCCESS',
                $versionNo,
                $templateKey,
                $contentHash,
                [
                    'filename' => $filename,
                    'confirmed_at' => $confirmedAt->toIso8601String(),
                ],
                $confirmedAt
            );

            $this->accessAudit->recordAuditEvent(
                $request,
                'INSERT',
                'product_quotation_versions',
                $version->id,
                null,
                $this->serializeVersionAuditSnapshot($version, $normalized['items'])
            );

            $this->accessAudit->recordAuditEvent(
                $request,
                'UPDATE',
                'product_quotations',
                $quotation->id,
                $beforeSnapshot,
                $this->serializeQuotationAuditSnapshot($quotation)
            );
        });

        try {
            $binary = $this->quotationExportService->buildWordBinaryFromNormalizedQuotation($normalized);

            if ($version instanceof ProductQuotationVersion) {
                $version->status = self::VERSION_STATUS_SUCCESS;
                $version->save();

                $emailNotification = $this->sendQuotationPrintNotification(
                    $request,
                    $version,
                    $normalized,
                    (string) $filename,
                    $binary
                );
            }

            return response($binary, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition' => $this->quotationExportService->buildContentDispositionHeader((string) $filename),
                'X-Quotation-Email-Status' => (string) ($emailNotification['status'] ?? 'SKIPPED'),
                'X-Quotation-Email-Message' => rawurlencode((string) ($emailNotification['message'] ?? '')),
            ]);
        } catch (Throwable $exception) {
            if ($version instanceof ProductQuotationVersion) {
                $version->status = self::VERSION_STATUS_FAILED;
                $version->save();

                $this->recordQuotationEvent(
                    $request,
                    (int) $version->quotation_id,
                    (int) $version->id,
                    self::EVENT_PRINT_FAILED,
                    'FAILED',
                    (int) $version->version_no,
                    $version->template_key,
                    $version->content_hash,
                    ['message' => $exception->getMessage()]
                );
            }

            throw $exception;
        }
    }

    /**
     * @param array<string, mixed> $normalized
     * @return array{status: 'SUCCESS'|'FAILED'|'SKIPPED', message: string|null}
     */
    private function sendQuotationPrintNotification(
        Request $request,
        ProductQuotationVersion $version,
        array $normalized,
        string $filename,
        string $binary
    ): array {
        $recipients = collect(
            config(
                'audit.product_quotation_print_notification_recipients',
                config('audit.product_feature_catalog_notification_recipients', [])
            )
        )
            ->map(fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values()
            ->all();

        if ($recipients === []) {
            return [
                'status' => 'SKIPPED',
                'message' => null,
            ];
        }

        $actor = $request->user();
        $actorName = trim((string) ($actor?->full_name ?? $actor?->username ?? 'Không rõ'));
        $actorUsername = trim((string) ($actor?->username ?? ''));
        $actorDisplay = $actorUsername !== ''
            ? sprintf('%s (%s)', $actorName, $actorUsername)
            : $actorName;
        $printedAt = $version->printed_at?->format('d/m/Y H:i:s') ?? now()->format('d/m/Y H:i:s');
        $resolvedFilename = trim($filename) !== '' ? trim($filename) : sprintf('bao-gia-v%d.docx', (int) $version->version_no);

        $result = $this->emailSmtp->sendHtmlEmail(
            $recipients,
            $this->buildQuotationPrintEmailSubject($version, $normalized),
            $this->buildQuotationPrintEmailLines($request, $version, $normalized, $resolvedFilename, $actorDisplay, $printedAt),
            $this->buildQuotationPrintEmailHtml($request, $version, $normalized, $resolvedFilename, $actorDisplay, $printedAt),
            [[
                'data' => $binary,
                'name' => $resolvedFilename,
                'options' => [
                    'mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ],
            ]]
        );

        if (($result['success'] ?? false) === true) {
            return [
                'status' => 'SUCCESS',
                'message' => 'Đã gửi email lưu trữ bản in báo giá.',
            ];
        }

        $message = (string) ($result['message'] ?? 'Không thể gửi email lưu trữ bản in báo giá.');

        Log::warning('product_quotation.print_email_failed', [
            'quotation_id' => $version->quotation_id,
            'version_id' => $version->id,
            'version_no' => $version->version_no,
            'recipients' => $recipients,
            'message' => $message,
        ]);

        return [
            'status' => 'FAILED',
            'message' => $message,
        ];
    }

    /**
     * @param array<string, mixed> $normalized
     */
    private function buildQuotationPrintEmailSubject(ProductQuotationVersion $version, array $normalized): string
    {
        $recipientName = trim((string) ($normalized['recipient_name'] ?? $version->recipient_name ?? ''));
        $recipientLabel = $recipientName !== ''
            ? $recipientName
            : sprintf('Báo giá #%d', (int) $version->quotation_id);

        return sprintf(
            '[VNPT Business] Lưu trữ bản in báo giá v%d - %s',
            (int) $version->version_no,
            $recipientLabel
        );
    }

    /**
     * @param array<string, mixed> $normalized
     * @return array<int, string>
     */
    private function buildQuotationPrintEmailLines(
        Request $request,
        ProductQuotationVersion $version,
        array $normalized,
        string $filename,
        string $actorDisplay,
        string $printedAt
    ): array {
        $quoteDate = $version->quote_date?->format('d/m/Y') ?? '';
        $lines = [
            'Hệ thống vừa ghi nhận một lần xác nhận in báo giá.',
            '',
            'Phiên bản in: v' . (int) $version->version_no,
            'Tên file: ' . $filename,
            'Đơn vị nhận báo giá: ' . trim((string) ($normalized['recipient_name'] ?? $version->recipient_name ?? '')),
            'Ngày báo giá: ' . ($quoteDate !== '' ? $quoteDate : '—'),
            'Tổng tiền: ' . $this->formatQuotationEmailCurrency((float) ($normalized['total'] ?? $version->total_amount ?? 0)),
            'Người xác nhận in: ' . $actorDisplay,
            'Thời gian xác nhận: ' . $printedAt,
            'URL: ' . $request->fullUrl(),
            'IP: ' . (string) ($request->ip() ?? 'Không rõ'),
            'Hash nội dung: ' . trim((string) ($version->content_hash ?? '—')),
            '',
            'Mail này kèm theo file Word vừa in để lưu trữ.',
        ];

        $items = is_array($normalized['items'] ?? null) ? $normalized['items'] : [];
        if ($items !== []) {
            $lines[] = '';
            $lines[] = 'Danh sách hạng mục:';
            foreach ($items as $index => $item) {
                $lines[] = sprintf(
                    '%d. %s | SL %s | Đơn giá %s | Thành tiền %s',
                    $index + 1,
                    trim((string) ($item['product_name'] ?? 'Hạng mục')),
                    $this->formatQuotationEmailNumber((float) ($item['quantity'] ?? 0)),
                    $this->formatQuotationEmailCurrency((float) ($item['unit_price'] ?? 0)),
                    $this->formatQuotationEmailCurrency((float) ($item['line_total'] ?? 0))
                );
            }
        }

        return $lines;
    }

    /**
     * @param array<string, mixed> $normalized
     */
    private function buildQuotationPrintEmailHtml(
        Request $request,
        ProductQuotationVersion $version,
        array $normalized,
        string $filename,
        string $actorDisplay,
        string $printedAt
    ): string {
        $quoteDate = $version->quote_date?->format('d/m/Y') ?? '—';
        $url = trim((string) $request->fullUrl());
        $summaryRows = [
            ['label' => 'Phiên bản in', 'value' => 'v' . (int) $version->version_no],
            ['label' => 'Tên file', 'value' => $filename],
            ['label' => 'Đơn vị nhận báo giá', 'value' => trim((string) ($normalized['recipient_name'] ?? $version->recipient_name ?? '')) ?: '—'],
            ['label' => 'Ngày báo giá', 'value' => $quoteDate],
            ['label' => 'Tổng tiền', 'value' => $this->formatQuotationEmailCurrency((float) ($normalized['total'] ?? $version->total_amount ?? 0))],
            ['label' => 'Người xác nhận in', 'value' => $actorDisplay],
            ['label' => 'Thời gian xác nhận', 'value' => $printedAt],
            [
                'label' => 'URL',
                'value' => $url !== ''
                    ? '<a href="' . $this->escapeQuotationEmailHtml($url) . '" style="color:#0b4f93;text-decoration:none;">'
                        . $this->escapeQuotationEmailHtml($url)
                        . '</a>'
                    : '—',
                'is_html' => $url !== '',
            ],
            ['label' => 'IP', 'value' => (string) ($request->ip() ?? 'Không rõ')],
            ['label' => 'Hash nội dung', 'value' => trim((string) ($version->content_hash ?? '')) ?: '—'],
        ];

        $items = is_array($normalized['items'] ?? null) ? $normalized['items'] : [];
        $html = [
            '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
            '<body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">',
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:1100px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;">',
            '<tr><td style="padding:28px 32px 16px 32px;">',
            '<div style="font-size:24px;font-weight:700;color:#0b4f93;">Lưu trữ bản in báo giá</div>',
            '<div style="margin-top:8px;font-size:14px;line-height:1.6;color:#4b5563;">Hệ thống vừa xác nhận một lần in báo giá thành công. File Word của phiên bản đã được đính kèm trong email này để lưu trữ.</div>',
            '</td></tr>',
            '<tr><td style="padding:0 32px 24px 32px;">',
            '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Thông tin bản in</div>',
            $this->renderQuotationEmailKeyValueTableHtml($summaryRows),
            '</td></tr>',
            '<tr><td style="padding:0 32px 16px 32px;">',
            '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Nội dung hạng mục báo giá</div>',
            '</td></tr>',
            '<tr><td style="padding:0 32px 32px 32px;">',
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #dbe4f0;">',
            '<thead><tr>',
            '<th align="left" style="width:52px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">TT</th>',
            '<th align="left" style="padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Hạng mục</th>',
            '<th align="left" style="width:120px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Đơn vị</th>',
            '<th align="right" style="width:90px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Số lượng</th>',
            '<th align="right" style="width:150px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Đơn giá</th>',
            '<th align="right" style="width:72px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">VAT</th>',
            '<th align="right" style="width:170px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Thành tiền</th>',
            '<th align="left" style="width:240px;padding:12px 14px;background:#f8fbff;border:1px solid #dbe4f0;font-size:12px;font-weight:700;color:#0f172a;">Ghi chú</th>',
            '</tr></thead><tbody>',
        ];

        if ($items === []) {
            $html[] = '<tr><td colspan="8" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;color:#4b5563;">Không có hạng mục nào trong báo giá.</td></tr>';
        } else {
            foreach ($items as $index => $item) {
                $vatLabel = $item['vat_rate'] === null || $item['vat_rate'] === ''
                    ? '—'
                    : $this->formatQuotationEmailNumber((float) $item['vat_rate']) . '%';

                $html[] = '<tr>';
                $html[] = '<td valign="top" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->escapeQuotationEmailHtml((string) ($index + 1)) . '</td>';
                $html[] = '<td valign="top" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->formatQuotationEmailHtmlValue((string) ($item['product_name'] ?? '')) . '</td>';
                $html[] = '<td valign="top" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->formatQuotationEmailHtmlValue((string) ($item['unit'] ?? '')) . '</td>';
                $html[] = '<td valign="top" align="right" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->escapeQuotationEmailHtml($this->formatQuotationEmailNumber((float) ($item['quantity'] ?? 0))) . '</td>';
                $html[] = '<td valign="top" align="right" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->escapeQuotationEmailHtml($this->formatQuotationEmailCurrency((float) ($item['unit_price'] ?? 0))) . '</td>';
                $html[] = '<td valign="top" align="right" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->escapeQuotationEmailHtml($vatLabel) . '</td>';
                $html[] = '<td valign="top" align="right" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->escapeQuotationEmailHtml($this->formatQuotationEmailCurrency((float) ($item['line_total'] ?? 0))) . '</td>';
                $html[] = '<td valign="top" style="padding:12px 14px;border:1px solid #dbe4f0;font-size:13px;color:#111827;">' . $this->formatQuotationEmailHtmlValue((string) ($item['note'] ?? '')) . '</td>';
                $html[] = '</tr>';
            }
        }

        $html[] = '</tbody></table>';
        $html[] = '</td></tr>';
        $html[] = '</table></body></html>';

        return implode('', $html);
    }

    private function renderQuotationEmailKeyValueTableHtml(array $rows): string
    {
        $html = ['<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #dbe4f0;">'];

        foreach ($rows as $row) {
            $value = (string) ($row['value'] ?? '—');
            $html[] = '<tr>';
            $html[] = '<td style="width:32%;padding:12px 16px;border:1px solid #dbe4f0;background:#f8fbff;font-size:13px;font-weight:600;color:#374151;">'
                . $this->escapeQuotationEmailHtml((string) ($row['label'] ?? 'Thông tin'))
                . '</td>';
            $html[] = '<td style="padding:12px 16px;border:1px solid #dbe4f0;font-size:13px;line-height:1.6;color:#111827;">'
                . (($row['is_html'] ?? false) ? $value : $this->formatQuotationEmailHtmlValue($value))
                . '</td>';
            $html[] = '</tr>';
        }

        $html[] = '</table>';

        return implode('', $html);
    }

    private function formatQuotationEmailCurrency(float $amount): string
    {
        return number_format($amount, 0, ',', '.') . ' đ';
    }

    private function formatQuotationEmailNumber(float $value): string
    {
        $formatted = number_format($value, 2, '.', '');

        return rtrim(rtrim($formatted, '0'), '.');
    }

    private function formatQuotationEmailHtmlValue(string $value): string
    {
        return nl2br($this->escapeQuotationEmailHtml($value !== '' ? $value : '—'), false);
    }

    private function escapeQuotationEmailHtml(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function missingTableResponse(): ?JsonResponse
    {
        foreach ([
            'product_quotations',
            'product_quotation_items',
            'product_quotation_versions',
            'product_quotation_version_items',
            'product_quotation_events',
        ] as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
        }

        return null;
    }

    private function missingDefaultSettingsTableResponse(): ?JsonResponse
    {
        if (! $this->support->hasTable('product_quotation_default_settings')) {
            return $this->support->missingTable('product_quotation_default_settings');
        }

        return null;
    }

    private function resolveCustomerId(Request $request): int|JsonResponse|null
    {
        $customerId = $this->support->parseNullableInt($request->input('customer_id'));
        if ($customerId === null) {
            return null;
        }

        if (! $this->support->hasTable('customers')) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $exists = DB::table('customers')->where('id', $customerId)->exists();
        if (! $exists) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        return $customerId;
    }

    /**
     * @return array{
     *   recipient_name: string,
     *   sender_city: string,
     *   scope_summary: string,
     *   vat_rate: float,
     *   validity_days: int,
     *   notes_text: string,
     *   contact_line: string,
     *   closing_message: string,
     *   signatory_title: string,
     *   signatory_unit: string,
     *   signatory_name: string,
     *   subtotal: float,
     *   vat_amount: float,
     *   total: float,
     *   total_in_words: string,
     *   uses_multi_vat_template: bool,
     *   items: array<int, array{
     *     product_id: int|null,
     *     product_name: string,
     *     unit: string,
     *     quantity: float,
     *     unit_price: float,
     *     vat_rate: float|null,
     *     vat_amount: float,
     *     total_with_vat: float,
     *     line_total: float,
     *     note: string
     *   }>
     * }
     */
    private function normalizeDraftPayload(Request $request): array
    {
        $validated = Validator::make($request->all(), [
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'sender_city' => ['nullable', 'string', 'max:120'],
            'scope_summary' => ['nullable', 'string', 'max:2000'],
            'quote_date' => ['nullable', 'date'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'validity_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'notes_text' => ['nullable', 'string', 'max:8000'],
            'contact_line' => ['nullable', 'string', 'max:2000'],
            'closing_message' => ['nullable', 'string', 'max:2000'],
            'signatory_title' => ['nullable', 'string', 'max:255'],
            'signatory_unit' => ['nullable', 'string', 'max:255'],
            'signatory_name' => ['nullable', 'string', 'max:255'],
            'items' => ['nullable', 'array', 'max:200'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.product_package_id' => ['nullable', 'integer'],
            'items.*.product_name' => ['nullable', 'string', 'max:500'],
            'items.*.unit' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.note' => ['nullable', 'string', 'max:4000'],
        ])->validate();

        $defaultVatRate = round((float) ($validated['vat_rate'] ?? 10), 2);
        $items = [];
        $subtotal = 0.0;
        $vatAmount = 0.0;

        foreach ($validated['items'] ?? [] as $item) {
            $productId = isset($item['product_id']) && $item['product_id'] !== ''
                ? (int) $item['product_id']
                : null;
            $productPackageId = isset($item['product_package_id']) && $item['product_package_id'] !== ''
                ? (int) $item['product_package_id']
                : null;
            $productName = trim((string) ($item['product_name'] ?? ''));
            $unit = trim((string) ($item['unit'] ?? ''));
            $note = trim((string) ($item['note'] ?? ''));

            if ($productId === null && $productName === '' && $unit === '' && $note === '') {
                continue;
            }

            $quantity = round(max(0, (float) ($item['quantity'] ?? 0)), 2);
            $unitPrice = round(max(0, (float) ($item['unit_price'] ?? 0)), 2);
            $itemVatRate = array_key_exists('vat_rate', $item) && $item['vat_rate'] !== null && $item['vat_rate'] !== ''
                ? round((float) $item['vat_rate'], 2)
                : null;
            $effectiveVatRate = $itemVatRate ?? $defaultVatRate;
            $lineTotal = round($quantity * $unitPrice, 2);
            $itemVatAmount = round($lineTotal * ($effectiveVatRate / 100), 2);
            $itemTotalWithVat = round($lineTotal + $itemVatAmount, 2);

            $subtotal += $lineTotal;
            $vatAmount += $itemVatAmount;
            $items[] = [
                'product_id' => $productId,
                'product_package_id' => $productPackageId,
                'product_name' => $productName,
                'unit' => $unit,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'vat_rate' => $itemVatRate,
                'vat_amount' => $itemVatAmount,
                'total_with_vat' => $itemTotalWithVat,
                'line_total' => $lineTotal,
                'note' => $note,
            ];
        }

        $normalizedVatRateKeys = array_values(array_unique(array_map(
            static fn (array $item): string => number_format((float) ($item['vat_rate'] ?? $defaultVatRate), 2, '.', ''),
            $items
        )));
        $usesMultiVatTemplate = count($normalizedVatRateKeys) > 1;
        $vatRate = count($normalizedVatRateKeys) === 1 && $items !== []
            ? round((float) ($items[0]['vat_rate'] ?? $defaultVatRate), 2)
            : $defaultVatRate;
        $vatAmount = round($usesMultiVatTemplate ? $vatAmount : $subtotal * ($vatRate / 100), 2);
        $total = round($subtotal + $vatAmount, 2);

        return [
            'recipient_name' => trim((string) ($validated['recipient_name'] ?? '')),
            'sender_city' => trim((string) ($validated['sender_city'] ?? '')) ?: 'Cần Thơ',
            'scope_summary' => trim((string) ($validated['scope_summary'] ?? '')) ?: self::DEFAULT_SCOPE_SUMMARY,
            'vat_rate' => $vatRate,
            'validity_days' => (int) ($validated['validity_days'] ?? 90),
            'notes_text' => (string) ($validated['notes_text'] ?? implode("\n", self::DEFAULT_NOTES)),
            'contact_line' => trim((string) ($validated['contact_line'] ?? '')) ?: self::DEFAULT_CONTACT_LINE,
            'closing_message' => trim((string) ($validated['closing_message'] ?? '')) ?: self::DEFAULT_CLOSING_MESSAGE,
            'signatory_title' => trim((string) ($validated['signatory_title'] ?? '')) ?: self::DEFAULT_SIGNATORY_TITLE,
            'signatory_unit' => trim((string) ($validated['signatory_unit'] ?? '')) ?: self::DEFAULT_SIGNATORY_UNIT,
            'signatory_name' => trim((string) ($validated['signatory_name'] ?? '')) ?: self::DEFAULT_SIGNATORY_NAME,
            'subtotal' => round($subtotal, 2),
            'vat_amount' => $vatAmount,
            'total' => $total,
            'total_in_words' => '',
            'uses_multi_vat_template' => $usesMultiVatTemplate,
            'items' => $items,
        ];
    }

    private function validatePersistableDraftPayload(array $normalized): ?JsonResponse
    {
        $items = $normalized['items'] ?? [];
        $total = (float) ($normalized['total'] ?? 0);

        if ($items !== [] && $total > 0) {
            return null;
        }

        return response()->json([
            'message' => 'Không lưu nháp báo giá 0 đồng. Vui lòng nhập ít nhất một hạng mục có thành tiền lớn hơn 0.',
        ], 422);
    }

    /**
     * @return array{
     *   scope_summary: string,
     *   validity_days: int,
     *   notes_text: string,
     *   contact_line: string,
     *   closing_message: string,
     *   signatory_title: string,
     *   signatory_unit: string,
     *   signatory_name: string
     * }
     */
    private function normalizeDefaultSettingsPayload(Request $request): array
    {
        $validated = Validator::make($request->all(), [
            'scope_summary' => ['nullable', 'string', 'max:2000'],
            'validity_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'notes_text' => ['nullable', 'string', 'max:8000'],
            'contact_line' => ['nullable', 'string', 'max:2000'],
            'closing_message' => ['nullable', 'string', 'max:2000'],
            'signatory_title' => ['nullable', 'string', 'max:255'],
            'signatory_unit' => ['nullable', 'string', 'max:255'],
            'signatory_name' => ['nullable', 'string', 'max:255'],
        ])->validate();

        return [
            'scope_summary' => trim((string) ($validated['scope_summary'] ?? '')) ?: self::DEFAULT_SCOPE_SUMMARY,
            'validity_days' => (int) ($validated['validity_days'] ?? 90),
            'notes_text' => (string) ($validated['notes_text'] ?? implode("\n", self::DEFAULT_NOTES)),
            'contact_line' => trim((string) ($validated['contact_line'] ?? '')) ?: self::DEFAULT_CONTACT_LINE,
            'closing_message' => trim((string) ($validated['closing_message'] ?? '')) ?: self::DEFAULT_CLOSING_MESSAGE,
            'signatory_title' => trim((string) ($validated['signatory_title'] ?? '')) ?: self::DEFAULT_SIGNATORY_TITLE,
            'signatory_unit' => trim((string) ($validated['signatory_unit'] ?? '')) ?: self::DEFAULT_SIGNATORY_UNIT,
            'signatory_name' => trim((string) ($validated['signatory_name'] ?? '')) ?: self::DEFAULT_SIGNATORY_NAME,
        ];
    }

    private function buildDraftPayload(
        array $normalized,
        ?int $customerId,
        mixed $quoteDateInput,
        ?int $actorId,
        bool $isNew
    ): array {
        $quoteDate = null;
        if (is_string($quoteDateInput) && trim($quoteDateInput) !== '') {
            $quoteDate = Carbon::parse($quoteDateInput)->format('Y-m-d');
        }

        $payload = [
            'customer_id' => $customerId,
            'recipient_name' => $normalized['recipient_name'],
            'sender_city' => $normalized['sender_city'],
            'quote_date' => $quoteDate,
            'scope_summary' => $normalized['scope_summary'],
            'vat_rate' => $normalized['vat_rate'],
            'validity_days' => $normalized['validity_days'],
            'notes_text' => $normalized['notes_text'],
            'contact_line' => $normalized['contact_line'],
            'closing_message' => $normalized['closing_message'],
            'signatory_title' => $normalized['signatory_title'],
            'signatory_unit' => $normalized['signatory_unit'],
            'signatory_name' => $normalized['signatory_name'],
            'subtotal' => $normalized['subtotal'],
            'vat_amount' => $normalized['vat_amount'],
            'total_amount' => $normalized['total'],
            'total_in_words' => $normalized['total_in_words'],
            'uses_multi_vat_template' => $normalized['uses_multi_vat_template'],
            'content_hash' => $this->buildDraftContentHash($normalized, $quoteDate),
            'status' => self::STATUS_DRAFT,
            'updated_by' => $actorId,
        ];

        if ($isNew) {
            $payload['uuid'] = (string) Str::uuid();
            $payload['created_by'] = $actorId;
        }

        return $payload;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    private function buildDraftItemPayloads(array $items): array
    {
        $supportsProductPackageId = $this->support->hasColumn('product_quotation_items', 'product_package_id');

        return collect($items)
            ->values()
            ->map(function (array $item, int $index) use ($supportsProductPackageId): array {
                $payload = [
                    'sort_order' => $index + 1,
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'unit' => $item['unit'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'vat_rate' => $item['vat_rate'],
                    'vat_amount' => $item['vat_amount'],
                    'line_total' => $item['line_total'],
                    'total_with_vat' => $item['total_with_vat'],
                    'note' => $item['note'],
                ];

                if ($supportsProductPackageId) {
                    $payload['product_package_id'] = $item['product_package_id'] ?? null;
                }

                return $payload;
            })
            ->all();
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    private function buildVersionItemPayloads(int $versionId, array $items): array
    {
        return collect($items)
            ->values()
            ->map(function (array $item, int $index) use ($versionId): array {
                return [
                    'version_id' => $versionId,
                    'sort_order' => $index + 1,
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'unit' => $item['unit'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'vat_rate' => $item['vat_rate'],
                    'vat_amount' => $item['vat_amount'],
                    'line_total' => $item['line_total'],
                    'total_with_vat' => $item['total_with_vat'],
                    'note' => $item['note'],
                ];
            })
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function buildExportPayloadArrayFromQuotation(ProductQuotation $quotation): array
    {
        $items = $quotation->relationLoaded('items')
            ? $quotation->items
            : $quotation->items()->orderBy('sort_order')->orderBy('id')->get();

        return [
            'recipient_name' => $quotation->recipient_name,
            'sender_city' => $quotation->sender_city,
            'quote_date' => $quotation->quote_date?->format('Y-m-d'),
            'scope_summary' => $quotation->scope_summary,
            'vat_rate' => $quotation->vat_rate,
            'validity_days' => $quotation->validity_days,
            'notes_text' => $quotation->notes_text,
            'contact_line' => $quotation->contact_line,
            'closing_message' => $quotation->closing_message,
            'signatory_title' => $quotation->signatory_title,
            'signatory_unit' => $quotation->signatory_unit,
            'signatory_name' => $quotation->signatory_name,
            'items' => $items
                ->map(function (ProductQuotationItem $item): array {
                    return [
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'unit' => $item->unit,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'vat_rate' => $item->vat_rate,
                        'note' => $item->note,
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    private function buildDraftContentHash(array $normalized, ?string $quoteDate): string
    {
        $notesValue = array_key_exists('notes_text', $normalized)
            ? $normalized['notes_text']
            : implode("\n", array_values($normalized['notes'] ?? []));

        return $this->hashPayload([
            'recipient_name' => $normalized['recipient_name'],
            'sender_city' => $normalized['sender_city'],
            'quote_date' => $quoteDate,
            'scope_summary' => $normalized['scope_summary'],
            'vat_rate' => $normalized['vat_rate'],
            'validity_days' => $normalized['validity_days'],
            'notes_text' => $notesValue,
            'contact_line' => $normalized['contact_line'],
            'closing_message' => $normalized['closing_message'],
            'signatory_title' => $normalized['signatory_title'],
            'signatory_unit' => $normalized['signatory_unit'],
            'signatory_name' => $normalized['signatory_name'],
            'uses_multi_vat_template' => $normalized['uses_multi_vat_template'],
            'items' => collect($normalized['items'])
                ->map(fn (array $item): array => $this->normalizeHashItem($item))
                ->values()
                ->all(),
        ]);
    }

    private function buildVersionContentHash(array $normalized): string
    {
        return $this->hashPayload([
            'recipient_name' => $normalized['recipient_name'],
            'sender_city' => $normalized['sender_city'],
            'quote_date' => $normalized['date']->format('Y-m-d'),
            'scope_summary' => $normalized['scope_summary'],
            'vat_rate' => $normalized['vat_rate'],
            'validity_days' => $normalized['validity_days'],
            'notes' => array_values($normalized['notes']),
            'contact_line' => $normalized['contact_line'],
            'closing_message' => $normalized['closing_message'],
            'signatory_title' => $normalized['signatory_title'],
            'signatory_unit' => $normalized['signatory_unit'],
            'signatory_name' => $normalized['signatory_name'],
            'uses_multi_vat_template' => $normalized['uses_multi_vat_template'],
            'items' => collect($normalized['items'])
                ->map(fn (array $item): array => $this->normalizeHashItem($item))
                ->values()
                ->all(),
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function hashPayload(array $payload): string
    {
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return hash('sha256', is_string($encoded) ? $encoded : serialize($payload));
    }

    /**
     * @param array<string, mixed> $item
     * @return array<string, mixed>
     */
    private function normalizeHashItem(array $item): array
    {
        return [
            'product_id' => $item['product_id'] ?? null,
            'product_name' => (string) ($item['product_name'] ?? ''),
            'unit' => (string) ($item['unit'] ?? ''),
            'quantity' => round((float) ($item['quantity'] ?? 0), 2),
            'unit_price' => round((float) ($item['unit_price'] ?? 0), 2),
            'vat_rate' => round((float) ($item['vat_rate'] ?? 0), 2),
            'vat_amount' => round((float) ($item['vat_amount'] ?? 0), 2),
            'line_total' => round((float) ($item['line_total'] ?? 0), 2),
            'total_with_vat' => round((float) ($item['total_with_vat'] ?? 0), 2),
            'note' => (string) ($item['note'] ?? ''),
        ];
    }

    private function resolveTemplateKey(bool $usesMultiVatTemplate): string
    {
        return $usesMultiVatTemplate ? self::TEMPLATE_KEY_MULTI_VAT : self::TEMPLATE_KEY_DEFAULT;
    }

    /**
     * @param array<string, mixed>|null $metadata
     */
    private function recordQuotationEvent(
        Request $request,
        int $quotationId,
        ?int $versionId,
        string $eventType,
        ?string $eventStatus,
        ?int $versionNo,
        ?string $templateKey,
        ?string $contentHash,
        ?array $metadata = null,
        ?Carbon $createdAt = null
    ): void {
        if (! $this->support->hasTable('product_quotation_events')) {
            return;
        }

        ProductQuotationEvent::create([
            'quotation_id' => $quotationId,
            'version_id' => $versionId,
            'version_no' => $versionNo,
            'event_type' => $eventType,
            'event_status' => $eventStatus,
            'template_key' => $templateKey,
            'filename' => isset($metadata['filename']) ? (string) $metadata['filename'] : null,
            'content_hash' => $contentHash,
            'metadata' => $metadata,
            'url' => $request->fullUrl(),
            'ip_address' => $request->ip(),
            'user_agent' => $this->support->normalizeNullableString($request->userAgent()),
            'created_by' => $this->accessAudit->resolveAuthenticatedUserId($request),
            'created_at' => $createdAt ?? Carbon::now(),
        ]);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function resolveLatestVersionMap(array $quotationIds): array
    {
        if ($quotationIds === []) {
            return [];
        }

        return ProductQuotationVersion::query()
            ->whereIn('quotation_id', $quotationIds)
            ->orderBy('quotation_id')
            ->orderByDesc('version_no')
            ->get()
            ->groupBy('quotation_id')
            ->map(fn (Collection $versions): array => $this->serializeVersion($versions->first()))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeQuotationListItem(ProductQuotation $quotation, array $latestVersionMap): array
    {
        return [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'customer_id' => $quotation->customer_id,
            'recipient_name' => $quotation->recipient_name,
            'sender_city' => $quotation->sender_city,
            'quote_date' => $quotation->quote_date?->format('Y-m-d'),
            'subtotal' => (float) $quotation->subtotal,
            'vat_amount' => (float) $quotation->vat_amount,
            'total_amount' => (float) $quotation->total_amount,
            'uses_multi_vat_template' => (bool) $quotation->uses_multi_vat_template,
            'latest_version_no' => (int) $quotation->latest_version_no,
            'last_printed_at' => $quotation->last_printed_at?->toIso8601String(),
            'last_printed_by' => $quotation->last_printed_by,
            'status' => $quotation->status,
            'items_count' => (int) ($quotation->items_count ?? 0),
            'versions_count' => (int) ($quotation->versions_count ?? 0),
            'events_count' => (int) ($quotation->events_count ?? 0),
            'latest_version' => $latestVersionMap[(string) $quotation->id] ?? null,
            'created_at' => $quotation->created_at?->toIso8601String(),
            'updated_at' => $quotation->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeQuotationDetail(ProductQuotation $quotation): array
    {
        $quotation->loadMissing(['items']);
        $quotation->loadCount(['versions', 'events']);

        return [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'customer_id' => $quotation->customer_id,
            'recipient_name' => $quotation->recipient_name,
            'sender_city' => $quotation->sender_city,
            'quote_date' => $quotation->quote_date?->format('Y-m-d'),
            'scope_summary' => $quotation->scope_summary,
            'vat_rate' => $quotation->vat_rate !== null ? (float) $quotation->vat_rate : null,
            'validity_days' => (int) $quotation->validity_days,
            'notes_text' => $quotation->notes_text,
            'contact_line' => $quotation->contact_line,
            'closing_message' => $quotation->closing_message,
            'signatory_title' => $quotation->signatory_title,
            'signatory_unit' => $quotation->signatory_unit,
            'signatory_name' => $quotation->signatory_name,
            'subtotal' => (float) $quotation->subtotal,
            'vat_amount' => (float) $quotation->vat_amount,
            'total_amount' => (float) $quotation->total_amount,
            'total_in_words' => $quotation->total_in_words,
            'uses_multi_vat_template' => (bool) $quotation->uses_multi_vat_template,
            'content_hash' => $quotation->content_hash,
            'latest_version_no' => (int) $quotation->latest_version_no,
            'last_printed_at' => $quotation->last_printed_at?->toIso8601String(),
            'last_printed_by' => $quotation->last_printed_by,
            'status' => $quotation->status,
            'items' => $quotation->items
                ->map(fn (ProductQuotationItem $item): array => $this->serializeQuotationItem($item))
                ->values(),
            'versions_count' => (int) ($quotation->versions_count ?? 0),
            'events_count' => (int) ($quotation->events_count ?? 0),
            'created_at' => $quotation->created_at?->toIso8601String(),
            'updated_at' => $quotation->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDefaultSettings(?ProductQuotationDefaultSetting $settings, ?int $actorId = null): array
    {
        return [
            'user_id' => $settings?->user_id ?? $actorId,
            'scope_summary' => $settings?->scope_summary ?: self::DEFAULT_SCOPE_SUMMARY,
            'validity_days' => (int) ($settings?->validity_days ?? 90),
            'notes_text' => $settings?->notes_text ?? implode("\n", self::DEFAULT_NOTES),
            'contact_line' => $settings?->contact_line ?: self::DEFAULT_CONTACT_LINE,
            'closing_message' => $settings?->closing_message ?: self::DEFAULT_CLOSING_MESSAGE,
            'signatory_title' => $settings?->signatory_title ?: self::DEFAULT_SIGNATORY_TITLE,
            'signatory_unit' => $settings?->signatory_unit ?: self::DEFAULT_SIGNATORY_UNIT,
            'signatory_name' => $settings?->signatory_name ?: self::DEFAULT_SIGNATORY_NAME,
            'is_persisted' => $settings !== null,
            'created_at' => $settings?->created_at?->toIso8601String(),
            'updated_at' => $settings?->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDefaultSettingsAuditSnapshot(ProductQuotationDefaultSetting $settings): array
    {
        return [
            'id' => $settings->id,
            'user_id' => $settings->user_id,
            'scope_summary' => $settings->scope_summary ?: self::DEFAULT_SCOPE_SUMMARY,
            'validity_days' => (int) ($settings->validity_days ?? 90),
            'notes_text' => $settings->notes_text ?? implode("\n", self::DEFAULT_NOTES),
            'contact_line' => $settings->contact_line ?: self::DEFAULT_CONTACT_LINE,
            'closing_message' => $settings->closing_message ?: self::DEFAULT_CLOSING_MESSAGE,
            'signatory_title' => $settings->signatory_title ?: self::DEFAULT_SIGNATORY_TITLE,
            'signatory_unit' => $settings->signatory_unit ?: self::DEFAULT_SIGNATORY_UNIT,
            'signatory_name' => $settings->signatory_name ?: self::DEFAULT_SIGNATORY_NAME,
            'created_by' => $settings->created_by,
            'updated_by' => $settings->updated_by,
            'created_at' => $settings->created_at?->toIso8601String(),
            'updated_at' => $settings->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeQuotationItem(ProductQuotationItem $item): array
    {
        return [
            'id' => $item->id,
            'sort_order' => (int) $item->sort_order,
            'product_id' => $item->product_id,
            'product_package_id' => $item->product_package_id !== null ? (int) $item->product_package_id : null,
            'product_name' => $item->product_name,
            'unit' => $item->unit,
            'quantity' => (float) $item->quantity,
            'unit_price' => (float) $item->unit_price,
            'vat_rate' => $item->vat_rate !== null ? (float) $item->vat_rate : null,
            'vat_amount' => $item->vat_amount !== null ? (float) $item->vat_amount : null,
            'line_total' => (float) $item->line_total,
            'total_with_vat' => $item->total_with_vat !== null ? (float) $item->total_with_vat : null,
            'note' => $item->note,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeVersion(ProductQuotationVersion $version, array $actorMap = []): array
    {
        return [
            'id' => $version->id,
            'quotation_id' => $version->quotation_id,
            'version_no' => (int) $version->version_no,
            'template_key' => $version->template_key,
            'status' => $version->status,
            'filename' => $version->filename,
            'quote_date' => $version->quote_date?->format('Y-m-d'),
            'recipient_name' => $version->recipient_name,
            'subtotal' => (float) $version->subtotal,
            'vat_amount' => (float) $version->vat_amount,
            'total_amount' => (float) $version->total_amount,
            'content_hash' => $version->content_hash,
            'printed_at' => $version->printed_at?->toIso8601String(),
            'printed_by' => $version->printed_by,
            'printed_by_actor' => $this->resolveActor($version->printed_by, $actorMap),
            'created_at' => $version->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeVersionDetail(ProductQuotationVersion $version, array $actorMap = []): array
    {
        $version->loadMissing(['items']);

        return [
            'id' => $version->id,
            'quotation_id' => $version->quotation_id,
            'version_no' => (int) $version->version_no,
            'template_key' => $version->template_key,
            'status' => $version->status,
            'filename' => $version->filename,
            'quote_date' => $version->quote_date?->format('Y-m-d'),
            'recipient_name' => $version->recipient_name,
            'sender_city' => $version->sender_city,
            'scope_summary' => $version->scope_summary,
            'vat_rate' => $version->vat_rate !== null ? (float) $version->vat_rate : null,
            'validity_days' => (int) $version->validity_days,
            'notes_text' => $version->notes_text,
            'contact_line' => $version->contact_line,
            'closing_message' => $version->closing_message,
            'signatory_title' => $version->signatory_title,
            'signatory_unit' => $version->signatory_unit,
            'signatory_name' => $version->signatory_name,
            'subtotal' => (float) $version->subtotal,
            'vat_amount' => (float) $version->vat_amount,
            'total_amount' => (float) $version->total_amount,
            'total_in_words' => $version->total_in_words,
            'uses_multi_vat_template' => (bool) $version->uses_multi_vat_template,
            'content_hash' => $version->content_hash,
            'printed_at' => $version->printed_at?->toIso8601String(),
            'printed_by' => $version->printed_by,
            'printed_by_actor' => $this->resolveActor($version->printed_by, $actorMap),
            'metadata' => $version->metadata,
            'created_at' => $version->created_at?->toIso8601String(),
            'items' => $version->items
                ->map(fn (ProductQuotationVersionItem $item): array => [
                    'id' => $item->id,
                    'sort_order' => (int) $item->sort_order,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'unit' => $item->unit,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'vat_rate' => $item->vat_rate !== null ? (float) $item->vat_rate : null,
                    'vat_amount' => $item->vat_amount !== null ? (float) $item->vat_amount : null,
                    'line_total' => (float) $item->line_total,
                    'total_with_vat' => $item->total_with_vat !== null ? (float) $item->total_with_vat : null,
                    'note' => $item->note,
                ])
                ->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEvent(ProductQuotationEvent $event, array $actorMap = []): array
    {
        return [
            'id' => $event->id,
            'quotation_id' => $event->quotation_id,
            'version_id' => $event->version_id,
            'version_no' => $event->version_no,
            'event_type' => $event->event_type,
            'event_status' => $event->event_status,
            'template_key' => $event->template_key,
            'filename' => $event->filename,
            'content_hash' => $event->content_hash,
            'metadata' => $event->metadata,
            'url' => $event->url,
            'ip_address' => $event->ip_address,
            'user_agent' => $event->user_agent,
            'created_by' => $event->created_by,
            'actor' => $this->resolveActor($event->created_by, $actorMap),
            'created_at' => $event->created_at?->toIso8601String(),
        ];
    }

    private function resolveActorMap(array $actorIds): array
    {
        $resolvedActorIds = collect($actorIds)
            ->map(fn (mixed $actorId): ?int => $this->support->parseNullableInt($actorId))
            ->filter(fn (?int $actorId): bool => $actorId !== null)
            ->unique()
            ->values()
            ->all();

        if ($resolvedActorIds === []) {
            return [];
        }

        $actorTable = $this->support->resolveEmployeeTable();
        if ($actorTable === null) {
            return [];
        }

        $columns = $this->support->selectColumns($actorTable, ['id', 'user_code', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($actorTable)
            ->select($columns)
            ->whereIn('id', $resolvedActorIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => $data['id'] ?? null,
                    'user_code' => $this->support->firstNonEmpty($data, ['user_code']),
                    'full_name' => $this->support->firstNonEmpty($data, ['full_name', 'name']),
                    'username' => $this->support->firstNonEmpty($data, ['username']),
                ];
            })
            ->filter(fn (array $record): bool => array_key_exists('id', $record) && $record['id'] !== null)
            ->keyBy(fn (array $record): string => (string) $record['id'])
            ->all();
    }

    private function resolveActor(mixed $actorId, array $actorMap): ?array
    {
        $resolvedId = $this->support->parseNullableInt($actorId);
        if ($resolvedId === null) {
            return null;
        }

        return $actorMap[(string) $resolvedId] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeQuotationAuditSnapshot(ProductQuotation $quotation): array
    {
        $quotation->loadMissing(['items']);

        return [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'customer_id' => $quotation->customer_id,
            'recipient_name' => $quotation->recipient_name,
            'sender_city' => $quotation->sender_city,
            'quote_date' => $quotation->quote_date?->format('Y-m-d'),
            'scope_summary' => $quotation->scope_summary,
            'vat_rate' => $quotation->vat_rate !== null ? (float) $quotation->vat_rate : null,
            'validity_days' => (int) $quotation->validity_days,
            'notes_text' => $quotation->notes_text,
            'contact_line' => $quotation->contact_line,
            'closing_message' => $quotation->closing_message,
            'signatory_title' => $quotation->signatory_title,
            'signatory_unit' => $quotation->signatory_unit,
            'signatory_name' => $quotation->signatory_name,
            'subtotal' => (float) $quotation->subtotal,
            'vat_amount' => (float) $quotation->vat_amount,
            'total_amount' => (float) $quotation->total_amount,
            'total_in_words' => $quotation->total_in_words,
            'uses_multi_vat_template' => (bool) $quotation->uses_multi_vat_template,
            'content_hash' => $quotation->content_hash,
            'latest_version_no' => (int) $quotation->latest_version_no,
            'last_printed_at' => $quotation->last_printed_at?->toIso8601String(),
            'last_printed_by' => $quotation->last_printed_by,
            'status' => $quotation->status,
            'items' => $quotation->items
                ->map(fn (ProductQuotationItem $item): array => $this->serializeQuotationItem($item))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    private function serializeVersionAuditSnapshot(ProductQuotationVersion $version, array $items): array
    {
        return [
            'id' => $version->id,
            'quotation_id' => $version->quotation_id,
            'version_no' => (int) $version->version_no,
            'template_key' => $version->template_key,
            'status' => $version->status,
            'filename' => $version->filename,
            'quote_date' => $version->quote_date?->format('Y-m-d'),
            'recipient_name' => $version->recipient_name,
            'sender_city' => $version->sender_city,
            'scope_summary' => $version->scope_summary,
            'vat_rate' => $version->vat_rate !== null ? (float) $version->vat_rate : null,
            'validity_days' => (int) $version->validity_days,
            'notes_text' => $version->notes_text,
            'contact_line' => $version->contact_line,
            'closing_message' => $version->closing_message,
            'signatory_title' => $version->signatory_title,
            'signatory_unit' => $version->signatory_unit,
            'signatory_name' => $version->signatory_name,
            'subtotal' => (float) $version->subtotal,
            'vat_amount' => (float) $version->vat_amount,
            'total_amount' => (float) $version->total_amount,
            'total_in_words' => $version->total_in_words,
            'uses_multi_vat_template' => (bool) $version->uses_multi_vat_template,
            'content_hash' => $version->content_hash,
            'printed_at' => $version->printed_at?->toIso8601String(),
            'printed_by' => $version->printed_by,
            'items' => collect($items)
                ->map(fn (array $item): array => $this->normalizeHashItem($item))
                ->values()
                ->all(),
        ];
    }
}
