UPDATE customer_request_status_catalogs
SET
  form_fields_json = CASE status_code
    WHEN 'assigned_to_receiver' THEN JSON_ARRAY(
      JSON_OBJECT('name','receiver_user_id','label','Người thực hiện','type','user_select','required',FALSE),
      JSON_OBJECT('name','accepted_at','label','Ngày chấp nhận','type','datetime','required',FALSE),
      JSON_OBJECT('name','started_at','label','Ngày bắt đầu','type','datetime','required',FALSE),
      JSON_OBJECT('name','expected_completed_at','label','Ngày dự kiến hoàn thành','type','datetime','required',FALSE),
      JSON_OBJECT('name','processing_content','label','Nội dung xử lý','type','textarea','required',FALSE)
    )
    WHEN 'pending_dispatch' THEN JSON_ARRAY(
      JSON_OBJECT('name','dispatcher_user_id','label','Người điều phối (PM)','type','user_select','required',FALSE),
      JSON_OBJECT('name','dispatched_at','label','Ngày điều phối','type','datetime','required',FALSE),
      JSON_OBJECT('name','dispatch_note','label','Ghi chú điều phối','type','textarea','required',FALSE)
    )
    WHEN 'receiver_in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('name','receiver_user_id','label','Người thực hiện','type','user_select','required',FALSE),
      JSON_OBJECT('name','accepted_at','label','Ngày chấp nhận','type','datetime','required',FALSE),
      JSON_OBJECT('name','started_at','label','Ngày bắt đầu','type','datetime','required',FALSE),
      JSON_OBJECT('name','expected_completed_at','label','Ngày dự kiến hoàn thành','type','datetime','required',FALSE),
      JSON_OBJECT('name','progress_percent','label','Tiến độ','type','number','required',FALSE),
      JSON_OBJECT('name','processing_content','label','Nội dung xử lý','type','textarea','required',FALSE)
    )
    WHEN 'waiting_customer_feedback' THEN JSON_ARRAY(
      JSON_OBJECT('name','feedback_request_content','label','Nội dung yêu cầu phản hồi','type','textarea','required',FALSE),
      JSON_OBJECT('name','feedback_requested_at','label','Ngày gửi phản hồi','type','datetime','required',FALSE),
      JSON_OBJECT('name','customer_due_at','label','Hạn phản hồi','type','datetime','required',FALSE),
      JSON_OBJECT('name','customer_feedback_at','label','Ngày khách hàng phản hồi','type','datetime','required',FALSE),
      JSON_OBJECT('name','customer_feedback_content','label','Nội dung khách hàng phản hồi','type','textarea','required',FALSE)
    )
    WHEN 'in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('name','performer_user_id','label','Người thực hiện','type','user_select','required',FALSE),
      JSON_OBJECT('name','started_at','label','Ngày bắt đầu','type','datetime','required',FALSE),
      JSON_OBJECT('name','expected_completed_at','label','Ngày dự kiến hoàn thành','type','datetime','required',FALSE),
      JSON_OBJECT('name','progress_percent','label','Tiến độ','type','number','required',FALSE),
      JSON_OBJECT('name','processing_content','label','Nội dung xử lý','type','textarea','required',FALSE)
    )
    WHEN 'not_executed' THEN JSON_ARRAY(
      JSON_OBJECT('name','decision_by_user_id','label','Người xác nhận','type','user_select','required',FALSE),
      JSON_OBJECT('name','decision_at','label','Ngày xác nhận','type','datetime','required',FALSE),
      JSON_OBJECT('name','decision_reason','label','Lý do không thực hiện','type','textarea','required',FALSE)
    )
    WHEN 'completed' THEN JSON_ARRAY(
      JSON_OBJECT('name','completed_by_user_id','label','Người hoàn thành','type','user_select','required',FALSE),
      JSON_OBJECT('name','completed_at','label','Ngày hoàn thành','type','datetime','required',FALSE),
      JSON_OBJECT('name','result_content','label','Kết quả thực hiện','type','textarea','required',FALSE)
    )
    WHEN 'customer_notified' THEN JSON_ARRAY(
      JSON_OBJECT('name','notified_by_user_id','label','Người báo khách hàng','type','user_select','required',FALSE),
      JSON_OBJECT('name','notified_at','label','Ngày báo khách hàng','type','datetime','required',FALSE),
      JSON_OBJECT('name','notification_channel','label','Kênh báo khách hàng','type','text','required',FALSE),
      JSON_OBJECT('name','notification_content','label','Nội dung báo khách hàng','type','textarea','required',FALSE),
      JSON_OBJECT('name','customer_feedback','label','Phản hồi khách hàng','type','textarea','required',FALSE)
    )
    WHEN 'returned_to_manager' THEN JSON_ARRAY(
      JSON_OBJECT('name','returned_by_user_id','label','Người chuyển trả','type','user_select','required',FALSE),
      JSON_OBJECT('name','returned_at','label','Ngày chuyển trả','type','datetime','required',FALSE),
      JSON_OBJECT('name','return_reason','label','Lý do chuyển trả','type','textarea','required',FALSE)
    )
    WHEN 'analysis' THEN JSON_ARRAY(
      JSON_OBJECT('name','performer_user_id','label','Người phân tích','type','user_select','required',FALSE),
      JSON_OBJECT('name','analysis_content','label','Nội dung phân tích','type','textarea','required',FALSE),
      JSON_OBJECT('name','analysis_completed_at','label','Ngày hoàn thành','type','datetime','required',FALSE)
    )
    WHEN 'coding' THEN JSON_ARRAY(
      JSON_OBJECT('name','developer_user_id','label','Dev thực hiện','type','user_select','required',TRUE),
      JSON_OBJECT('name','coding_content','label','Nội dung lập trình','type','textarea','required',FALSE),
      JSON_OBJECT('name','coding_phase','label','Sub-status','type','select','required',TRUE),
      JSON_OBJECT('name','upcode_version','label','Phiên bản upcode','type','text','required',FALSE),
      JSON_OBJECT('name','upcode_environment','label','Môi trường upcode','type','text','required',FALSE)
    )
    WHEN 'dms_transfer' THEN JSON_ARRAY(
      JSON_OBJECT('name','dms_contact_user_id','label','Người phụ trách DMS','type','hidden','required',FALSE),
      JSON_OBJECT('name','exchange_content','label','Nội dung trao đổi','type','textarea','required',FALSE),
      JSON_OBJECT('name','task_ref','label','Mã task','type','text','required',FALSE),
      JSON_OBJECT('name','task_url','label','URL task','type','url','required',FALSE),
      JSON_OBJECT('name','dms_phase','label','Sub-status','type','select','required',TRUE)
    )
    ELSE form_fields_json
  END,
  updated_at = NOW()
WHERE status_code IN (
  'assigned_to_receiver',
  'pending_dispatch',
  'receiver_in_progress',
  'waiting_customer_feedback',
  'in_progress',
  'not_executed',
  'completed',
  'customer_notified',
  'returned_to_manager',
  'analysis',
  'coding',
  'dms_transfer'
);
