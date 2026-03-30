<?php

namespace App\Console\Commands;

use App\Models\AsyncExport;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;

class PruneAsyncExportsCommand extends Command
{
    protected $signature = 'exports:prune {--hours=24 : Retention window in hours}';

    protected $description = 'Delete expired async export files and mark jobs as EXPIRED.';

    public function handle(): int
    {
        $hours = max(1, (int) $this->option('hours'));
        $threshold = now()->subHours($hours);
        $disk = Storage::disk('local');

        [$expiredCount, $deletedFileCount] = $this->pruneJobs(
            AsyncExport::query()
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now())
                ->where('status', '!=', AsyncExport::STATUS_EXPIRED),
            $disk
        );

        [$legacyExpiredCount, $legacyDeletedFileCount] = $this->pruneJobs(
            AsyncExport::query()
                ->whereNull('expires_at')
                ->whereNotNull('finished_at')
                ->where('finished_at', '<=', $threshold)
                ->whereIn('status', [AsyncExport::STATUS_DONE, AsyncExport::STATUS_FAILED]),
            $disk
        );

        $expiredCount += $legacyExpiredCount;
        $deletedFileCount += $legacyDeletedFileCount;

        $this->info("Pruned async exports: {$expiredCount} jobs, {$deletedFileCount} files.");

        return self::SUCCESS;
    }

    /**
     * @return array{0:int,1:int}
     */
    private function pruneJobs(Builder $query, FilesystemAdapter $disk): array
    {
        $deletedFileCount = 0;
        $expiredCount = 0;

        $query->chunkById(200, function ($jobs) use ($disk, &$deletedFileCount, &$expiredCount): void {
                foreach ($jobs as $job) {
                    $filePath = trim((string) ($job->file_path ?? ''));
                    if ($filePath !== '' && $disk->exists($filePath)) {
                        $disk->delete($filePath);
                        $deletedFileCount++;
                    }

                    $job->status = AsyncExport::STATUS_EXPIRED;
                    if ($job->expires_at === null) {
                        $job->expires_at = $job->finished_at ?? now();
                    }
                    $job->save();
                    $expiredCount++;
                }
            });

        return [$expiredCount, $deletedFileCount];
    }
}
