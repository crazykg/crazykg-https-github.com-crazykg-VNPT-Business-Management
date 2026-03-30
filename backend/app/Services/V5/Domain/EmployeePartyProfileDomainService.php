<?php

namespace App\Services\V5\Domain;

use App\Models\EmployeePartyProfile;
use App\Models\InternalUser;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeePartyProfileDomainService
{
    private const PARTY_PROFILE_TABLE = 'employee_party_profiles';

    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable(self::PARTY_PROFILE_TABLE)) {
            return $this->support->missingTable(self::PARTY_PROFILE_TABLE);
        }

        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $departmentColumn = $this->resolveEmployeeDepartmentColumn($employeeTable);

        $query = EmployeePartyProfile::query()
            ->join("{$employeeTable} as iu", 'iu.id', '=', self::PARTY_PROFILE_TABLE.'.employee_id')
            ->select(self::PARTY_PROFILE_TABLE.'.*')
            ->with($this->partyProfileRelations());

        $this->applyEmployeeVisibility($query, $request, 'iu', $departmentColumn);
        $this->applyFilters($query, $request, $departmentColumn);

        $kpis = $this->buildListKpis(clone $query);
        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => self::PARTY_PROFILE_TABLE.'.id',
            'employee_id' => self::PARTY_PROFILE_TABLE.'.employee_id',
            'user_code' => 'iu.user_code',
            'full_name' => 'iu.full_name',
            'department_id' => $departmentColumn ? "iu.{$departmentColumn}" : 'iu.id',
            'party_card_number' => self::PARTY_PROFILE_TABLE.'.party_card_number',
            'created_at' => self::PARTY_PROFILE_TABLE.'.created_at',
        ], 'iu.user_code');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'iu.user_code') {
            $query->orderBy('iu.user_code', 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, [self::PARTY_PROFILE_TABLE.'.*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (EmployeePartyProfile $profile): array => $this->serializePartyProfile($profile))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => array_merge(
                        $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                        ['kpis' => $kpis]
                    ),
                ]);
            }

            $paginator = $query->paginate($perPage, [self::PARTY_PROFILE_TABLE.'.*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (EmployeePartyProfile $profile): array => $this->serializePartyProfile($profile))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => array_merge(
                    $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
                    ['kpis' => $kpis]
                ),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (EmployeePartyProfile $profile): array => $this->serializePartyProfile($profile))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => array_merge(
                $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
                ['kpis' => $kpis]
            ),
        ]);
    }

    public function showForEmployee(int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::PARTY_PROFILE_TABLE)) {
            return $this->support->missingTable(self::PARTY_PROFILE_TABLE);
        }

        $employee = InternalUser::query()
            ->with($this->employeeRelations())
            ->findOrFail($id);
        $profile = EmployeePartyProfile::query()
            ->with($this->partyProfileRelations())
            ->where('employee_id', $employee->id)
            ->first();

        return response()->json([
            'data' => $profile ? $this->serializePartyProfile($profile) : null,
            'employee' => $this->serializeEmployeeSummary($employee),
        ]);
    }

    public function upsertForEmployee(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable(self::PARTY_PROFILE_TABLE)) {
            return $this->support->missingTable(self::PARTY_PROFILE_TABLE);
        }

        $employee = InternalUser::query()->findOrFail($id);
        $existingProfile = EmployeePartyProfile::query()->where('employee_id', $employee->id)->first();
        $validated = $this->validateUpsertPayload($request, $existingProfile?->id);
        $actorId = $request->user() instanceof InternalUser ? (int) $request->user()->id : null;

        $profile = DB::transaction(fn (): EmployeePartyProfile => $this->persistProfile(
            $employee,
            $validated,
            $actorId,
            $existingProfile
        ));

        $profile->load($this->partyProfileRelations());

        return response()->json([
            'data' => $this->serializePartyProfile($profile),
        ], $existingProfile ? 200 : 201);
    }

    public function bulkUpsert(Request $request): JsonResponse
    {
        if (! $this->support->hasTable(self::PARTY_PROFILE_TABLE)) {
            return $this->support->missingTable(self::PARTY_PROFILE_TABLE);
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:300'],
            'items.*' => ['required', 'array'],
        ]);

        $actorId = $request->user() instanceof InternalUser ? (int) $request->user()->id : null;
        $results = [];
        $created = [];
        $seenEmployeeCodes = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $employeeCode = strtoupper(trim((string) ($itemPayload['employee_code'] ?? '')));
                if ($employeeCode === '') {
                    throw ValidationException::withMessages([
                        'employee_code' => 'Mã nhân viên là bắt buộc.',
                    ]);
                }

                if (isset($seenEmployeeCodes[$employeeCode])) {
                    throw ValidationException::withMessages([
                        'employee_code' => 'Mã nhân viên bị trùng trong file import.',
                    ]);
                }
                $seenEmployeeCodes[$employeeCode] = true;

                $employee = InternalUser::query()
                    ->whereRaw('UPPER(user_code) = ?', [$employeeCode])
                    ->first();
                if (! $employee instanceof InternalUser) {
                    throw ValidationException::withMessages([
                        'employee_code' => 'Không tìm thấy nhân sự với Mã NV đã cung cấp.',
                    ]);
                }

                $subRequest = Request::create(
                    "/api/v5/internal-users/{$employee->id}/party-profile",
                    'PUT',
                    $itemPayload
                );
                $subRequest->setUserResolver(fn () => $request->user());

                $validatedItem = $this->validateUpsertPayload(
                    $subRequest,
                    EmployeePartyProfile::query()->where('employee_id', $employee->id)->value('id')
                );

                $profile = DB::transaction(fn (): EmployeePartyProfile => $this->persistProfile(
                    $employee,
                    $validatedItem,
                    $actorId,
                    EmployeePartyProfile::query()->where('employee_id', $employee->id)->first()
                ));
                $profile->load($this->partyProfileRelations());
                $serialized = $this->serializePartyProfile($profile);

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $serialized,
                ];
                $created[] = $serialized;
            } catch (ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể lưu hồ sơ đảng viên.',
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

    private function applyFilters(Builder $query, Request $request, ?string $departmentColumn): void
    {
        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function (Builder $builder) use ($like): void {
                $builder
                    ->where('iu.user_code', 'like', $like)
                    ->orWhere('iu.username', 'like', $like)
                    ->orWhere('iu.full_name', 'like', $like)
                    ->orWhere('iu.email', 'like', $like);
            });
        }

        $departmentId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'department_id'));
        if ($departmentId !== null && $departmentColumn !== null) {
            $query->where("iu.{$departmentColumn}", $departmentId);
        }

        $missingInfo = strtoupper(trim((string) ($this->support->readFilterParam($request, 'missing_info', '') ?? '')));
        if ($missingInfo === 'CARD_NUMBER') {
            $query->whereNull(self::PARTY_PROFILE_TABLE.'.party_card_number');
        }
    }

    private function applyEmployeeVisibility(Builder $query, Request $request, string $employeeAlias, ?string $departmentColumn): void
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof InternalUser) {
            return;
        }

        $visibility = app(UserAccessService::class)->resolveEmployeeVisibility((int) $authenticatedUser->id);
        if ($visibility['all']) {
            return;
        }

        $query->where(function (Builder $builder) use ($visibility, $employeeAlias, $authenticatedUser, $departmentColumn): void {
            $hasAnyScope = false;

            if ($visibility['self_only']) {
                $builder->where("{$employeeAlias}.id", (int) $authenticatedUser->id);
                $hasAnyScope = true;
            }

            $deptIds = $visibility['dept_ids'] ?? [];
            if ($deptIds !== [] && $departmentColumn !== null) {
                if ($hasAnyScope) {
                    $builder->orWhereIn("{$employeeAlias}.{$departmentColumn}", $deptIds);
                } else {
                    $builder->whereIn("{$employeeAlias}.{$departmentColumn}", $deptIds);
                }
                $hasAnyScope = true;
            }

            if (! $hasAnyScope) {
                $builder->whereRaw('1 = 0');
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function validateUpsertPayload(Request $request, int|string|null $ignoreProfileId = null): array
    {
        $rules = [
            'ethnicity' => ['nullable', 'string', 'max:120'],
            'religion' => ['nullable', 'string', 'max:120'],
            'hometown' => ['nullable', 'string', 'max:255'],
            'professional_qualification' => ['nullable', 'string', 'max:255'],
            'political_theory_level' => ['nullable', 'string', 'max:255'],
            'party_card_number' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];

        $partyCardRule = Rule::unique(self::PARTY_PROFILE_TABLE, 'party_card_number');
        if ($ignoreProfileId !== null) {
            $partyCardRule = $partyCardRule->ignore($ignoreProfileId);
        }
        $rules['party_card_number'][] = $partyCardRule;

        return $request->validate($rules);
    }

    private function persistProfile(
        InternalUser $employee,
        array $validated,
        ?int $actorId,
        ?EmployeePartyProfile $existingProfile = null
    ): EmployeePartyProfile {
        $profile = $existingProfile ?? new EmployeePartyProfile();
        $profile->employee_id = (int) $employee->id;
        // Keep legacy columns blank when an older database still has the deprecated status/date fields.
        if ($this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'party_member_status')) {
            $profile->party_member_status = (string) ($existingProfile?->party_member_status ?: 'PROBATIONARY');
        }
        if ($this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'probationary_join_date')) {
            $profile->probationary_join_date = null;
        }
        if ($this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'official_join_date')) {
            $profile->official_join_date = null;
        }
        $profile->ethnicity = $this->support->normalizeNullableString($validated['ethnicity'] ?? null);
        $profile->religion = $this->support->normalizeNullableString($validated['religion'] ?? null);
        $profile->hometown = $this->support->normalizeNullableString($validated['hometown'] ?? null);
        $profile->professional_qualification = $this->support->normalizeNullableString($validated['professional_qualification'] ?? null);
        $profile->political_theory_level = $this->support->normalizeNullableString($validated['political_theory_level'] ?? null);
        $profile->party_card_number = $this->support->normalizeNullableString($validated['party_card_number'] ?? null);
        if ($this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'party_card_issue_date')) {
            $profile->party_card_issue_date = null;
        }
        $profile->notes = $this->support->normalizeNullableString($validated['notes'] ?? null);

        if (! $profile->exists && $actorId !== null && $this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'created_by')) {
            $profile->created_by = $actorId;
        }
        if ($actorId !== null && $this->support->hasColumn(self::PARTY_PROFILE_TABLE, 'updated_by')) {
            $profile->updated_by = $actorId;
        }

        $profile->save();

        return $profile;
    }

    private function resolveEmployeeDepartmentColumn(string $employeeTable): ?string
    {
        if ($this->support->hasColumn($employeeTable, 'department_id')) {
            return 'department_id';
        }

        if ($this->support->hasColumn($employeeTable, 'dept_id')) {
            return 'dept_id';
        }

        return null;
    }

    /**
     * @return array<string, int>
     */
    private function buildListKpis(Builder $query): array
    {
        $countColumn = self::PARTY_PROFILE_TABLE.'.id';

        return [
            'total_party_members' => (clone $query)->count($countColumn),
            'missing_party_card_number_count' => (clone $query)
                ->whereNull(self::PARTY_PROFILE_TABLE.'.party_card_number')
                ->count($countColumn),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePartyProfile(EmployeePartyProfile $profile): array
    {
        $profile->loadMissing($this->partyProfileRelations());
        $employee = $profile->employee instanceof InternalUser ? $profile->employee : null;

        return [
            'id' => $profile->id,
            'employee_id' => $profile->employee_id,
            'ethnicity' => $profile->ethnicity,
            'religion' => $profile->religion,
            'hometown' => $profile->hometown,
            'professional_qualification' => $profile->professional_qualification,
            'political_theory_level' => $profile->political_theory_level,
            'party_card_number' => $profile->party_card_number,
            'notes' => $profile->notes,
            'created_at' => optional($profile->created_at)->toISOString(),
            'updated_at' => optional($profile->updated_at)->toISOString(),
            'employee' => $employee ? $this->serializeEmployeeSummary($employee) : null,
            'profile_quality' => [
                'missing_card_number' => $this->support->normalizeNullableString($profile->party_card_number) === null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEmployeeSummary(InternalUser $employee): array
    {
        $employee->loadMissing($this->employeeRelations());
        $department = $employee->department;
        $position = $employee->position;
        $phone = $this->support->normalizeNullableString($employee->phone_number ?? $employee->phone ?? $employee->mobile);
        $dateOfBirth = $employee->date_of_birth;
        $normalizedDateOfBirth = $dateOfBirth instanceof \DateTimeInterface
            ? $dateOfBirth->format('Y-m-d')
            : (is_string($dateOfBirth) ? $dateOfBirth : null);

        return [
            'id' => $employee->id,
            'uuid' => (string) ($employee->uuid ?? ''),
            'user_code' => (string) ($employee->user_code ?? $employee->username ?? $employee->id),
            'employee_code' => (string) ($employee->user_code ?? $employee->username ?? $employee->id),
            'username' => (string) ($employee->username ?? $employee->user_code ?? ''),
            'full_name' => (string) ($employee->full_name ?? ''),
            'email' => (string) ($employee->email ?? ''),
            'phone_number' => $phone,
            'phone' => $phone,
            'mobile' => $phone,
            'status' => strtoupper((string) ($employee->status ?? 'ACTIVE')),
            'department_id' => $employee->department_id ?? $employee->dept_id,
            'position_id' => $employee->position_id,
            'date_of_birth' => $normalizedDateOfBirth,
            'gender' => $employee->gender,
            'job_title_raw' => $employee->job_title_raw,
            'position_code' => $position?->pos_code,
            'position_name' => $position?->pos_name,
            'job_title_vi' => $employee->job_title_raw ?: $position?->pos_name,
            'department' => $department ? [
                'id' => $department->id,
                'dept_code' => $department->dept_code,
                'dept_name' => $department->dept_name,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function employeeRelations(): array
    {
        $relations = [
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ];

        if ($this->support->hasTable('positions')) {
            $relations['position'] = fn ($query) => $query->select(
                $this->support->selectColumns('positions', ['id', 'pos_code', 'pos_name'])
            );
        }

        return $relations;
    }

    /**
     * @return array<string, mixed>
     */
    private function partyProfileRelations(): array
    {
        return [
            'employee' => fn ($query) => $query
                ->select($this->support->selectColumns('internal_users', [
                    'id',
                    'uuid',
                    'user_code',
                    'username',
                    'full_name',
                    'phone',
                    'phone_number',
                    'mobile',
                    'email',
                    'status',
                    'department_id',
                    'dept_id',
                    'position_id',
                    'job_title_raw',
                    'date_of_birth',
                    'gender',
                    'created_at',
                    'updated_at',
                ]))
                ->with($this->employeeRelations()),
        ];
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $messages) {
            if (is_array($messages) && isset($messages[0]) && is_string($messages[0]) && trim($messages[0]) !== '') {
                return trim($messages[0]);
            }
        }

        return 'Dữ liệu hồ sơ đảng viên không hợp lệ.';
    }
}
