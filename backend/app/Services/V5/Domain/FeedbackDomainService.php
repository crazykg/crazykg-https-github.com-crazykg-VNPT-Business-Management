<?php

namespace App\Services\V5\Domain;

use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FeedbackDomainService
{
    private const TABLE           = 'feedback_requests';
    private const RESPONSE_TABLE  = 'feedback_responses';
    private const ATTACHMENT_TYPE = 'FEEDBACK_REQUEST';

    private const PRIORITIES = ['UNRATED', 'LOW', 'MEDIUM', 'HIGH'];
    private const STATUSES   = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    // -------------------------------------------------------------------------
    // INDEX
    // -------------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        $query = FeedbackRequest::query()
            ->select($this->support->selectColumns(self::TABLE, [
                'id', 'uuid', 'title', 'description', 'priority', 'status',
                'created_by', 'updated_by', 'status_changed_by', 'status_changed_at',
                'created_at', 'updated_at',
            ]))
            ->orderByDesc('id');

        // Search
        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->support->hasColumn(self::TABLE, 'title')) {
                    $builder->orWhere(self::TABLE.'.title', 'like', $like);
                }
                if ($this->support->hasColumn(self::TABLE, 'description')) {
                    $builder->orWhere(self::TABLE.'.description', 'like', $like);
                }
            });
        }

        // Filter status
        $statusFilter = trim((string) ($request->query('status', '') ?? ''));
        if ($statusFilter !== '' && in_array($statusFilter, self::STATUSES, true)) {
            $query->where('status', $statusFilter);
        }

        // Filter priority
        $priorityFilter = trim((string) ($request->query('priority', '') ?? ''));
        if ($priorityFilter !== '' && in_array($priorityFilter, self::PRIORITIES, true)) {
            $query->where('priority', $priorityFilter);
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);

            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (FeedbackRequest $fb): array => $this->serializeFeedback($fb))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (FeedbackRequest $fb): array => $this->serializeFeedback($fb))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query->get()
            ->map(fn (FeedbackRequest $fb): array => $this->serializeFeedback($fb))
            ->values();

        return response()->json(['data' => $rows]);
    }

    // -------------------------------------------------------------------------
    // SHOW
    // -------------------------------------------------------------------------

    public function show(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        /** @var FeedbackRequest $fb */
        $fb = FeedbackRequest::query()->findOrFail($id);

        $data = $this->serializeFeedback($fb);

        // Attach responses if response table exists
        if ($this->support->hasTable(self::RESPONSE_TABLE)) {
            $data['responses'] = FeedbackResponse::query()
                ->where('feedback_id', $fb->id)
                ->orderBy('created_at')
                ->get()
                ->map(fn (FeedbackResponse $r): array => $this->serializeResponse($r))
                ->values()
                ->all();
        }

        // Attach files
        $data['attachments'] = $this->loadAttachmentsForFeedback((int) $fb->id);

        return response()->json(['data' => $data]);
    }

    // -------------------------------------------------------------------------
    // STORE
    // -------------------------------------------------------------------------

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        $validated = $request->validate([
            'title'          => ['required', 'string', 'max:255'],
            'description'    => ['nullable', 'string'],
            'priority'       => ['nullable', Rule::in(self::PRIORITIES)],
            'attachment_ids' => ['sometimes', 'nullable', 'array'],
            'attachment_ids.*' => ['integer', 'min:1'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $fb = new FeedbackRequest();
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'uuid', (string) Str::uuid());
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'title', $validated['title']);
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'description', $validated['description'] ?? null);
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'priority', $validated['priority'] ?? 'UNRATED');
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'status', 'OPEN');
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'created_by', $userId);
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'updated_by', $userId);

        $fb->save();

        // Link attachments
        $attachmentIds = array_map('intval', $validated['attachment_ids'] ?? []);
        $this->linkAttachments((int) $fb->id, $attachmentIds);

        $data = $this->serializeFeedback($fb);
        $data['attachments'] = $this->loadAttachmentsForFeedback((int) $fb->id);

        return response()->json(['data' => $data], 201);
    }

    // -------------------------------------------------------------------------
    // UPDATE
    // -------------------------------------------------------------------------

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        /** @var FeedbackRequest $fb */
        $fb = FeedbackRequest::query()->findOrFail($id);

        $validated = $request->validate([
            'title'            => ['sometimes', 'required', 'string', 'max:255'],
            'description'      => ['sometimes', 'nullable', 'string'],
            'priority'         => ['sometimes', 'nullable', Rule::in(self::PRIORITIES)],
            'status'           => ['sometimes', 'required', Rule::in(self::STATUSES)],
            'attachment_ids'   => ['sometimes', 'nullable', 'array'],
            'attachment_ids.*' => ['integer', 'min:1'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        if (array_key_exists('title', $validated)) {
            $this->support->setAttributeIfColumn($fb, self::TABLE, 'title', $validated['title']);
        }
        if (array_key_exists('description', $validated)) {
            $this->support->setAttributeIfColumn($fb, self::TABLE, 'description', $validated['description']);
        }
        if (array_key_exists('priority', $validated)) {
            $this->support->setAttributeIfColumn($fb, self::TABLE, 'priority', $validated['priority'] ?? 'UNRATED');
        }
        if (array_key_exists('status', $validated)) {
            $oldStatus = $fb->status ?? null;
            $newStatus = $validated['status'];
            $this->support->setAttributeIfColumn($fb, self::TABLE, 'status', $newStatus);
            if ($oldStatus !== $newStatus) {
                $this->support->setAttributeIfColumn($fb, self::TABLE, 'status_changed_by', $userId);
                $this->support->setAttributeIfColumn($fb, self::TABLE, 'status_changed_at', now());
            }
        }
        $this->support->setAttributeIfColumn($fb, self::TABLE, 'updated_by', $userId);

        $fb->save();

        // Sync attachments when provided
        if (array_key_exists('attachment_ids', $validated)) {
            $attachmentIds = array_map('intval', $validated['attachment_ids'] ?? []);
            $this->syncAttachments((int) $fb->id, $attachmentIds);
        }

        $data = $this->serializeFeedback($fb);
        $data['attachments'] = $this->loadAttachmentsForFeedback((int) $fb->id);

        return response()->json(['data' => $data]);
    }

    // -------------------------------------------------------------------------
    // DESTROY
    // -------------------------------------------------------------------------

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        $fb = FeedbackRequest::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $fb, 'FeedbackRequest');
    }

    // -------------------------------------------------------------------------
    // RESPONSES (replies)
    // -------------------------------------------------------------------------

    public function storeResponse(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::TABLE) || ! $this->support->hasTable(self::RESPONSE_TABLE)) {
            return $this->support->missingTable(self::RESPONSE_TABLE);
        }

        /** @var FeedbackRequest $fb */
        $fb = FeedbackRequest::query()->findOrFail($id);

        $validated = $request->validate([
            'content'           => ['required', 'string'],
            'is_admin_response' => ['sometimes', 'boolean'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $response = new FeedbackResponse();
        $this->support->setAttributeIfColumn($response, self::RESPONSE_TABLE, 'feedback_id', $fb->id);
        $this->support->setAttributeIfColumn($response, self::RESPONSE_TABLE, 'content', $validated['content']);
        $this->support->setAttributeIfColumn($response, self::RESPONSE_TABLE, 'is_admin_response', $validated['is_admin_response'] ?? false);
        $this->support->setAttributeIfColumn($response, self::RESPONSE_TABLE, 'created_by', $userId);

        $response->save();

        return response()->json(['data' => $this->serializeResponse($response)], 201);
    }

    public function destroyResponse(Request $request, int $feedbackId, int $responseId): JsonResponse
    {
        if (! $this->support->hasTable(self::RESPONSE_TABLE)) {
            return $this->support->missingTable(self::RESPONSE_TABLE);
        }

        $response = FeedbackResponse::query()
            ->where('feedback_id', $feedbackId)
            ->findOrFail($responseId);

        return $this->accessAudit->deleteModel($request, $response, 'FeedbackResponse');
    }

    // -------------------------------------------------------------------------
    // Attachment helpers
    // -------------------------------------------------------------------------

    /**
     * Link attachment IDs to a feedback record (insert only, no delete).
     *
     * @param array<int, int> $attachmentIds
     */
    private function linkAttachments(int $feedbackId, array $attachmentIds): void
    {
        if ($attachmentIds === [] || ! $this->support->hasTable('attachments')) {
            return;
        }

        foreach ($attachmentIds as $attachmentId) {
            if (! DB::table('attachments')->where('id', $attachmentId)->exists()) {
                continue;
            }

            DB::table('attachments')
                ->where('id', $attachmentId)
                ->update([
                    'reference_type' => self::ATTACHMENT_TYPE,
                    'reference_id'   => $feedbackId,
                ]);
        }
    }

    /**
     * Sync attachments: set new IDs, clear orphaned ones belonging to this feedback.
     *
     * @param array<int, int> $newAttachmentIds
     */
    private function syncAttachments(int $feedbackId, array $newAttachmentIds): void
    {
        if (! $this->support->hasTable('attachments')) {
            return;
        }

        // Detach attachments no longer in the new list
        $detachQuery = DB::table('attachments')
            ->where('reference_type', self::ATTACHMENT_TYPE)
            ->where('reference_id', $feedbackId);

        if ($newAttachmentIds !== []) {
            $detachQuery->whereNotIn('id', $newAttachmentIds);
        }

        $detachQuery->update(['reference_type' => null, 'reference_id' => null]);

        // Link new ones
        $this->linkAttachments($feedbackId, $newAttachmentIds);
    }

    /**
     * Load serialized attachments for a feedback record.
     *
     * @return array<int, array<string, mixed>>
     */
    private function loadAttachmentsForFeedback(int $feedbackId): array
    {
        if (! $this->support->hasTable('attachments')) {
            return [];
        }

        $query = DB::table('attachments')
            ->where('reference_type', self::ATTACHMENT_TYPE)
            ->where('reference_id', $feedbackId)
            ->orderBy('id');

        if ($this->support->hasColumn('attachments', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $cols = array_values(array_filter([
            'id',
            $this->support->hasColumn('attachments', 'file_name')          ? 'file_name'          : null,
            $this->support->hasColumn('attachments', 'file_url')           ? 'file_url'           : null,
            $this->support->hasColumn('attachments', 'drive_file_id')      ? 'drive_file_id'      : null,
            $this->support->hasColumn('attachments', 'file_size')          ? 'file_size'          : null,
            $this->support->hasColumn('attachments', 'mime_type')          ? 'mime_type'          : null,
            $this->support->hasColumn('attachments', 'storage_disk')       ? 'storage_disk'       : null,
            $this->support->hasColumn('attachments', 'storage_path')       ? 'storage_path'       : null,
            $this->support->hasColumn('attachments', 'storage_visibility') ? 'storage_visibility' : null,
            $this->support->hasColumn('attachments', 'storage_provider')   ? 'storage_provider'   : null,
            $this->support->hasColumn('attachments', 'created_at')         ? 'created_at'         : null,
        ]));

        return $query
            ->select($cols)
            ->get()
            ->map(fn (object $row): array => [
                'id'               => (string) $row->id,
                'fileName'         => (string) ($row->file_name ?? ''),
                'fileUrl'          => isset($row->file_url) ? (string) $row->file_url : null,
                'driveFileId'      => isset($row->drive_file_id) ? (string) $row->drive_file_id : null,
                'fileSize'         => isset($row->file_size) ? (int) $row->file_size : 0,
                'mimeType'         => (string) ($row->mime_type ?? 'application/octet-stream'),
                'storageDisk'      => isset($row->storage_disk) ? (string) $row->storage_disk : null,
                'storagePath'      => isset($row->storage_path) ? (string) $row->storage_path : null,
                'storageVisibility'=> isset($row->storage_visibility) ? (string) $row->storage_visibility : null,
                'storageProvider'  => isset($row->storage_provider) ? (string) $row->storage_provider : 'LOCAL',
                'createdAt'        => isset($row->created_at) ? (string) $row->created_at : null,
            ])
            ->values()
            ->all();
    }

    // -------------------------------------------------------------------------
    // Serializers
    // -------------------------------------------------------------------------

    private function serializeFeedback(FeedbackRequest $fb): array
    {
        return [
            'id'                => $fb->id,
            'uuid'              => $fb->uuid ?? null,
            'title'             => $fb->title ?? '',
            'description'       => $fb->description ?? null,
            'priority'          => $fb->priority ?? 'UNRATED',
            'status'            => $fb->status ?? 'OPEN',
            'created_by'        => $fb->created_by ?? null,
            'updated_by'        => $fb->updated_by ?? null,
            'status_changed_by' => $fb->status_changed_by ?? null,
            'status_changed_at' => $fb->status_changed_at?->toIso8601String() ?? null,
            'created_at'        => $fb->created_at?->toIso8601String() ?? null,
            'updated_at'        => $fb->updated_at?->toIso8601String() ?? null,
        ];
    }

    private function serializeResponse(FeedbackResponse $r): array
    {
        return [
            'id'                => $r->id,
            'feedback_id'       => $r->feedback_id,
            'content'           => $r->content ?? '',
            'is_admin_response' => (bool) ($r->is_admin_response ?? false),
            'created_by'        => $r->created_by ?? null,
            'created_at'        => $r->created_at?->toIso8601String() ?? null,
            'updated_at'        => $r->updated_at?->toIso8601String() ?? null,
        ];
    }

    /** @param mixed $value */
    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }
}
