<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ArchiveSoftDeletedRecordsCommand extends Command
{
    protected $signature = 'archive:soft-deletes
        {--tables=* : Specific configured source tables to archive}
        {--days= : Override retention window in days}
        {--chunk= : Override chunk size}';

    protected $description = 'Move aged soft-deleted rows into *_archive tables, then hard-delete originals.';

    public function handle(): int
    {
        $definitions = (array) config('vnpt_archival.soft_delete.tables', []);
        $selectedTables = array_values(array_filter(array_map('strval', (array) $this->option('tables'))));

        if ($selectedTables !== []) {
            $unknown = array_values(array_diff($selectedTables, array_keys($definitions)));
            if ($unknown !== []) {
                $this->error('Unknown archival table(s): '.implode(', ', $unknown));

                return self::FAILURE;
            }

            $definitions = array_intersect_key($definitions, array_flip($selectedTables));
        }

        if ($definitions === []) {
            $this->warn('No archival tables are configured.');

            return self::SUCCESS;
        }

        $days = max(1, (int) ($this->option('days') ?: config('vnpt_archival.soft_delete.days', 180)));
        $chunkSize = max(1, (int) ($this->option('chunk') ?: config('vnpt_archival.soft_delete.chunk_size', 200)));
        $cutoff = now()->subDays($days);
        $totalArchived = 0;

        foreach ($definitions as $sourceTable => $definition) {
            $archiveTable = (string) ($definition['archive_table'] ?? '');
            if ($archiveTable === '') {
                $this->warn(sprintf('Skipping %s because archive_table is not configured.', $sourceTable));
                continue;
            }

            if (! Schema::hasTable($sourceTable) || ! Schema::hasTable($archiveTable) || ! Schema::hasColumn($sourceTable, 'deleted_at')) {
                $this->warn(sprintf('Skipping %s because required source/archive tables are unavailable.', $sourceTable));
                continue;
            }

            $archivedForTable = $this->archiveTable(
                $sourceTable,
                $archiveTable,
                array_values(array_map('strval', (array) ($definition['copy_columns'] ?? []))),
                $cutoff,
                $chunkSize
            );

            $totalArchived += $archivedForTable;
            $this->line(sprintf('Archived %d rows from %s into %s.', $archivedForTable, $sourceTable, $archiveTable));
        }

        $this->info(sprintf('Archived soft-deleted records: %d rows.', $totalArchived));

        return self::SUCCESS;
    }

    private function archiveTable(
        string $sourceTable,
        string $archiveTable,
        array $copyColumns,
        \Illuminate\Support\Carbon $cutoff,
        int $chunkSize
    ): int {
        $copiableColumns = array_values(array_filter(
            $copyColumns,
            fn (string $column): bool => Schema::hasColumn($sourceTable, $column) && Schema::hasColumn($archiveTable, $column)
        ));

        $archived = 0;

        DB::table($sourceTable)
            ->whereNotNull('deleted_at')
            ->where('deleted_at', '<=', $cutoff)
            ->orderBy('id')
            ->chunkById($chunkSize, function ($rows) use ($sourceTable, $archiveTable, $copiableColumns, &$archived, $cutoff): void {
                if ($rows->isEmpty()) {
                    return;
                }

                DB::transaction(function () use ($rows, $sourceTable, $archiveTable, $copiableColumns, &$archived, $cutoff): void {
                    $ids = [];
                    $archivedAt = now();

                    foreach ($rows as $row) {
                        $record = (array) $row;
                        $sourceId = (int) ($record['id'] ?? 0);
                        if ($sourceId <= 0) {
                            continue;
                        }

                        $payload = [
                            'source_id' => $sourceId,
                            'source_created_at' => $record['created_at'] ?? null,
                            'source_updated_at' => $record['updated_at'] ?? null,
                            'source_deleted_at' => $record['deleted_at'] ?? null,
                            'archived_at' => $archivedAt,
                            'archive_reason' => 'soft_delete_retention',
                            'payload' => json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        ];

                        foreach ($copiableColumns as $column) {
                            $payload[$column] = $record[$column] ?? null;
                        }

                        DB::table($archiveTable)->updateOrInsert(
                            ['source_id' => $sourceId],
                            $payload
                        );

                        $ids[] = $sourceId;
                    }

                    if ($ids === []) {
                        return;
                    }

                    $deleted = DB::table($sourceTable)
                        ->whereIn('id', $ids)
                        ->whereNotNull('deleted_at')
                        ->where('deleted_at', '<=', $cutoff)
                        ->delete();

                    $archived += $deleted;
                });
            }, 'id');

        return $archived;
    }
}
