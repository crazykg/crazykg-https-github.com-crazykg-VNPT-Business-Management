<?php

namespace App\Services\V5\ProjectProcedure;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureAttachmentService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access
    ) {}

    public function stepAttachments(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $rows = DB::table('attachments')
            ->where('reference_type', 'PROCEDURE_STEP')
            ->where('reference_id', $step->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function (object $a): array {
                $creatorName = null;
                if (($a->created_by ?? null) !== null) {
                    $u = DB::table('internal_users')->where('id', $a->created_by)->first();
                    $creatorName = $u ? trim(($u->last_name ?? '').' '.($u->first_name ?? '')) : null;
                }

                return [
                    'id'                => $a->id,
                    'fileName'          => $a->file_name,
                    'fileUrl'           => $a->file_url,
                    'fileSize'          => $a->file_size,
                    'mimeType'          => $a->mime_type,
                    'driveFileId'       => $a->drive_file_id ?? null,
                    'storageDisk'       => $a->storage_disk ?? null,
                    'storagePath'       => $a->storage_path ?? null,
                    'storageVisibility' => $a->storage_visibility ?? null,
                    'createdAt'         => $a->created_at,
                    'createdBy'         => $a->created_by,
                    'createdByName'     => $creatorName,
                ];
            });

        return response()->json(['data' => $rows]);
    }

    public function linkStepAttachment(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $validated = Validator::make($request->all(), [
            'fileName'          => ['required', 'string', 'max:500'],
            'fileUrl'           => ['required', 'string', 'max:2048'],
            'fileSize'          => ['nullable', 'integer'],
            'mimeType'          => ['nullable', 'string', 'max:100'],
            'driveFileId'       => ['nullable', 'string', 'max:255'],
            'storageDisk'       => ['nullable', 'string', 'max:50'],
            'storagePath'       => ['nullable', 'string', 'max:1024'],
            'storageVisibility' => ['nullable', 'string', 'max:20'],
        ])->validate();

        $userId = $request->user()?->id;

        $id = DB::table('attachments')->insertGetId([
            'reference_type'     => 'PROCEDURE_STEP',
            'reference_id'       => $step->id,
            'file_name'          => $validated['fileName'],
            'file_url'           => $validated['fileUrl'],
            'file_size'          => $validated['fileSize'] ?? 0,
            'mime_type'          => $validated['mimeType'] ?? null,
            'drive_file_id'      => $validated['driveFileId'] ?? null,
            'storage_disk'       => $validated['storageDisk'] ?? null,
            'storage_path'       => $validated['storagePath'] ?? null,
            'storage_visibility' => $validated['storageVisibility'] ?? null,
            'is_primary'         => 0,
            'created_by'         => $userId,
            'updated_by'         => $userId,
            'created_at'         => DB::raw('NOW()'),
            'updated_at'         => DB::raw('NOW()'),
        ]);

        return response()->json([
            'data' => [
                'id'        => $id,
                'fileName'  => $validated['fileName'],
                'fileUrl'   => $validated['fileUrl'],
                'fileSize'  => $validated['fileSize'] ?? 0,
                'mimeType'  => $validated['mimeType'] ?? null,
                'createdAt' => now()->toDateTimeString(),
                'createdBy' => $userId,
            ],
        ], 201);
    }

    public function deleteStepAttachment(Request $request, int $stepId, int $attachmentId): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $deleted = DB::table('attachments')
            ->where('id', $attachmentId)
            ->where('reference_type', 'PROCEDURE_STEP')
            ->where('reference_id', $step->id)
            ->delete();

        if (! $deleted) {
            return response()->json(['message' => 'File đính kèm không tồn tại.'], 404);
        }

        return response()->json(['message' => 'File đã xóa.']);
    }
}
