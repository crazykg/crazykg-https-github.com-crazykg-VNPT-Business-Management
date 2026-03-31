<?php

return [
    'enabled' => (bool) env('DB_READ_REPLICA_ENABLED', false),
    'connection' => env('DB_READ_REPLICA_CONNECTION', 'mysql_replica'),
    'primary_connection' => env('DB_READ_PRIMARY_CONNECTION', env('DB_CONNECTION', 'mysql')),
];
