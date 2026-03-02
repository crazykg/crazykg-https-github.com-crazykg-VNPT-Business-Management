<?php

namespace App\Jobs;

use App\Http\Controllers\Api\V5MasterDataController;
use App\Http\Controllers\ProgrammingRequestController;
use App\Models\AsyncExport;
use App\Models\InternalUser;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Request;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
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
        $module = trim((string) $export->module);
        if (! in_array($module, ['support_requests', 'programming_requests'], true)) {
            throw new \RuntimeException('Unsupported async export module.');
        }

        $time = now();
        $baseName = sprintf('%s_%s_%s.csv', $module, $time->format('Ymd_His'), $export->uuid);
        $relativeDirectory = sprintf('exports/%s/%s', $module, $time->format('Y/m/d'));
        $relativePath = $relativeDirectory.'/'.$baseName;

        $disk = Storage::disk('local');
        $disk->makeDirectory($relativeDirectory);
        $absolutePath = $disk->path($relativePath);
        $output = fopen($absolutePath, 'wb');
        if (! is_resource($output)) {
            throw new \RuntimeException('Cannot create export file.');
        }

        try {
            fwrite($output, "\xEF\xBB\xBF");
            if ($module === 'support_requests') {
                $this->writeSupportRequestsCsv($export, $output);
            } else {
                $this->writeProgrammingRequestsCsv($export, $output);
            }
        } finally {
            fclose($output);
        }

        return [$relativePath, $baseName];
    }

    /**
     * @param resource $output
     */
    private function writeSupportRequestsCsv(AsyncExport $export, $output): void
    {
        $controller = app(V5MasterDataController::class);
        $query = $this->resolveFilterQuery($export);
        $user = $this->resolveRequestedUser($export);

        fputcsv($output, [
            'Nội dung yêu cầu',
            'Mã yêu cầu',
            'Khách hàng',
            'Nhóm Zalo/Telegram yêu cầu',
            'Người xử lý',
            'Người tiếp nhận',
            'Trạng thái',
            'Mức ưu tiên',
            'Ngày nhận yêu cầu',
            'Hạn xử lý',
            'Ghi chú',
        ]);

        $page = 1;
        $perPage = 100;
        while (true) {
            $pageRequest = Request::create('/api/v5/support-requests', 'GET', array_merge($query, [
                'page' => $page,
                'per_page' => $perPage,
                'simple' => 1,
            ]));
            $pageRequest->setUserResolver(static fn () => $user);

            $response = $controller->supportRequests($pageRequest);
            $payload = $response->getData(true);
            $rows = is_array($payload['data'] ?? null) ? $payload['data'] : [];
            if ($rows === []) {
                break;
            }

            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $requestCode = trim((string) ($row['request_code'] ?? $row['ticket_code'] ?? ''));
                $referenceRequestCode = trim((string) ($row['reference_request_code'] ?? $row['reference_ticket_code'] ?? ''));
                $requestCodeSummary = sprintf(
                    'YC: %s | YCTC: %s',
                    $requestCode !== '' ? $requestCode : '--',
                    $referenceRequestCode !== '' ? $referenceRequestCode : '--'
                );

                fputcsv($output, [
                    (string) ($row['summary'] ?? ''),
                    $requestCodeSummary,
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['service_group_name'] ?? ''),
                    (string) ($row['assignee_name'] ?? ''),
                    (string) ($row['receiver_name'] ?? ''),
                    (string) ($row['status'] ?? ''),
                    (string) ($row['priority'] ?? ''),
                    (string) ($row['requested_date'] ?? ''),
                    (string) ($row['due_date'] ?? ''),
                    (string) ($row['notes'] ?? ''),
                ]);
            }

            if (count($rows) < $perPage) {
                break;
            }
            $page++;
        }
    }

    /**
     * @param resource $output
     */
    private function writeProgrammingRequestsCsv(AsyncExport $export, $output): void
    {
        $controller = app(ProgrammingRequestController::class);
        $query = $this->resolveFilterQuery($export);
        $user = $this->resolveRequestedUser($export);

        fputcsv($output, [
            'Mã YC',
            'Tên YC',
            'Sản phẩm',
            'Khách hàng',
            'Loại',
            'Trạng thái',
            'Tiến độ (%)',
            'Hạn phân tích',
            'Hạn code',
            'Ngày TBKH',
            'Dev',
            'Ngày nhận yêu cầu',
        ]);

        $page = 1;
        $perPage = 100;
        while (true) {
            $pageRequest = Request::create('/api/v5/programming-requests', 'GET', array_merge($query, [
                'page' => $page,
                'per_page' => $perPage,
            ]));
            $pageRequest->setUserResolver(static fn () => $user);

            $response = $controller->index($pageRequest);
            $payload = $response->getData(true);
            $rows = is_array($payload['data'] ?? null) ? $payload['data'] : [];
            if ($rows === []) {
                break;
            }

            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                fputcsv($output, [
                    (string) ($row['req_code'] ?? ''),
                    (string) ($row['req_name'] ?? ''),
                    (string) ($row['product_name'] ?? ''),
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['req_type'] ?? ''),
                    (string) ($row['status'] ?? ''),
                    (string) ($row['overall_progress'] ?? ''),
                    (string) ($row['analyze_end_date'] ?? ''),
                    (string) ($row['code_end_date'] ?? ''),
                    (string) ($row['noti_date'] ?? ''),
                    (string) ($row['coder_name'] ?? ''),
                    (string) ($row['requested_date'] ?? ''),
                ]);
            }

            if (count($rows) < $perPage) {
                break;
            }
            $page++;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveFilterQuery(AsyncExport $export): array
    {
        $filters = json_decode((string) ($export->filters_json ?? ''), true);
        if (! is_array($filters)) {
            return [];
        }

        unset($filters['page'], $filters['per_page'], $filters['simple']);

        return $filters;
    }

    private function resolveRequestedUser(AsyncExport $export): InternalUser
    {
        $userId = (int) ($export->requested_by ?? 0);
        $user = InternalUser::query()->find($userId);
        if (! $user instanceof InternalUser) {
            throw new \RuntimeException('Requested user is not available for export.');
        }

        return $user;
    }
}
