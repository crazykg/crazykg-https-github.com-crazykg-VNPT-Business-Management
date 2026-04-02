<?php

return [
    'soft_delete' => [
        'days' => (int) env('VNPT_ARCHIVE_SOFT_DELETE_DAYS', 180),
        'chunk_size' => (int) env('VNPT_ARCHIVE_SOFT_DELETE_CHUNK_SIZE', 200),
        'tables' => [
            'revenue_targets' => [
                'archive_table' => 'revenue_targets_archive',
                'copy_columns' => [
                    'period_type',
                    'period_key',
                    'period_start',
                    'period_end',
                    'dept_id',
                    'target_type',
                    'target_amount',
                    'actual_amount',
                    'notes',
                    'approved_by',
                    'approved_at',
                    'data_scope',
                    'created_by',
                    'updated_by',
                ],
            ],
        ],
    ],
];
