-- ================================================================================
-- SCRIPT MAPPING DỮ LIỆU IMPORT 197 YÊU CẦU
-- Ngày: 2026-04-02
-- Mục đích: Tạo bảng tạm chứa mapping và chuẩn bị dữ liệu cho script insert
-- ================================================================================

-- Tạo bảng tạm chứa mapping customer
DROP TEMPORARY TABLE IF EXISTS `temp_customer_mapping`;
CREATE TEMPORARY TABLE `temp_customer_mapping` (
    `stt` INT,
    `don_vi` VARCHAR(255),
    `customer_code` VARCHAR(50),
    `customer_id` BIGINT
);

-- Mapping các đơn vị đã có trong database
INSERT INTO `temp_customer_mapping` VALUES
-- Các BV/TTYT đã có trong database
(1, 'Bệnh viện Ung bướu Cần Thơ', NULL, 3),
(2, 'BV Sản Nhi', '93007', 3),
(3, 'BVĐK KV Ngã Bảy', '93016', 14),
(4, 'BVĐK KV Ngã Bảy', '93016', 14),
(5, 'Phòng khám Nhơn Ái', NULL, NULL),
(6, 'Bệnh viện Tâm Thần Cần Thơ', NULL, NULL),
(7, 'Bệnh viện Ung bướu Cần Thơ', NULL, 3),
(8, 'BV Sản Nhi', '93007', 3),
(9, 'PK Hòa Hảo Long Mỹ', NULL, NULL),
(10, 'TTYT KV Long Mỹ', '93003', 7),
(11, 'TTYT KV Long Mỹ', '93003', 7),
(12, 'BVĐK KV Ngã Bảy', '93016', 14),
(13, 'Trạm Y tế Hỏa Lựu', '93015', 97),
(14, 'TTYT KV Châu Thành', '93005', 12),
(15, 'TTYT KV Long Mỹ', '93003', 7),
(16, 'TTYT KV Phụng Hiệp', '93004', 8),
(17, 'Bệnh viện Ung bướu Cần Thơ', NULL, 3),
(18, 'PK Hòa Hảo Long Mỹ', NULL, NULL),
(19, 'TTYT KV Vị Thủy', NULL, NULL),
(20, 'TTYT KV Châu Thành', '93005', 12);

-- Tạo bảng tạm chứa mapping người tiếp nhận
DROP TEMPORARY TABLE IF EXISTS `temp_receiver_mapping`;
CREATE TEMPORARY TABLE `temp_receiver_mapping` (
    `receiver_name` VARCHAR(255),
    `user_id` BIGINT
);

-- Mapping người tiếp nhận từ internal_users
INSERT INTO `temp_receiver_mapping` VALUES
('Nguyễn Vĩnh Lạp', 43),
('Nguyễn Nhựt Trường', 50),
('Phan Phú Thịnh', 32),
('Dương Tố Như', 46),
('Phạm Thanh Trào', 10),
('Trương Công Quốc Huy', 42),
('Lê Đào Thiên Đức', 36),
('Nguyễn Hải Đăng', 39),
('Võ Hoàng Kiệt', 45),
('A. Khanh', NULL),
('C. Nữ', NULL),
('Phát', NULL),
('Trường', NULL),
('Đăng TH', NULL),
('A. Huy', NULL),
('A. Thảo', NULL),
('A. Rở', NULL),
('Duy', NULL),
('Luận', NULL);

-- Tạo bảng tạm chứa mapping nhóm hỗ trợ
DROP TEMPORARY TABLE IF EXISTS `temp_group_mapping`;
CREATE TEMPORARY TABLE `temp_group_mapping` (
    `nhom_zalo` VARCHAR(255),
    `group_code` VARCHAR(50),
    `group_id` BIGINT
);

-- Mapping các nhóm hỗ trợ
INSERT INTO `temp_group_mapping` VALUES
('Dược - Vật tư | BV Ung Bướu & VNPT', NULL, 1),
('Phần mềm Sản Nhi', NULL, 6),
(NULL, NULL, 2),
(NULL, NULL, 2),
(NULL, NULL, 2),
(NULL, NULL, 2),
('Nội trú | BV Ung Bướu & VNPT', NULL, 1),
('EMR - BVĐK Ngã Bảy', NULL, 2),
('[PKLM] IT - Support', NULL, 2),
('HISs -EMR TTYT khu vực Long Mỹ', NULL, 2),
('EMR - BVĐK Ngã Bảy', NULL, 2),
('HISs - TYT H Phụng Hiệp', NULL, 2),
('Hiss IT - Châu Thành 93005', NULL, 2),
('Tiếp nhận yêu cầu HIS TTYT TXLM', NULL, 2),
('HIss IT - Phụng Hiệp', NULL, 2),
('[PKLM] PK Long Mỹ - Cần Thơ: HIS - LIS', NULL, 2),
('BVĐKTP NBAY', NULL, 2),
('EMR-Bệnh viện Sản Nhi', NULL, 6),
('Hiss - yêu cầu lập trình BVĐK Ngã Bảy', NULL, 2),
('HISs - BV Tâm thần _ Da liễu', NULL, 2),
('VNPT HMIS Huyện Vĩnh Thạnh', NULL, 2),
('PHẦN MỀM PK TÂM PHÚC', NULL, 2),
('HOÀN THIỆN PHẦN MỀM', NULL, 5);

-- Hiển thị mapping summary
SELECT 'Customer Mapping Summary' AS info;
SELECT don_vi, COUNT(*) as so_luong FROM temp_customer_mapping GROUP BY don_vi;

SELECT 'Receiver Mapping Summary' AS info;
SELECT receiver_name, user_id FROM temp_receiver_mapping WHERE user_id IS NOT NULL;

SELECT 'Group Mapping Summary' AS info;
SELECT group_code, COUNT(*) as so_luong FROM temp_group_mapping WHERE group_code IS NOT NULL GROUP BY group_code;

-- Cleanup
DROP TEMPORARY TABLE IF EXISTS `temp_customer_mapping`;
DROP TEMPORARY TABLE IF EXISTS `temp_receiver_mapping`;
DROP TEMPORARY TABLE IF EXISTS `temp_group_mapping`;

SELECT 'Data mapping preparation completed' AS status;
