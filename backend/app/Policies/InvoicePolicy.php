<?php

namespace App\Policies;

use App\Models\InternalUser;
use App\Models\Invoice;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;
use Illuminate\Auth\Access\Response;

class InvoicePolicy
{
    use ResolvesDepartmentScopedAccess;

    public function view(InternalUser $user, Invoice $invoice): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.read')) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        return Response::allow();
    }

    /**
     * Authorization-only check: WHO can update.
     * WHAT can be updated (e.g. terminal status restrictions) is enforced as a business rule
     * in InvoiceDomainService and returns 422, not 403.
     */
    public function update(InternalUser $user, Invoice $invoice): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.write')) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        return Response::allow();
    }

    public function delete(InternalUser $user, Invoice $invoice): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.delete')) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập hóa đơn này.');
        }

        return Response::allow();
    }
}
