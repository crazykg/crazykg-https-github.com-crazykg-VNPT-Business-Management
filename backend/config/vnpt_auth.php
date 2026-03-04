<?php

return [
    'cookie_name' => env('VNPT_AUTH_COOKIE_NAME', 'vnpt_business_auth_token'),
    'cookie_minutes' => (int) env('VNPT_AUTH_COOKIE_MINUTES', 60),
    'access_cookie_name' => env('VNPT_AUTH_ACCESS_COOKIE_NAME', env('VNPT_AUTH_COOKIE_NAME', 'vnpt_business_auth_token')),
    'access_cookie_minutes' => (int) env('VNPT_AUTH_ACCESS_COOKIE_MINUTES', env('VNPT_AUTH_COOKIE_MINUTES', 60)),
    'refresh_cookie_name' => env('VNPT_AUTH_REFRESH_COOKIE_NAME', 'vnpt_business_refresh_token'),
    'refresh_cookie_minutes' => (int) env('VNPT_AUTH_REFRESH_COOKIE_MINUTES', 10080),
    'cookie_path' => env('VNPT_AUTH_COOKIE_PATH', '/'),
    'cookie_domain' => env('VNPT_AUTH_COOKIE_DOMAIN'),
    'cookie_secure' => env('VNPT_AUTH_COOKIE_SECURE'),
    'cookie_same_site' => env('VNPT_AUTH_COOKIE_SAME_SITE', 'lax'),
];
