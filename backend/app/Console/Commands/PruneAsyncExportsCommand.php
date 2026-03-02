<?php

namespace App\Console\Commands;

use App\Models\AsyncExport;
use Illuminate\Console\Command;
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

        $expiredJobs = AsyncExport::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->where('status', '!=', AsyncExport::STATUS_EXPIRED)
            ->get();

        $legacyJobs = AsyncExport::query()
            ->whereNull('expires_at')
            ->whereNotNull('finished_at')
            ->where('finished_at', '<=', $threshold)
            ->whereIn('status', [AsyncExport::STATUS_DONE, AsyncExport::STATUS_FAILED])
            ->get();

        $jobs = $expiredJobs->concat($legacyJobs)->unique('id')->values();

        $deletedFileCount = 0;
        $expiredCount = 0;

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

        $this->info("Pruned async exports: {$expiredCount} jobs, {$deletedFileCount} files.");

        return self::SUCCESS;
    }
}
