<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCauLichSuTrangThai extends Model
{
    public $timestamps = false;

    protected $table = 'yc_lich_su_trang_thai';

    protected $fillable = [
        'yeu_cau_id',
        'don_vi_id',
        'tien_trinh',
        'tien_trinh_id',
        'trang_thai_cu',
        'trang_thai_moi',
        'nguoi_thay_doi_id',
        'ly_do',
        'thoi_gian_o_trang_thai_cu_gio',
        'thay_doi_luc',
    ];
}
