<?php

return [
    'auth' => [
        'login_per_minute' => (int) env('VNPT_RATE_LIMIT_AUTH_LOGIN_PER_MINUTE', 5),
        'refresh_per_minute' => (int) env('VNPT_RATE_LIMIT_AUTH_REFRESH_PER_MINUTE', 10),
    ],
    'api' => [
        'read_per_minute' => (int) env('VNPT_RATE_LIMIT_API_READ_PER_MINUTE', 60),
        'dashboard_per_minute' => (int) env('VNPT_RATE_LIMIT_API_DASHBOARD_PER_MINUTE', 120),
        'export_per_minute' => (int) env('VNPT_RATE_LIMIT_API_EXPORT_PER_MINUTE', 10),
        'write_per_minute' => (int) env('VNPT_RATE_LIMIT_API_WRITE_PER_MINUTE', 30),
        'write_heavy_per_minute' => (int) env('VNPT_RATE_LIMIT_API_WRITE_HEAVY_PER_MINUTE', 10),
    ],
];
