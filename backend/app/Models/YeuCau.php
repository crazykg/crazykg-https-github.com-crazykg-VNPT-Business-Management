<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class YeuCau extends Model
{
    use SoftDeletes;

    protected $table = 'yeu_cau';

    protected $fillable = [
        'don_vi_id',
        'ma_yc',
        'nguoi_tao_id',
        'khach_hang_id',
        'tieu_de',
        'mo_ta',
        'do_uu_tien',
        'loai_yc',
        'kenh_tiep_nhan',
        'pm_id',
        'ba_id',
        'r_id',
        'dev_id',
        'nguoi_trao_doi_id',
        'trang_thai',
        'tien_trinh_hien_tai',
        'tt_id_hien_tai',
        'ket_qua',
        'hoan_thanh_luc',
        'tong_gio_xu_ly',
    ];
}
