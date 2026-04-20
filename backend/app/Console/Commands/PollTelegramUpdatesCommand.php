<?php

namespace App\Console\Commands;

use App\Services\V5\IntegrationSettings\TelegramIntegrationService;
use Illuminate\Console\Command;

class PollTelegramUpdatesCommand extends Command
{
    protected $signature = 'telegram:poll-updates {--limit=25 : Max updates fetched in one run (1..100)} {--timeout=0 : Telegram long-poll timeout in seconds}';

    protected $description = 'Poll Telegram Bot API updates and auto-reply /start with chat ID.';

    public function __construct(
        private readonly TelegramIntegrationService $telegramService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $limit = max(1, min(100, (int) $this->option('limit')));
        $timeout = max(0, (int) $this->option('timeout'));

        $result = $this->telegramService->pollUpdates($limit, $timeout);
        $status = (string) ($result['status'] ?? 'UNKNOWN');

        if ($status === 'FAILED') {
            $message = (string) ($result['message'] ?? 'Telegram polling failed.');
            $reason = (string) ($result['reason'] ?? 'unknown');

            $this->error(sprintf('Telegram poll FAILED (%s): %s', $reason, $message));

            return self::FAILURE;
        }

        if ($status === 'SKIPPED') {
            $reason = (string) ($result['reason'] ?? 'skipped');
            $this->line(sprintf('Telegram poll SKIPPED (%s).', $reason));

            return self::SUCCESS;
        }

        $processed = (int) ($result['processed'] ?? 0);
        $startCommands = (int) ($result['start_commands'] ?? 0);
        $nextOffset = (int) ($result['next_offset'] ?? 0);

        $this->info(sprintf(
            'Telegram poll OK: processed=%d, start_commands=%d, next_offset=%d',
            $processed,
            $startCommands,
            $nextOffset,
        ));

        return self::SUCCESS;
    }
}
