<?php

namespace App\Policies;

use App\Models\InternalUser;
use App\Models\Invoice;
use App\Models\Receipt;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;
use Illuminate\Auth\Access\Response;

class ReceiptPolicy
{
    use ResolvesDepartmentScopedAccess;

    public function view(InternalUser $user, Receipt $receipt): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.read')) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveReceiptDepartmentIds($receipt),
            [(int) $receipt->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        return Response::allow();
    }

    public function update(InternalUser $user, Receipt $receipt): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.write')) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveReceiptDepartmentIds($receipt),
            [(int) $receipt->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        return Response::allow();
    }

    public function delete(InternalUser $user, Receipt $receipt): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.delete')) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveReceiptDepartmentIds($receipt),
            [(int) $receipt->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        return Response::allow();
    }

    /**
     * Authorization-only check: WHO can reverse.
     * WHAT can be reversed (e.g. must be CONFIRMED, must not be a reversal-offset)
     * is enforced as a business rule in ReceiptDomainService and returns 422, not 403.
     */
    public function reverse(InternalUser $user, Receipt $receipt): Response
    {
        if (! $this->hasPermission($user, 'fee_collection.write')) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        if (! $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveReceiptDepartmentIds($receipt),
            [(int) $receipt->getAttribute('created_by')]
        )) {
            return Response::deny('Bạn không có quyền truy cập phiếu thu này.');
        }

        return Response::allow();
    }

    /**
     * @return array<int, int>
     */
    private function resolveReceiptDepartmentIds(Receipt $receipt): array
    {
        $invoice = $receipt->invoice;
        if ($invoice instanceof Invoice) {
            $deptIds = $this->resolveInvoiceDepartmentIds($invoice);
            if ($deptIds !== []) {
                return $deptIds;
            }
        }

        $contract = $receipt->contract;
        if ($contract !== null) {
            return $this->resolveContractDepartmentIds($contract);
        }

        return [];
    }
}
