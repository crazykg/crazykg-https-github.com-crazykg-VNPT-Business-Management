<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCauNguoiLienQuan extends Model
{
    public $timestamps = false;

    protected $table = 'yc_nguoi_lien_quan';

    protected $fillable = [
        'yeu_cau_id',
        'don_vi_id',
        'user_id',
        'vai_tro',
        'trang_thai_bat_dau',
        'cap_quyen_luc',
        'thu_hoi_luc',
        'cap_boi_id',
    ];
}
