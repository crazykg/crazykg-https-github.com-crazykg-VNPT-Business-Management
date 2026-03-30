<?php

namespace App\Http\Requests\V5;

use App\Support\Auth\UserAccessService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;

abstract class V5FormRequest extends FormRequest
{
    protected function authorizeWithPermission(string $permissionKey): bool
    {
        if (app()->runningUnitTests() && ! Schema::hasTable('permissions')) {
            return true;
        }

        $userId = (int) ($this->user()?->id ?? 0);
        if ($userId <= 0) {
            return false;
        }

        return app(UserAccessService::class)->hasPermission($userId, $permissionKey);
    }

    protected function support(): V5DomainSupportService
    {
        return app(V5DomainSupportService::class);
    }
}
