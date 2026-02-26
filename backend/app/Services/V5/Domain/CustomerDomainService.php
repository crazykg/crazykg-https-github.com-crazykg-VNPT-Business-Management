<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CustomerDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $query = Customer::query()
            ->select($this->support->selectColumns('customers', [
                'id',
                'uuid',
                'customer_code',
                'customer_name',
                'company_name',
                'tax_code',
                'address',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['customer_code', 'customer_name', 'company_name', 'tax_code', 'address'] as $column) {
                    if ($this->support->hasColumn('customers', $column)) {
                        $builder->orWhere("customers.{$column}", 'like', $like);
                    }
                }
            });
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'customers.id',
            'customer_code' => 'customers.customer_code',
            'customer_name' => 'customers.customer_name',
            'tax_code' => 'customers.tax_code',
            'created_at' => 'customers.created_at',
        ], 'customers.id');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'customers.id' && $this->support->hasColumn('customers', 'id')) {
            $query->orderBy('customers.id', 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Customer $customer): array => $this->support->serializeCustomer($customer))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Customer $customer): array => $this->support->serializeCustomer($customer))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'customer_code' => ['required', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('customers', 'uuid')) {
            $rules['uuid'][] = Rule::unique('customers', 'uuid');
        }
        if ($this->support->hasColumn('customers', 'customer_code')) {
            $rules['customer_code'][] = Rule::unique('customers', 'customer_code');
        }

        $validated = $request->validate($rules);

        $customer = new Customer();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $uuid);
        $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        $this->support->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        $this->support->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code'] ?? null);
        $this->support->setAttributeIfColumn($customer, 'customers', 'address', $validated['address'] ?? null);

        if ($this->support->hasColumn('customers', 'data_scope')) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope'] ?? null);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'customers',
            $customer->getKey(),
            null,
            $this->accessAudit->toAuditArray($customer)
        );

        return response()->json(['data' => $this->support->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $customer, 'khách hàng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($customer);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_code' => ['sometimes', 'required', 'string', 'max:100'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('customers', 'uuid')) {
            $rules['uuid'][] = Rule::unique('customers', 'uuid')->ignore($customer->id);
        }
        if ($this->support->hasColumn('customers', 'customer_code')) {
            $rules['customer_code'][] = Rule::unique('customers', 'customer_code')->ignore($customer->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('customer_code', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        }
        if (array_key_exists('customer_name', $validated)) {
            $this->support->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        }
        if (array_key_exists('tax_code', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code']);
        }
        if (array_key_exists('address', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'address', $validated['address']);
        }
        if ($this->support->hasColumn('customers', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'customers',
            $customer->getKey(),
            $before,
            $this->accessAudit->toAuditArray($customer->fresh() ?? $customer)
        );

        return response()->json(['data' => $this->support->serializeCustomer($customer)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $customer, 'Customer');
    }
}
