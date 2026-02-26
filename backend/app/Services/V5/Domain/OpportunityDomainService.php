<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Opportunity;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OpportunityDomainService
{
    /**
     * @var array<int, string>
     */
    private const OPPORTUNITY_STAGES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $rows = Opportunity::query()
            ->with(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ->select($this->support->selectColumns('opportunities', [
                'id',
                'opp_name',
                'customer_id',
                'amount',
                'expected_value',
                'stage',
                'probability',
                'owner_id',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Opportunity $opportunity): array => $this->support->serializeOpportunity($opportunity))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $rules = [
            'opp_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'integer'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'stage' => ['nullable', Rule::in(self::OPPORTUNITY_STAGES)],
            'owner_id' => ['nullable', 'integer'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        $validated = $request->validate($rules);

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $opportunity = new Opportunity();
        $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        $this->support->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->support->toOpportunityStorageStage((string) ($validated['stage'] ?? 'NEW')));

        if ($this->support->hasColumn('opportunities', 'owner_id')) {
            $requestedOwnerId = $this->support->parseNullableInt($validated['owner_id'] ?? null);
            $ownerId = $requestedOwnerId ?? $this->support->resolveDefaultOwnerId();

            if ($ownerId === null) {
                return response()->json(['message' => 'owner_id is required. Seed internal_users before creating opportunities.'], 422);
            }

            if (! $this->support->ownerExists($ownerId)) {
                $message = $requestedOwnerId !== null
                    ? 'owner_id is invalid.'
                    : 'owner_id is required. Seed internal_users before creating opportunities.';

                return response()->json(['message' => $message], 422);
            }

            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);

            if ($this->support->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->support->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }
        }

        if ($this->support->hasColumn('opportunities', 'data_scope')) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope'] ?? null);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'cơ hội',
            $this->support->extractIntFromRecord($this->accessAudit->toAuditArray($opportunity), ['dept_id', 'department_id']),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        $opportunity->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'opportunities',
            $opportunity->getKey(),
            null,
            $this->accessAudit->toAuditArray($opportunity)
        );

        return response()->json([
            'data' => $this->support->serializeOpportunity(
                $opportunity->fresh()->load(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $opportunity, 'cơ hội');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($opportunity);

        $rules = [
            'opp_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'stage' => ['sometimes', 'nullable', Rule::in(self::OPPORTUNITY_STAGES)],
            'owner_id' => ['sometimes', 'nullable', 'integer'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        $validated = $request->validate($rules);

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        }

        if (array_key_exists('opp_name', $validated)) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        }
        if (array_key_exists('amount', $validated)) {
            $this->support->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        }
        if (array_key_exists('stage', $validated)) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->support->toOpportunityStorageStage((string) $validated['stage']));
        }
        if (array_key_exists('owner_id', $validated) && $this->support->hasColumn('opportunities', 'owner_id')) {
            $ownerId = $this->support->parseNullableInt($validated['owner_id']);
            if ($ownerId === null || ! $this->support->ownerExists($ownerId)) {
                return response()->json(['message' => 'owner_id is invalid.'], 422);
            }

            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);
            $ownerDeptId = null;
            if ($this->support->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->support->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }

            $scopeError = $this->accessAudit->authorizeMutationByScope(
                $request,
                'cơ hội',
                $ownerDeptId,
                $this->accessAudit->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }
        if ($this->support->hasColumn('opportunities', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        $opportunity->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'opportunities',
            $opportunity->getKey(),
            $before,
            $this->accessAudit->toAuditArray($opportunity->fresh() ?? $opportunity)
        );

        return response()->json([
            'data' => $this->support->serializeOpportunity(
                $opportunity->fresh()->load(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $opportunity, 'Opportunity');
    }
}
