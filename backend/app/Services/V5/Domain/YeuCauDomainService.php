<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\YeuCau;
use App\Models\YeuCauLichSuTrangThai;
use App\Models\YeuCauNguoiLienQuan;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class YeuCauDomainService
{
    /**
     * @var array<string, array<int, string>>
     */
    private array $tableColumns = [];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess
    ) {}

    public function processCatalog(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $counts = DB::table('yeu_cau')
            ->select(['tien_trinh_hien_tai', DB::raw('COUNT(*) as aggregate')])
            ->whereNull('deleted_at')
            ->groupBy('tien_trinh_hien_tai')
            ->pluck('aggregate', 'tien_trinh_hien_tai');

        $groups = array_map(function (array $group) use ($counts): array {
            return [
                ...$group,
                'processes' => array_map(function (array $definition) use ($counts): array {
                    return [
                        ...$definition,
                        'active_count' => (int) ($counts[$definition['process_code']] ?? 0),
                    ];
                }, $group['processes']),
            ];
        }, YeuCauProcessRegistry::groups());

        return response()->json([
            'data' => [
                'master_fields' => YeuCauProcessRegistry::masterFields(),
                'groups' => $groups,
            ],
        ]);
    }

    public function processDefinition(string $processCode): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $definition = YeuCauProcessRegistry::find($processCode);
        if ($definition === null) {
            return response()->json(['message' => 'Tiến trình không tồn tại.'], 404);
        }

        $activeCount = DB::table('yeu_cau')
            ->whereNull('deleted_at')
            ->where('tien_trinh_hien_tai', $processCode)
            ->count();

        return response()->json([
            'data' => [
                ...$definition,
                'active_count' => $activeCount,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $processCode = $this->normalizeNullableString($request->query('process_code'));
        $keyword = $this->normalizeNullableString($request->query('q'));
        [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 100);
        $userId = $this->resolveUserIdFromRequest($request);

        $query = $this->baseYeuCauQuery($userId)
            ->when($processCode !== null, fn ($builder) => $builder->where('yc.tien_trinh_hien_tai', $processCode))
            ->when($keyword !== null, function ($builder) use ($keyword): void {
                $builder->where(function ($subQuery) use ($keyword): void {
                    $subQuery
                        ->where('yc.ma_yc', 'like', "%{$keyword}%")
                        ->orWhere('yc.tieu_de', 'like', "%{$keyword}%")
                        ->orWhere('c.customer_name', 'like', "%{$keyword}%");
                });
            });

        $total = (clone $query)->count();
        $rows = $query
            ->orderByDesc('yc.updated_at')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn (object $row): array => $this->serializeYeuCauRow($row))
            ->values()
            ->all();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $record = $this->findAccessibleYeuCau($id, $this->resolveUserIdFromRequest($request));
        if ($record === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return response()->json([
            'data' => $record,
        ]);
    }

    public function timeline(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $yeuCau = $this->findAccessibleYeuCauModel($id, $this->resolveUserIdFromRequest($request));
        if ($yeuCau === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $rows = DB::table('yc_lich_su_trang_thai as ls')
            ->leftJoin('internal_users as actor', 'actor.id', '=', 'ls.nguoi_thay_doi_id')
            ->select([
                'ls.id',
                'ls.yeu_cau_id',
                'ls.tien_trinh',
                'ls.tien_trinh_id',
                'ls.trang_thai_cu',
                'ls.trang_thai_moi',
                'ls.nguoi_thay_doi_id',
                'ls.ly_do',
                'ls.thoi_gian_o_trang_thai_cu_gio',
                'ls.thay_doi_luc',
                'actor.full_name as nguoi_thay_doi_name',
                'actor.user_code as nguoi_thay_doi_code',
            ])
            ->where('ls.yeu_cau_id', $yeuCau->id)
            ->orderByDesc('ls.thay_doi_luc')
            ->orderByDesc('ls.id')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'yeu_cau_id' => (int) $row->yeu_cau_id,
                'tien_trinh' => (string) $row->tien_trinh,
                'tien_trinh_id' => $this->support->parseNullableInt($row->tien_trinh_id),
                'trang_thai_cu' => $this->normalizeNullableString($row->trang_thai_cu),
                'trang_thai_moi' => $this->normalizeNullableString($row->trang_thai_moi),
                'nguoi_thay_doi_id' => $this->support->parseNullableInt($row->nguoi_thay_doi_id),
                'nguoi_thay_doi_name' => $this->normalizeNullableString($row->nguoi_thay_doi_name),
                'nguoi_thay_doi_code' => $this->normalizeNullableString($row->nguoi_thay_doi_code),
                'ly_do' => $this->normalizeNullableString($row->ly_do),
                'thoi_gian_o_trang_thai_cu_gio' => $row->thoi_gian_o_trang_thai_cu_gio !== null ? (float) $row->thoi_gian_o_trang_thai_cu_gio : null,
                'thay_doi_luc' => $this->normalizeNullableString($row->thay_doi_luc),
            ])
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function people(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $yeuCau = $this->findAccessibleYeuCauModel($id, $this->resolveUserIdFromRequest($request));
        if ($yeuCau === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $rows = DB::table('yc_nguoi_lien_quan as ylq')
            ->leftJoin('internal_users as u', 'u.id', '=', 'ylq.user_id')
            ->leftJoin('internal_users as grantor', 'grantor.id', '=', 'ylq.cap_boi_id')
            ->select([
                'ylq.id',
                'ylq.yeu_cau_id',
                'ylq.user_id',
                'ylq.vai_tro',
                'ylq.trang_thai_bat_dau',
                'ylq.cap_quyen_luc',
                'ylq.thu_hoi_luc',
                'ylq.cap_boi_id',
                'u.full_name as user_name',
                'u.user_code as user_code',
                'grantor.full_name as cap_boi_name',
            ])
            ->where('ylq.yeu_cau_id', $yeuCau->id)
            ->orderByRaw("CASE ylq.vai_tro
                WHEN 'nguoi_nhap' THEN 1
                WHEN 'pm' THEN 2
                WHEN 'ba' THEN 3
                WHEN 'nguoi_thuc_hien' THEN 4
                WHEN 'nguoi_trao_doi' THEN 5
                WHEN 'dev' THEN 6
                WHEN 'nguoi_phan_cong' THEN 7
                ELSE 99
            END")
            ->orderBy('ylq.id')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'yeu_cau_id' => (int) $row->yeu_cau_id,
                'user_id' => (int) $row->user_id,
                'user_name' => $this->normalizeNullableString($row->user_name),
                'user_code' => $this->normalizeNullableString($row->user_code),
                'vai_tro' => (string) $row->vai_tro,
                'trang_thai_bat_dau' => $this->normalizeNullableString($row->trang_thai_bat_dau),
                'cap_quyen_luc' => $this->normalizeNullableString($row->cap_quyen_luc),
                'thu_hoi_luc' => $this->normalizeNullableString($row->thu_hoi_luc),
                'cap_boi_id' => $this->support->parseNullableInt($row->cap_boi_id),
                'cap_boi_name' => $this->normalizeNullableString($row->cap_boi_name),
                'is_active' => $this->normalizeNullableString($row->thu_hoi_luc) === null,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function showProcess(Request $request, int $id, string $processCode): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $processDefinition = YeuCauProcessRegistry::find($processCode);
        if ($processDefinition === null) {
            return response()->json(['message' => 'Tiến trình không tồn tại.'], 404);
        }

        $yeuCau = $this->findAccessibleYeuCauModel($id, $this->resolveUserIdFromRequest($request));
        if ($yeuCau === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $currentDefinition = YeuCauProcessRegistry::find((string) $yeuCau->tien_trinh_hien_tai);
        $row = $this->latestProcessRow($processCode, (int) $yeuCau->id);
        $requestedUserId = $this->resolveUserIdFromRequest($request);

        return response()->json([
            'data' => [
                'yeu_cau' => $this->serializeYeuCauModel($yeuCau),
                'current_process' => $currentDefinition,
                'process' => $processDefinition,
                'process_row' => $row === null ? null : $this->serializeProcessRow($processDefinition, $row),
                'allowed_next_processes' => $currentDefinition === null
                    ? []
                    : array_values(array_filter(array_map(
                        fn (string $code): ?array => YeuCauProcessRegistry::find($code),
                        $currentDefinition['allowed_next_processes'] ?? []
                    ))),
                'transition_allowed' => $this->canTransitionToProcess($yeuCau, $processCode),
                'can_write' => $this->canWriteProcess((int) $yeuCau->id, $requestedUserId, $processDefinition),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        [$masterPayload, $errorResponse] = $this->validateMasterPayload($request, true);
        if ($errorResponse !== null) {
            return $errorResponse;
        }

        $actorId = $this->resolveUserIdFromRequest($request)
            ?? $this->support->parseNullableInt($request->input('created_by'))
            ?? $this->support->parseNullableInt($request->input('nguoi_tao_id'));

        if ($actorId === null) {
            return response()->json(['message' => 'Không xác định được người tạo yêu cầu.'], 422);
        }

        if (! InternalUser::query()->whereKey($actorId)->exists()) {
            return response()->json(['message' => 'nguoi_tao_id không hợp lệ.'], 422);
        }

        $currentUser = InternalUser::query()->find($actorId);
        $donViId = $this->support->parseNullableInt($request->input('don_vi_id'))
            ?? $this->support->parseNullableInt($currentUser?->department_id);

        if ($donViId === null) {
            return response()->json(['message' => 'Không xác định được đơn vị tạo yêu cầu.'], 422);
        }

        $processDefinition = YeuCauProcessRegistry::find('tt_giao_yc_pm');
        $processPayloadInput = is_array($request->input('process_payload')) ? $request->input('process_payload') : [];
        [$processPayload, $processErrors] = $this->normalizeProcessPayload(
            $processDefinition,
            $processPayloadInput,
            null,
            $actorId,
            'tt_giao_yc_pm',
            null,
            null
        );
        if ($processErrors !== []) {
            return response()->json(['message' => 'Dữ liệu tiến trình không hợp lệ.', 'errors' => $processErrors], 422);
        }

        $yeuCau = DB::transaction(function () use ($actorId, $donViId, $masterPayload, $processDefinition, $processPayload, $request): YeuCau {
            $yeuCau = new YeuCau();
            $yeuCau->fill([
                'don_vi_id' => $donViId,
                'ma_yc' => $this->generateRequestCode($donViId),
                'nguoi_tao_id' => $actorId,
                ...$masterPayload,
                'trang_thai' => $processDefinition['default_status'],
                'tien_trinh_hien_tai' => $processDefinition['process_code'],
                'ket_qua' => 'dang_xu_ly',
            ]);
            $yeuCau->save();

            $processRowId = $this->insertProcessRow($processDefinition['table_name'], [
                ...$processPayload,
                'yeu_cau_id' => $yeuCau->id,
                'don_vi_id' => $donViId,
            ]);

            $this->syncYeuCauAfterProcessSave($yeuCau, $processDefinition, $processPayload, $processRowId);
            $this->grantCreatorAndAssignments($yeuCau, $processDefinition, $processPayload, $actorId);
            $this->appendTimeline((int) $yeuCau->id, $donViId, null, $processDefinition['default_status'], $processDefinition['process_code'], $processRowId, $actorId, $this->normalizeNullableString($request->input('ly_do')));

            return $yeuCau;
        });

        return response()->json([
            'data' => $this->findAccessibleYeuCau((int) $yeuCau->id, $actorId),
        ], 201);
    }

    public function saveProcess(Request $request, int $id, string $processCode): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $processDefinition = YeuCauProcessRegistry::find($processCode);
        if ($processDefinition === null) {
            return response()->json(['message' => 'Tiến trình không tồn tại.'], 404);
        }

        $actorId = $this->resolveUserIdFromRequest($request)
            ?? $this->support->parseNullableInt($request->input('updated_by'))
            ?? $this->support->parseNullableInt($request->input('created_by'));
        $yeuCau = YeuCau::query()->find($id);
        if ($yeuCau === null || ! $this->canReadYeuCau($yeuCau, $actorId)) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if (! $this->canWriteProcess((int) $yeuCau->id, $actorId, $processDefinition)) {
            return response()->json(['message' => 'Bạn không có quyền thao tác tiến trình này.'], 403);
        }

        if (! $this->canTransitionToProcess($yeuCau, $processCode)) {
            return response()->json(['message' => 'Tiến trình đích không hợp lệ từ trạng thái hiện tại.'], 422);
        }

        $currentProcessCode = $this->normalizeNullableString($yeuCau->tien_trinh_hien_tai);
        $currentProcessId = $this->support->parseNullableInt($yeuCau->tt_id_hien_tai);
        $processPayloadInput = is_array($request->input('process_payload')) ? $request->input('process_payload') : [];
        [$processPayload, $processErrors] = $this->normalizeProcessPayload(
            $processDefinition,
            $processPayloadInput,
            $yeuCau,
            $actorId,
            $currentProcessCode,
            $currentProcessId,
            $processCode === $currentProcessCode ? $this->latestProcessRow($processCode, (int) $yeuCau->id) : null
        );
        if ($processErrors !== []) {
            return response()->json(['message' => 'Dữ liệu tiến trình không hợp lệ.', 'errors' => $processErrors], 422);
        }

        [$masterPatch, $masterPatchError] = $this->validateMasterPayload($request, false);
        if ($masterPatchError !== null) {
            return $masterPatchError;
        }

        DB::transaction(function () use ($yeuCau, $processDefinition, $processPayload, $masterPatch, $actorId, $request, $currentProcessCode): void {
            $oldStatus = $yeuCau->trang_thai;
            $resolvedActorId = $actorId ?? (int) $yeuCau->nguoi_tao_id;
            $processRowId = $this->upsertProcessRow(
                $processDefinition['table_name'],
                (int) $yeuCau->id,
                [
                    ...$processPayload,
                    'yeu_cau_id' => (int) $yeuCau->id,
                    'don_vi_id' => (int) $yeuCau->don_vi_id,
                ],
                $processDefinition['process_code'] === $yeuCau->tien_trinh_hien_tai
            );

            if ($masterPatch !== []) {
                $yeuCau->fill($masterPatch);
            }

            $this->syncYeuCauAfterProcessSave($yeuCau, $processDefinition, $processPayload, $processRowId);
            $this->grantCreatorAndAssignments($yeuCau, $processDefinition, $processPayload, $resolvedActorId);
            $this->appendTimeline(
                (int) $yeuCau->id,
                (int) $yeuCau->don_vi_id,
                $oldStatus,
                $yeuCau->trang_thai,
                $processDefinition['process_code'],
                $processRowId,
                $resolvedActorId,
                $this->normalizeNullableString($request->input('ly_do')) ?? ($currentProcessCode !== $processDefinition['process_code'] ? "Chuyển sang {$processDefinition['process_label']}" : null)
            );
        });

        return response()->json([
            'data' => $this->findAccessibleYeuCau((int) $yeuCau->id, $actorId),
        ]);
    }

    /**
     * @return array{0:array<string, mixed>,1:?JsonResponse}
     */
    private function validateMasterPayload(Request $request, bool $requireMandatoryFields): array
    {
        $payload = [];
        $khachHangId = $this->support->parseNullableInt($request->input('khach_hang_id'));
        $tieuDe = $this->normalizeNullableString($request->input('tieu_de'));
        $moTa = $this->normalizeNullableString($request->input('mo_ta'));
        $doUuTien = $this->support->parseNullableInt($request->input('do_uu_tien'));
        $loaiYc = $this->normalizeNullableString($request->input('loai_yc'));
        $kenhTiepNhan = $this->normalizeNullableString($request->input('kenh_tiep_nhan'));

        if ($requireMandatoryFields || $request->has('khach_hang_id')) {
            if ($khachHangId === null) {
                return [[], response()->json(['message' => 'khach_hang_id là bắt buộc.'], 422)];
            }
            if ($this->support->hasTable('customers') && ! Customer::query()->whereKey($khachHangId)->exists()) {
                return [[], response()->json(['message' => 'khach_hang_id không hợp lệ.'], 422)];
            }
            $payload['khach_hang_id'] = $khachHangId;
        }

        if ($requireMandatoryFields || $request->has('tieu_de')) {
            if ($tieuDe === null) {
                return [[], response()->json(['message' => 'tieu_de là bắt buộc.'], 422)];
            }
            $payload['tieu_de'] = $tieuDe;
        }

        if ($request->has('mo_ta') || $requireMandatoryFields) {
            $payload['mo_ta'] = $moTa;
        }

        if ($requireMandatoryFields || $request->has('do_uu_tien')) {
            $resolvedPriority = $doUuTien ?? 2;
            if (! in_array($resolvedPriority, [1, 2, 3, 4], true)) {
                return [[], response()->json(['message' => 'do_uu_tien không hợp lệ.'], 422)];
            }
            $payload['do_uu_tien'] = $resolvedPriority;
        }

        if ($request->has('loai_yc')) {
            $payload['loai_yc'] = $loaiYc;
        }

        if ($request->has('kenh_tiep_nhan')) {
            $payload['kenh_tiep_nhan'] = $kenhTiepNhan;
        }

        return [$payload, null];
    }

    /**
     * @param array<string, mixed> $payload
     * @param object|null $existingRow
     * @return array{0:array<string,mixed>,1:array<string, array<int, string>>}
     */
    private function normalizeProcessPayload(
        array $processDefinition,
        array $payload,
        ?YeuCau $yeuCau,
        ?int $actorId,
        ?string $currentProcessCode,
        ?int $currentProcessId,
        ?object $existingRow
    ): array {
        $normalized = [];
        $errors = [];

        foreach ($processDefinition['form_fields'] as $field) {
            $fieldName = (string) $field['name'];
            $normalized[$fieldName] = $this->normalizeFieldValue($field, $payload[$fieldName] ?? ($existingRow->{$fieldName} ?? null));
        }

        $this->applyProcessDefaults(
            $processDefinition['process_code'],
            $normalized,
            $yeuCau,
            $actorId,
            $currentProcessCode,
            $currentProcessId
        );

        foreach ($processDefinition['form_fields'] as $field) {
            $fieldName = (string) $field['name'];
            $required = (bool) ($field['required'] ?? false);
            $value = $normalized[$fieldName] ?? null;
            if ($required && ($value === null || $value === '')) {
                $errors[$fieldName][] = "{$field['label']} là bắt buộc.";
            }

            if (($field['type'] ?? '') === 'json_textarea' && is_string($value) && trim($value) !== '') {
                json_decode($value, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $errors[$fieldName][] = "{$field['label']} phải là JSON hợp lệ.";
                }
            }

            if (($field['type'] ?? '') === 'enum' && $value !== null) {
                $options = is_array($field['options'] ?? null) ? $field['options'] : [];
                if (! in_array((string) $value, $options, true)) {
                    $errors[$fieldName][] = "{$field['label']} không hợp lệ.";
                }
            }

            if (($field['type'] ?? '') === 'priority' && $value !== null && ! in_array((int) $value, [1, 2, 3, 4], true)) {
                $errors[$fieldName][] = "{$field['label']} không hợp lệ.";
            }
        }

        return [$normalized, $errors];
    }

    /**
     * @param array<string, mixed> $normalized
     */
    private function applyProcessDefaults(
        string $processCode,
        array &$normalized,
        ?YeuCau $yeuCau,
        ?int $actorId,
        ?string $currentProcessCode,
        ?int $currentProcessId
    ): void {
        $masterActorFallbacks = [
            'pm_id' => $yeuCau?->pm_id,
            'ba_id' => $yeuCau?->ba_id,
            'r_id' => $yeuCau?->r_id,
            'dev_id' => $yeuCau?->dev_id,
            'nguoi_trao_doi_id' => $yeuCau?->nguoi_trao_doi_id,
        ];

        foreach ($masterActorFallbacks as $column => $fallbackValue) {
            if (array_key_exists($column, $normalized) && ($normalized[$column] === null || $normalized[$column] === '')) {
                $normalized[$column] = $this->support->parseNullableInt($fallbackValue);
            }
        }

        switch ($processCode) {
            case 'tt_giao_yc_pm':
                $normalized['nguoi_giao_id'] = $this->support->parseNullableInt($normalized['nguoi_giao_id'] ?? null)
                    ?? $actorId
                    ?? $this->support->parseNullableInt($yeuCau?->nguoi_tao_id);
                break;
            case 'tt_cho_kh_cung_cap':
                $normalized['nguoi_tao_id'] = $this->support->parseNullableInt($normalized['nguoi_tao_id'] ?? null)
                    ?? $actorId
                    ?? $this->support->parseNullableInt($yeuCau?->nguoi_tao_id);
                $normalized['tt_tra_yc_id'] = $this->support->parseNullableInt($normalized['tt_tra_yc_id'] ?? null)
                    ?? $this->latestProcessRowId('tt_tra_yc_pm', (int) ($yeuCau?->id ?? 0));
                break;
            case 'tt_chuyen_dms':
                $normalized['nguoi_chuyen_id'] = $this->support->parseNullableInt($normalized['nguoi_chuyen_id'] ?? null)
                    ?? $actorId;
                break;
            case 'tt_trao_doi_dms':
                $normalized['nguoi_trao_doi_id'] = $this->support->parseNullableInt($normalized['nguoi_trao_doi_id'] ?? null)
                    ?? $actorId
                    ?? $this->support->parseNullableInt($yeuCau?->nguoi_trao_doi_id);
                $normalized['tt_chuyen_dms_id'] = $this->support->parseNullableInt($normalized['tt_chuyen_dms_id'] ?? null)
                    ?? $this->latestProcessRowId('tt_chuyen_dms', (int) ($yeuCau?->id ?? 0));
                break;
            case 'tt_tao_task':
                $normalized['nguoi_tao_id'] = $this->support->parseNullableInt($normalized['nguoi_tao_id'] ?? null)
                    ?? $actorId;
                break;
            case 'tt_dms_nhan_task':
            case 'tt_dms_dang_thuc_hien':
            case 'tt_hoan_thanh_dms':
                $normalized['tt_tao_task_id'] = $this->support->parseNullableInt($normalized['tt_tao_task_id'] ?? null)
                    ?? $this->latestProcessRowId('tt_tao_task', (int) ($yeuCau?->id ?? 0));
                break;
            case 'tt_tam_ngung':
                $normalized['nguoi_tao_id'] = $this->support->parseNullableInt($normalized['nguoi_tao_id'] ?? null)
                    ?? $actorId;
                $normalized['tu_tien_trinh'] = $this->normalizeNullableString($normalized['tu_tien_trinh'] ?? null)
                    ?? $currentProcessCode;
                $normalized['tu_tt_id'] = $this->support->parseNullableInt($normalized['tu_tt_id'] ?? null)
                    ?? $currentProcessId;
                $normalized['ngay_tam_ngung'] = $this->normalizeNullableString($normalized['ngay_tam_ngung'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'tt_lap_trinh':
                $normalized['pm_id'] = $this->support->parseNullableInt($normalized['pm_id'] ?? null)
                    ?? $this->support->parseNullableInt($yeuCau?->pm_id);
                $normalized['ba_id'] = $this->support->parseNullableInt($normalized['ba_id'] ?? null)
                    ?? $this->support->parseNullableInt($yeuCau?->ba_id);
                break;
            case 'tt_dang_lap_trinh':
            case 'tt_hoan_thanh_lap_trinh':
                $normalized['tt_lap_trinh_id'] = $this->support->parseNullableInt($normalized['tt_lap_trinh_id'] ?? null)
                    ?? $this->latestProcessRowId('tt_lap_trinh', (int) ($yeuCau?->id ?? 0));
                break;
            case 'tt_khong_tiep_nhan':
                $normalized['nguoi_xac_nhan_id'] = $this->support->parseNullableInt($normalized['nguoi_xac_nhan_id'] ?? null)
                    ?? $actorId;
                $normalized['tu_tien_trinh'] = $this->normalizeNullableString($normalized['tu_tien_trinh'] ?? null)
                    ?? $currentProcessCode;
                break;
            case 'tt_thong_bao_kh':
                $normalized['nguoi_gui_id'] = $this->support->parseNullableInt($normalized['nguoi_gui_id'] ?? null)
                    ?? $actorId;
                break;
            case 'tt_ket_thuc':
                $normalized['nguoi_dong_id'] = $this->support->parseNullableInt($normalized['nguoi_dong_id'] ?? null)
                    ?? $actorId;
                $normalized['tu_tien_trinh'] = $this->normalizeNullableString($normalized['tu_tien_trinh'] ?? null)
                    ?? $currentProcessCode;
                break;
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function syncYeuCauAfterProcessSave(YeuCau $yeuCau, array $processDefinition, array $payload, int $processRowId): void
    {
        $syncColumns = [];
        foreach ($processDefinition['sync_master_columns'] ?? [] as $source => $target) {
            if (! Schema::hasColumn('yeu_cau', $target)) {
                continue;
            }
            if (array_key_exists($source, $payload)) {
                $syncColumns[$target] = $payload[$source];
            }
        }

        $ketQua = 'dang_xu_ly';
        $hoanThanhLuc = null;
        $tongGio = $yeuCau->tong_gio_xu_ly;

        if ($processDefinition['process_code'] === 'tt_khong_tiep_nhan') {
            $ketQua = 'khong_tiep_nhan';
        } elseif ($processDefinition['process_code'] === 'tt_ket_thuc') {
            $ketQuaCuoi = $this->normalizeNullableString($payload['ket_qua_cuoi'] ?? null);
            $ketQua = match ($ketQuaCuoi) {
                'hoan_thanh' => 'hoan_thanh',
                'khong_tiep_nhan' => 'khong_tiep_nhan',
                default => 'ket_thuc',
            };
            $hoanThanhLuc = now()->format('Y-m-d H:i:s');
            $tongGio = $payload['tong_gio'] ?? $tongGio;
        }

        $yeuCau->fill([
            ...$syncColumns,
            'trang_thai' => $processDefinition['default_status'],
            'tien_trinh_hien_tai' => $processDefinition['process_code'],
            'tt_id_hien_tai' => $processRowId,
            'ket_qua' => $ketQua,
            'hoan_thanh_luc' => $hoanThanhLuc,
            'tong_gio_xu_ly' => $tongGio,
        ]);
        $yeuCau->save();
    }

    /**
     * @param array<string, mixed> $processPayload
     */
    private function grantCreatorAndAssignments(YeuCau $yeuCau, array $processDefinition, array $processPayload, int $actorId): void
    {
        $this->upsertRelatedUser((int) $yeuCau->id, (int) $yeuCau->don_vi_id, (int) $yeuCau->nguoi_tao_id, 'nguoi_nhap', $yeuCau->trang_thai, $actorId);

        foreach ($processDefinition['role_assignments'] ?? [] as $assignment) {
            $field = (string) ($assignment['field'] ?? '');
            $role = (string) ($assignment['role'] ?? '');
            if ($field === '' || $role === '') {
                continue;
            }
            $userId = $this->support->parseNullableInt($processPayload[$field] ?? null);
            if ($userId === null) {
                continue;
            }
            $this->upsertRelatedUser((int) $yeuCau->id, (int) $yeuCau->don_vi_id, $userId, $role, $yeuCau->trang_thai, $actorId);
        }
    }

    private function appendTimeline(
        int $yeuCauId,
        int $donViId,
        ?string $oldStatus,
        string $newStatus,
        string $processCode,
        int $processRowId,
        int $actorId,
        ?string $reason
    ): void {
        YeuCauLichSuTrangThai::query()->create([
            'yeu_cau_id' => $yeuCauId,
            'don_vi_id' => $donViId,
            'tien_trinh' => $processCode,
            'tien_trinh_id' => $processRowId,
            'trang_thai_cu' => $oldStatus,
            'trang_thai_moi' => $newStatus,
            'nguoi_thay_doi_id' => $actorId,
            'ly_do' => $reason,
            'thay_doi_luc' => now(),
        ]);
    }

    private function upsertRelatedUser(
        int $yeuCauId,
        int $donViId,
        int $userId,
        string $role,
        ?string $statusFrom,
        int $grantById
    ): void {
        YeuCauNguoiLienQuan::query()->updateOrCreate(
            [
                'yeu_cau_id' => $yeuCauId,
                'user_id' => $userId,
                'vai_tro' => $role,
            ],
            [
                'don_vi_id' => $donViId,
                'trang_thai_bat_dau' => $statusFrom,
                'cap_quyen_luc' => now(),
                'thu_hoi_luc' => null,
                'cap_boi_id' => $grantById,
            ]
        );
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function insertProcessRow(string $table, array $payload): int
    {
        return (int) DB::table($table)->insertGetId([
            ...$this->filterByTableColumns($table, $payload),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function upsertProcessRow(string $table, int $yeuCauId, array $payload, bool $updateExisting): int
    {
        $filtered = $this->filterByTableColumns($table, $payload);
        if ($updateExisting) {
            $existing = DB::table($table)
                ->where('yeu_cau_id', $yeuCauId)
                ->orderByDesc('id')
                ->first();
            if ($existing !== null) {
                DB::table($table)
                    ->where('id', $existing->id)
                    ->update([
                        ...$filtered,
                        'updated_at' => now(),
                    ]);

                return (int) $existing->id;
            }
        }

        return $this->insertProcessRow($table, $filtered);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function filterByTableColumns(string $table, array $payload): array
    {
        $allowedColumns = array_flip($this->tableColumns($table));
        $filtered = [];
        foreach ($payload as $key => $value) {
            if (! isset($allowedColumns[$key])) {
                continue;
            }
            $filtered[$key] = $value;
        }

        return $filtered;
    }

    /**
     * @return array<int, string>
     */
    private function tableColumns(string $table): array
    {
        if (! isset($this->tableColumns[$table])) {
            $this->tableColumns[$table] = Schema::hasTable($table)
                ? Schema::getColumnListing($table)
                : [];
        }

        return $this->tableColumns[$table];
    }

    private function generateRequestCode(int $donViId): string
    {
        $monthToken = now()->format('Ym');
        $prefix = "YC-{$donViId}-{$monthToken}-";

        $latestCode = YeuCau::query()
            ->where('don_vi_id', $donViId)
            ->where('ma_yc', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->value('ma_yc');

        $sequence = 1;
        if (is_string($latestCode) && preg_match('/(\d+)$/', $latestCode, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return sprintf('%s%04d', $prefix, $sequence);
    }

    private function baseYeuCauQuery(?int $userId)
    {
        return DB::table('yeu_cau as yc')
            ->leftJoin('customers as c', 'c.id', '=', 'yc.khach_hang_id')
            ->leftJoin('internal_users as creator', 'creator.id', '=', 'yc.nguoi_tao_id')
            ->leftJoin('internal_users as pm', 'pm.id', '=', 'yc.pm_id')
            ->leftJoin('internal_users as ba', 'ba.id', '=', 'yc.ba_id')
            ->leftJoin('internal_users as r', 'r.id', '=', 'yc.r_id')
            ->leftJoin('internal_users as dev', 'dev.id', '=', 'yc.dev_id')
            ->leftJoin('internal_users as exchanger', 'exchanger.id', '=', 'yc.nguoi_trao_doi_id')
            ->select([
                'yc.*',
                'c.customer_name as khach_hang_name',
                'creator.full_name as nguoi_tao_name',
                'pm.full_name as pm_name',
                'ba.full_name as ba_name',
                'r.full_name as r_name',
                'dev.full_name as dev_name',
                'exchanger.full_name as nguoi_trao_doi_name',
            ])
            ->whereNull('yc.deleted_at')
            ->when($userId !== null && ! $this->userAccess->isAdmin($userId), function ($builder) use ($userId): void {
                $builder->where(function ($subQuery) use ($userId): void {
                    $subQuery
                        ->where('yc.nguoi_tao_id', $userId)
                        ->orWhereExists(function ($relatedQuery) use ($userId): void {
                            $relatedQuery
                                ->select(DB::raw(1))
                                ->from('yc_nguoi_lien_quan as ylq')
                                ->whereColumn('ylq.yeu_cau_id', 'yc.id')
                                ->where('ylq.user_id', $userId)
                                ->whereNull('ylq.thu_hoi_luc');
                        });
                });
            });
    }

    private function findAccessibleYeuCau(int $id, ?int $userId): ?array
    {
        $row = $this->baseYeuCauQuery($userId)
            ->where('yc.id', $id)
            ->first();

        return $row === null ? null : $this->serializeYeuCauRow($row);
    }

    private function findAccessibleYeuCauModel(int $id, ?int $userId): ?YeuCau
    {
        $query = YeuCau::query()->whereKey($id);
        if ($userId !== null && ! $this->userAccess->isAdmin($userId)) {
            $query->where(function ($subQuery) use ($userId): void {
                $subQuery
                    ->where('nguoi_tao_id', $userId)
                    ->orWhereExists(function ($relatedQuery) use ($userId): void {
                        $relatedQuery
                            ->select(DB::raw(1))
                            ->from('yc_nguoi_lien_quan as ylq')
                            ->whereColumn('ylq.yeu_cau_id', 'yeu_cau.id')
                            ->where('ylq.user_id', $userId)
                            ->whereNull('ylq.thu_hoi_luc');
                    });
            });
        }

        return $query->first();
    }

    private function canReadYeuCau(YeuCau $yeuCau, ?int $userId): bool
    {
        if ($userId === null) {
            return true;
        }

        if ($this->userAccess->isAdmin($userId)) {
            return true;
        }

        if ((int) $yeuCau->nguoi_tao_id === $userId) {
            return true;
        }

        return DB::table('yc_nguoi_lien_quan')
            ->where('yeu_cau_id', $yeuCau->id)
            ->where('user_id', $userId)
            ->whereNull('thu_hoi_luc')
            ->exists();
    }

    private function canWriteProcess(int $yeuCauId, ?int $userId, array $processDefinition): bool
    {
        if ($userId === null) {
            return true;
        }

        if ($this->userAccess->isAdmin($userId)) {
            return true;
        }

        $roles = DB::table('yc_nguoi_lien_quan')
            ->where('yeu_cau_id', $yeuCauId)
            ->where('user_id', $userId)
            ->whereNull('thu_hoi_luc')
            ->pluck('vai_tro')
            ->map(fn ($value): string => (string) $value)
            ->all();

        if ($roles === []) {
            $yeuCau = YeuCau::query()->find($yeuCauId);
            if ($yeuCau !== null && (int) $yeuCau->nguoi_tao_id === $userId) {
                $roles[] = 'nguoi_nhap';
            }
        }

        return array_intersect($roles, $processDefinition['write_roles'] ?? []) !== [];
    }

    private function canTransitionToProcess(YeuCau $yeuCau, string $targetProcessCode): bool
    {
        $currentProcessCode = $this->normalizeNullableString($yeuCau->tien_trinh_hien_tai);
        if ($currentProcessCode === null || $currentProcessCode === $targetProcessCode) {
            return true;
        }

        $currentDefinition = YeuCauProcessRegistry::find($currentProcessCode);
        if ($currentDefinition === null) {
            return false;
        }

        return in_array($targetProcessCode, $currentDefinition['allowed_next_processes'] ?? [], true);
    }

    private function latestProcessRow(string $processCode, int $yeuCauId): ?object
    {
        $definition = YeuCauProcessRegistry::find($processCode);
        if ($definition === null) {
            return null;
        }

        return DB::table($definition['table_name'])
            ->where('yeu_cau_id', $yeuCauId)
            ->orderByDesc('id')
            ->first();
    }

    private function latestProcessRowId(string $processCode, int $yeuCauId): ?int
    {
        if ($yeuCauId <= 0) {
            return null;
        }

        $row = $this->latestProcessRow($processCode, $yeuCauId);
        return $row !== null ? (int) $row->id : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeYeuCauModel(YeuCau $yeuCau): array
    {
        return $this->findAccessibleYeuCau((int) $yeuCau->id, null) ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeYeuCauRow(object $row): array
    {
        $processMeta = $this->normalizeNullableString($row->tien_trinh_hien_tai) !== null
            ? YeuCauProcessRegistry::find((string) $row->tien_trinh_hien_tai)
            : null;

        return [
            'id' => (int) $row->id,
            'don_vi_id' => (int) $row->don_vi_id,
            'ma_yc' => (string) $row->ma_yc,
            'nguoi_tao_id' => (int) $row->nguoi_tao_id,
            'nguoi_tao_name' => $this->normalizeNullableString($row->nguoi_tao_name),
            'khach_hang_id' => (int) $row->khach_hang_id,
            'khach_hang_name' => $this->normalizeNullableString($row->khach_hang_name),
            'tieu_de' => (string) $row->tieu_de,
            'mo_ta' => $this->normalizeNullableString($row->mo_ta),
            'do_uu_tien' => (int) $row->do_uu_tien,
            'loai_yc' => $this->normalizeNullableString($row->loai_yc),
            'kenh_tiep_nhan' => $this->normalizeNullableString($row->kenh_tiep_nhan),
            'pm_id' => $this->support->parseNullableInt($row->pm_id),
            'pm_name' => $this->normalizeNullableString($row->pm_name),
            'ba_id' => $this->support->parseNullableInt($row->ba_id),
            'ba_name' => $this->normalizeNullableString($row->ba_name),
            'r_id' => $this->support->parseNullableInt($row->r_id),
            'r_name' => $this->normalizeNullableString($row->r_name),
            'dev_id' => $this->support->parseNullableInt($row->dev_id),
            'dev_name' => $this->normalizeNullableString($row->dev_name),
            'nguoi_trao_doi_id' => $this->support->parseNullableInt($row->nguoi_trao_doi_id),
            'nguoi_trao_doi_name' => $this->normalizeNullableString($row->nguoi_trao_doi_name),
            'trang_thai' => (string) $row->trang_thai,
            'tien_trinh_hien_tai' => $this->normalizeNullableString($row->tien_trinh_hien_tai),
            'tt_id_hien_tai' => $this->support->parseNullableInt($row->tt_id_hien_tai),
            'ket_qua' => (string) $row->ket_qua,
            'hoan_thanh_luc' => $this->normalizeNullableString($row->hoan_thanh_luc),
            'tong_gio_xu_ly' => $row->tong_gio_xu_ly !== null ? (float) $row->tong_gio_xu_ly : null,
            'created_at' => $this->normalizeNullableString($row->created_at),
            'updated_at' => $this->normalizeNullableString($row->updated_at),
            'current_process_label' => $processMeta['process_label'] ?? null,
            'current_process_group_label' => $processMeta['group_label'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeProcessRow(array $definition, object $row): array
    {
        $raw = (array) $row;
        $userFieldIds = [];
        foreach ($definition['form_fields'] as $field) {
            if (($field['type'] ?? '') !== 'user_select') {
                continue;
            }
            $value = $this->support->parseNullableInt($raw[$field['name']] ?? null);
            if ($value !== null) {
                $userFieldIds[] = $value;
            }
        }

        $usersById = InternalUser::query()
            ->whereIn('id', array_values(array_unique($userFieldIds)))
            ->get(['id', 'user_code', 'full_name', 'username'])
            ->keyBy('id');

        $data = [
            'id' => (int) $row->id,
            'yeu_cau_id' => (int) $row->yeu_cau_id,
            'don_vi_id' => (int) $row->don_vi_id,
            'trang_thai' => $this->normalizeNullableString($row->trang_thai),
            'ghi_chu' => $this->normalizeNullableString($row->ghi_chu ?? null),
            'created_at' => $this->normalizeNullableString($row->created_at ?? null),
            'updated_at' => $this->normalizeNullableString($row->updated_at ?? null),
        ];

        foreach ($definition['form_fields'] as $field) {
            $fieldName = (string) $field['name'];
            $value = $raw[$fieldName] ?? null;
            $data[$fieldName] = $value;
            if (($field['type'] ?? '') === 'user_select') {
                $userId = $this->support->parseNullableInt($value);
                $user = $userId !== null ? $usersById->get($userId) : null;
                $data["{$fieldName}_name"] = $user?->full_name ?? $user?->username ?? null;
                $data["{$fieldName}_code"] = $user?->user_code ?? null;
            }
        }

        return [
            'process_code' => $definition['process_code'],
            'process_label' => $definition['process_label'],
            'table_name' => $definition['table_name'],
            'data' => $data,
        ];
    }

    /**
     * @param array<string, mixed> $field
     */
    private function normalizeFieldValue(array $field, mixed $value): mixed
    {
        $type = (string) ($field['type'] ?? 'text');
        return match ($type) {
            'user_select', 'number', 'priority' => $this->support->parseNullableInt($value),
            'boolean_nullable' => $this->normalizeNullableBoolean($value),
            'json_textarea' => $this->normalizeJsonTextarea($value),
            default => $this->normalizeNullableString($value),
        };
    }

    private function normalizeNullableBoolean(mixed $value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return ((int) $value) === 1;
        }

        $normalized = strtolower(trim((string) $value));
        return match ($normalized) {
            '1', 'true', 'yes', 'co', 'có' => true,
            '0', 'false', 'no', 'khong', 'không' => false,
            default => null,
        };
    }

    private function normalizeJsonTextarea(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_array($value) || is_object($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $normalized = trim((string) $value);
        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    private function resolveUserIdFromRequest(Request $request): ?int
    {
        $user = $request->user();
        if ($user && isset($user->id)) {
            return $this->support->parseNullableInt($user->id);
        }

        return null;
    }

    private function missingTablesResponse(): ?JsonResponse
    {
        foreach (['yeu_cau', 'yc_nguoi_lien_quan', 'yc_lich_su_trang_thai'] as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
        }

        foreach (YeuCauProcessRegistry::all() as $definition) {
            if (! $this->support->hasTable($definition['table_name'])) {
                return $this->support->missingTable($definition['table_name']);
            }
        }

        return null;
    }
}
