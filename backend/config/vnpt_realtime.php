<?php

return [
    'enabled' => (bool) env('VNPT_REALTIME_ENABLED', false),
    'dashboard_channel' => env('VNPT_REALTIME_DASHBOARD_CHANNEL', 'v5.dashboards'),
    'allowed_permissions' => [
        'dashboard.view',
        'fee_collection.read',
        'revenue.read',
        'revenue.targets',
    ],
];
