<?php

namespace App\Policies;

use App\Models\InternalUser;
use App\Models\Invoice;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class InvoicePolicy
{
    use ResolvesDepartmentScopedAccess;

    public function view(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.read')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }

    public function update(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.write')) {
            return false;
        }

        if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }

    public function delete(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.delete')) {
            return false;
        }

        if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }
}
