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
                'Mới tiếp nhận',
                'customer_request_cases',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                []
            ),
            self::status(
                'waiting_customer_feedback',
                'Đợi phản hồi từ khách hàng',
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
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
            self::status(
                'in_progress',
                'Đang xử lý',
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
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
            self::status(
                'not_executed',
                'Không thực hiện',
                'customer_request_not_executed',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('decision_by_user_id', 'Người xác nhận', 'user_select'),
                    self::field('decision_at', 'Ngày xác nhận', 'datetime'),
                    self::field('decision_reason', 'Lý do không thực hiện', 'textarea'),
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
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
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
            self::status(
                'customer_notified',
                'Báo khách hàng',
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
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
            self::status(
                'returned_to_manager',
                'Chuyển trả người quản lý',
                'customer_request_returned_to_manager',
                [
                    ...$commonColumns,
                    self::column('received_at', 'Ngày tiếp nhận'),
                ],
                [
                    self::field('returned_by_user_id', 'Người chuyển trả', 'user_select'),
                    self::field('returned_at', 'Ngày chuyển trả', 'datetime'),
                    self::field('return_reason', 'Lý do chuyển trả', 'textarea'),
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
            self::status(
                'analysis',
                'Phân tích',
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
                    self::field('notes', 'Ghi chú trạng thái', 'textarea'),
                ]
            ),
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
        array $formFields
    ): array {
        return [
            'status_code' => $statusCode,
            'status_name_vi' => $label,
            'table_name' => $tableName,
            'list_columns' => $listColumns,
            'form_fields' => $formFields,
        ];
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
