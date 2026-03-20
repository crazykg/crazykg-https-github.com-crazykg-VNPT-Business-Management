<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerPersonnelDomainService
{
    private const EMPLOYEE_MIN_AGE_EXCLUSIVE = 20;
    private const EMPLOYEE_MAX_AGE_EXCLUSIVE = 66;

    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('customer_personnel')) {
            return $this->support->missingTable('customer_personnel');
        }

        $query = DB::table('customer_personnel');
        if ($this->support->hasColumn('customer_personnel', 'deleted_at')) {
            $query->whereNull('customer_personnel.deleted_at');
        }
        $joinSupportContactPositions =
            $this->support->hasTable('support_contact_positions')
            && $this->support->hasColumn('customer_personnel', 'position_id')
            && $this->support->hasColumn('support_contact_positions', 'id');
        if ($joinSupportContactPositions) {
            $query->leftJoin('support_contact_positions as scp', 'customer_personnel.position_id', '=', 'scp.id');
        }

        $columns = [];
        foreach (['id', 'customer_id', 'full_name', 'date_of_birth', 'position_id', 'position_type', 'phone', 'email', 'status', 'created_at'] as $column) {
            if (! $this->support->hasColumn('customer_personnel', $column)) {
                continue;
            }
            $columns[] = $joinSupportContactPositions
                ? "customer_personnel.{$column} as {$column}"
                : $column;
        }

        if ($joinSupportContactPositions) {
            if ($this->support->hasColumn('support_contact_positions', 'position_code')) {
                $columns[] = 'scp.position_code as position_code';
            }
            if ($this->support->hasColumn('support_contact_positions', 'position_name')) {
                $columns[] = 'scp.position_name as position_name';
            }
        }

        $query->select($columns);

        $customerId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->support->hasColumn('customer_personnel', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if (
            $status !== ''
            && in_array($status, ['ACTIVE', 'INACTIVE'], true)
            && $this->support->hasColumn('customer_personnel', 'status')
        ) {
            $query->where('customer_personnel.status', $status);
        }

        $query->orderBy('customer_personnel.id');

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('customer_personnel')) {
            return $this->support->missingTable('customer_personnel');
        }

        $validated = $request->validate([
            'customer_id' => ['required', 'integer'],
            'full_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'position_type' => ['nullable', 'string', 'max:50'],
            'position_id' => ['nullable', 'integer'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE', 'Active', 'Inactive'])],
        ]);

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            throw ValidationException::withMessages([
                'date_of_birth' => [$this->employeeDateOfBirthRangeMessage()],
            ]);
        }

        $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
            $validated['position_type'] ?? null,
            $validated['position_id'] ?? null,
            ! array_key_exists('position_type', $validated) && ! array_key_exists('position_id', $validated)
        );
        if ($resolvedPosition === null) {
            return response()->json(['message' => 'position_type hoặc position_id không tồn tại trong danh mục chức vụ.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('customer_personnel', [
            'customer_id' => $customerId,
            'full_name' => trim((string) $validated['full_name']),
            'date_of_birth' => $this->support->normalizeNullableString($validated['date_of_birth'] ?? null),
            'position_id' => $resolvedPosition['id'],
            'position_type' => $resolvedPosition['position_code'],
            'phone' => $this->support->normalizeNullableString($validated['phone'] ?? null),
            'email' => $this->support->normalizeNullableString($validated['email'] ?? null),
            'status' => $this->normalizeCustomerPersonnelStorageStatus((string) ($validated['status'] ?? 'ACTIVE')),
        ]);

        if ($this->support->hasColumn('customer_personnel', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('customer_personnel', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('customer_personnel')->insertGetId($payload);
        $record = $this->loadCustomerPersonnelById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Customer personnel created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('customer_personnel')) {
            return $this->support->missingTable('customer_personnel');
        }

        $validated = $request->validate([
            'customer_id' => ['sometimes', 'required', 'integer'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'position_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'position_id' => ['sometimes', 'nullable', 'integer'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(['ACTIVE', 'INACTIVE', 'Active', 'Inactive'])],
        ]);

        $targetId = trim($id);
        if ($targetId === '') {
            return response()->json(['message' => 'id is invalid.'], 422);
        }

        $current = DB::table('customer_personnel')
            ->where('id', $targetId)
            ->when($this->support->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();
        if ($current === null) {
            return response()->json(['message' => 'Customer personnel not found.'], 404);
        }

        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            throw ValidationException::withMessages([
                'date_of_birth' => [$this->employeeDateOfBirthRangeMessage()],
            ]);
        }

        $payload = [];
        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $payload['customer_id'] = $customerId;
        }
        if (array_key_exists('full_name', $validated)) {
            $payload['full_name'] = trim((string) $validated['full_name']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $payload['date_of_birth'] = $this->support->normalizeNullableString($validated['date_of_birth']);
        }
        if (array_key_exists('position_type', $validated) || array_key_exists('position_id', $validated)) {
            $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
                $validated['position_type'] ?? null,
                $validated['position_id'] ?? null,
                false
            );
            if ($resolvedPosition === null) {
                return response()->json(['message' => 'position_type hoặc position_id không tồn tại trong danh mục chức vụ.'], 422);
            }

            $payload['position_type'] = $resolvedPosition['position_code'];
            $payload['position_id'] = $resolvedPosition['id'];
        }
        if (array_key_exists('phone', $validated)) {
            $payload['phone'] = $this->support->normalizeNullableString($validated['phone']);
        }
        if (array_key_exists('email', $validated)) {
            $payload['email'] = $this->support->normalizeNullableString($validated['email']);
        }
        if (array_key_exists('status', $validated)) {
            $payload['status'] = $this->normalizeCustomerPersonnelStorageStatus((string) ($validated['status'] ?? 'ACTIVE'));
        }

        $payload = $this->support->filterPayloadByTableColumns('customer_personnel', $payload);
        if ($payload === []) {
            $existing = $this->loadCustomerPersonnelById((int) $targetId);
            if ($existing === null) {
                return response()->json(['message' => 'Customer personnel not found.'], 404);
            }

            return response()->json(['data' => $existing]);
        }

        if ($this->support->hasColumn('customer_personnel', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('customer_personnel')
            ->where('id', $targetId)
            ->update($payload);

        $record = $this->loadCustomerPersonnelById((int) $targetId);
        if ($record === null) {
            return response()->json(['message' => 'Customer personnel updated but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('customer_personnel')) {
            return $this->support->missingTable('customer_personnel');
        }

        $targetId = trim($id);
        if ($targetId === '') {
            return response()->json(['message' => 'id is invalid.'], 422);
        }

        $deleteQuery = DB::table('customer_personnel')->where('id', $targetId);
        if ($this->support->hasColumn('customer_personnel', 'deleted_at')) {
            $payload = ['deleted_at' => now()];
            if ($this->support->hasColumn('customer_personnel', 'updated_at')) {
                $payload['updated_at'] = now();
            }
            $deleted = $deleteQuery
                ->whereNull('deleted_at')
                ->update($this->support->filterPayloadByTableColumns('customer_personnel', $payload));
        } else {
            $deleted = $deleteQuery->delete();
        }

        if ($deleted <= 0) {
            return response()->json(['message' => 'Customer personnel not found.'], 404);
        }

        return response()->json(['message' => 'Customer personnel deleted.']);
    }

    private function loadCustomerPersonnelById(int $id): ?array
    {
        if (! $this->support->hasTable('customer_personnel')) {
            return null;
        }

        $query = DB::table('customer_personnel');
        $joinSupportContactPositions =
            $this->support->hasTable('support_contact_positions')
            && $this->support->hasColumn('customer_personnel', 'position_id')
            && $this->support->hasColumn('support_contact_positions', 'id');
        if ($joinSupportContactPositions) {
            $query->leftJoin('support_contact_positions as scp', 'customer_personnel.position_id', '=', 'scp.id');
        }

        $columns = [];
        foreach (['id', 'customer_id', 'full_name', 'date_of_birth', 'position_id', 'position_type', 'phone', 'email', 'status', 'created_at'] as $column) {
            if (! $this->support->hasColumn('customer_personnel', $column)) {
                continue;
            }
            $columns[] = $joinSupportContactPositions
                ? "customer_personnel.{$column} as {$column}"
                : $column;
        }
        if ($joinSupportContactPositions) {
            if ($this->support->hasColumn('support_contact_positions', 'position_code')) {
                $columns[] = 'scp.position_code as position_code';
            }
            if ($this->support->hasColumn('support_contact_positions', 'position_name')) {
                $columns[] = 'scp.position_name as position_name';
            }
        }

        $record = $query
            ->select($columns)
            ->where('customer_personnel.id', $id)
            ->when($this->support->hasColumn('customer_personnel', 'deleted_at'), fn ($builder) => $builder->whereNull('customer_personnel.deleted_at'))
            ->first();

        return $record !== null ? $this->serializeCustomerPersonnelRecord((array) $record) : null;
    }

    /**
     * @return array{id:int,position_code:string,position_name:string}|null
     */
    private function resolveCustomerPersonnelPositionMaster(
        mixed $positionTypeInput,
        mixed $positionIdInput,
        bool $allowDefault = false
    ): ?array {
        if (! $this->support->hasTable('support_contact_positions')) {
            return null;
        }

        $canResolveById = $this->support->hasColumn('support_contact_positions', 'id');
        $canResolveByCode = $this->support->hasColumn('support_contact_positions', 'position_code');
        $canResolveByName = $this->support->hasColumn('support_contact_positions', 'position_name');
        if (! $canResolveById || (! $canResolveByCode && ! $canResolveByName)) {
            return null;
        }

        $positionId = $this->support->parseNullableInt($positionIdInput);
        $positionText = trim((string) ($positionTypeInput ?? ''));
        $positionCode = $this->sanitizeSupportContactPositionCode($positionText);

        $record = null;
        if ($positionId !== null) {
            $record = DB::table('support_contact_positions')
                ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->where('id', $positionId)
                ->first();
        }

        if ($record === null && $positionCode !== '' && $canResolveByCode) {
            $record = DB::table('support_contact_positions')
                ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->whereRaw('UPPER(TRIM(position_code)) = ?', [$positionCode])
                ->first();
        }

        if ($record === null && $positionText !== '' && $canResolveByName) {
            $record = DB::table('support_contact_positions')
                ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->whereRaw(
                    'LOWER(TRIM(position_name)) = ?',
                    [function_exists('mb_strtolower') ? mb_strtolower($positionText, 'UTF-8') : strtolower($positionText)]
                )
                ->first();
        }

        if ($record === null && $positionText !== '') {
            $matchToken = $this->normalizeSupportContactPositionMatchToken($positionText);
            if ($matchToken !== '') {
                $candidates = DB::table('support_contact_positions')
                    ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                    ->orderBy('id')
                    ->get();

                foreach ($candidates as $candidate) {
                    $candidateCode = (string) ($candidate->position_code ?? '');
                    $candidateName = (string) ($candidate->position_name ?? '');
                    if (
                        $this->normalizeSupportContactPositionMatchToken($candidateCode) === $matchToken
                        || $this->normalizeSupportContactPositionMatchToken($candidateName) === $matchToken
                    ) {
                        $record = $candidate;
                        break;
                    }
                }
            }
        }

        if ($record === null && $allowDefault) {
            if ($canResolveByCode) {
                $record = DB::table('support_contact_positions')
                    ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                    ->whereRaw('UPPER(TRIM(position_code)) = ?', ['DAU_MOI'])
                    ->first();
            }

            if ($record === null) {
                $query = DB::table('support_contact_positions')
                    ->select($this->support->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']));

                if ($this->support->hasColumn('support_contact_positions', 'is_active')) {
                    $query->where('is_active', 1);
                }

                $record = $query->orderBy('id')->first();
            }
        }

        if ($record === null) {
            return null;
        }

        $resolvedId = $this->support->parseNullableInt($record->id ?? null);
        if ($resolvedId === null) {
            return null;
        }

        $resolvedCode = $this->sanitizeSupportContactPositionCode((string) ($record->position_code ?? ''));
        if ($resolvedCode === '') {
            return null;
        }

        $resolvedName = $this->support->normalizeNullableString($record->position_name ?? null) ?? $resolvedCode;

        return [
            'id' => $resolvedId,
            'position_code' => $resolvedCode,
            'position_name' => $resolvedName,
        ];
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

    private function normalizeSupportContactPositionMatchToken(string $value): string
    {
        $normalized = Str::ascii(trim($value));
        if ($normalized === '') {
            return '';
        }

        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', $normalized));
    }

    private function normalizeCustomerPersonnelStorageStatus(string $status): string
    {
        return strtoupper(trim($status)) === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCustomerPersonnelRecord(array $record): array
    {
        $status = $this->normalizeCustomerPersonnelStorageStatus((string) ($record['status'] ?? 'ACTIVE'));
        $positionId = $this->support->parseNullableInt($record['position_id'] ?? null);
        $positionType = $this->sanitizeSupportContactPositionCode((string) ($record['position_code'] ?? $record['position_type'] ?? ''));
        $positionLabel = $this->support->normalizeNullableString($record['position_name'] ?? null);

        if ($positionType === '' || $positionLabel === null) {
            $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
                $positionType !== '' ? $positionType : ($record['position_type'] ?? null),
                $positionId,
                false
            );
            if ($resolvedPosition !== null) {
                $positionId = $resolvedPosition['id'];
                $positionType = $resolvedPosition['position_code'];
                $positionLabel = $resolvedPosition['position_name'];
            }
        }

        if ($positionType === '') {
            $positionType = $this->sanitizeSupportContactPositionCode((string) ($record['position_type'] ?? 'DAU_MOI'));
        }
        if ($positionType === '') {
            $positionType = 'DAU_MOI';
        }
        if ($positionLabel === null || $positionLabel === '') {
            $positionLabel = $positionType;
        }

        return [
            'id' => (string) ($record['id'] ?? ''),
            'fullName' => (string) ($record['full_name'] ?? ''),
            'birthday' => $this->formatDateColumn($record['date_of_birth'] ?? null),
            'positionType' => $positionType,
            'positionId' => $positionId !== null ? (string) $positionId : null,
            'positionLabel' => $positionLabel,
            'phoneNumber' => (string) ($record['phone'] ?? ''),
            'email' => (string) ($record['email'] ?? ''),
            'customerId' => (string) ($record['customer_id'] ?? ''),
            'status' => $status === 'INACTIVE' ? 'Inactive' : 'Active',
            'createdDate' => $this->formatDateColumn($record['created_at'] ?? null),
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

    private function isOutOfAllowedEmployeeAgeRange(mixed $dateOfBirth): bool
    {
        $normalized = trim((string) ($dateOfBirth ?? ''));
        if ($normalized === '') {
            return false;
        }

        $birthDate = date_create_immutable($normalized);
        if (! $birthDate instanceof \DateTimeImmutable) {
            return false;
        }

        $today = new \DateTimeImmutable('today');
        if ($birthDate > $today) {
            return true;
        }

        $age = $birthDate->diff($today)->y;

        return $age <= self::EMPLOYEE_MIN_AGE_EXCLUSIVE || $age >= self::EMPLOYEE_MAX_AGE_EXCLUSIVE;
    }

    private function employeeDateOfBirthRangeMessage(): string
    {
        return sprintf(
            'Ngày sinh phải cho số tuổi > %d và < %d.',
            self::EMPLOYEE_MIN_AGE_EXCLUSIVE,
            self::EMPLOYEE_MAX_AGE_EXCLUSIVE
        );
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
