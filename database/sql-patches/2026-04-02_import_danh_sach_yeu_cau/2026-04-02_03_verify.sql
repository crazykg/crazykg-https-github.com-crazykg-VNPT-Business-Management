-- ================================================================================
-- SCRIPT VERIFY KẾT QUẢ IMPORT 197 YÊU CẦU
-- Ngày: 2026-04-02
-- Mục đích: Kiểm tra kết quả sau khi import
-- ================================================================================

-- 1. Kiểm tra tổng số lượng yêu cầu đã import
SELECT '=== TỔNG SỐ LƯỢNG YÊU CẦU ĐÃ IMPORT ===' AS '';
SELECT COUNT(*) AS total_imported
FROM customer_request_cases
WHERE request_code LIKE 'CRC-202604-%';

-- 2. Kiểm tra số lượng theo trạng thái
SELECT '=== SỐ LƯỢNG THEO TRẠNG THÁI ===' AS '';
SELECT current_status_code, COUNT(*) AS so_luong
FROM customer_request_cases
WHERE request_code LIKE 'CRC-202604-%'
GROUP BY current_status_code;

-- 3. Kiểm tra số lượng theo khách hàng
SELECT '=== SỐ LƯỢNG THEO KHÁCH HÀNG ===' AS '';
SELECT c.customer_name, COUNT(crc.id) AS so_yeu_cau
FROM customer_request_cases crc
LEFT JOIN customers c ON crc.customer_id = c.id
WHERE crc.request_code LIKE 'CRC-202604-%'
GROUP BY c.id, c.customer_name
ORDER BY so_yeu_cau DESC;

-- 4. Kiểm tra số lượng theo nhóm hỗ trợ
SELECT '=== SỐ LƯỢNG THEO NHÓM HỖ TRỢ ===' AS '';
SELECT ssg.group_name, COUNT(crc.id) AS so_yeu_cau
FROM customer_request_cases crc
LEFT JOIN support_service_groups ssg ON crc.support_service_group_id = ssg.id
WHERE crc.request_code LIKE 'CRC-202604-%'
GROUP BY ssg.id, ssg.group_name
ORDER BY so_yeu_cau DESC;

-- 5. Kiểm tra các yêu cầu chưa map được customer
SELECT '=== YÊU CẦU CHƯA MAP ĐƯỢC KHÁCH HÀNG ===' AS '';
SELECT crc.request_code, crc.summary, crc.customer_id
FROM customer_request_cases crc
WHERE crc.request_code LIKE 'CRC-202604-%'
AND crc.customer_id IS NULL;

-- 6. Kiểm tra các yêu cầu chưa map được người tiếp nhận
SELECT '=== YÊU CẦU CHƯA MAP ĐƯỢC NGƯỜI TIẾP NHẬN ===' AS '';
SELECT crc.request_code, crc.summary, crc.received_by_user_id
FROM customer_request_cases crc
WHERE crc.request_code LIKE 'CRC-202604-%'
AND crc.received_by_user_id IS NULL;

-- 7. Kiểm tra 10 yêu cầu đầu tiên
SELECT '=== 10 YÊU CẦU ĐẦU TIÊN ===' AS '';
SELECT
    crc.request_code,
    crc.summary,
    c.customer_name,
    ssg.group_name AS support_group,
    iu.full_name AS receiver_name,
    crc.current_status_code,
    crc.created_at
FROM customer_request_cases crc
LEFT JOIN customers c ON crc.customer_id = c.id
LEFT JOIN support_service_groups ssg ON crc.support_service_group_id = ssg.id
LEFT JOIN internal_users iu ON crc.received_by_user_id = iu.id
WHERE crc.request_code LIKE 'CRC-202604-%'
ORDER BY crc.id ASC
LIMIT 10;

-- 8. Kiểm tra 10 yêu cầu cuối cùng
SELECT '=== 10 YÊU CẦU CUỐI CÙNG ===' AS '';
SELECT
    crc.request_code,
    crc.summary,
    c.customer_name,
    ssg.group_name AS support_group,
    iu.full_name AS receiver_name,
    crc.current_status_code,
    crc.created_at
FROM customer_request_cases crc
LEFT JOIN customers c ON crc.customer_id = c.id
LEFT JOIN support_service_groups ssg ON crc.support_service_group_id = ssg.id
LEFT JOIN internal_users iu ON crc.received_by_user_id = iu.id
WHERE crc.request_code LIKE 'CRC-202604-%'
ORDER BY crc.id DESC
LIMIT 10;

-- 9. Tổng kết
SELECT '=== TỔNG KẾT ===' AS '';
SELECT
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%') AS tong_yeu_cau,
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%' AND current_status_code = 'new_intake') AS trang_thai_new_intake,
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%' AND customer_id IS NOT NULL) AS da_map_customer,
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%' AND customer_id IS NULL) AS chua_map_customer,
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%' AND received_by_user_id IS NOT NULL) AS da_map_receiver,
    (SELECT COUNT(*) FROM customer_request_cases WHERE request_code LIKE 'CRC-202604-%' AND received_by_user_id IS NULL) AS chua_map_receiver;

SELECT 'Verify completed' AS status;
