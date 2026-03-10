<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Controllers\Controller;
use App\Models\AsyncExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AsyncExportController extends Controller
{
    public function show(Request $request, string $uuid): JsonResponse
    {
        $export = $this->resolveExportByUuid($uuid);
        if (! $export instanceof AsyncExport) {
            return response()->json(['message' => 'Export job not found.'], 404);
        }
        if (! $this->canAccessExport($request, $export)) {
            return response()->json(['message' => 'Bạn không có quyền truy cập export này.'], 403);
        }

        return response()->json([
            'data' => $this->serializeExport($export),
        ]);
    }

    public function download(Request $request, string $uuid): BinaryFileResponse|JsonResponse
    {
        $export = $this->resolveExportByUuid($uuid);
        if (! $export instanceof AsyncExport) {
            return response()->json(['message' => 'Export job not found.'], 404);
        }
        if (! $this->canAccessExport($request, $export)) {
            return response()->json(['message' => 'Bạn không có quyền truy cập export này.'], 403);
        }

        if ($this->isExpired($export)) {
            $this->markExpired($export);

            return response()->json(['message' => 'Export file has expired.'], 410);
        }

        if ((string) $export->status !== AsyncExport::STATUS_DONE) {
            return response()->json(['message' => 'Export is not ready for download.'], 409);
        }

        $filePath = trim((string) ($export->file_path ?? ''));
        if ($filePath === '' || ! Storage::disk('local')->exists($filePath)) {
            return response()->json(['message' => 'Export file is not available.'], 404);
        }

        $fileName = trim((string) ($export->file_name ?? ''));
        if ($fileName === '') {
            $fileName = basename($filePath);
        }

        return Storage::disk('local')->download($filePath, $fileName);
    }

    private function resolveExportByUuid(string $uuid): ?AsyncExport
    {
        $normalizedUuid = trim($uuid);
        if ($normalizedUuid === '') {
            return null;
        }

        return AsyncExport::query()->where('uuid', $normalizedUuid)->first();
    }

    private function canAccessExport(Request $request, AsyncExport $job): bool
    {
        $actorId = $this->resolveActorId($request);

        return $actorId !== null && (int) $job->requested_by === $actorId;
    }

    private function resolveActorId(Request $request): ?int
    {
        $user = $request->user();
        $rawId = $user?->id;
        if (! is_numeric($rawId)) {
            return null;
        }

        return (int) $rawId;
    }

    private function isExpired(AsyncExport $export): bool
    {
        return $export->expires_at !== null && $export->expires_at->isPast();
    }

    private function markExpired(AsyncExport $export): void
    {
        if ((string) $export->status === AsyncExport::STATUS_EXPIRED) {
            return;
        }

        $export->status = AsyncExport::STATUS_EXPIRED;
        $export->save();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeExport(AsyncExport $job): array
    {
        $isDone = (string) $job->status === AsyncExport::STATUS_DONE;
        $isExpired = $this->isExpired($job) || (string) $job->status === AsyncExport::STATUS_EXPIRED;

        return [
            'uuid' => (string) $job->uuid,
            'module' => (string) $job->module,
            'format' => (string) $job->format,
            'status' => (string) $job->status,
            'file_name' => $job->file_name,
            'error_message' => $job->error_message,
            'started_at' => optional($job->started_at)?->toISOString(),
            'finished_at' => optional($job->finished_at)?->toISOString(),
            'expires_at' => optional($job->expires_at)?->toISOString(),
            'created_at' => optional($job->created_at)?->toISOString(),
            'updated_at' => optional($job->updated_at)?->toISOString(),
            'download_url' => $isDone && ! $isExpired ? "/api/v5/exports/{$job->uuid}/download" : null,
            'is_ready' => $isDone && ! $isExpired,
        ];
    }
}
