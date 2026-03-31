<?php

use App\Models\InternalUser;
use App\Support\Auth\UserAccessService;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel((string) config('vnpt_realtime.dashboard_channel', 'v5.dashboards'), function (InternalUser $user): bool {
    $permissions = app(UserAccessService::class)->permissionKeysForUser((int) $user->id);

    if (in_array('*', $permissions, true)) {
        return true;
    }

    $allowedPermissions = array_values(array_filter(
        (array) config('vnpt_realtime.allowed_permissions', []),
        static fn (mixed $permission): bool => is_string($permission) && trim($permission) !== ''
    ));

    return array_intersect($permissions, $allowedPermissions) !== [];
});
