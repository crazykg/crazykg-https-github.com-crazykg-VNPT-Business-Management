<?php

namespace App\Jobs;

use App\Models\AsyncExport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class GenerateAsyncExportJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    private const RETENTION_HOURS = 24;

    public function __construct(
        private readonly int $exportId
    ) {}

    public function handle(): void
    {
        $export = AsyncExport::query()->find($this->exportId);
        if (! $export instanceof AsyncExport) {
            return;
        }

        if (! in_array((string) $export->status, [AsyncExport::STATUS_QUEUED, AsyncExport::STATUS_PROCESSING], true)) {
            return;
        }

        $export->status = AsyncExport::STATUS_PROCESSING;
        $export->error_message = null;
        $export->started_at = now();
        $export->save();

        try {
            [$relativePath, $fileName] = $this->generateCsv($export);

            $export->status = AsyncExport::STATUS_DONE;
            $export->file_path = $relativePath;
            $export->file_name = $fileName;
            $export->finished_at = now();
            $export->expires_at = now()->addHours(self::RETENTION_HOURS);
            $export->error_message = null;
            $export->save();
        } catch (\Throwable $exception) {
            $export->status = AsyncExport::STATUS_FAILED;
            $export->finished_at = now();
            $export->error_message = Str::limit($exception->getMessage(), 2000, '...');
            $export->save();

            throw $exception;
        }
    }

    /**
     * @return array{0:string,1:string}
     */
    private function generateCsv(AsyncExport $export): array
    {
        throw new \RuntimeException(sprintf(
            'Async export module "%s" is no longer supported.',
            trim((string) $export->module)
        ));
    }
}
