<?php

namespace App\Services\V5\Support;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Database\Connection;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Log;
use Throwable;

class ReadReplicaConnectionResolver
{
    private ?string $resolvedConnectionName = null;

    private bool $usingReplica = false;

    private bool $loggedFallback = false;

    public function __construct(
        private readonly DatabaseManager $database,
    ) {}

    public function connection(): Connection
    {
        return $this->database->connection($this->resolveConnectionName());
    }

    public function table(string|Expression $table): Builder
    {
        return $this->connection()->table($table);
    }

    /**
     * @param array<int, mixed> $bindings
     * @return array<int, object>
     */
    public function select(string $query, array $bindings = []): array
    {
        return $this->connection()->select($query, $bindings);
    }

    public function driverName(): string
    {
        return $this->connection()->getDriverName();
    }

    public function usingReplica(): bool
    {
        $this->resolveConnectionName();

        return $this->usingReplica;
    }

    public function resolvedConnectionName(): string
    {
        return $this->resolveConnectionName();
    }

    private function resolveConnectionName(): string
    {
        if ($this->resolvedConnectionName !== null) {
            return $this->resolvedConnectionName;
        }

        $primaryConnection = (string) config('vnpt_read_replica.primary_connection', (string) config('database.default'));
        $replicaConnection = trim((string) config('vnpt_read_replica.connection', 'mysql_replica'));
        $enabled = (bool) config('vnpt_read_replica.enabled', false);

        if (! $enabled || $replicaConnection === '' || $replicaConnection === $primaryConnection) {
            return $this->resolvedConnectionName = $primaryConnection;
        }

        try {
            $connection = $this->database->connection($replicaConnection);
            $connection->getPdo();

            $this->usingReplica = true;

            return $this->resolvedConnectionName = $replicaConnection;
        } catch (Throwable $exception) {
            if (! $this->loggedFallback) {
                Log::warning('Read replica unavailable. Falling back to primary connection.', [
                    'replica_connection' => $replicaConnection,
                    'primary_connection' => $primaryConnection,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);
                $this->loggedFallback = true;
            }

            $this->usingReplica = false;

            return $this->resolvedConnectionName = $primaryConnection;
        }
    }
}
