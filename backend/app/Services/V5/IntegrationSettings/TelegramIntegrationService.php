<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class TelegramIntegrationService
{
    private const PROVIDER = 'TELEGRAM';

    private const POLLING_OFFSET_CACHE_KEY = 'telegram:polling:last_update_id';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function settings(): JsonResponse
    {
        if (! $this->hasTelegramColumns()) {
            return response()->json([
                'message' => 'Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.',
                'errors' => [
                    'telegram' => ['Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.'],
                ],
            ], 422);
        }

        $settingsRow = $this->loadSettingsRow();
        $decodedToken = $this->decodeBotToken($settingsRow['telegram_bot_token_encrypted'] ?? null);

        return response()->json([
            'data' => [
                'provider' => self::PROVIDER,
                'enabled' => (bool) ($settingsRow['telegram_enabled'] ?? false),
                'bot_username' => $this->support->normalizeNullableString($settingsRow['telegram_bot_username'] ?? null),
                'has_bot_token' => $decodedToken !== null,
                'token_preview' => $this->maskToken($decodedToken),
                'last_test_status' => $this->support->normalizeNullableString($settingsRow['telegram_last_test_status'] ?? null),
                'last_test_message' => $this->support->normalizeNullableString($settingsRow['telegram_last_test_message'] ?? null),
                'last_test_at' => $settingsRow['telegram_last_test_at'] ?? null,
                'updated_at' => $settingsRow['updated_at'] ?? null,
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa tồn tại. Vui lòng chạy migration trước.',
            ], 422);
        }

        if (! $this->hasTelegramColumns()) {
            return response()->json([
                'message' => 'Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.',
                'errors' => [
                    'telegram' => ['Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.'],
                ],
            ], 422);
        }

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'bot_username' => ['nullable', 'string', 'max:255'],
            'bot_token' => ['nullable', 'string', 'max:500'],
            'clear_bot_token' => ['nullable', 'boolean'],
        ]);

        $existing = $this->loadSettingsRow();
        $enabled = (bool) ($validated['enabled'] ?? false);
        $botUsername = $this->support->normalizeNullableString($validated['bot_username'] ?? null);
        $botToken = $this->support->normalizeNullableString($validated['bot_token'] ?? null);
        $clearBotToken = (bool) ($validated['clear_bot_token'] ?? false);
        $hasStoredToken = ! empty($existing['telegram_bot_token_encrypted'] ?? null);
        $willHaveToken = $botToken !== null || (! $clearBotToken && $hasStoredToken);

        if ($enabled && $botUsername === null) {
            return response()->json([
                'message' => 'Bot username là bắt buộc khi bật Telegram.',
                'errors' => [
                    'bot_username' => ['Bot username là bắt buộc khi bật Telegram.'],
                ],
            ], 422);
        }

        if ($enabled && ! $willHaveToken) {
            return response()->json([
                'message' => 'Bot token là bắt buộc khi bật Telegram.',
                'errors' => [
                    'bot_token' => ['Bot token là bắt buộc khi bật Telegram.'],
                ],
            ], 422);
        }

        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => $enabled,
            'telegram_enabled' => $enabled,
            'telegram_bot_username' => $botUsername,
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        if ($clearBotToken) {
            $payload['telegram_bot_token_encrypted'] = null;
        } elseif ($botToken !== null) {
            $payload['telegram_bot_token_encrypted'] = Crypt::encryptString($botToken);
        }

        $configurationChanged = $existing === null
            || (bool) ($existing['telegram_enabled'] ?? false) !== $enabled
            || $this->support->normalizeNullableString($existing['telegram_bot_username'] ?? null) !== $botUsername
            || $clearBotToken
            || $botToken !== null;

        if ($configurationChanged) {
            $payload['telegram_last_test_status'] = null;
            $payload['telegram_last_test_message'] = 'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.';
            $payload['telegram_last_test_at'] = null;
        }

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', $payload)
        );

        return $this->settings();
    }

    public function testSettings(Request $request): JsonResponse
    {
        if (! $this->hasTelegramColumns()) {
            return response()->json([
                'message' => 'Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.',
                'errors' => [
                    'telegram' => ['Cấu hình Telegram chưa sẵn sàng. Vui lòng chạy migration Telegram trước.'],
                ],
            ], 422);
        }

        $validated = $request->validate([
            'bot_token' => ['nullable', 'string', 'max:500'],
        ]);

        $settingsRow = $this->loadSettingsRow();
        $runtimeToken = $this->resolveRuntimeToken($validated['bot_token'] ?? null, $settingsRow);

        if ($runtimeToken === null) {
            $message = 'Chưa có bot token để kiểm tra. Vui lòng nhập token và bấm Lưu.';
            $this->saveTestResult('FAILED', $message);

            return response()->json([
                'message' => $message,
                'status' => 'FAILED',
                'tested_at' => now()->toIso8601String(),
            ], 422);
        }

        try {
            $response = Http::acceptJson()
                ->timeout(20)
                ->get(sprintf('https://api.telegram.org/bot%s/getMe', $runtimeToken));
        } catch (Throwable $exception) {
            $message = $this->normalizeTestMessage($exception->getMessage(), 'Không thể kết nối Telegram Bot API.');
            $this->saveTestResult('FAILED', $message);

            return response()->json([
                'message' => $message,
                'status' => 'FAILED',
                'tested_at' => now()->toIso8601String(),
            ], 422);
        }

        $responsePayload = $response->json();
        if (! $response->successful()) {
            $description = is_array($responsePayload) ? ($responsePayload['description'] ?? null) : null;
            $message = $this->normalizeTestMessage($description, 'Kết nối Telegram thất bại.');
            $this->saveTestResult('FAILED', $message);

            return response()->json([
                'message' => $message,
                'status' => 'FAILED',
                'tested_at' => now()->toIso8601String(),
            ], 422);
        }

        if (! is_array($responsePayload) || ! (bool) ($responsePayload['ok'] ?? false)) {
            $description = is_array($responsePayload) ? ($responsePayload['description'] ?? null) : null;
            $message = $this->normalizeTestMessage($description, 'Telegram API trả về dữ liệu không hợp lệ.');
            $this->saveTestResult('FAILED', $message);

            return response()->json([
                'message' => $message,
                'status' => 'FAILED',
                'tested_at' => now()->toIso8601String(),
            ], 422);
        }

        $bot = is_array($responsePayload['result'] ?? null) ? $responsePayload['result'] : [];
        $botUsername = $this->support->normalizeNullableString($bot['username'] ?? null);
        $displayBot = $botUsername !== null
            ? '@'.$botUsername
            : ($this->support->normalizeNullableString($settingsRow['telegram_bot_username'] ?? null) ?? 'bot');

        $message = sprintf('Kết nối Telegram thành công (%s).', $displayBot);
        $this->saveTestResult('SUCCESS', $message);

        return response()->json([
            'data' => [
                'message' => $message,
                'status' => 'SUCCESS',
                'tested_at' => now()->toIso8601String(),
                'persisted' => true,
                'bot' => [
                    'id' => $bot['id'] ?? null,
                    'username' => $botUsername,
                    'first_name' => $this->support->normalizeNullableString($bot['first_name'] ?? null),
                    'is_bot' => (bool) ($bot['is_bot'] ?? false),
                ],
            ],
        ]);
    }

    public function webhook(Request $request): JsonResponse
    {
        if (! $this->hasTelegramColumns()) {
            return response()->json(['ok' => true]);
        }

        $settingsRow = $this->loadSettingsRow();
        if (! (bool) ($settingsRow['telegram_enabled'] ?? false)) {
            return response()->json(['ok' => true]);
        }

        $runtimeToken = $this->resolveRuntimeToken(null, $settingsRow);
        if ($runtimeToken === null) {
            return response()->json(['ok' => true]);
        }

        $this->processIncomingUpdate($request->all(), $runtimeToken);

        return response()->json(['ok' => true]);
    }

    /**
     * @return array{success:bool,message:string,sent_at:string|null}
     */
    public function sendMessageToChatId(string $chatId, string $text): array
    {
        if (! $this->hasTelegramColumns()) {
            return [
                'success' => false,
                'message' => 'Cấu hình Telegram chưa sẵn sàng.',
                'sent_at' => null,
            ];
        }

        $settingsRow = $this->loadSettingsRow();
        if (! (bool) ($settingsRow['telegram_enabled'] ?? false)) {
            return [
                'success' => false,
                'message' => 'Telegram đang tắt.',
                'sent_at' => null,
            ];
        }

        $runtimeToken = $this->resolveRuntimeToken(null, $settingsRow);
        if ($runtimeToken === null) {
            return [
                'success' => false,
                'message' => 'Chưa có bot token Telegram.',
                'sent_at' => null,
            ];
        }

        return $this->sendMessageWithToken($runtimeToken, $chatId, $text);
    }

    /**
     * @return array{success:bool,message:string,sent_at:string|null}
     */
    private function sendMessageWithToken(string $runtimeToken, string $chatIdValue, string $text): array
    {
        try {
            $response = Http::acceptJson()
                ->timeout(20)
                ->post(sprintf('https://api.telegram.org/bot%s/sendMessage', $runtimeToken), [
                    'chat_id' => $chatIdValue,
                    'text' => $text,
                ]);
        } catch (Throwable $exception) {
            return [
                'success' => false,
                'message' => $this->normalizeTestMessage($exception->getMessage(), 'Không thể gửi tin nhắn Telegram.'),
                'sent_at' => null,
            ];
        }

        $payload = $response->json();
        if (! $response->successful() || ! is_array($payload) || ! (bool) ($payload['ok'] ?? false)) {
            $description = is_array($payload) ? ($payload['description'] ?? null) : null;

            return [
                'success' => false,
                'message' => $this->normalizeTestMessage($description, 'Gửi Telegram thất bại.'),
                'sent_at' => null,
            ];
        }

        return [
            'success' => true,
            'message' => 'Đã gửi Telegram thành công.',
            'sent_at' => now()->toIso8601String(),
        ];
    }

    public function pollUpdates(int $limit = 25, int $timeoutSeconds = 0): array
    {
        if (! $this->hasTelegramColumns()) {
            return [
                'status' => 'SKIPPED',
                'reason' => 'telegram_columns_missing',
                'processed' => 0,
            ];
        }

        $settingsRow = $this->loadSettingsRow();
        if (! (bool) ($settingsRow['telegram_enabled'] ?? false)) {
            return [
                'status' => 'SKIPPED',
                'reason' => 'telegram_disabled',
                'processed' => 0,
            ];
        }

        $runtimeToken = $this->resolveRuntimeToken(null, $settingsRow);
        if ($runtimeToken === null) {
            return [
                'status' => 'SKIPPED',
                'reason' => 'missing_bot_token',
                'processed' => 0,
            ];
        }

        $offset = $this->readPollingOffset();

        try {
            $response = Http::acceptJson()
                ->timeout(max(20, $timeoutSeconds + 10))
                ->get(sprintf('https://api.telegram.org/bot%s/getUpdates', $runtimeToken), [
                    'offset' => $offset,
                    'timeout' => max(0, $timeoutSeconds),
                    'allowed_updates' => ['message'],
                    'limit' => max(1, min(100, $limit)),
                ]);
        } catch (Throwable $exception) {
            return [
                'status' => 'FAILED',
                'reason' => 'telegram_get_updates_exception',
                'processed' => 0,
                'message' => $this->normalizeTestMessage($exception->getMessage(), 'Không thể polling Telegram updates.'),
            ];
        }

        $payload = $response->json();
        if (! $response->successful() || ! is_array($payload) || ! (bool) ($payload['ok'] ?? false)) {
            $description = is_array($payload) ? ($payload['description'] ?? null) : null;

            return [
                'status' => 'FAILED',
                'reason' => 'telegram_get_updates_failed',
                'processed' => 0,
                'message' => $this->normalizeTestMessage($description, 'Telegram getUpdates thất bại.'),
            ];
        }

        $updates = is_array($payload['result'] ?? null) ? $payload['result'] : [];
        $processed = 0;
        $matchedStart = 0;
        $lastSeenUpdateId = null;

        foreach ($updates as $update) {
            if (! is_array($update)) {
                continue;
            }

            $updateId = $this->support->parseNullableInt($update['update_id'] ?? null);
            if ($updateId !== null) {
                $lastSeenUpdateId = $updateId;
            }

            $processed++;
            if ($this->processIncomingUpdate($update, $runtimeToken)) {
                $matchedStart++;
            }
        }

        if ($lastSeenUpdateId !== null) {
            $this->writePollingOffset($lastSeenUpdateId + 1);
        }

        return [
            'status' => 'OK',
            'reason' => 'polling_completed',
            'processed' => $processed,
            'start_commands' => $matchedStart,
            'next_offset' => $this->readPollingOffset(),
        ];
    }

    private function processIncomingUpdate(array $update, string $runtimeToken): bool
    {
        $message = is_array($update['message'] ?? null) ? $update['message'] : [];
        $text = $this->support->normalizeNullableString($message['text'] ?? null);
        if ($text === null || ! $this->isStartCommand($text)) {
            return false;
        }

        $chat = is_array($message['chat'] ?? null) ? $message['chat'] : [];
        $chatIdValue = $this->support->normalizeNullableString($chat['id'] ?? null);
        if ($chatIdValue === null) {
            return false;
        }

        $replyLines = [
            'Chat ID của bạn là: '.$chatIdValue,
            'Vui lòng gửi chat ID này cho quản trị viên để cập nhật vào phần mềm.',
        ];

        try {
            Http::acceptJson()
                ->timeout(20)
                ->post(sprintf('https://api.telegram.org/bot%s/sendMessage', $runtimeToken), [
                    'chat_id' => $chatIdValue,
                    'text' => implode("\n", $replyLines),
                ]);
        } catch (Throwable) {
            // Keep message processing resilient even if Telegram sendMessage fails.
        }

        return true;
    }

    private function readPollingOffset(): int
    {
        $value = $this->pollingOffsetStore()->get(self::POLLING_OFFSET_CACHE_KEY, 0);
        $offset = is_numeric($value) ? (int) $value : 0;

        return max(0, $offset);
    }

    private function writePollingOffset(int $offset): void
    {
        $this->pollingOffsetStore()->forever(self::POLLING_OFFSET_CACHE_KEY, max(0, $offset));
    }

    private function pollingOffsetStore(): \Illuminate\Contracts\Cache\Repository
    {
        $defaultStore = (string) config('cache.default', 'file');
        $resolvedStore = $defaultStore === 'array' ? 'file' : $defaultStore;

        return Cache::store($resolvedStore);
    }

    private function isStartCommand(string $text): bool
    {
        $normalized = strtolower(trim($text));

        return $normalized === '/start' || str_starts_with($normalized, '/start ');
    }

    private function resolveRuntimeToken(mixed $runtimeToken = null, ?array $settingsRow = null): ?string
    {
        $fromRequest = $this->support->normalizeNullableString($runtimeToken);
        if ($fromRequest !== null) {
            return $fromRequest;
        }

        $resolvedSettings = $settingsRow ?? $this->loadSettingsRow();

        return $this->decodeBotToken($resolvedSettings['telegram_bot_token_encrypted'] ?? null);
    }
    private function loadSettingsRow(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $row = DB::table('integration_settings')
            ->where('provider', self::PROVIDER)
            ->first();

        return $row ? (array) $row : null;
    }

    private function hasTelegramColumns(): bool
    {
        if (! $this->support->hasTable('integration_settings')) {
            return false;
        }

        foreach ([
            'telegram_enabled',
            'telegram_bot_username',
            'telegram_bot_token_encrypted',
            'telegram_last_test_status',
            'telegram_last_test_message',
            'telegram_last_test_at',
        ] as $column) {
            if (! $this->support->hasColumn('integration_settings', $column)) {
                return false;
            }
        }

        return true;
    }

    private function decodeBotToken(mixed $encryptedToken): ?string
    {
        $raw = $this->support->normalizeNullableString($encryptedToken);
        if ($raw === null) {
            return null;
        }

        try {
            return $this->support->normalizeNullableString(Crypt::decryptString($raw));
        } catch (\Throwable) {
            return $raw;
        }
    }

    private function maskToken(?string $token): ?string
    {
        if ($token === null) {
            return null;
        }

        $length = strlen($token);
        if ($length <= 8) {
            return str_repeat('*', $length);
        }

        return sprintf('%s%s%s', substr($token, 0, 4), str_repeat('*', max(4, $length - 8)), substr($token, -4));
    }

    private function saveTestResult(string $status, string $message): void
    {
        if (! $this->support->hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', [
                'telegram_last_test_status' => strtoupper(trim($status)),
                'telegram_last_test_message' => $this->normalizeTestMessage($message, ''),
                'telegram_last_test_at' => now(),
                'updated_at' => now(),
            ])
        );
    }

    private function normalizeTestMessage(mixed $message, string $fallback): string
    {
        $normalized = trim((string) $message);
        if ($normalized === '') {
            $normalized = $fallback;
        }

        return Str::limit($normalized, 500, '...');
    }
}
