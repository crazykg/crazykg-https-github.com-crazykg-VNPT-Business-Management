-- ================================================================================
-- SCRIPT TEST IMPORT 2 YÊU CẦU ĐẦU TIÊN
-- Ngày: 2026-04-02
-- Mục đích: Test import 2 yêu cầu đầu tiên trước khi chạy toàn bộ 197 yêu cầu
-- ================================================================================
--
-- CÁCH CHẠY ĐÚNG (với UTF-8 encoding):
-- mysql -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 < 2026-04-02_02a_test_2_requests.sql
-- ================================================================================

-- SET encoding UTF-8
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

--
-- REFERENCE DATA:
-- ================
-- workflow_definition_id = 4 (LUONG_A - Luồng xử lý Yêu cầu khách hàng)
--
-- SUPPORT SERVICE GROUPS:
--   1 = HIS L2
--   2 = HIS L3
--   5 = HOÀN THIỆN PHẦN MỀM
--   6 = Hiss Bệnh Viện Sản Nhi
--
-- INTERNAL USERS (receivers):
--  10 = Phạm Thanh Trào
--  32 = Phan Phú Thịnh
--  36 = Lê Đào Thiên Đức
--  39 = Nguyễn Hải Đăng
--  42 = Trương Công Quốc Huy
--  43 = Nguyễn Vĩnh Lạp
--  45 = Võ Hoàng Kiệt
--  46 = Dương Tố Như
--  50 = Nguyễn Nhựt Trường
--
-- CUSTOMERS (customer_code -> id):
--   93007 -> 3 (Bệnh viện Sản - Nhi Hậu Giang)
--   93999 -> (sẽ tạo cho BV Ung bướu Cần Thơ)
-- ================================================================================

-- Tạo customers mới nếu chưa tồn tại
INSERT IGNORE INTO `customers` (`customer_code`, `customer_name`, `created_by`, `created_at`, `updated_at`)
VALUES
    ('93007', 'Bệnh viện Sản - Nhi Hậu Giang', 9, NOW(), NOW()),
    ('93999', 'Bệnh viện Ung bướu Cần Thơ', 9, NOW(), NOW());

-- INSERT 2 yêu cầu test với ĐẦY ĐỦ fields
INSERT INTO `customer_request_cases`
(`request_code`, `customer_id`, `customer_personnel_id`, `project_id`, `product_id`,
 `support_service_group_id`, `summary`, `description`, `priority`, `source_channel`,
 `workflow_definition_id`, `current_status_code`,
 `received_by_user_id`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
-- STT 1: In phiếu dinh dưỡng - BV Ung bướu Cần Thơ
('CRC-202604-0001',
 (SELECT id FROM customers WHERE customer_code = '93999'),  -- customer_id = BV Ung bướu Cần Thơ
 NULL,  -- customer_personnel_id (chưa xác định)
 NULL,  -- project_id (chưa xác định)
 NULL,  -- product_id (chưa xác định)
 1,     -- support_service_group_id = HIS L2
 'In phiếu dinh dưỡng không được BN: Nguyễn Huỳnh Gia Phú',
 'Bệnh viện Ung bướu Cần Thơ - Yêu cầu in phiếu dinh dưỡng',
 2,     -- priority = Trung bình
 'Kênh khác',  -- source_channel
 4,     -- workflow_definition_id = LUONG_A
 'new_intake',
 43,    -- received_by_user_id = Nguyễn Vĩnh Lạp
 9, 9,  -- created_by, updated_by
 NOW(), NOW()),

-- STT 2: Bổ sung tính năng - BV Sản Nhi
('CRC-202604-0002',
 (SELECT id FROM customers WHERE customer_code = '93007'),  -- customer_id = BV Sản Nhi
 NULL,  -- customer_personnel_id (chưa xác định)
 NULL,  -- project_id (chưa xác định)
 NULL,  -- product_id (chưa xác định)
 6,     -- support_service_group_id = Hiss Bệnh Viện Sản Nhi
 'Bổ sung tính năng theo phiếu yêu cầu',
 'BV Sản Nhi - Bổ sung tính năng',
 2,     -- priority = Trung bình
 'Kênh khác',  -- source_channel
 4,     -- workflow_definition_id = LUONG_A
 'new_intake',
 50,    -- received_by_user_id = Nguyễn Nhựt Trường
 9, 9,  -- created_by, updated_by
 NOW(), NOW());

-- Verify kết quả
SELECT '=== KẾT QUẢ TEST IMPORT ===' AS '';
SELECT
    crc.request_code,
    crc.summary,
    c.customer_name,
    c.customer_code,
    p.project_name,
    pr.product_name,
    iu.full_name AS receiver_name,
    ssg.group_name AS support_group,
    crc.workflow_definition_id,
    crc.current_status_code,
    crc.created_at
FROM customer_request_cases crc
LEFT JOIN customers c ON crc.customer_id = c.id
LEFT JOIN projects p ON crc.project_id = p.id
LEFT JOIN products pr ON crc.product_id = pr.id
LEFT JOIN internal_users iu ON crc.received_by_user_id = iu.id
LEFT JOIN support_service_groups ssg ON crc.support_service_group_id = ssg.id
WHERE crc.request_code IN ('CRC-202604-0001', 'CRC-202604-0002');

SELECT 'Test completed' AS status;
