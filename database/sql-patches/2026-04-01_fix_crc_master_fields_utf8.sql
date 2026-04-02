UPDATE customer_request_workflow_metadata
SET
  master_fields_json = JSON_ARRAY(
    JSON_OBJECT('name', 'project_item_id', 'label', 'Khách hàng | Dự án | Sản phẩm', 'type', 'project_item_select', 'required', FALSE),
    JSON_OBJECT('name', 'summary', 'label', 'Nội dung yêu cầu', 'type', 'text', 'required', TRUE),
    JSON_OBJECT('name', 'project_id', 'label', 'Dự án', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'product_id', 'label', 'Sản phẩm', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'customer_id', 'label', 'Khách hàng', 'type', 'customer_select', 'required', FALSE),
    JSON_OBJECT('name', 'customer_personnel_id', 'label', 'Người yêu cầu', 'type', 'customer_personnel_select', 'required', FALSE),
    JSON_OBJECT('name', 'support_service_group_id', 'label', 'Kênh tiếp nhận', 'type', 'support_group_select', 'required', FALSE),
    JSON_OBJECT('name', 'source_channel', 'label', 'Kênh khác', 'type', 'text', 'required', FALSE),
    JSON_OBJECT('name', 'priority', 'label', 'Độ ưu tiên', 'type', 'priority', 'required', FALSE),
    JSON_OBJECT('name', 'description', 'label', 'Mô tả chi tiết', 'type', 'textarea', 'required', FALSE)
  ),
  updated_at = NOW();
