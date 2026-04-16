<?php

namespace App\Services\V5\Document;

use App\Services\V5\IntegrationSettings\BackblazeB2IntegrationService;
use App\Services\V5\IntegrationSettings\GoogleDriveIntegrationService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class DocumentAttachmentService
{
    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;
    private const BACKBLAZE_B2_STORAGE_DISK = 'backblaze_b2';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly BackblazeB2IntegrationService $backblaze,
        private readonly GoogleDriveIntegrationService $googleDrive,
    ) {}

    public function uploadAttachment(Request $request): JsonResponse
    {
        // Debug logging
        $uploadedFile = $request->file('file');
        \Log::channel('daily')->info('[DocumentAttachment] Upload request received', [
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'content_length' => $request->header('Content-Length'),
            'has_file' => $request->hasFile('file'),
            'file_exists' => $uploadedFile !== null,
            'file_error' => $uploadedFile?->getError(),
            'file_name' => $uploadedFile?->getClientOriginalName(),
            'file_size' => $uploadedFile?->getSize(),
            'file_mime' => $uploadedFile?->getMimeType(),
            'file_extension' => $uploadedFile?->getClientOriginalExtension(),
            'all_input' => $request->all(),
            'all_files' => array_keys($request->allFiles()),
        ]);

        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:20480',
                'mimes:pdf,doc,docx,xlsx,xls,txt,png,jpg,jpeg',
            ],
        ]);

        /** @var UploadedFile|null $file */
        $file = $validated['file'] ?? null;
        if (! $file instanceof UploadedFile) {
            return response()->json(['message' => 'File upload không hợp lệ.'], 422);
        }

        $allowedExtensions = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'txt', 'png', 'jpg', 'jpeg'];
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ($extension === '' || ! in_array($extension, $allowedExtensions, true)) {
            return response()->json([
                'message' => 'Định dạng file không được hỗ trợ.',
            ], 422);
        }

        try {
            $uploadResult = $this->uploadDocumentFileToStorage($file);
        } catch (\Throwable $exception) {
            Log::error('[DocumentAttachment] Upload failed', ['error' => $exception->getMessage()]);
            return response()->json([
                'message' => 'Tải file thất bại. Vui lòng thử lại hoặc liên hệ quản trị viên.',
            ], 500);
        }

        // Resolve actor ID from request (for created_by/updated_by)
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);

        // Get optional reference parameters from request
        $referenceType = $this->support->normalizeNullableString($request->input('reference_type')) ?? 'DOCUMENT';
        $referenceId = $this->support->parseNullableInt($request->input('reference_id')) ?? 0;

        // Insert into attachments table to persist file metadata
        if (! $this->support->hasTable('attachments')) {
            Log::error('[DocumentAttachment] attachments table not found');
            return response()->json([
                'message' => 'Không thể lưu thông tin file. Vui lòng liên hệ quản trị viên.',
            ], 500);
        }

        $attachmentId = DB::table('attachments')->insertGetId([
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'file_name' => (string) $uploadResult['fileName'],
            'file_url' => (string) $uploadResult['fileUrl'],
            'drive_file_id' => $uploadResult['driveFileId'] ?? null,
            'file_size' => (int) $uploadResult['fileSize'],
            'mime_type' => (string) $uploadResult['mimeType'],
            'storage_disk' => $uploadResult['storageDisk'] ?? null,
            'storage_path' => $uploadResult['storagePath'] ?? null,
            'storage_visibility' => $uploadResult['storageVisibility'] ?? 'private',
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'id' => $attachmentId,
                'fileName' => (string) $uploadResult['fileName'],
                'mimeType' => (string) $uploadResult['mimeType'],
                'fileSize' => (int) $uploadResult['fileSize'],
                'fileUrl' => (string) $uploadResult['fileUrl'],
                'driveFileId' => (string) ($uploadResult['driveFileId'] ?? ''),
                'createdAt' => now()->toDateString(),
                'storageProvider' => (string) ($uploadResult['storageProvider'] ?? 'LOCAL'),
                'storagePath' => $uploadResult['storagePath'] ?? null,
                'storageDisk' => $uploadResult['storageDisk'] ?? null,
                'storageVisibility' => $uploadResult['storageVisibility'] ?? null,
                'warningMessage' => $uploadResult['warningMessage'] ?? null,
            ],
        ]);
    }

    public function deleteUploadedAttachment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'attachmentId' => ['nullable', 'integer'],
            'driveFileId' => ['nullable', 'string', 'max:255'],
            'fileUrl' => ['nullable', 'string'],
            'storagePath' => ['nullable', 'string', 'max:1024'],
            'storageDisk' => ['nullable', 'string', 'max:50'],
        ]);

        $attachmentId = $this->support->parseNullableInt($validated['attachmentId'] ?? null);
        $driveFileId = $this->support->normalizeNullableString($validated['driveFileId'] ?? null);
        $fileUrl = $this->support->normalizeNullableString($validated['fileUrl'] ?? null);
        $storagePath = $this->support->normalizeNullableString($validated['storagePath'] ?? null);
        $storageDisk = $this->support->normalizeNullableString($validated['storageDisk'] ?? null);

        if ($attachmentId !== null && $this->support->hasTable('attachments')) {
            $attachmentRecord = DB::table('attachments')->where('id', $attachmentId)->first();
            if ($attachmentRecord !== null) {
                $attachmentData = (array) $attachmentRecord;
                $driveFileId = $driveFileId ?? $this->support->normalizeNullableString($attachmentData['drive_file_id'] ?? null);
                $fileUrl = $fileUrl ?? $this->support->normalizeNullableString($attachmentData['file_url'] ?? null);
                $storagePath = $storagePath ?? $this->support->normalizeNullableString($attachmentData['storage_path'] ?? null);
                $storageDisk = $storageDisk ?? $this->support->normalizeNullableString($attachmentData['storage_disk'] ?? null);
            }
        }

        if ($driveFileId !== null && $this->googleDrive->isConfigured()) {
            try {
                $this->googleDrive->deleteFile($driveFileId);
            } catch (\Throwable $exception) {
                Log::error('[DocumentAttachment] Google Drive delete failed', ['error' => $exception->getMessage(), 'driveFileId' => $driveFileId]);
                return response()->json([
                    'message' => 'Không thể xóa file trên Google Drive. Vui lòng thử lại.',
                ], 500);
            }
        }

        if ($storagePath !== null && $storageDisk === self::BACKBLAZE_B2_STORAGE_DISK) {
            try {
                $this->backblaze->deleteFileByStoragePath($storagePath);
            } catch (\Throwable $exception) {
                Log::error('[DocumentAttachment] Backblaze B2 delete failed', ['error' => $exception->getMessage(), 'storagePath' => $storagePath]);
                return response()->json([
                    'message' => 'Không thể xóa file trên bộ nhớ đám mây. Vui lòng thử lại.',
                ], 500);
            }
        } elseif ($storagePath !== null) {
            $this->deleteLocalDocumentFileByStoragePath($storagePath, $storageDisk ?? 'local');
        }

        if ($fileUrl !== null && $storageDisk !== self::BACKBLAZE_B2_STORAGE_DISK) {
            $this->deleteLocalDocumentFileByUrl($fileUrl);
        }

        return response()->json(['message' => 'Đã xóa file đính kèm.']);
    }

    public function downloadDocumentAttachment(Request $request, int $id): Response
    {
        $attachment = $this->findAttachmentDownloadRow($id, 'DOCUMENT');
        if ($attachment instanceof Response) {
            return $attachment;
        }

        return $this->downloadAttachmentResponse($attachment);
    }

    public function downloadAttachment(Request $request, int $id): Response
    {
        $attachment = $this->findAttachmentDownloadRow($id);
        if ($attachment instanceof Response) {
            return $attachment;
        }

        return $this->downloadAttachmentResponse($attachment);
    }

    public function downloadTemporaryAttachment(Request $request): Response
    {
        $disk = trim((string) $request->query('disk', 'local'));
        $path = trim((string) $request->query('path', ''));
        $name = trim((string) $request->query('name', 'attachment'));

        if ($path === '') {
            return response()->json(['message' => 'Invalid attachment path.'], 422);
        }

        if ($disk === self::BACKBLAZE_B2_STORAGE_DISK) {
            return $this->backblaze->downloadAttachmentResponse($path, $name);
        }

        if (! Storage::disk($disk)->exists($path)) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return Storage::disk($disk)->download($path, $name);
    }

    /**
     * @param array<int, int> $documentIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function loadDocumentAttachmentMap(array $documentIds): array
    {
        if (
            $documentIds === []
            || ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $query = DB::table('attachments')
            ->select($this->support->selectColumns('attachments', [
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ]))
            ->where('reference_type', 'DOCUMENT')
            ->whereIn('reference_id', $documentIds)
            ->when($this->support->hasColumn('attachments', 'deleted_at'), fn ($builder) => $builder->whereNull('deleted_at'));

        if ($this->support->hasColumn('attachments', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }

            $map[$referenceId][] = [
                'id' => (string) ($row['id'] ?? ''),
                'fileName' => (string) ($row['file_name'] ?? ''),
                'mimeType' => (string) ($this->support->firstNonEmpty($row, ['mime_type'], 'application/octet-stream')),
                'fileSize' => (int) ($row['file_size'] ?? 0),
                'fileUrl' => $this->resolveAttachmentFileUrl($row),
                'driveFileId' => (string) ($row['drive_file_id'] ?? ''),
                'createdAt' => $this->formatDateColumn($row['created_at'] ?? null) ?? '',
                'storagePath' => $this->support->normalizeNullableString($row['storage_path'] ?? null),
                'storageDisk' => $this->support->normalizeNullableString($row['storage_disk'] ?? null),
                'storageVisibility' => $this->support->normalizeNullableString($row['storage_visibility'] ?? null),
                'storageProvider' => $this->support->normalizeNullableString($row['drive_file_id'] ?? null) !== null
                    ? 'GOOGLE_DRIVE'
                    : (($this->support->normalizeNullableString($row['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
            ];
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    public function syncDocumentAttachments(int $documentId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'DOCUMENT')
            ->where('reference_id', $documentId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) $this->support->firstNonEmpty($item, ['fileName', 'file_name'], ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->support->parseNullableInt($this->support->firstNonEmpty($item, ['fileSize', 'file_size'], 0)) ?? 0;
            $storagePath = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storagePath', 'storage_path']));
            $storageDisk = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageDisk', 'storage_disk']));
            $storageVisibility = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageVisibility', 'storage_visibility']));
            $payload = $this->support->filterPayloadByTableColumns('attachments', [
                'reference_type' => 'DOCUMENT',
                'reference_id' => $documentId,
                'file_name' => $fileName,
                'file_url' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['fileUrl', 'file_url'])),
                'drive_file_id' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['driveFileId', 'drive_file_id'])),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['mimeType', 'mime_type'])),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @return array{
     *     fileName:string,
     *     mimeType:string,
     *     fileSize:int,
     *     fileUrl:string,
     *     driveFileId:?string,
     *     storageProvider:string,
     *     storagePath:?string,
     *     storageDisk:?string,
     *     storageVisibility:?string,
     *     warningMessage:?string
     * }
     */
    private function uploadDocumentFileToStorage(UploadedFile $file): array
    {
        $warnings = [];

        if ($this->backblaze->isConfigured()) {
            $backblazeResult = $this->backblaze->uploadFile($file);
            if ((bool) ($backblazeResult['success'] ?? false)) {
                $storagePath = $backblazeResult['storagePath'] ?? null;
                $storageDisk = (string) ($backblazeResult['storageDisk'] ?? self::BACKBLAZE_B2_STORAGE_DISK);

                return [
                    'fileName' => $file->getClientOriginalName(),
                    'mimeType' => $file->getClientMimeType() ?: 'application/octet-stream',
                    'fileSize' => (int) $file->getSize(),
                    'fileUrl' => $storagePath !== null
                        ? $this->buildSignedTempAttachmentDownloadUrl($storageDisk, $storagePath, $file->getClientOriginalName())
                        : '',
                    'driveFileId' => null,
                    'storageProvider' => 'BACKBLAZE_B2',
                    'storagePath' => $storagePath,
                    'storageDisk' => $storageDisk,
                    'storageVisibility' => 'private',
                    'warningMessage' => null,
                ];
            }

            $backblazeWarning = $this->support->normalizeNullableString($backblazeResult['errorMessage'] ?? null);
            if ($backblazeWarning !== null) {
                $warnings[] = 'Backblaze B2: '.$backblazeWarning;
            }
        }

        $storedPath = $file->store('documents', 'local');
        $warningMessage = $warnings !== []
            ? implode(' ', $warnings).' File đã được lưu tạm trên máy chủ nội bộ.'
            : null;

        return [
            'fileName' => $file->getClientOriginalName(),
            'mimeType' => $file->getClientMimeType() ?: 'application/octet-stream',
            'fileSize' => (int) $file->getSize(),
            'fileUrl' => $this->buildSignedTempAttachmentDownloadUrl('local', $storedPath, $file->getClientOriginalName()),
            'driveFileId' => null,
            'storageProvider' => 'LOCAL',
            'storagePath' => $storedPath,
            'storageDisk' => 'local',
            'storageVisibility' => 'private',
            'warningMessage' => $warningMessage,
        ];
    }

    /**
     * @return array<string, mixed>|Response
     */
    private function findAttachmentDownloadRow(int $id, ?string $referenceType = null): array|Response
    {
        if (! $this->support->hasTable('attachments')) {
            return $this->support->missingTable('attachments');
        }

        $attachment = DB::table('attachments')
            ->select($this->support->selectColumns('attachments', [
                'id',
                'reference_type',
                'file_name',
                'file_url',
                'drive_file_id',
                'storage_disk',
                'storage_path',
                'storage_visibility',
            ]))
            ->where('id', $id)
            ->when(
                $referenceType !== null && $this->support->hasColumn('attachments', 'reference_type'),
                fn ($builder) => $builder->where('reference_type', $referenceType)
            )
            ->first();

        if ($attachment === null) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return (array) $attachment;
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function downloadAttachmentResponse(array $attachment): Response
    {
        $storagePath = $this->support->normalizeNullableString($attachment['storage_path'] ?? null);
        $storageDisk = $this->support->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->support->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';

        if ($storagePath !== null && $storageDisk === self::BACKBLAZE_B2_STORAGE_DISK) {
            return $this->backblaze->downloadAttachmentResponse($storagePath, $fileName);
        }

        if ($storagePath !== null && Storage::disk($storageDisk)->exists($storagePath)) {
            return Storage::disk($storageDisk)->download($storagePath, $fileName);
        }

        $fileUrl = $this->support->normalizeNullableString($attachment['file_url'] ?? null);
        if ($fileUrl !== null) {
            return redirect()->away($fileUrl);
        }

        return response()->json(['message' => 'Attachment file is unavailable.'], 404);
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function resolveAttachmentFileUrl(array $attachment): string
    {
        $storedPath = $this->support->normalizeNullableString($attachment['storage_path'] ?? null);
        $storedDisk = $this->support->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->support->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';
        $attachmentId = $this->support->parseNullableInt($attachment['id'] ?? null);

        if ($storedPath !== null) {
            if ($attachmentId !== null) {
                $signedUrl = $this->buildSignedAttachmentDownloadUrl($attachmentId);
                if ($signedUrl !== '') {
                    return $signedUrl;
                }
            }

            $temporaryUrl = $this->buildSignedTempAttachmentDownloadUrl($storedDisk, $storedPath, $fileName);
            if ($temporaryUrl !== '') {
                return $temporaryUrl;
            }
        }

        return (string) ($attachment['file_url'] ?? '');
    }

    private function buildSignedAttachmentDownloadUrl(int $attachmentId): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                ['id' => $attachmentId],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function buildSignedTempAttachmentDownloadUrl(string $disk, string $path, string $name): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.temp-download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                [
                    'disk' => $disk,
                    'path' => $path,
                    'name' => $name,
                ],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function deleteLocalDocumentFileByUrl(string $fileUrl): void
    {
        $parsedQuery = parse_url($fileUrl, PHP_URL_QUERY);
        if (is_string($parsedQuery) && $parsedQuery !== '') {
            parse_str($parsedQuery, $queryParams);
            $pathFromQuery = isset($queryParams['path']) ? trim((string) $queryParams['path']) : '';
            if ($pathFromQuery !== '') {
                $diskFromQuery = isset($queryParams['disk']) ? trim((string) $queryParams['disk']) : 'local';
                $this->deleteLocalDocumentFileByStoragePath($pathFromQuery, $diskFromQuery !== '' ? $diskFromQuery : 'local');

                return;
            }
        }
    }

    private function deleteLocalDocumentFileByStoragePath(string $storagePath, string $storageDisk = 'local'): void
    {
        $path = trim($storagePath);
        if ($path === '') {
            return;
        }

        // Path traversal guard — reject any path that tries to escape the disk root
        $path = $this->sanitizeStoragePath($path);
        if ($path === '') {
            Log::warning('[DocumentAttachment] Rejected suspicious storagePath', ['raw' => $storagePath]);

            return;
        }

        $disk = trim($storageDisk) !== '' ? trim($storageDisk) : 'local';
        if ($disk === self::BACKBLAZE_B2_STORAGE_DISK) {
            $this->backblaze->deleteFileByStoragePath($path);

            return;
        }

        if (! Storage::disk($disk)->exists($path)) {
            return;
        }

        Storage::disk($disk)->delete($path);
    }

    /**
     * Sanitize a storage-relative path, rejecting traversal attempts.
     *
     * - Strips null bytes
     * - Rejects absolute paths (Unix or Windows)
     * - Rejects paths containing ".." segments
     * - Normalizes directory separators
     *
     * Returns empty string if the path is rejected.
     */
    private function sanitizeStoragePath(string $path): string
    {
        // Null-byte injection
        $path = str_replace("\0", '', $path);

        // Reject absolute paths (Unix /… or Windows C:\…)
        if (str_starts_with($path, '/') || preg_match('/^[A-Za-z]:/i', $path) === 1) {
            return '';
        }

        // Normalize separators
        $normalized = str_replace(['\\', '//'], '/', $path);

        // Reject any traversal component
        foreach (explode('/', $normalized) as $segment) {
            if ($segment === '..') {
                return '';
            }
        }

        return $normalized;
    }

    private function formatDateColumn(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $text, $matches) === 1) {
            return $matches[0];
        }

        return $text;
    }

    /**
     * Cập nhật reference_type và reference_id cho attachment
     * Dùng để link attachment vào customer request/procedure/etc sau khi upload
     */
    public function updateAttachmentReference(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('attachments')) {
            return response()->json(['message' => 'Table attachments không tồn tại.'], 500);
        }

        $validated = $request->validate([
            'reference_type' => ['required', 'string', 'max:50'],
            'reference_id' => ['required', 'integer', 'min:1'],
        ]);

        $attachment = DB::table('attachments')->where('id', $id)->first();
        if ($attachment === null) {
            return response()->json(['message' => 'Attachment không tồn tại.'], 404);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);

        DB::table('attachments')
            ->where('id', $id)
            ->update($this->support->filterPayloadByTableColumns('attachments', [
                'reference_type' => $validated['reference_type'],
                'reference_id' => $validated['reference_id'],
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]));

        return response()->json(['message' => 'Đã cập nhật liên kết file đính kèm.']);
    }
}
