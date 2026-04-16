<?php

namespace App\Services\V5\Contract;

use App\Models\Contract;
use App\Services\V5\Contract\ContractRenewalService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ContractPaymentService
{
    /**
     * @var array<int, string>
     */
    private const PAYMENT_SCHEDULE_STATUSES = ['PENDING', 'INVOICED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];

    /**
     * @var array<int, string>
     */
    private const PAYMENT_ALLOCATION_MODES = ['EVEN', 'MILESTONE'];

    /**
     * @var array<int, string>
     */
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    /**
     * @var array<int, string>
     */
    private const CONTRACT_TERM_UNITS = ['MONTH', 'DAY'];

    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;
    private const BACKBLAZE_B2_STORAGE_DISK = 'backblaze_b2';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly ContractRenewalService $renewalService
    ) {}

    public function paymentSchedules(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $query = DB::table('payment_schedules')
            ->select($this->paymentScheduleColumns());

        $contractId = $this->support->parseNullableInt($request->query('contract_id'));
        if ($contractId !== null) {
            $query->where('contract_id', $contractId);
        }

        $rows = $this->serializePaymentScheduleRows($query
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values());

        return response()->json(['data' => $rows]);
    }

    public function updatePaymentSchedule(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $schedule = DB::table('payment_schedules')->where('id', $id)->first();
        if ($schedule === null) {
            return response()->json(['message' => 'Payment schedule not found.'], 404);
        }

        $before = $this->accessAudit->toAuditArray($schedule);
        $beforeAttachmentMap = $this->loadPaymentScheduleAttachmentMap([$id]);
        $before['attachments'] = $beforeAttachmentMap[(string) $id] ?? [];
        $scopeContractId = $this->support->parseNullableInt($before['contract_id'] ?? null);
        if ($scopeContractId !== null && $this->support->hasTable('contracts')) {
            $scopeContract = Contract::query()->find($scopeContractId);
            if ($scopeContract instanceof Contract) {
                $scopeError = $this->accessAudit->assertModelMutationAccess($request, $scopeContract, 'kỳ thanh toán');
                if ($scopeError instanceof JsonResponse) {
                    return $scopeError;
                }
            }
        }

        $validated = $request->validate([
            'actual_paid_date' => ['sometimes', 'nullable', 'date'],
            'actual_paid_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'required', Rule::in(self::PAYMENT_SCHEDULE_STATUSES)],
            'notes' => ['sometimes', 'nullable', 'string'],
            'attachments' => ['sometimes', 'array'],
            'attachments.*' => ['array'],
        ]);

        $current = (array) $schedule;
        $updates = [];
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $attachmentsProvided = array_key_exists('attachments', $validated);
        $attachments = $attachmentsProvided && is_array($validated['attachments'] ?? null)
            ? $validated['attachments']
            : [];
        $isPaymentConfirmationMutation = array_key_exists('actual_paid_date', $validated)
            || array_key_exists('actual_paid_amount', $validated)
            || array_key_exists('status', $validated);

        if ($isPaymentConfirmationMutation && $scopeContractId !== null && ! $this->isPaymentScheduleBaselineInSync($scopeContractId)) {
            return response()->json([
                'message' => 'Lịch thanh toán đang lệch giá trị hợp đồng hiện tại. Vui lòng sinh lại kỳ thanh toán trước khi xác nhận thu tiền.',
            ], 422);
        }

        if (array_key_exists('actual_paid_date', $validated)) {
            $updates['actual_paid_date'] = $validated['actual_paid_date'];
        }
        if (array_key_exists('actual_paid_amount', $validated)) {
            $updates['actual_paid_amount'] = $validated['actual_paid_amount'] ?? 0;
        }
        if (array_key_exists('status', $validated)) {
            $updates['status'] = strtoupper((string) $validated['status']);
        }
        if (array_key_exists('notes', $validated)) {
            $updates['notes'] = $validated['notes'];
        }

        if (($updates['status'] ?? '') === 'PAID') {
            if (! array_key_exists('actual_paid_date', $updates) || $updates['actual_paid_date'] === null) {
                $updates['actual_paid_date'] = now()->toDateString();
            }

            if (
                ! array_key_exists('actual_paid_amount', $updates)
                || (float) ($updates['actual_paid_amount'] ?? 0) <= 0
            ) {
                $updates['actual_paid_amount'] = (float) ($current['expected_amount'] ?? 0);
            }
        }

        $resolvedStatus = strtoupper((string) ($updates['status'] ?? $current['status'] ?? 'PENDING'));
        $resolvedActualPaidDate = array_key_exists('actual_paid_date', $updates)
            ? $updates['actual_paid_date']
            : ($current['actual_paid_date'] ?? null);
        $resolvedActualPaidAmount = (float) (
            array_key_exists('actual_paid_amount', $updates)
                ? ($updates['actual_paid_amount'] ?? 0)
                : ($current['actual_paid_amount'] ?? 0)
        );
        $hasConfirmedPayment = in_array($resolvedStatus, ['PAID', 'PARTIAL'], true)
            || $resolvedActualPaidAmount > 0
            || $resolvedActualPaidDate !== null;

        if ($isPaymentConfirmationMutation) {
            if ($hasConfirmedPayment) {
                if ($this->support->hasColumn('payment_schedules', 'confirmed_by')) {
                    $updates['confirmed_by'] = $actorId;
                }
                if ($this->support->hasColumn('payment_schedules', 'confirmed_at')) {
                    $updates['confirmed_at'] = now();
                }
            } else {
                if ($this->support->hasColumn('payment_schedules', 'confirmed_by')) {
                    $updates['confirmed_by'] = null;
                }
                if ($this->support->hasColumn('payment_schedules', 'confirmed_at')) {
                    $updates['confirmed_at'] = null;
                }
            }
        }

        if ($updates === [] && ! $attachmentsProvided) {
            $currentPayload = $this->serializePaymentScheduleRows(collect([$current]))->first();

            return response()->json(['data' => $currentPayload]);
        }

        if ($updates !== []) {
            $updates['updated_at'] = now();
            DB::table('payment_schedules')->where('id', $id)->update($updates);
        } elseif ($attachmentsProvided && $this->support->hasColumn('payment_schedules', 'updated_at')) {
            DB::table('payment_schedules')->where('id', $id)->update(['updated_at' => now()]);
        }

        if ($attachmentsProvided) {
            $this->syncPaymentScheduleAttachments($id, $attachments, $actorId);
        }

        $fresh = DB::table('payment_schedules')->where('id', $id)->first();
        if ($fresh === null) {
            return response()->json(['message' => 'Payment schedule not found after update.'], 404);
        }

        $after = $this->accessAudit->toAuditArray($fresh);
        $afterAttachmentMap = $this->loadPaymentScheduleAttachmentMap([$id]);
        $after['attachments'] = $afterAttachmentMap[(string) $id] ?? [];

        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'payment_schedules',
            $id,
            $before,
            $after
        );

        $payload = $this->serializePaymentScheduleRows(collect([(array) $fresh]))->first();

        return response()->json(['data' => $payload]);
    }

    public function destroyPaymentSchedule(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $schedule = DB::table('payment_schedules')->where('id', $id)->first();
        if ($schedule === null) {
            return response()->json(['message' => 'Payment schedule not found.'], 404);
        }

        $before = $this->accessAudit->toAuditArray($schedule);
        $beforeAttachmentMap = $this->loadPaymentScheduleAttachmentMap([$id]);
        $before['attachments'] = $beforeAttachmentMap[(string) $id] ?? [];

        $scopeContractId = $this->support->parseNullableInt($before['contract_id'] ?? null);
        if ($scopeContractId !== null && $this->support->hasTable('contracts')) {
            $scopeContract = Contract::query()->find($scopeContractId);
            if ($scopeContract instanceof Contract) {
                $scopeError = $this->accessAudit->assertModelMutationAccess($request, $scopeContract, 'kỳ thanh toán');
                if ($scopeError instanceof JsonResponse) {
                    return $scopeError;
                }
            }
        }

        $status = strtoupper(trim((string) ($schedule->status ?? 'PENDING')));
        $actualPaidAmount = (float) ($schedule->actual_paid_amount ?? 0);
        $actualPaidDate = $this->support->normalizeNullableString($schedule->actual_paid_date ?? null);
        $invoiceId = $this->support->hasColumn('payment_schedules', 'invoice_id')
            ? $this->support->parseNullableInt($schedule->invoice_id ?? null)
            : null;

        if ($invoiceId !== null) {
            return response()->json([
                'message' => 'Không thể xóa kỳ thanh toán đã liên kết với hóa đơn.',
            ], 422);
        }

        if ($actualPaidAmount > 0 || $actualPaidDate !== null || in_array($status, ['PAID', 'PARTIAL'], true)) {
            return response()->json([
                'message' => 'Không thể xóa kỳ thanh toán đã phát sinh thu tiền thực tế.',
            ], 422);
        }

        DB::transaction(function () use ($id): void {
            $this->deletePaymentScheduleAttachments($id);
            DB::table('payment_schedules')->where('id', $id)->delete();
        });

        $this->accessAudit->recordAuditEvent(
            $request,
            'DELETE',
            'payment_schedules',
            $id,
            $before,
            null
        );

        return response()->json([
            'message' => 'Đã xóa kỳ thanh toán.',
        ]);
    }

    public function generateContractPayments(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $contract = Contract::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $contract, 'hợp đồng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $validated = $request->validate([
            'allocation_mode' => ['sometimes', 'string', Rule::in(self::PAYMENT_ALLOCATION_MODES)],
            'advance_percentage' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'retention_percentage' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'installment_count' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
            'installments' => ['sometimes', 'array'],
            'installments.*.label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'installments.*.percentage' => ['sometimes', 'required', 'numeric', 'min:0.01', 'max:100'],
            'installments.*.expected_date' => ['sometimes', 'nullable', 'date'],
            'draft_installments' => ['sometimes', 'array'],
            'draft_installments.*.label' => ['required_with:draft_installments', 'string', 'max:255'],
            'draft_installments.*.expected_date' => ['required_with:draft_installments', 'date'],
            'draft_installments.*.expected_amount' => ['required_with:draft_installments', 'numeric', 'gt:0'],
        ]);

        try {
            $this->assertSchedulesCanBeRegenerated($contract);
            $generationSummary = $this->generateContractPaymentSchedulesFallback($contract, [
                'allocation_mode' => $validated['allocation_mode'] ?? null,
                'advance_percentage' => $validated['advance_percentage'] ?? null,
                'retention_percentage' => $validated['retention_percentage'] ?? null,
                'installment_count' => $validated['installment_count'] ?? null,
                'installments' => $validated['installments'] ?? [],
                'draft_installments' => $validated['draft_installments'] ?? [],
            ]);
        } catch (ValidationException $validationException) {
            throw $validationException;
        } catch (\Throwable $exception) {
            Log::error('[ContractPayment] Auto-generate failed', ['contract_id' => $contract->id, 'error' => $exception->getMessage()]);
            return response()->json([
                'message' => 'Không thể sinh kỳ thanh toán tự động. Vui lòng kiểm tra lại dữ liệu hợp đồng.',
            ], 422);
        }

        $rows = $this->serializePaymentScheduleRows(DB::table('payment_schedules')
            ->select($this->paymentScheduleColumns())
            ->where('contract_id', $contract->id)
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values());

        $auditAfter = [
            'contract_id' => $contract->id,
            'generated_rows' => (int) ($generationSummary['generated_count'] ?? 0),
            'allocation_mode' => (string) ($generationSummary['allocation_mode'] ?? 'EVEN'),
            'generation_mode' => 'backend',
        ];

        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'contracts',
            $contract->id,
            ['contract_id' => $contract->id, 'operation' => 'generate_contract_payments'],
            $auditAfter
        );

        $generatedCycleNumbers = $generationSummary['generated_cycle_numbers'] ?? [];

        return response()->json([
            'message' => 'Đã sinh kỳ thanh toán theo logic backend thống nhất.',
            'data' => $rows,
            'generated_data' => $rows
                ->filter(fn (array $row): bool => in_array(
                    (int) ($row['cycle_number'] ?? 0),
                    $generatedCycleNumbers,
                    true
                ))
                ->values(),
            'meta' => [
                'generated_count' => (int) ($generationSummary['generated_count'] ?? 0),
                'allocation_mode' => (string) ($generationSummary['allocation_mode'] ?? 'EVEN'),
                'generation_mode' => 'backend',
            ],
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function paymentScheduleColumns(): array
    {
        return $this->support->selectColumns('payment_schedules', [
            'id',
            'contract_id',
            'project_id',
            'milestone_name',
            'cycle_number',
            'expected_date',
            'expected_amount',
            'actual_paid_date',
            'actual_paid_amount',
            'status',
            'notes',
            'confirmed_by',
            'confirmed_at',
            'created_at',
            'updated_at',
        ]);
    }

    /**
     * @param Collection<int, array<string, mixed>|object>|array<int, array<string, mixed>|object> $records
     * @return Collection<int, array<string, mixed>>
     */
    private function serializePaymentScheduleRows(Collection|array $records): Collection
    {
        $normalizedRecords = collect($records)
            ->map(fn ($record): array => is_array($record) ? $record : (array) $record)
            ->values();

        $scheduleIds = $normalizedRecords
            ->map(fn (array $record): ?int => $this->support->parseNullableInt($record['id'] ?? null))
            ->filter(fn (?int $scheduleId): bool => $scheduleId !== null)
            ->unique()
            ->values()
            ->all();

        $confirmedByIds = $normalizedRecords
            ->map(fn (array $record): ?int => $this->support->parseNullableInt($record['confirmed_by'] ?? null))
            ->filter(fn (?int $userId): bool => $userId !== null)
            ->unique()
            ->values()
            ->all();

        $attachmentMap = $this->loadPaymentScheduleAttachmentMap($scheduleIds);
        $actorMap = $this->resolveAuditActorMap($confirmedByIds);

        return $normalizedRecords
            ->map(fn (array $record): array => $this->serializePaymentScheduleRecord($record, $attachmentMap, $actorMap))
            ->values();
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, array<int, array<string, mixed>>> $attachmentMap
     * @param array<string, array<string, mixed>> $actorMap
     * @return array<string, mixed>
     */
    private function serializePaymentScheduleRecord(array $record, array $attachmentMap = [], array $actorMap = []): array
    {
        $recordId = (string) ($record['id'] ?? '');
        $confirmedById = $this->support->parseNullableInt($record['confirmed_by'] ?? null);
        $confirmedByName = null;
        if ($confirmedById !== null) {
            $actor = $actorMap[(string) $confirmedById] ?? null;
            if (is_array($actor)) {
                $resolvedName = trim((string) $this->support->firstNonEmpty($actor, ['full_name', 'username'], ''));
                $confirmedByName = $resolvedName !== '' ? $resolvedName : null;
            }
        }

        return [
            'id' => $record['id'] ?? null,
            'contract_id' => $record['contract_id'] ?? null,
            'project_id' => $record['project_id'] ?? null,
            'milestone_name' => (string) ($record['milestone_name'] ?? ''),
            'cycle_number' => (int) ($record['cycle_number'] ?? 1),
            'expected_date' => (string) ($record['expected_date'] ?? ''),
            'expected_amount' => (float) ($record['expected_amount'] ?? 0),
            'actual_paid_date' => $record['actual_paid_date'] ?? null,
            'actual_paid_amount' => (float) ($record['actual_paid_amount'] ?? 0),
            'status' => strtoupper((string) ($record['status'] ?? 'PENDING')),
            'notes' => $record['notes'] ?? null,
            'confirmed_by' => $confirmedById,
            'confirmed_by_name' => $confirmedByName,
            'confirmed_at' => $record['confirmed_at'] ?? null,
            'attachments' => $recordId !== '' ? ($attachmentMap[$recordId] ?? []) : [],
            'created_at' => $record['created_at'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
        ];
    }

    /**
     * @param array<int, int> $actorIds
     * @return array<string, array<string, mixed>>
     */
    private function resolveAuditActorMap(array $actorIds): array
    {
        if ($actorIds === []) {
            return [];
        }

        $actorTable = $this->support->resolveEmployeeTable();
        if ($actorTable === null) {
            return [];
        }

        $columns = $this->support->selectColumns($actorTable, ['id', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($actorTable)
            ->select($columns)
            ->whereIn('id', $actorIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => $data['id'] ?? null,
                    'full_name' => $this->support->firstNonEmpty($data, ['full_name', 'name']),
                    'username' => $this->support->firstNonEmpty($data, ['username']),
                ];
            })
            ->filter(fn (array $record): bool => array_key_exists('id', $record) && $record['id'] !== null)
            ->keyBy(fn (array $record): string => (string) $record['id'])
            ->all();
    }

    /**
     * @param array<int, int> $scheduleIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadPaymentScheduleAttachmentMap(array $scheduleIds): array
    {
        if (
            $scheduleIds === []
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
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->whereIn('reference_id', $scheduleIds)
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

            $map[$referenceId][] = [
                'id' => (string) ($row['id'] ?? ''),
                'fileName' => (string) ($row['file_name'] ?? ''),
                'mimeType' => (string) ($this->support->firstNonEmpty($row, ['mime_type'], 'application/octet-stream')),
                'fileSize' => (int) ($row['file_size'] ?? 0),
                'fileUrl' => $this->resolveAttachmentFileUrl($row),
                'driveFileId' => (string) ($row['drive_file_id'] ?? ''),
                'createdAt' => $this->formatDateColumn($row['created_at'] ?? null) ?? '',
                'storagePath' => $this->support->normalizeNullableString($row['storage_path'] ?? null),
                'storageDisk' => $this->support->normalizeNullableString($row['storage_disk'] ?? null),
                'storageVisibility' => $this->support->normalizeNullableString($row['storage_visibility'] ?? null),
                'storageProvider' => $this->support->normalizeNullableString($row['drive_file_id'] ?? null) !== null
                    ? 'GOOGLE_DRIVE'
                    : (($this->support->normalizeNullableString($row['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
            ];
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncPaymentScheduleAttachments(int $scheduleId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->where('reference_id', $scheduleId)
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
                'reference_type' => 'PAYMENT_SCHEDULE',
                'reference_id' => $scheduleId,
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
                'v5.documents.attachments.download',
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
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->toISOString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param array<string, mixed> $options
     * @return array{generated_count:int,allocation_mode:string,generated_cycle_numbers:array<int, int>}
     */
    private function generateContractPaymentSchedulesFallback(Contract $contract, array $options = []): array
    {
        $context = $this->resolveContractPaymentGenerationContext($contract);
        $cycle = (string) $context['cycle'];
        $amount = (float) $context['amount'];
        $startDate = (string) $context['start_date'];
        $endDate = isset($context['end_date']) ? (string) $context['end_date'] : null;
        $investmentMode = $this->support->normalizeNullableString($context['investment_mode'] ?? null);

        $requestedAllocationMode = $this->support->normalizeNullableString($options['allocation_mode'] ?? null);
        $allocationMode = $this->resolvePaymentAllocationMode($requestedAllocationMode, $investmentMode);
        $advancePercentage = $this->clampPercentageValue($options['advance_percentage'] ?? null);
        $retentionPercentage = $this->clampPercentageValue($options['retention_percentage'] ?? null);
        $installmentCount = $this->support->parseNullableInt($options['installment_count'] ?? null);
        $installments = is_array($options['installments'] ?? null) ? $options['installments'] : [];
        $draftInstallments = is_array($options['draft_installments'] ?? null) ? $options['draft_installments'] : [];

        if ($allocationMode === 'MILESTONE') {
            $scheduleSpecs = $this->buildMilestonePaymentSchedule(
                $amount,
                $startDate,
                $endDate,
                $advancePercentage,
                $retentionPercentage,
                $installmentCount,
                $installments
            );
        } else {
            $scheduleSpecs = $draftInstallments !== []
                ? $this->buildEvenDraftPaymentSchedule(
                    $amount,
                    $cycle,
                    $startDate,
                    $endDate,
                    $investmentMode,
                    $draftInstallments
                )
                : (function () use ($amount, $cycle, $startDate, $endDate, $investmentMode): array {
                    $expectedDates = $this->buildExpectedPaymentDatesForCycle($cycle, $startDate, $endDate);
                    $cycleCount = max(1, count($expectedDates));
                    $expectedAmounts = $this->buildAllocatedExpectedAmounts($amount, $cycleCount);
                    $rows = [];
                    foreach ($expectedDates as $index => $expectedDate) {
                        $cycleNumber = $index + 1;
                        $rows[] = [
                            'milestone_name' => $this->buildPaymentMilestoneName($cycle, $cycleNumber, $investmentMode),
                            'expected_date' => $expectedDate,
                            'expected_amount' => max(0, (float) ($expectedAmounts[$index] ?? 0)),
                        ];
                    }

                    return $rows;
                })();
        }

        $contractData = $contract->toArray();
        $projectId = $this->support->parseNullableInt($this->support->firstNonEmpty($contractData, ['project_id']));
        $requiresProjectId = $this->support->hasColumn('payment_schedules', 'project_id')
            && ! $this->isColumnNullable('payment_schedules', 'project_id');

        if ($requiresProjectId && $projectId === null) {
            throw ValidationException::withMessages([
                'project_id' => ['Không thể sinh kỳ thanh toán vì hợp đồng chưa có dự án liên kết.'],
            ]);
        }

        $now = now();
        $rows = [];

        foreach ($scheduleSpecs as $index => $scheduleSpec) {
            $cycleNumber = $index + 1;
            $expectedDate = (string) ($scheduleSpec['expected_date'] ?? $startDate);
            $expectedAmount = (float) ($scheduleSpec['expected_amount'] ?? 0);

            $row = [
                'contract_id' => $contract->id,
                'milestone_name' => (string) ($scheduleSpec['milestone_name'] ?? $this->buildPaymentMilestoneName($cycle, $cycleNumber, $investmentMode)),
                'cycle_number' => $cycleNumber,
                'expected_date' => $expectedDate,
                'expected_amount' => max(0, $expectedAmount),
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'PENDING',
                'notes' => null,
            ];

            if ($this->support->hasColumn('payment_schedules', 'project_id')) {
                $row['project_id'] = $projectId;
            }
            if ($this->support->hasColumn('payment_schedules', 'created_at')) {
                $row['created_at'] = $now;
            }
            if ($this->support->hasColumn('payment_schedules', 'updated_at')) {
                $row['updated_at'] = $now;
            }

            $rows[] = $row;
        }

        DB::transaction(function () use ($contract, $rows): void {
            $this->syncStoredContractAmount($contract, array_sum(array_map(
                static fn (array $row): float => (float) ($row['expected_amount'] ?? 0),
                $rows
            )));

            DB::table('payment_schedules')
                ->where('contract_id', $contract->id)
                ->delete();

            if ($rows !== []) {
                DB::table('payment_schedules')->insert($rows);

                // Apply renewal penalty if this contract has a gap vs its parent
                if ($this->support->hasColumn('contracts', 'penalty_rate')
                    && $this->support->hasColumn('payment_schedules', 'penalty_rate')) {
                    $penaltyRate = $this->parseNullableFloat($contract->getAttribute('penalty_rate'));
                    if ($penaltyRate !== null && $penaltyRate > 0) {
                        $insertedIds = DB::table('payment_schedules')
                            ->where('contract_id', $contract->id)
                            ->where('status', 'PENDING')
                            ->pluck('id');
                        $this->renewalService->applyPenaltyToSchedules($insertedIds->all(), $penaltyRate);
                    }
                }
            }
        });

        return [
            'generated_count' => count($rows),
            'allocation_mode' => $allocationMode,
            'generated_cycle_numbers' => array_values(array_map(
                static fn (array $row): int => (int) ($row['cycle_number'] ?? 0),
                $rows
            )),
        ];
    }

    private function deletePaymentScheduleAttachments(int $scheduleId): void
    {
        if (
            ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->where('reference_id', $scheduleId)
            ->delete();
    }

    /**
     * @return array{cycle:string,amount:float,start_date:string,end_date:?string,investment_mode:?string}
     */
    private function resolveContractPaymentGenerationContext(Contract $contract): array
    {
        $contractData = $contract->toArray();
        $projectId = $this->support->parseNullableInt($this->support->firstNonEmpty($contractData, ['project_id']));

        $cycle = $this->normalizePaymentCycle((string) $this->support->firstNonEmpty($contractData, ['payment_cycle'], 'ONCE'));
        $amount = $this->resolveContractEffectiveAmount($contract, $contractData);
        $effectiveDate = $this->normalizeDateFilter($this->support->firstNonEmpty($contractData, ['effective_date']));
        $signDate = $this->normalizeDateFilter($this->support->firstNonEmpty($contractData, ['sign_date']));
        $startDate = $effectiveDate ?? $signDate;
        $endDate = $this->normalizeDateFilter($this->support->firstNonEmpty($contractData, ['expiry_date']));
        $investmentMode = $this->resolveContractInvestmentMode($contract, $projectId);
        $termUnitRaw = strtoupper(trim((string) $this->support->firstNonEmpty($contractData, ['term_unit'], '')));
        $termUnit = in_array($termUnitRaw, self::CONTRACT_TERM_UNITS, true) ? $termUnitRaw : null;
        $termValue = $this->parseNullableFloat($this->support->firstNonEmpty($contractData, ['term_value']));

        if (($termUnit !== null && $termValue === null) || ($termUnit === null && $termValue !== null)) {
            throw ValidationException::withMessages([
                'term_value' => ['term_unit và term_value phải đi cùng nhau để suy ra ngày hết hiệu lực.'],
            ]);
        }

        if ($termUnit === 'DAY' && $termValue !== null && floor($termValue) !== $termValue) {
            throw ValidationException::withMessages([
                'term_value' => ['Thời hạn theo ngày phải là số nguyên.'],
            ]);
        }

        if ($endDate === null && $startDate !== null && $termUnit !== null && $termValue !== null) {
            $endDate = $this->resolveContractExpiryDateFromTerm($termUnit, $termValue, $effectiveDate, $signDate);
        }

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'value' => ['Giá trị hợp đồng phải lớn hơn 0 để sinh kỳ thanh toán.'],
            ]);
        }

        if ($startDate === null) {
            throw ValidationException::withMessages([
                'effective_date' => ['Không xác định được mốc bắt đầu hợp đồng để sinh kỳ thanh toán.'],
            ]);
        }

        if ($endDate !== null && $endDate < $startDate) {
            throw ValidationException::withMessages([
                'expiry_date' => ['Ngày hết hiệu lực phải lớn hơn hoặc bằng mốc bắt đầu hợp đồng.'],
            ]);
        }

        return [
            'cycle' => $cycle,
            'amount' => $amount,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'investment_mode' => $investmentMode,
        ];
    }

    /**
     * @param array<string, mixed> $contractData
     */
    private function resolveContractEffectiveAmount(Contract $contract, array $contractData): float
    {
        $fallbackAmount = (float) $this->support->firstNonEmpty($contractData, ['value', 'total_value'], 0);

        if (
            ! $this->support->hasTable('contract_items')
            || ! $this->support->hasColumn('contract_items', 'contract_id')
            || ! $this->support->hasColumn('contract_items', 'quantity')
            || ! $this->support->hasColumn('contract_items', 'unit_price')
        ) {
            return $fallbackAmount;
        }

        $itemsTotal = (float) DB::table('contract_items')
            ->where('contract_id', $contract->getKey())
            ->selectRaw('COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 0) as total_amount')
            ->value('total_amount');

        return $itemsTotal > 0 ? round($itemsTotal, 2) : $fallbackAmount;
    }

    private function assertSchedulesCanBeRegenerated(Contract $contract): void
    {
        if (
            ! $this->support->hasTable('payment_schedules')
            || ! $this->support->hasColumn('payment_schedules', 'contract_id')
        ) {
            return;
        }

        $columns = ['id'];
        if ($this->support->hasColumn('payment_schedules', 'status')) {
            $columns[] = 'status';
        }
        if ($this->support->hasColumn('payment_schedules', 'actual_paid_amount')) {
            $columns[] = 'actual_paid_amount';
        }

        $rows = DB::table('payment_schedules')
            ->where('contract_id', $contract->getKey())
            ->select($columns)
            ->get();

        $hasCollectedRows = $rows->contains(function (object $row): bool {
            $status = strtoupper(trim((string) ($row->status ?? '')));
            $actualPaidAmount = (float) ($row->actual_paid_amount ?? 0);
            return $actualPaidAmount > 0 || in_array($status, ['PAID', 'PARTIAL'], true);
        });

        if ($hasCollectedRows) {
            throw ValidationException::withMessages([
                'payment_schedules' => ['Không thể sinh lại kỳ thanh toán vì hợp đồng đã có kỳ thu tiền thực tế.'],
            ]);
        }
    }

    private function isPaymentScheduleBaselineInSync(int $contractId): bool
    {
        $contract = Contract::query()->find($contractId);
        if (! $contract instanceof Contract) {
            return true;
        }

        $effectiveAmount = $this->resolveContractEffectiveAmount($contract, $contract->toArray());
        $scheduleAmount = (float) DB::table('payment_schedules')
            ->where('contract_id', $contractId)
            ->sum('expected_amount');

        return abs(round($scheduleAmount, 2) - round($effectiveAmount, 2)) <= 0.5;
    }

    private function syncStoredContractAmount(Contract $contract, float $amount): void
    {
        $normalizedAmount = round(max(0, $amount), 2);
        $dirty = false;

        if ($this->support->hasColumn('contracts', 'value') && (float) ($contract->getAttribute('value') ?? 0) !== $normalizedAmount) {
            $contract->setAttribute('value', $normalizedAmount);
            $dirty = true;
        }

        if ($this->support->hasColumn('contracts', 'total_value') && (float) ($contract->getAttribute('total_value') ?? 0) !== $normalizedAmount) {
            $contract->setAttribute('total_value', $normalizedAmount);
            $dirty = true;
        }

        if ($dirty) {
            $contract->save();
        }
    }

    private function resolvePaymentAllocationMode(?string $requestedMode, ?string $investmentMode): string
    {
        $normalizedMode = strtoupper(trim((string) ($requestedMode ?? '')));
        if (in_array($normalizedMode, self::PAYMENT_ALLOCATION_MODES, true)) {
            if ($normalizedMode === 'EVEN' && strtoupper((string) $investmentMode) === 'DAU_TU') {
                throw ValidationException::withMessages([
                    'allocation_mode' => ['Dự án Đầu tư chỉ dùng được cách phân bổ Tạm ứng + Đợt đầu tư.'],
                ]);
            }

            if ($normalizedMode === 'MILESTONE' && strtoupper((string) $investmentMode) !== 'DAU_TU') {
                throw ValidationException::withMessages([
                    'allocation_mode' => ['Chỉ dự án Đầu tư mới dùng được cách phân bổ theo mốc nghiệm thu.'],
                ]);
            }

            return $normalizedMode;
        }

        return strtoupper((string) $investmentMode) === 'DAU_TU' ? 'MILESTONE' : 'EVEN';
    }

    private function clampPercentageValue(mixed $value, float $default = 0): float
    {
        $parsed = $this->parseNullableFloat($value);
        if ($parsed === null) {
            return $default;
        }

        return max(0, min(100, $parsed));
    }

    private function resolveContractInvestmentMode(Contract $contract, ?int $projectId): ?string
    {
        $projectInvestmentMode = null;

        if (
            $projectId !== null
            && $this->support->hasTable('projects')
            && $this->support->hasColumn('projects', 'investment_mode')
        ) {
            $rawMode = DB::table('projects')
                ->where('id', $projectId)
                ->value('investment_mode');

            $projectInvestmentMode = strtoupper(trim((string) ($rawMode ?? '')));
        }

        if ($projectInvestmentMode !== null && $projectInvestmentMode !== '') {
            return $projectInvestmentMode;
        }

        if (! $this->support->hasColumn('contracts', 'project_type_code')) {
            return null;
        }

        $contractMode = strtoupper(trim((string) ($contract->getAttribute('project_type_code') ?? '')));

        return $contractMode !== '' ? $contractMode : null;
    }

    /**
     * @param array<int, mixed> $installments
     * @return array<int, array{milestone_name:string,expected_date:string,expected_amount:float}>
     */
    private function buildMilestonePaymentSchedule(
        float $totalAmount,
        string $startDate,
        ?string $endDate,
        float $advancePercentage,
        float $retentionPercentage,
        ?int $installmentCount,
        array $installments = []
    ): array {
        if ($endDate === null || trim($endDate) === '') {
            throw ValidationException::withMessages([
                'expiry_date' => ['Dự án Đầu tư cần có Ngày hết hiệu lực để sinh kỳ thanh toán theo mốc nghiệm thu.'],
            ]);
        }

        $safeTotal = round(max(0, $totalAmount), 2);
        $safeAdvancePercentage = $this->clampPercentageValue($advancePercentage, 15);
        $safeRetentionPercentage = $this->clampPercentageValue($retentionPercentage, 5);
        $installmentSpecs = $this->normalizeMilestoneInstallmentDefinitions($installments);
        $hasCustomInstallments = $installmentSpecs !== [];
        $safeInstallmentCount = $hasCustomInstallments
            ? count($installmentSpecs)
            : max(1, min(50, $installmentCount ?? 3));

        if ($hasCustomInstallments) {
            $customPercentageTotal = round(array_sum(array_map(
                static fn (array $item): float => (float) ($item['percentage'] ?? 0),
                $installmentSpecs
            )), 2);

            $percentageTotal = round($safeAdvancePercentage + $safeRetentionPercentage + $customPercentageTotal, 2);
            if (abs($percentageTotal - 100) >= 0.01) {
                throw ValidationException::withMessages([
                    'installments' => ['Tổng % tạm ứng, các đợt thanh toán và quyết toán phải bằng 100%.'],
                ]);
            }
        } elseif ($safeAdvancePercentage + $safeRetentionPercentage >= 100) {
            throw ValidationException::withMessages([
                'retention_percentage' => ['Tổng % tạm ứng và % giữ lại phải nhỏ hơn 100% để còn phần thanh toán theo đợt.'],
            ]);
        }

        $rows = [];
        $hasAdvance = $safeAdvancePercentage > 0;
        $hasRetention = $safeRetentionPercentage > 0;

        if ($hasAdvance) {
            $rows[] = [
                'milestone_name' => 'Tạm ứng',
                'expected_date' => $startDate,
                'expected_amount' => round(($safeTotal * $safeAdvancePercentage) / 100, 2),
            ];
        }

        $installmentDates = $this->buildMilestoneInstallmentDates(
            $startDate,
            $endDate,
            $safeInstallmentCount,
            $hasAdvance,
            $hasRetention
        );

        if ($hasCustomInstallments) {
            foreach ($installmentSpecs as $index => $installmentSpec) {
                $fallbackDate = $installmentDates[$index] ?? $endDate;
                $rows[] = [
                    'milestone_name' => (string) ($installmentSpec['label'] ?? sprintf('Thanh toán đợt %d', $index + 1)),
                    'expected_date' => (string) ($installmentSpec['expected_date'] ?? $fallbackDate),
                    'expected_amount' => round(($safeTotal * (float) ($installmentSpec['percentage'] ?? 0)) / 100, 2),
                ];
            }
        } else {
            $advanceAmount = round(($safeTotal * $safeAdvancePercentage) / 100, 2);
            $retentionAmount = round(($safeTotal * $safeRetentionPercentage) / 100, 2);
            $installmentPool = max(0, round($safeTotal - $advanceAmount - $retentionAmount, 2));
            $installmentAmounts = $this->buildAllocatedExpectedAmounts($installmentPool, $safeInstallmentCount);

            foreach ($installmentDates as $index => $installmentDate) {
                $rows[] = [
                    'milestone_name' => sprintf('Thanh toán đợt %d', $index + 1),
                    'expected_date' => $installmentDate,
                    'expected_amount' => max(0, (float) ($installmentAmounts[$index] ?? 0)),
                ];
            }
        }

        if ($hasRetention) {
            $rows[] = [
                'milestone_name' => 'Quyết toán',
                'expected_date' => $endDate,
                'expected_amount' => round(($safeTotal * $safeRetentionPercentage) / 100, 2),
            ];
        }

        if ($rows === []) {
            throw ValidationException::withMessages([
                'allocation_mode' => ['Không thể sinh mốc thanh toán đầu tư vì chưa có cấu hình tạm ứng, đợt thanh toán hoặc quyết toán.'],
            ]);
        }

        $totalAllocated = round(array_sum(array_map(
            static fn (array $row): float => (float) ($row['expected_amount'] ?? 0),
            $rows
        )), 2);
        $diff = round($safeTotal - $totalAllocated, 2);
        if (abs($diff) >= 0.01) {
            $lastIndex = count($rows) - 1;
            $rows[$lastIndex]['expected_amount'] = max(0, round(((float) $rows[$lastIndex]['expected_amount']) + $diff, 2));
        }

        return array_map(static function (array $row): array {
            return [
                'milestone_name' => (string) ($row['milestone_name'] ?? ''),
                'expected_date' => (string) ($row['expected_date'] ?? ''),
                'expected_amount' => round(max(0, (float) ($row['expected_amount'] ?? 0)), 2),
            ];
        }, $rows);
    }

    /**
     * @param array<int, mixed> $draftInstallments
     * @return array<int, array{milestone_name:string,expected_date:string,expected_amount:float}>
     */
    private function buildEvenDraftPaymentSchedule(
        float $totalAmount,
        string $cycle,
        string $startDate,
        ?string $endDate,
        ?string $investmentMode,
        array $draftInstallments
    ): array {
        $normalizedDraftInstallments = $this->normalizeEvenDraftInstallments(
            $draftInstallments,
            $cycle,
            $investmentMode
        );

        $safeTotal = round(max(0, $totalAmount), 2);
        $draftTotal = round(array_sum(array_map(
            static fn (array $row): float => (float) ($row['expected_amount'] ?? 0),
            $normalizedDraftInstallments
        )), 2);

        if (abs($draftTotal - $safeTotal) > 0.5) {
            throw ValidationException::withMessages([
                'draft_installments' => ['Tổng số tiền dự thảo phải bằng giá trị hợp đồng trước khi sinh kỳ thanh toán.'],
            ]);
        }

        return array_map(static function (array $row): array {
            return [
                'milestone_name' => (string) ($row['label'] ?? ''),
                'expected_date' => (string) ($row['expected_date'] ?? ''),
                'expected_amount' => round(max(0, (float) ($row['expected_amount'] ?? 0)), 2),
            ];
        }, $normalizedDraftInstallments);
    }

    /**
     * @param array<int, mixed> $installments
     * @return array<int, array{label:string,percentage:float,expected_date:?string}>
     */
    private function normalizeMilestoneInstallmentDefinitions(array $installments): array
    {
        $normalized = [];

        foreach ($installments as $index => $installment) {
            if (! is_array($installment)) {
                continue;
            }

            $percentage = $this->parseNullableFloat($installment['percentage'] ?? null);
            if ($percentage === null || $percentage <= 0) {
                throw ValidationException::withMessages([
                    "installments.{$index}.percentage" => ['Mỗi đợt thanh toán phải có tỷ lệ % lớn hơn 0.'],
                ]);
            }

            $expectedDate = $this->normalizeDateFilter($installment['expected_date'] ?? null);

            $normalized[] = [
                'label' => trim((string) ($installment['label'] ?? '')),
                'percentage' => max(0, min(100, $percentage)),
                'expected_date' => $expectedDate,
            ];
        }

        return $normalized;
    }

    /**
     * @param array<int, mixed> $draftInstallments
     * @return array<int, array{label:string,expected_date:string,expected_amount:float}>
     */
    private function normalizeEvenDraftInstallments(
        array $draftInstallments,
        string $cycle,
        ?string $investmentMode
    ): array {
        if ($draftInstallments === []) {
            throw ValidationException::withMessages([
                'draft_installments' => ['Bản chỉnh sửa phải có ít nhất 1 kỳ dự thảo.'],
            ]);
        }

        $normalized = [];

        foreach ($draftInstallments as $index => $installment) {
            if (! is_array($installment)) {
                throw ValidationException::withMessages([
                    "draft_installments.{$index}" => ['Dữ liệu kỳ dự thảo không hợp lệ.'],
                ]);
            }

            $label = trim((string) ($installment['label'] ?? ''));
            if ($label === '') {
                throw ValidationException::withMessages([
                    "draft_installments.{$index}.label" => ['Tên kỳ không được để trống.'],
                ]);
            }

            $expectedDate = $this->normalizeDateFilter($installment['expected_date'] ?? null);
            if ($expectedDate === null) {
                throw ValidationException::withMessages([
                    "draft_installments.{$index}.expected_date" => ['Ngày dự kiến không hợp lệ.'],
                ]);
            }

            $expectedAmount = $this->parseNullableFloat($installment['expected_amount'] ?? null);
            if ($expectedAmount === null || $expectedAmount <= 0) {
                throw ValidationException::withMessages([
                    "draft_installments.{$index}.expected_amount" => ['Số tiền dự kiến phải lớn hơn 0.'],
                ]);
            }

            $normalized[] = [
                'label' => $label,
                'expected_date' => $expectedDate,
                'expected_amount' => round(max(0, $expectedAmount), 2),
            ];
        }

        return $normalized;
    }

    /**
     * @return array<int, string>
     */
    private function buildMilestoneInstallmentDates(
        string $startDate,
        string $endDate,
        int $installmentCount,
        bool $hasAdvance,
        bool $hasRetention
    ): array {
        if ($installmentCount <= 0) {
            return [];
        }

        try {
            $start = Carbon::parse($startDate)->startOfDay();
            $end = Carbon::parse($endDate)->startOfDay();
        } catch (\Throwable) {
            return array_fill(0, $installmentCount, $startDate);
        }

        if ($end->lte($start)) {
            return array_fill(0, $installmentCount, $start->toDateString());
        }

        $startMonth = $start->copy()->startOfMonth();
        $endMonth = $end->copy()->startOfMonth();
        $monthSpan = max(1, (($endMonth->year - $startMonth->year) * 12) + ($endMonth->month - $startMonth->month));
        $dates = [];

        for ($index = 1; $index <= $installmentCount; $index++) {
            if ($hasAdvance && $hasRetention) {
                $rawOffsetMonths = ($monthSpan / ($installmentCount + 1)) * $index;
            } elseif ($hasAdvance && ! $hasRetention) {
                $rawOffsetMonths = ($monthSpan / $installmentCount) * $index;
            } elseif (! $hasAdvance && $hasRetention) {
                $rawOffsetMonths = ($monthSpan / ($installmentCount + 1)) * $index;
            } else {
                $rawOffsetMonths = $installmentCount === 1
                    ? $monthSpan
                    : ($monthSpan / max(1, $installmentCount - 1)) * ($index - 1);
            }

            $offsetMonths = (int) ceil(max(0, $rawOffsetMonths) - 0.000001);
            $candidate = $startMonth->copy()->addMonthsNoOverflow($offsetMonths)->startOfMonth();

            if ($candidate->lt($start)) {
                $candidate = $start->copy();
            }
            if ($candidate->gt($end)) {
                $candidate = $end->copy();
            }

            $dates[] = $candidate->toDateString();
        }

        return $dates;
    }

    /**
     * @return array<int, float>
     */
    private function buildAllocatedExpectedAmounts(float $totalAmount, int $cycleCount): array
    {
        $safeTotal = round(max(0, $totalAmount), 2);
        $safeCount = max(1, $cycleCount);

        if ($safeCount === 1) {
            return [$safeTotal];
        }

        $amounts = [];
        $baseAmount = round($safeTotal / $safeCount, 2);

        for ($index = 1; $index <= $safeCount; $index++) {
            if ($index === $safeCount) {
                $amounts[] = max(0, round($safeTotal - ($baseAmount * max(0, $safeCount - 1)), 2));
                continue;
            }

            $amounts[] = $baseAmount;
        }

        if ($amounts === []) {
            return [$safeTotal];
        }

        $sum = round(array_sum($amounts), 2);
        $diff = round($safeTotal - $sum, 2);
        if (abs($diff) >= 0.01) {
            $lastIndex = count($amounts) - 1;
            $amounts[$lastIndex] = max(0, round(((float) $amounts[$lastIndex]) + $diff, 2));
        }

        return array_map(
            static fn (float $value): float => round(max(0, $value), 2),
            array_map(static fn ($value): float => (float) $value, $amounts)
        );
    }

    /**
     * @return array<int, string>
     */
    private function buildExpectedPaymentDatesForCycle(string $cycle, string $startDate, ?string $endDate): array
    {
        try {
            $start = Carbon::parse($startDate)->startOfDay();
        } catch (\Throwable) {
            return [$startDate];
        }

        $intervalMonths = match (strtoupper($cycle)) {
            'MONTHLY' => 1,
            'QUARTERLY' => 3,
            'HALF_YEARLY' => 6,
            'YEARLY' => 12,
            default => null,
        };

        if ($intervalMonths === null) {
            return [$start->toDateString()];
        }

        $end = null;
        if ($endDate !== null && trim($endDate) !== '') {
            try {
                $end = Carbon::parse($endDate)->endOfDay();
            } catch (\Throwable) {
                $end = null;
            }
        }

        if (! $end instanceof Carbon || $end->lt($start)) {
            return [$start->toDateString()];
        }

        $dates = [];
        $safetyCounter = 0;

        while ($safetyCounter < 1200) {
            $currentDate = $start->copy()->addMonthsNoOverflow($intervalMonths * $safetyCounter);
            if ($currentDate->gt($end)) {
                break;
            }

            $dates[] = $currentDate->toDateString();
            $safetyCounter++;
        }

        return $dates !== [] ? $dates : [$start->toDateString()];
    }

    private function buildPaymentMilestoneName(string $cycle, int $cycleNumber, ?string $investmentMode = null): string
    {
        $normalizedInvestmentMode = strtoupper(trim((string) ($investmentMode ?? '')));
        $prefix = in_array($normalizedInvestmentMode, ['THUE_DICH_VU_DACTHU', 'THUE_DICH_VU_COSAN'], true)
            ? 'Phí dịch vụ kỳ'
            : 'Thanh toán kỳ';

        return match (strtoupper($cycle)) {
            'ONCE' => 'Thanh toán một lần',
            'MONTHLY' => sprintf('%s %d (tháng)', $prefix, $cycleNumber),
            'QUARTERLY' => sprintf('%s %d (quý)', $prefix, $cycleNumber),
            'HALF_YEARLY' => sprintf('%s %d (6 tháng)', $prefix, $cycleNumber),
            'YEARLY' => sprintf('%s %d (năm)', $prefix, $cycleNumber),
            default => sprintf('%s %d', $prefix, $cycleNumber),
        };
    }

    private function resolveContractStartDateForTerm(?string $effectiveDate, ?string $signDate): ?string
    {
        $normalizedEffectiveDate = $this->normalizeDateFilter($effectiveDate);
        if ($normalizedEffectiveDate !== null) {
            return $normalizedEffectiveDate;
        }

        $normalizedSignDate = $this->normalizeDateFilter($signDate);
        if ($normalizedSignDate !== null) {
            return $normalizedSignDate;
        }

        return Carbon::now()->subDay()->toDateString();
    }

    private function resolveContractExpiryDateFromTerm(
        ?string $termUnit,
        ?float $termValue,
        ?string $effectiveDate,
        ?string $signDate
    ): ?string {
        $normalizedTermUnit = strtoupper(trim((string) ($termUnit ?? '')));
        if (! in_array($normalizedTermUnit, self::CONTRACT_TERM_UNITS, true)) {
            return null;
        }

        if ($termValue === null || ! is_finite($termValue) || $termValue <= 0) {
            return null;
        }

        $startDate = $this->resolveContractStartDateForTerm($effectiveDate, $signDate);
        if ($startDate === null) {
            return null;
        }

        try {
            $start = Carbon::createFromFormat('Y-m-d', $startDate)->startOfDay();
        } catch (\Throwable) {
            return null;
        }

        if ($normalizedTermUnit === 'DAY') {
            if (floor($termValue) !== $termValue) {
                return null;
            }

            return $start->copy()->addDays((int) $termValue - 1)->toDateString();
        }

        $months = (int) floor($termValue);
        $days = (int) round(($termValue - $months) * 30);
        if ($months === 0 && $days === 0) {
            $days = 1;
        }

        return $start
            ->copy()
            ->addMonthsNoOverflow($months)
            ->addDays($days - 1)
            ->toDateString();
    }

    private function parseNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_float($value) || is_int($value)) {
            return (float) $value;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function normalizeDateFilter(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }

        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', $raw);
        $errors = \DateTimeImmutable::getLastErrors();
        if (
            $parsed === false
            || ($errors !== false && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0))
        ) {
            return null;
        }

        return $parsed->format('Y-m-d');
    }

    private function normalizePaymentCycle(string $cycle): string
    {
        $normalized = strtoupper(trim($cycle));

        return in_array($normalized, self::PAYMENT_CYCLES, true) ? $normalized : 'ONCE';
    }

    private function isColumnNullable(string $table, string $column): bool
    {
        if (! $this->support->hasColumn($table, $column)) {
            return false;
        }

        try {
            $driver = DB::getDriverName();

            if ($driver === 'sqlite') {
                $tableName = str_replace("'", "''", $table);
                $rows = DB::select("PRAGMA table_info('{$tableName}')");

                foreach ($rows as $row) {
                    $rowData = (array) $row;
                    if ((string) ($rowData['name'] ?? '') !== $column) {
                        continue;
                    }

                    return ((int) ($rowData['notnull'] ?? 1)) === 0;
                }

                return false;
            }

            $databaseName = DB::getDatabaseName();
            $columnInfo = DB::table('information_schema.COLUMNS')
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
