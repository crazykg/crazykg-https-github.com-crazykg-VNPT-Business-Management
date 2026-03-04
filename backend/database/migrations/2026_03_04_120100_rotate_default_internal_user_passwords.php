<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'internal_users';
    private const KNOWN_DEFAULT_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, 'password')) {
            return;
        }

        $query = DB::table(self::TABLE)->where('password', self::KNOWN_DEFAULT_HASH);
        $rows = $query->select(['id'])->get();
        if ($rows->isEmpty()) {
            return;
        }

        foreach ($rows as $row) {
            $payload = [
                'password' => Hash::make($this->generateTemporaryPassword()),
            ];

            if (Schema::hasColumn(self::TABLE, 'must_change_password')) {
                $payload['must_change_password'] = 1;
            }
            if (Schema::hasColumn(self::TABLE, 'password_reset_required_at')) {
                $payload['password_reset_required_at'] = now();
            }
            if (Schema::hasColumn(self::TABLE, 'password_changed_at')) {
                $payload['password_changed_at'] = null;
            }
            if (Schema::hasColumn(self::TABLE, 'status')) {
                $payload['status'] = 'INACTIVE';
            }
            if (Schema::hasColumn(self::TABLE, 'updated_at')) {
                $payload['updated_at'] = now();
            }

            DB::table(self::TABLE)
                ->where('id', (int) $row->id)
                ->update($payload);
        }
    }

    public function down(): void
    {
        // no-op: password rotation should not be rolled back.
    }

    private function generateTemporaryPassword(int $length = 16): string
    {
        $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $lower = 'abcdefghijkmnopqrstuvwxyz';
        $digits = '23456789';
        $symbols = '@#$%&*-_=+!?';
        $all = $upper.$lower.$digits.$symbols;

        $passwordChars = [
            $upper[random_int(0, strlen($upper) - 1)],
            $lower[random_int(0, strlen($lower) - 1)],
            $digits[random_int(0, strlen($digits) - 1)],
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];

        for ($index = count($passwordChars); $index < max(12, $length); $index++) {
            $passwordChars[] = $all[random_int(0, strlen($all) - 1)];
        }

        shuffle($passwordChars);

        return implode('', $passwordChars);
    }
};

