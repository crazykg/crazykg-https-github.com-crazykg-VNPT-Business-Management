<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Sensitive Keys For Audit Masking
    |--------------------------------------------------------------------------
    |
    | Any key matching (exact or contains) below will be masked before being
    | persisted into audit_logs.old_values/new_values.
    |
    */
    'sensitive_keys' => [
        'password',
        'temporary_password',
        'current_password',
        'new_password',
        'password_confirmation',
        'token',
        'access_token',
        'refresh_token',
        'api_key',
        'secret',
        'service_account_json',
        'private_key',
        'client_secret',
        'authorization',
    ],

    'mask' => '[REDACTED]',
];

