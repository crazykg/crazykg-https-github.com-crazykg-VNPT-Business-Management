<?php

namespace Tests\Feature;

use App\Models\AsyncExport;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PruneAsyncExportsCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        Schema::dropIfExists('async_exports');
        Schema::create('async_exports', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('module')->nullable();
            $table->string('format')->nullable();
            $table->string('status')->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('async_exports');

        parent::tearDown();
    }

    public function test_command_prunes_expired_and_legacy_exports_in_chunks(): void
    {
        Storage::disk('local')->put('exports/expired.csv', 'expired');
        Storage::disk('local')->put('exports/legacy.csv', 'legacy');
        Storage::disk('local')->put('exports/fresh.csv', 'fresh');

        DB::table('async_exports')->insert([
            [
                'id' => 1,
                'module' => 'contracts',
                'format' => 'csv',
                'status' => AsyncExport::STATUS_DONE,
                'file_path' => 'exports/expired.csv',
                'file_name' => 'expired.csv',
                'finished_at' => now()->subHours(30),
                'expires_at' => now()->subHour(),
                'started_at' => now()->subHours(31),
                'created_at' => now()->subHours(31),
                'updated_at' => now()->subHours(31),
            ],
            [
                'id' => 2,
                'module' => 'customers',
                'format' => 'csv',
                'status' => AsyncExport::STATUS_FAILED,
                'file_path' => 'exports/legacy.csv',
                'file_name' => 'legacy.csv',
                'finished_at' => now()->subHours(30),
                'expires_at' => null,
                'started_at' => now()->subHours(31),
                'created_at' => now()->subHours(31),
                'updated_at' => now()->subHours(31),
            ],
            [
                'id' => 3,
                'module' => 'projects',
                'format' => 'csv',
                'status' => AsyncExport::STATUS_DONE,
                'file_path' => 'exports/fresh.csv',
                'file_name' => 'fresh.csv',
                'finished_at' => now()->subHours(1),
                'expires_at' => now()->addHours(2),
                'started_at' => now()->subHours(2),
                'created_at' => now()->subHours(2),
                'updated_at' => now()->subHours(2),
            ],
        ]);

        $this->artisan('exports:prune', ['--hours' => 24])
            ->expectsOutput('Pruned async exports: 2 jobs, 2 files.')
            ->assertSuccessful();

        $this->assertSame(AsyncExport::STATUS_EXPIRED, DB::table('async_exports')->where('id', 1)->value('status'));
        $this->assertSame(AsyncExport::STATUS_EXPIRED, DB::table('async_exports')->where('id', 2)->value('status'));
        $this->assertSame(AsyncExport::STATUS_DONE, DB::table('async_exports')->where('id', 3)->value('status'));

        Storage::disk('local')->assertMissing('exports/expired.csv');
        Storage::disk('local')->assertMissing('exports/legacy.csv');
        Storage::disk('local')->assertExists('exports/fresh.csv');
    }
}
