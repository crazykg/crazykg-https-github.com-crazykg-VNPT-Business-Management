<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('monthly_calendars')) {
            Schema::create('monthly_calendars', function (Blueprint $table): void {
                // Khoá chính là ngày dương lịch (DATE)
                $table->date('date')->primary();

                // Phân rã ngày
                $table->smallInteger('year')->unsigned()->notNull();
                $table->tinyInteger('month')->unsigned()->notNull();
                $table->tinyInteger('day')->unsigned()->notNull();

                // Phân loại thời gian
                $table->tinyInteger('week_number')->unsigned()->notNull()->comment('Tuần trong năm (1-53)');
                $table->tinyInteger('day_of_week')->unsigned()->notNull()->comment('1: Chủ Nhật, 2: Thứ Hai, ..., 7: Thứ Bảy');
                $table->boolean('is_weekend')->default(false)->comment('TRUE nếu Thứ Bảy hoặc Chủ Nhật');

                // Quản lý ngày làm việc / nghỉ lễ
                $table->boolean('is_working_day')->default(true)->comment('TRUE = ngày làm việc bình thường');
                $table->boolean('is_holiday')->default(false)->comment('TRUE = ngày nghỉ lễ chính thức');
                $table->string('holiday_name', 200)->nullable()->comment('Tên ngày lễ nếu có');
                $table->string('note', 255)->nullable()->comment('Ghi chú thêm');

                // Audit
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                // Index tối ưu
                $table->index(['year', 'month'],       'idx_mc_year_month');
                $table->index(['year', 'week_number'], 'idx_mc_year_week');
                $table->index('updated_at',             'idx_mc_updated');
                $table->index('is_working_day',         'idx_mc_working_day');
                $table->index('is_holiday',             'idx_mc_holiday');
            });
        }

        // Seed lịch năm hiện tại + năm kế tiếp
        $this->seedCalendarYear((int) date('Y'));
        $this->seedCalendarYear((int) date('Y') + 1);
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_calendars');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Sinh toàn bộ ngày trong một năm vào bảng monthly_calendars.
     * Các ngày đã tồn tại sẽ được bỏ qua (INSERT IGNORE / updateOrInsert).
     */
    private function seedCalendarYear(int $year): void
    {
        if (! Schema::hasTable('monthly_calendars')) {
            return;
        }

        $start = new \DateTimeImmutable("{$year}-01-01");
        $end   = new \DateTimeImmutable("{$year}-12-31");
        $current = $start;

        $rows = [];

        while ($current <= $end) {
            $dateStr    = $current->format('Y-m-d');
            $month      = (int) $current->format('n');
            $day        = (int) $current->format('j');
            $dayOfWeek  = (int) $current->format('w'); // 0=CN, 6=T7
            $weekNumber = (int) $current->format('W'); // ISO-8601 week
            $isWeekend  = $dayOfWeek === 0 || $dayOfWeek === 6;

            // day_of_week: 1=CN, 2=T2, …, 7=T7  (theo comment schema)
            $dowMapped = ($dayOfWeek === 0) ? 1 : $dayOfWeek + 1;

            // Ngày lễ cố định Việt Nam
            [$isHoliday, $holidayName] = $this->resolveVietnameseHoliday($year, $month, $day);

            $rows[] = [
                'date'         => $dateStr,
                'year'         => $year,
                'month'        => $month,
                'day'          => $day,
                'week_number'  => $weekNumber,
                'day_of_week'  => $dowMapped,
                'is_weekend'   => $isWeekend,
                'is_working_day' => ! $isWeekend && ! $isHoliday,
                'is_holiday'   => $isHoliday,
                'holiday_name' => $holidayName,
                'note'         => null,
                'created_at'   => DB::raw('NOW()'),
                'updated_at'   => DB::raw('NOW()'),
                'created_by'   => null,
                'updated_by'   => null,
            ];

            $current = $current->modify('+1 day');
        }

        // Chunk insert để tránh vượt giới hạn SQL placeholder
        foreach (array_chunk($rows, 100) as $chunk) {
            foreach ($chunk as $row) {
                DB::table('monthly_calendars')->updateOrInsert(
                    ['date' => $row['date']],
                    array_diff_key($row, ['date' => ''])
                );
            }
        }
    }

    /**
     * Tra cứu ngày lễ cố định của Việt Nam (không phụ thuộc lịch âm).
     * Trả về [bool $isHoliday, ?string $holidayName]
     *
     * @return array{bool, string|null}
     */
    private function resolveVietnameseHoliday(int $year, int $month, int $day): array
    {
        // Ngày lễ cố định (dương lịch)
        $fixedHolidays = [
            '01-01' => 'Tết Dương lịch',
            '04-30' => 'Ngày Giải phóng miền Nam',
            '05-01' => 'Quốc tế Lao động',
            '09-02' => 'Quốc khánh',
        ];

        $key = sprintf('%02d-%02d', $month, $day);
        if (isset($fixedHolidays[$key])) {
            return [true, $fixedHolidays[$key]];
        }

        // Ngày nghỉ bù / đặc thù Tết Dương lịch năm cụ thể
        // (Admin có thể cập nhật trực tiếp sau qua UI)

        return [false, null];
    }
};
