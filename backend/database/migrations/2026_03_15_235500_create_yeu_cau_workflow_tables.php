<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->createYeuCauTable();
        $this->createNguoiLienQuanTable();
        $this->createTtGiaoYcPmTable();
        $this->createTtGiaoYcRTable();
        $this->createTtTraYcPmTable();
        $this->createTtChoKhCungCapTable();
        $this->createTtThucHienTable();
        $this->createTtHoanThanhTable();
        $this->createTtChuyenBaTable();
        $this->createTtChuyenPmBaTable();
        $this->createTtChuyenDmsTable();
        $this->createTtTraoDoiDmsTable();
        $this->createTtTaoTaskTable();
        $this->createTtDmsNhanTaskTable();
        $this->createTtDmsDangThucHienTable();
        $this->createTtTamNgungTable();
        $this->createTtHoanThanhDmsTable();
        $this->createTtLapTrinhTable();
        $this->createTtDangLapTrinhTable();
        $this->createTtHoanThanhLapTrinhTable();
        $this->createTtUpcodeTable();
        $this->createTtKhongTiepNhanTable();
        $this->createTtThongBaoKhTable();
        $this->createTtKetThucTable();
        $this->createLichSuTrangThaiTable();
    }

    public function down(): void
    {
        Schema::dropIfExists('yc_lich_su_trang_thai');
        Schema::dropIfExists('tt_ket_thuc');
        Schema::dropIfExists('tt_thong_bao_kh');
        Schema::dropIfExists('tt_khong_tiep_nhan');
        Schema::dropIfExists('tt_upcode');
        Schema::dropIfExists('tt_hoan_thanh_lap_trinh');
        Schema::dropIfExists('tt_dang_lap_trinh');
        Schema::dropIfExists('tt_lap_trinh');
        Schema::dropIfExists('tt_hoan_thanh_dms');
        Schema::dropIfExists('tt_tam_ngung');
        Schema::dropIfExists('tt_dms_dang_thuc_hien');
        Schema::dropIfExists('tt_dms_nhan_task');
        Schema::dropIfExists('tt_tao_task');
        Schema::dropIfExists('tt_trao_doi_dms');
        Schema::dropIfExists('tt_chuyen_dms');
        Schema::dropIfExists('tt_chuyen_pm_ba');
        Schema::dropIfExists('tt_chuyen_ba');
        Schema::dropIfExists('tt_hoan_thanh');
        Schema::dropIfExists('tt_thuc_hien');
        Schema::dropIfExists('tt_cho_kh_cung_cap');
        Schema::dropIfExists('tt_tra_yc_pm');
        Schema::dropIfExists('tt_giao_yc_r');
        Schema::dropIfExists('tt_giao_yc_pm');
        Schema::dropIfExists('yc_nguoi_lien_quan');
        Schema::dropIfExists('yeu_cau');
    }

    private function createYeuCauTable(): void
    {
        if (Schema::hasTable('yeu_cau')) {
            return;
        }

        Schema::create('yeu_cau', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('don_vi_id');
            $table->string('ma_yc', 50)->unique();
            $table->unsignedBigInteger('nguoi_tao_id');
            $table->unsignedBigInteger('khach_hang_id');
            $table->string('tieu_de', 500);
            $table->text('mo_ta')->nullable();
            $table->unsignedTinyInteger('do_uu_tien')->default(2);
            $table->string('loai_yc', 100)->nullable();
            $table->string('kenh_tiep_nhan', 100)->nullable();
            $table->unsignedBigInteger('pm_id')->nullable();
            $table->unsignedBigInteger('ba_id')->nullable();
            $table->unsignedBigInteger('r_id')->nullable();
            $table->unsignedBigInteger('dev_id')->nullable();
            $table->unsignedBigInteger('nguoi_trao_doi_id')->nullable();
            $table->string('trang_thai', 80)->default('moi_tiep_nhan');
            $table->string('tien_trinh_hien_tai', 60)->nullable();
            $table->unsignedBigInteger('tt_id_hien_tai')->nullable();
            $table->enum('ket_qua', ['dang_xu_ly', 'hoan_thanh', 'khong_tiep_nhan', 'ket_thuc'])->default('dang_xu_ly');
            $table->dateTime('hoan_thanh_luc')->nullable();
            $table->decimal('tong_gio_xu_ly', 8, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('don_vi_id');
            $table->index('trang_thai');
            $table->index('pm_id');
            $table->index('khach_hang_id');
            $table->index('ket_qua');
            $table->index('created_at');
        });
    }

    private function createNguoiLienQuanTable(): void
    {
        if (Schema::hasTable('yc_nguoi_lien_quan')) {
            return;
        }

        Schema::create('yc_nguoi_lien_quan', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('yeu_cau_id');
            $table->unsignedBigInteger('don_vi_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('vai_tro', [
                'nguoi_nhap',
                'pm',
                'ba',
                'nguoi_thuc_hien',
                'nguoi_trao_doi',
                'dev',
                'nguoi_phan_cong',
            ]);
            $table->string('trang_thai_bat_dau', 80)->nullable();
            $table->dateTime('cap_quyen_luc')->useCurrent();
            $table->dateTime('thu_hoi_luc')->nullable();
            $table->unsignedBigInteger('cap_boi_id');

            $table->unique(['yeu_cau_id', 'user_id', 'vai_tro'], 'uq_yc_user_role');
            $table->index('yeu_cau_id');
            $table->index('user_id');
            $table->foreign('yeu_cau_id', 'fk_nlq_yc')->references('id')->on('yeu_cau')->cascadeOnDelete();
        });
    }

    private function createTtGiaoYcPmTable(): void
    {
        if (Schema::hasTable('tt_giao_yc_pm')) {
            return;
        }

        Schema::create('tt_giao_yc_pm', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_giao_id');
            $table->unsignedBigInteger('pm_nhan_id');
            $table->dateTime('deadline_phan_hoi')->nullable();
            $table->boolean('pm_co_nhan')->nullable();
            $table->text('ly_do_tu_choi')->nullable();
            $table->dateTime('pm_phan_hoi_luc')->nullable();
            $this->addProcessSharedTail($table, 'moi_tiep_nhan');
        });
    }

    private function createTtGiaoYcRTable(): void
    {
        if (Schema::hasTable('tt_giao_yc_r')) {
            return;
        }

        Schema::create('tt_giao_yc_r', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('pm_id');
            $table->unsignedBigInteger('r_nhan_id');
            $table->text('mo_ta_cong_viec')->nullable();
            $table->dateTime('deadline')->nullable();
            $table->boolean('r_co_the')->nullable();
            $table->dateTime('r_phan_hoi_luc')->nullable();
            $this->addProcessSharedTail($table, 'moi_tiep_nhan');
        });
    }

    private function createTtTraYcPmTable(): void
    {
        if (Schema::hasTable('tt_tra_yc_pm')) {
            return;
        }

        Schema::create('tt_tra_yc_pm', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('r_tra_id');
            $table->unsignedBigInteger('pm_nhan_id');
            $table->text('ly_do_tra');
            $table->unsignedTinyInteger('lan_tra')->default(1);
            $table->enum('nguyen_nhan', ['do_kh_thieu_tt', 'do_vuot_nang_luc', 'chua_xac_dinh'])->nullable();
            $table->dateTime('pm_danh_gia_luc')->nullable();
            $table->boolean('can_kh_bo_sung')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_tra_nguoi_quan_ly');
        });
    }

    private function createTtChoKhCungCapTable(): void
    {
        if (Schema::hasTable('tt_cho_kh_cung_cap')) {
            return;
        }

        Schema::create('tt_cho_kh_cung_cap', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_tao_id');
            $table->unsignedBigInteger('tt_tra_yc_id');
            $table->text('noi_dung_can_bo');
            $table->dateTime('gui_yc_cho_kh_luc')->nullable();
            $table->dateTime('deadline_kh')->nullable();
            $table->dateTime('kh_phan_hoi_luc')->nullable();
            $table->boolean('kh_da_cung_cap')->default(false);
            $table->text('noi_dung_kh_cung_cap')->nullable();
            $table->boolean('thong_tin_da_du')->nullable();
            $table->unsignedBigInteger('nguoi_danh_gia_id')->nullable();
            $table->dateTime('danh_gia_luc')->nullable();
            $this->addProcessSharedTail($table, 'doi_kh_cung_cap');
            $table->index('tt_tra_yc_id');
            $table->foreign('tt_tra_yc_id', 'fk_tt04_tra')->references('id')->on('tt_tra_yc_pm');
        });
    }

    private function createTtThucHienTable(): void
    {
        if (Schema::hasTable('tt_thuc_hien')) {
            return;
        }

        Schema::create('tt_thuc_hien', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('r_id');
            $table->dateTime('bat_dau_luc')->nullable();
            $table->dateTime('du_kien_xong')->nullable();
            $table->unsignedTinyInteger('tien_do')->default(0);
            $table->dateTime('cap_nhat_tien_do_luc')->nullable();
            $table->boolean('da_hoan_thanh')->nullable();
            $this->addProcessSharedTail($table, 'dang_thuc_hien');
        });
    }

    private function createTtHoanThanhTable(): void
    {
        if (Schema::hasTable('tt_hoan_thanh')) {
            return;
        }

        Schema::create('tt_hoan_thanh', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('r_id');
            $table->text('ket_qua');
            $table->json('file_dinh_kem')->nullable();
            $table->boolean('pm_chap_nhan')->nullable();
            $table->unsignedBigInteger('pm_danh_gia_id')->nullable();
            $table->dateTime('pm_danh_gia_luc')->nullable();
            $table->text('ly_do_khong_chap')->nullable();
            $this->addProcessSharedTail($table, 'hoan_thanh');
        });
    }

    private function createTtChuyenBaTable(): void
    {
        if (Schema::hasTable('tt_chuyen_ba')) {
            return;
        }

        Schema::create('tt_chuyen_ba', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('pm_id');
            $table->unsignedBigInteger('ba_nhan_id');
            $table->text('yeu_cau_phan_tich')->nullable();
            $table->dateTime('deadline_phan_tich')->nullable();
            $table->text('ket_qua_phan_tich')->nullable();
            $table->boolean('ba_hoan_thanh')->default(false);
            $table->dateTime('ba_hoan_thanh_luc')->nullable();
            $this->addProcessSharedTail($table, 'phan_tich');
        });
    }

    private function createTtChuyenPmBaTable(): void
    {
        if (Schema::hasTable('tt_chuyen_pm_ba')) {
            return;
        }

        Schema::create('tt_chuyen_pm_ba', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('pm_id');
            $table->unsignedBigInteger('ba_id')->nullable();
            $table->text('mo_ta_van_de')->nullable();
            $table->boolean('huong_dms')->nullable();
            $table->boolean('huong_lap_trinh')->nullable();
            $table->boolean('huong_khong_xu_ly')->nullable();
            $table->unsignedBigInteger('nguoi_danh_gia_id')->nullable();
            $table->dateTime('danh_gia_luc')->nullable();
            $this->addProcessSharedTail($table, 'cho_danh_gia_huong_xu_ly');
        });
    }

    private function createTtChuyenDmsTable(): void
    {
        if (Schema::hasTable('tt_chuyen_dms')) {
            return;
        }

        Schema::create('tt_chuyen_dms', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_chuyen_id');
            $table->unsignedBigInteger('dms_dau_moi_id')->nullable();
            $table->text('mo_ta_yc_dms')->nullable();
            $table->json('tai_lieu')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_dms');
        });
    }

    private function createTtTraoDoiDmsTable(): void
    {
        if (Schema::hasTable('tt_trao_doi_dms')) {
            return;
        }

        Schema::create('tt_trao_doi_dms', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_trao_doi_id');
            $table->unsignedBigInteger('tt_chuyen_dms_id');
            $table->unsignedSmallInteger('so_lan_trao_doi')->default(1);
            $table->text('tom_tat_trao_doi')->nullable();
            $table->string('ket_luan_huong', 200)->nullable();
            $table->boolean('phai_tao_task')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_dms_trao_doi');
            $table->index('tt_chuyen_dms_id');
            $table->foreign('tt_chuyen_dms_id', 'fk_tt10_dms')->references('id')->on('tt_chuyen_dms');
        });
    }

    private function createTtTaoTaskTable(): void
    {
        if (Schema::hasTable('tt_tao_task')) {
            return;
        }

        Schema::create('tt_tao_task', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_tao_id');
            $table->string('ma_task_ngoai', 100)->nullable();
            $table->string('ten_task', 500);
            $table->text('mo_ta_task')->nullable();
            $table->unsignedTinyInteger('do_uu_tien')->default(2);
            $table->dateTime('deadline_task')->nullable();
            $table->unsignedBigInteger('dms_nhan_id')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_dms_tao_task');
        });
    }

    private function createTtDmsNhanTaskTable(): void
    {
        if (Schema::hasTable('tt_dms_nhan_task')) {
            return;
        }

        Schema::create('tt_dms_nhan_task', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('tt_tao_task_id');
            $table->unsignedBigInteger('dms_nguoi_nhan_id')->nullable();
            $table->dateTime('nhan_luc')->nullable();
            $table->boolean('co_nhan')->nullable();
            $table->text('ly_do_khong_nhan')->nullable();
            $this->addProcessSharedTail($table, 'cho_dms_nhan');
            $table->index('tt_tao_task_id');
            $table->foreign('tt_tao_task_id', 'fk_tt12_task')->references('id')->on('tt_tao_task');
        });
    }

    private function createTtDmsDangThucHienTable(): void
    {
        if (Schema::hasTable('tt_dms_dang_thuc_hien')) {
            return;
        }

        Schema::create('tt_dms_dang_thuc_hien', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('tt_tao_task_id');
            $table->unsignedBigInteger('dms_nguoi_thuc_hien_id');
            $table->dateTime('bat_dau_luc')->nullable();
            $table->dateTime('du_kien_xong')->nullable();
            $table->unsignedTinyInteger('tien_do')->default(0);
            $this->addProcessSharedTail($table, 'chuyen_dms_dang_thuc_hien');
        });
    }

    private function createTtTamNgungTable(): void
    {
        if (Schema::hasTable('tt_tam_ngung')) {
            return;
        }

        Schema::create('tt_tam_ngung', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_tao_id');
            $table->string('tu_tien_trinh', 60);
            $table->unsignedBigInteger('tu_tt_id');
            $table->text('ly_do');
            $table->dateTime('ngay_tam_ngung')->useCurrent();
            $table->dateTime('du_kien_phuc_hoi')->nullable();
            $table->dateTime('ngay_phuc_hoi_thuc')->nullable();
            $table->unsignedBigInteger('nguoi_phuc_hoi_id')->nullable();
            $table->text('ghi_chu_phuc_hoi')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_dms_tam_ngung');
        });
    }

    private function createTtHoanThanhDmsTable(): void
    {
        if (Schema::hasTable('tt_hoan_thanh_dms')) {
            return;
        }

        Schema::create('tt_hoan_thanh_dms', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('dms_nguoi_hoan_thanh_id');
            $table->unsignedBigInteger('tt_tao_task_id');
            $table->text('ket_qua');
            $table->json('file_dinh_kem')->nullable();
            $table->dateTime('hoan_thanh_luc')->nullable();
            $table->boolean('pm_xac_nhan')->nullable();
            $table->unsignedBigInteger('pm_xac_nhan_id')->nullable();
            $table->dateTime('pm_xac_nhan_luc')->nullable();
            $this->addProcessSharedTail($table, 'chuyen_dms_hoan_thanh');
            $table->index('tt_tao_task_id');
            $table->foreign('tt_tao_task_id', 'fk_tt15_task')->references('id')->on('tt_tao_task');
        });
    }

    private function createTtLapTrinhTable(): void
    {
        if (Schema::hasTable('tt_lap_trinh')) {
            return;
        }

        Schema::create('tt_lap_trinh', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('pm_id');
            $table->unsignedBigInteger('ba_id')->nullable();
            $table->text('dac_ta_ky_thuat')->nullable();
            $table->string('module_lien_quan', 500)->nullable();
            $table->string('pham_vi_anh_huong', 500)->nullable();
            $table->unsignedBigInteger('dev_duoc_assign')->nullable();
            $table->dateTime('deadline_dev')->nullable();
            $this->addProcessSharedTail($table, 'lap_trinh');
        });
    }

    private function createTtDangLapTrinhTable(): void
    {
        if (Schema::hasTable('tt_dang_lap_trinh')) {
            return;
        }

        Schema::create('tt_dang_lap_trinh', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('dev_id');
            $table->unsignedBigInteger('tt_lap_trinh_id');
            $table->string('branch', 200)->nullable();
            $table->unsignedTinyInteger('tien_do')->default(0);
            $table->boolean('dev_lam_duoc')->nullable();
            $this->addProcessSharedTail($table, 'lap_trinh_dang_thuc_hien');
            $table->index('tt_lap_trinh_id');
            $table->foreign('tt_lap_trinh_id', 'fk_tt17_lp')->references('id')->on('tt_lap_trinh');
        });
    }

    private function createTtHoanThanhLapTrinhTable(): void
    {
        if (Schema::hasTable('tt_hoan_thanh_lap_trinh')) {
            return;
        }

        Schema::create('tt_hoan_thanh_lap_trinh', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('dev_id');
            $table->unsignedBigInteger('tt_lap_trinh_id');
            $table->string('pull_request_url', 500)->nullable();
            $table->text('mo_ta_thay_doi')->nullable();
            $table->text('test_cases')->nullable();
            $table->unsignedBigInteger('reviewer_id')->nullable();
            $table->boolean('da_review')->default(false);
            $table->dateTime('review_luc')->nullable();
            $this->addProcessSharedTail($table, 'lap_trinh_hoan_thanh');
            $table->index('tt_lap_trinh_id');
            $table->foreign('tt_lap_trinh_id', 'fk_tt18_lp')->references('id')->on('tt_lap_trinh');
        });
    }

    private function createTtUpcodeTable(): void
    {
        if (Schema::hasTable('tt_upcode')) {
            return;
        }

        Schema::create('tt_upcode', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('dev_id');
            $table->enum('moi_truong', ['staging', 'uat', 'production'])->default('staging');
            $table->string('phien_ban', 50)->nullable();
            $table->string('commit_hash', 100)->nullable();
            $table->dateTime('thoi_gian_up')->nullable();
            $table->boolean('ket_qua_up')->nullable();
            $table->text('log_up')->nullable();
            $this->addProcessSharedTail($table, 'lap_trinh_upcode');
        });
    }

    private function createTtKhongTiepNhanTable(): void
    {
        if (Schema::hasTable('tt_khong_tiep_nhan')) {
            return;
        }

        Schema::create('tt_khong_tiep_nhan', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_xac_nhan_id');
            $table->enum('nguyen_nhan', [
                'pm_tu_choi_tu_dau',
                'kh_khong_cung_cap_tt',
                'vuot_kha_nang_ho_tro',
                'khac',
            ]);
            $table->text('ly_do_chi_tiet');
            $table->string('tu_tien_trinh', 60);
            $table->text('de_xuat_phuong_an')->nullable();
            $this->addProcessSharedTail($table, 'khong_tiep_nhan');
        });
    }

    private function createTtThongBaoKhTable(): void
    {
        if (Schema::hasTable('tt_thong_bao_kh')) {
            return;
        }

        Schema::create('tt_thong_bao_kh', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_gui_id');
            $table->string('kenh', 100);
            $table->text('noi_dung');
            $table->dateTime('gui_luc')->nullable();
            $table->boolean('kh_xac_nhan')->default(false);
            $table->dateTime('kh_xac_nhan_luc')->nullable();
            $table->boolean('kh_hai_long')->nullable();
            $table->text('kh_phan_hoi')->nullable();
            $this->addProcessSharedTail($table, 'bao_khach_hang');
        });
    }

    private function createTtKetThucTable(): void
    {
        if (Schema::hasTable('tt_ket_thuc')) {
            return;
        }

        Schema::create('tt_ket_thuc', function (Blueprint $table): void {
            $table->id();
            $this->addProcessBaseColumns($table);
            $table->unsignedBigInteger('nguoi_dong_id');
            $table->enum('ket_qua_cuoi', ['hoan_thanh', 'khong_tiep_nhan', 'ket_thuc_khac']);
            $table->string('tu_tien_trinh', 60);
            $table->text('tom_tat')->nullable();
            $table->decimal('tong_gio', 8, 2)->nullable();
            $table->unsignedTinyInteger('diem_noi_bo')->nullable();
            $this->addProcessSharedTail($table, 'ket_thuc');
            $table->unique('yeu_cau_id', 'uq_tt22_yc');
        });
    }

    private function createLichSuTrangThaiTable(): void
    {
        if (Schema::hasTable('yc_lich_su_trang_thai')) {
            return;
        }

        Schema::create('yc_lich_su_trang_thai', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('yeu_cau_id');
            $table->unsignedBigInteger('don_vi_id');
            $table->string('tien_trinh', 60);
            $table->unsignedBigInteger('tien_trinh_id')->nullable();
            $table->string('trang_thai_cu', 80)->nullable();
            $table->string('trang_thai_moi', 80);
            $table->unsignedBigInteger('nguoi_thay_doi_id');
            $table->text('ly_do')->nullable();
            $table->decimal('thoi_gian_o_trang_thai_cu_gio', 8, 2)->nullable();
            $table->dateTime('thay_doi_luc')->useCurrent();

            $table->index('yeu_cau_id');
            $table->index('thay_doi_luc');
            $table->index('tien_trinh');
            $table->foreign('yeu_cau_id', 'fk_ls_yc')->references('id')->on('yeu_cau')->cascadeOnDelete();
        });
    }

    private function addProcessBaseColumns(Blueprint $table): void
    {
        $table->unsignedBigInteger('yeu_cau_id');
        $table->unsignedBigInteger('don_vi_id');
    }

    private function addProcessSharedTail(Blueprint $table, string $defaultTrangThai): void
    {
        $table->string('trang_thai', 80)->default($defaultTrangThai);
        $table->text('ghi_chu')->nullable();
        $table->timestamps();
        $table->index('yeu_cau_id');
        $table->foreign('yeu_cau_id')->references('id')->on('yeu_cau')->cascadeOnDelete();
    }
};
