<?php

namespace App\Services\V5\Domain;

final class CustomerRequestCaseRegistry
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public static function masterFields(): array
    {
        return [
            self::field('project_item_id', 'Khách hàng | Dự án | Sản phẩm', 'project_item_select'),
            self::field('summary', 'Nội dung yêu cầu', 'text', true),
            self::field('project_id', 'Dự án', 'hidden'),
            self::field('product_id', 'Sản phẩm', 'hidden'),
            self::field('customer_id', 'Khách hàng', 'customer_select'),
            self::field('customer_personnel_id', 'Người yêu cầu', 'customer_personnel_select'),
            self::field('support_service_group_id', 'Kênh tiếp nhận', 'support_group_select'),
            self::field('source_channel', 'Kênh khác', 'text'),
            self::field('priority', 'Độ ưu tiên', 'priority'),
            self::field('description', 'Mô tả chi tiết', 'textarea'),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function all(): array
    {
        return array_values(self::catalog());
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function catalog(): array
    {
        static $catalog = null;
        if ($catalog !== null) {
            return $catalog;
        }

        $catalog = [];
        foreach (self::definitions() as $definition) {
            $catalog[$definition['status_code']] = $definition;
        }

        return $catalog;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $statusCode): ?array
    {
        return self::catalog()[$statusCode] ?? null;
    }

    /**
     * @return array<int, string>
     */
    public static function tables(): array
    {
        return array_map(
            static fn (array $definition): string => (string) $definition['table_name'],
            self::all()
        );
    }

    /**
     * Logical groupings of statuses for display/filtering.
     * @return array<string, array<int, string>>
     */
    public static function statusGroups(): array
    {
        return [
            'intake'     => ['new_intake', 'assigned_to_receiver', 'waiting_customer_feedback'],
            'analysis'   => ['analysis', 'analysis_completed', 'analysis_suspended', 'returned_to_manager'],
            'processing' => ['in_progress', 'coding', 'coding_in_progress', 'coding_suspended', 'dms_transfer', 'dms_task_created', 'dms_in_progress', 'dms_suspended'],
            'closure'    => ['completed', 'waiting_notification', 'customer_notified', 'closed', 'not_executed'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function getStatusCodesForGroup(string $group): array
    {
        $normalized = strtolower(trim($group));
        if ($normalized === '') {
            return [];
        }

        return self::statusGroups()[$normalized] ?? [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function definitions(): array
    {
        $commonColumns = [
            self::column('request_code', 'ID yêu cầu'),
            self::column('summary', 'Nội dung'),
            self::column('requester_name', 'Người yêu cầu'),
            self::column('support_service_group_name', 'Kênh tiếp nhận'),
            self::column('received_by_name', 'Người tiếp nhận'),
        ];

        return [
            self::status(
                'new_intake',
                'Tiếp nhận',
                'customer_request_cases',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'assigned_to_receiver',
                'Giao R thực hiện',
                'customer_request_assigned_to_receiver',
                [
                    ...$commonColumns,
                    self::column('receiver_user_id', 'Người thực hiện'),
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('receiver_user_id', 'Người thực hiện', 'user_select'),
                    self::field('accepted_at', 'Ngày chấp nhận', 'datetime'),
                    self::field('started_at', 'Ngày bắt đầu', 'datetime'),
                    self::field('expected_completed_at', 'Ngày dự kiến hoàn thành', 'datetime'),
                    self::field('processing_content', 'Nội dung xử lý', 'textarea'),
                ]
            ),
            self::status(
                'pending_dispatch',
                'Giao PM/Trả YC cho PM',
                'customer_request_pending_dispatch',
                [
                    ...$commonColumns,
                    self::column('dispatcher_user_id', 'Người điều phối'),
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('dispatcher_user_id', 'Người điều phối (PM)', 'user_select'),
                    self::field('dispatched_at', 'Ngày điều phối', 'datetime'),
                    self::field('dispatch_note', 'Ghi chú điều phối', 'textarea'),
                ]
            ),
            self::status(
                'receiver_in_progress',
                'R Đang thực hiện',
                'customer_request_receiver_in_progress',
                [
                    ...$commonColumns,
                    self::column('receiver_user_id', 'Người thực hiện'),
                    self::column('progress_percent', 'Tiến độ'),
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('receiver_user_id', 'Người thực hiện', 'user_select'),
                    self::field('accepted_at', 'Ngày chấp nhận', 'datetime'),
                    self::field('started_at', 'Ngày bắt đầu', 'datetime'),
                    self::field('expected_completed_at', 'Ngày dự kiến hoàn thành', 'datetime'),
                    self::field('progress_percent', 'Tiến độ %', 'number'),
                    self::field('processing_content', 'Nội dung xử lý', 'textarea'),
                ]
            ),
            self::status(
                'waiting_customer_feedback',
                'Chờ khách hàng cung cấp thông tin',
                'customer_request_waiting_customer_feedbacks',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('feedback_request_content', 'Nội dung yêu cầu phản hồi', 'textarea'),
                    self::field('feedback_requested_at', 'Ngày gửi phản hồi', 'datetime'),
                    self::field('customer_due_at', 'Hạn phản hồi', 'datetime'),
                    self::field('customer_feedback_at', 'Ngày khách hàng phản hồi', 'datetime'),
                    self::field('customer_feedback_content', 'Nội dung khách hàng phản hồi', 'textarea'),
                ]
            ),
            self::status(
                'in_progress',
                'R Đang thực hiện',
                'customer_request_in_progress',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('performer_user_id', 'Người thực hiện', 'user_select'),
                    self::field('started_at', 'Ngày bắt đầu', 'datetime'),
                    self::field('expected_completed_at', 'Ngày dự kiến hoàn thành', 'datetime'),
                    self::field('progress_percent', 'Tiến độ', 'number'),
                    self::field('processing_content', 'Nội dung xử lý', 'textarea'),
                ]
            ),
            self::status(
                'not_executed',
                'Không tiếp nhận',
                'customer_request_not_executed',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('decision_by_user_id', 'Người xác nhận', 'user_select'),
                    self::field('decision_at', 'Ngày xác nhận', 'datetime'),
                    self::field('decision_reason', 'Lý do không thực hiện', 'textarea'),
                ]
            ),
            self::status(
                'completed',
                'Hoàn thành',
                'customer_request_completed',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('completed_by_user_id', 'Người hoàn thành', 'user_select'),
                    self::field('completed_at', 'Ngày hoàn thành', 'datetime'),
                    self::field('result_content', 'Kết quả thực hiện', 'textarea'),
                ]
            ),
            self::status(
                'waiting_notification',
                'Chờ thông báo khách hàng',
                'customer_request_waiting_notification',
                [
                    ...$commonColumns,
                    self::column('notified_by_user_id', 'Người phụ trách'),
                    self::column('notification_channel', 'Kênh thông báo'),
                    self::column('planned_notification_at', 'Dự kiến thông báo'),
                ],
                [
                    self::field('notified_by_user_id', 'Người phụ trách thông báo', 'user_select', true),
                    self::field('notification_channel', 'Kênh thông báo', 'select'),
                    self::field('notification_content', 'Nội dung thông báo', 'textarea'),
                    self::field('planned_notification_at', 'Dự kiến ngày thông báo', 'datetime'),
                    self::field('notes', 'Ghi chú', 'textarea'),
                ]
            ),
            self::status(
                'customer_notified',
                'Thông báo khách hàng',
                'customer_request_customer_notified',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('notified_by_user_id', 'Người báo khách hàng', 'user_select'),
                    self::field('notified_at', 'Ngày báo khách hàng', 'datetime'),
                    self::field('notification_channel', 'Kênh báo khách hàng', 'text'),
                    self::field('notification_content', 'Nội dung báo khách hàng', 'textarea'),
                    self::field('customer_feedback', 'Phản hồi khách hàng', 'textarea'),
                ]
            ),
            self::status(
                'closed',
                'Đóng yêu cầu',
                'customer_request_closed',
                [
                    ...$commonColumns,
                    self::column('closed_by_user_id', 'Người đóng'),
                    self::column('closed_at', 'Ngày đóng'),
                    self::column('customer_satisfaction', 'Mức độ hài lòng'),
                ],
                [
                    self::field('closed_by_user_id', 'Người đóng yêu cầu', 'user_select', true),
                    self::field('closed_at', 'Ngày đóng', 'datetime', true),
                    self::field('closure_reason', 'Lý do đóng', 'select', true),
                    self::field('closure_notes', 'Ghi chú đóng', 'textarea'),
                    self::field('customer_satisfaction', 'Mức độ hài lòng', 'select'),
                ]
            ),
            self::status(
                'returned_to_manager',
                'Giao PM/Trả YC cho PM',
                'customer_request_returned_to_manager',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('returned_by_user_id', 'Người chuyển trả', 'user_select'),
                    self::field('returned_at', 'Ngày chuyển trả', 'datetime'),
                    self::field('return_reason', 'Lý do chuyển trả', 'textarea'),
                ]
            ),
            self::status(
                'analysis',
                'Chuyển BA Phân tích ú quà',
                'customer_request_analysis',
                [
                    self::column('request_code', 'ID yêu cầu'),
                    self::column('summary', 'Nội dung'),
                    self::column('analysis_content', 'Nội dung phân tích'),
                    self::column('performer_name', 'Người thực hiện'),
                    self::column('analysis_completed_at', 'Ngày hoàn thành'),
                ],
                [
                    self::field('performer_user_id', 'Người phân tích', 'user_select'),
                    self::field('analysis_content', 'Nội dung phân tích', 'textarea'),
                    self::field('analysis_completed_at', 'Ngày hoàn thành', 'datetime'),
                ]
            ),
            self::status(
                'analysis_completed',
                'Chuyển BA Phân tích hoàn thành',
                'customer_request_analysis_completed',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'analysis_suspended',
                'Chuyển BA Phân tích tạm ngưng',
                'customer_request_analysis_suspended',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'assigned_to_receiver',
                'Giao R thực hiện',
                'customer_request_assigned_to_receiver',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'coding',
                'Lập trình',
                'customer_request_coding',
                [
                    ...$commonColumns,
                    self::column('developer_name', 'Dev thực hiện'),
                    self::column('coding_phase', 'Sub-status'),
                    self::column('coding_started_at', 'Ngày bắt đầu'),
                    self::column('coding_completed_at', 'Ngày HT code'),
                    self::column('upcode_version', 'Phiên bản upcode'),
                ],
                [
                    self::field('developer_user_id', 'Dev thực hiện', 'user_select', true),
                    self::field('coding_content', 'Nội dung lập trình', 'textarea'),
                    self::field('coding_phase', 'Sub-status', 'select', true),
                    self::field('upcode_version', 'Phiên bản upcode', 'text'),
                    self::field('upcode_environment', 'Môi trường upcode', 'text'),
                ]
            ),
            self::status(
                'coding_in_progress',
                'Dev đang thực hiện',
                'customer_request_coding_in_progress',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'coding_suspended',
                'Dev tạm ngưng',
                'customer_request_coding_suspended',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'dms_transfer',
                'Chuyển DMS',
                'customer_request_dms_transfer',
                [
                    ...$commonColumns,
                    // Đã ẩn column 'dms_contact_name' vì không cần hiển thị trong danh sách
                    self::column('dms_phase', 'Sub-status'),
                    self::column('task_ref', 'Mã task DMS'),
                    self::column('dms_started_at', 'Ngày bắt đầu'),
                    self::column('dms_completed_at', 'Ngày hoàn thành'),
                ],
                [
                    self::field('dms_contact_user_id', 'Người phụ trách DMS', 'hidden'),
                    self::field('exchange_content', 'Nội dung trao đổi', 'textarea'),
                    self::field('task_ref', 'Mã task', 'text'),
                    self::field('task_url', 'URL task', 'url'),
                    self::field('dms_phase', 'Sub-status', 'select', true),
                ]
            ),
            self::status(
                'dms_task_created',
                'Tạo task',
                'customer_request_dms_task_created',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'dms_in_progress',
                'DMS Đang thực hiện',
                'customer_request_dms_in_progress',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'dms_suspended',
                'DMS tạm ngưng',
                'customer_request_dms_suspended',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            // ── END V4 ANALYSIS BLOCK ─────────────────────────────────────────
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function status(
        string $statusCode,
        string $label,
        string $tableName,
        array $listColumns,
        array $_unusedFormFields
    ): array {
        return [
            'status_code' => $statusCode,
            'status_name_vi' => $label,
            'table_name' => $tableName,
            'list_columns' => $listColumns,
            'form_fields' => self::fixedStatusFormFields(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function fixedStatusFormFields(): array
    {
        return [
            self::field('received_at', 'Ngày bắt đầu', 'datetime'),
            self::field('completed_at', 'Ngày kết thúc', 'datetime'),
            self::field('extended_at', 'Ngày gia hạn', 'datetime'),
            self::field('progress_percent', 'Tiến độ phần trăm', 'number'),
            self::field('from_user_id', 'Người chuyển', 'user_select'),
            self::field('to_user_id', 'Người nhận', 'user_select', true),
            self::field('notes', 'Ghi chú', 'textarea', true),
        ];
    }

    /**
     * @return array<int, string>|null
     */
    public static function workflowaAllowedTargets(string $statusCode): ?array
    {
        $map = [
            'new_intake' => ['assigned_to_receiver', 'returned_to_manager'],
            'assigned_to_receiver' => ['in_progress', 'returned_to_manager'],
            'returned_to_manager' => ['not_executed', 'waiting_customer_feedback', 'assigned_to_receiver', 'analysis', 'dms_transfer', 'coding', 'completed'],
            'in_progress' => ['completed', 'returned_to_manager'],
            'waiting_customer_feedback' => ['assigned_to_receiver', 'returned_to_manager'],
            'not_executed' => ['customer_notified', 'returned_to_manager'],
            'analysis' => ['analysis_completed', 'analysis_suspended', 'returned_to_manager'],
            'analysis_completed' => ['dms_transfer', 'coding', 'returned_to_manager'],
            'analysis_suspended' => ['analysis', 'analysis_completed', 'returned_to_manager'],
            'dms_transfer' => ['dms_task_created', 'returned_to_manager'],
            'dms_task_created' => ['dms_in_progress', 'returned_to_manager'],
            'dms_in_progress' => ['completed', 'dms_suspended', 'returned_to_manager'],
            'dms_suspended' => ['dms_in_progress', 'returned_to_manager'],
            'coding' => ['coding_in_progress', 'returned_to_manager'],
            'coding_in_progress' => ['completed', 'coding_suspended', 'returned_to_manager'],
            'coding_suspended' => ['coding_in_progress', 'returned_to_manager'],
            'completed' => ['assigned_to_receiver', 'returned_to_manager', 'waiting_notification'],
            'waiting_notification' => ['customer_notified', 'returned_to_manager'],
            'customer_notified' => ['closed', 'returned_to_manager'],
            'closed' => ['returned_to_manager'],
        ];

        return $map[$statusCode] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private static function field(string $name, string $label, string $type, bool $required = false): array
    {
        return [
            'name' => $name,
            'label' => $label,
            'type' => $type,
            'required' => $required,
        ];
    }

    /**
     * @return array<string, string>
     */
    private static function column(string $key, string $label): array
    {
        return [
            'key' => $key,
            'label' => $label,
        ];
    }
}
