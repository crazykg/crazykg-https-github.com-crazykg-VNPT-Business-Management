-- ============================================================================
-- DATABASE THIẾT KẾ LƯU TRỮ BẢNG USE CASE
-- Dự án: Hệ thống thông tin quản lý Dân số và Kế hoạch hoá gia đình
-- Nguồn: BangUseCase.xlsx
-- Ngày tạo: 2026-03-21
-- Cập nhật: 2026-03-21 — Kết nối trực tiếp use_cases với projects
-- ============================================================================

-- ============================================================================
-- QUAN HỆ TỔNG QUAN:
--
--   projects (1) ──┬──< subsystems (N)     ──< function_groups (N)
--                  │
--                  ├──< actors (N)
--                  │
--                  └──< use_cases (N)  ──── mỗi dự án có bảng UC riêng
--                           │
--                           ├── (tuỳ chọn) → subsystem_id
--                           ├── (tuỳ chọn) → function_group_id
--                           ├──< use_case_actors (N-N với actors)
--                           ├──< use_case_steps (N)
--                           ├──< use_case_attachments (N)
--                           └──< use_case_audit_logs (N)
-- ============================================================================


-- ============================================================================
-- 1. BẢNG DỰ ÁN (Projects)
-- Bảng gốc — mỗi dự án sở hữu toàn bộ dữ liệu UseCase riêng biệt
-- ============================================================================
CREATE TABLE projects (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_code    VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã dự án (duy nhất toàn hệ thống)',
    project_name    VARCHAR(500) NOT NULL COMMENT 'Tên dự án',
    description     TEXT NULL COMMENT 'Mô tả dự án',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản/tài liệu đính kèm dự án',
    start_date      DATE NULL COMMENT 'Ngày bắt đầu dự án',
    end_date        DATE NULL COMMENT 'Ngày kết thúc dự án (dự kiến)',
    status          ENUM('draft', 'in_progress', 'completed', 'archived') DEFAULT 'draft' COMMENT 'Trạng thái dự án',
    created_by      BIGINT UNSIGNED NULL COMMENT 'Người tạo',
    updated_by      BIGINT UNSIGNED NULL COMMENT 'Người cập nhật',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL COMMENT 'Soft delete',

    INDEX idx_projects_status (status),
    INDEX idx_projects_code (project_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bảng lưu thông tin dự án — gốc sở hữu toàn bộ Use Case';


-- ============================================================================
-- 2. BẢNG HỆ THỐNG CON / MODULE (Subsystems)
-- Tương ứng cấp I, II trong file Excel
-- Thuộc về 1 project cụ thể
-- ============================================================================
CREATE TABLE subsystems (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT UNSIGNED NOT NULL COMMENT 'FK → projects: hệ thống con thuộc dự án nào',
    subsystem_code  VARCHAR(20) NOT NULL COMMENT 'Mã hệ thống con (I, II, III...)',
    subsystem_name  VARCHAR(500) NOT NULL COMMENT 'Tên hệ thống con',
    description     TEXT NULL COMMENT 'Mô tả hệ thống con',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản mô tả chi tiết',
    sort_order      INT DEFAULT 0 COMMENT 'Thứ tự sắp xếp',
    created_by      BIGINT UNSIGNED NULL,
    updated_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,

    CONSTRAINT fk_subsystems_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY uk_subsystem_code_project (project_id, subsystem_code),
    INDEX idx_subsystems_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hệ thống con / module (cấp I, II) — thuộc 1 dự án';


-- ============================================================================
-- 3. BẢNG NHÓM CHỨC NĂNG (Function Groups)
-- Tương ứng cấp I.1, I.2, I.3, II.1, II.2 trong file Excel
-- ============================================================================
CREATE TABLE function_groups (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT UNSIGNED NOT NULL COMMENT 'FK → projects: nhóm thuộc dự án nào (denormalized để query nhanh)',
    subsystem_id    BIGINT UNSIGNED NULL COMMENT 'FK → subsystems (NULL nếu không phân cấp subsystem)',
    group_code      VARCHAR(20) NOT NULL COMMENT 'Mã nhóm chức năng (I.1, I.2, I.3, II.1...)',
    group_name      VARCHAR(500) NOT NULL COMMENT 'Tên nhóm chức năng',
    description     TEXT NULL COMMENT 'Mô tả nhóm chức năng',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản mô tả chi tiết',
    sort_order      INT DEFAULT 0 COMMENT 'Thứ tự sắp xếp',
    created_by      BIGINT UNSIGNED NULL,
    updated_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,

    CONSTRAINT fk_function_groups_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_function_groups_subsystem FOREIGN KEY (subsystem_id) REFERENCES subsystems(id) ON DELETE SET NULL,
    UNIQUE KEY uk_group_code_project (project_id, group_code),
    INDEX idx_function_groups_project (project_id),
    INDEX idx_function_groups_subsystem (subsystem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nhóm chức năng (cấp I.1, I.2, II.1...) — thuộc 1 dự án';


-- ============================================================================
-- 4. BẢNG TÁC NHÂN (Actors)
-- Mỗi dự án có danh sách tác nhân riêng
-- ============================================================================
CREATE TABLE actors (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT UNSIGNED NOT NULL COMMENT 'FK → projects: tác nhân thuộc dự án nào',
    actor_name      VARCHAR(200) NOT NULL COMMENT 'Tên tác nhân',
    actor_type      ENUM('human', 'system', 'external') DEFAULT 'human' COMMENT 'Loại tác nhân',
    description     TEXT NULL COMMENT 'Mô tả tác nhân',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản mô tả chi tiết',
    created_by      BIGINT UNSIGNED NULL,
    updated_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,

    CONSTRAINT fk_actors_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY uk_actor_name_project (project_id, actor_name),
    INDEX idx_actors_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Danh sách tác nhân — mỗi dự án có actors riêng';


-- ============================================================================
-- 5. BẢNG USE CASE (Use Cases) — BẢNG CHÍNH
-- ★ KẾT NỐI TRỰC TIẾP VỚI PROJECT ★
-- Mỗi dự án sở hữu tập Use Case riêng biệt
-- subsystem_id và function_group_id là TUỲ CHỌN (cho phép phân cấp linh hoạt)
-- ============================================================================
CREATE TABLE use_cases (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- ★ FK TRỰC TIẾP TỚI DỰ ÁN — mỗi dự án có bảng UC riêng
    project_id          BIGINT UNSIGNED NOT NULL COMMENT 'FK → projects: Use Case thuộc dự án nào',

    -- FK tuỳ chọn — phân cấp nhóm (NULL nếu UC không thuộc subsystem/group nào)
    subsystem_id        BIGINT UNSIGNED NULL COMMENT 'FK → subsystems (tuỳ chọn)',
    function_group_id   BIGINT UNSIGNED NULL COMMENT 'FK → function_groups (tuỳ chọn)',

    -- ═══ CÁC CỘT TỪ FILE EXCEL ═══

    -- Cột TT (Số thứ tự trong nhóm)
    sequence_number     INT NOT NULL COMMENT 'Số thứ tự Use Case trong nhóm (cột TT)',

    -- Cột B: Tên Use-Case
    use_case_code       VARCHAR(50) NULL COMMENT 'Mã Use Case (tuỳ chọn, VD: UC-001)',
    use_case_name       VARCHAR(500) NOT NULL COMMENT 'Tên Use Case',

    -- Cột E: Mô tả Use-Case (nội dung dạng text nhiều dòng)
    use_case_description TEXT NULL COMMENT 'Mô tả Use Case (các bước xử lý)',

    -- Cột F: Mức độ cần thiết
    necessity_level     VARCHAR(50) NULL COMMENT 'Mức độ cần thiết: Bắt buộc (B), Mong muốn (M), Tuỳ chọn (T)',

    -- Cột G: Số transaction
    transaction_count   INT NULL COMMENT 'Số lượng transaction',

    -- Cột H: Mức độ phức tạp
    complexity_level    VARCHAR(50) NULL COMMENT 'Mức độ phức tạp: Đơn giản, Trung Bình, Phức tạp',

    -- Cột I: Phân loại
    classification      VARCHAR(100) NULL COMMENT 'Phân loại: Dữ liệu đầu vào, Dữ liệu đầu ra, Truy vấn...',

    -- Cột J: Ghi chú
    notes               TEXT NULL COMMENT 'Ghi chú bổ sung',

    -- ═══ TRƯỜNG BỔ SUNG: LƯU VĂN BẢN ═══
    document_content    LONGTEXT NULL COMMENT 'Nội dung văn bản đặc tả chi tiết Use Case (đặc tả kỹ thuật, mockup mô tả, ...)',
    document_format     VARCHAR(20) DEFAULT 'plain' COMMENT 'Định dạng văn bản: plain, markdown, html',

    -- ═══ METADATA ═══
    status              ENUM('draft', 'reviewed', 'approved', 'implemented', 'tested') DEFAULT 'draft' COMMENT 'Trạng thái Use Case',
    version             INT DEFAULT 1 COMMENT 'Phiên bản',
    sort_order          INT DEFAULT 0 COMMENT 'Thứ tự sắp xếp tuỳ chỉnh',
    created_by          BIGINT UNSIGNED NULL,
    updated_by          BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,

    -- ═══ CONSTRAINTS & INDEXES ═══
    CONSTRAINT fk_use_cases_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_use_cases_subsystem FOREIGN KEY (subsystem_id) REFERENCES subsystems(id) ON DELETE SET NULL,
    CONSTRAINT fk_use_cases_function_group FOREIGN KEY (function_group_id) REFERENCES function_groups(id) ON DELETE SET NULL,

    -- Index chính: lọc UC theo dự án (query phổ biến nhất)
    INDEX idx_use_cases_project (project_id),
    -- Index phân cấp: lọc UC theo subsystem hoặc function_group trong dự án
    INDEX idx_use_cases_project_subsystem (project_id, subsystem_id),
    INDEX idx_use_cases_project_group (project_id, function_group_id),
    -- Index tìm kiếm
    INDEX idx_use_cases_name (use_case_name),
    INDEX idx_use_cases_code (use_case_code),
    INDEX idx_use_cases_necessity (necessity_level),
    INDEX idx_use_cases_complexity (complexity_level),
    INDEX idx_use_cases_status (status),
    -- Unique: mã UC không trùng trong cùng 1 dự án
    UNIQUE KEY uk_use_case_code_project (project_id, use_case_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='★ BẢNG CHÍNH — Use Case thuộc trực tiếp 1 dự án, mỗi dự án có tập UC riêng';


-- ============================================================================
-- 6. BẢNG LIÊN KẾT USE CASE — TÁC NHÂN (Many-to-Many)
-- ============================================================================
CREATE TABLE use_case_actors (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'FK → use_cases',
    actor_id        BIGINT UNSIGNED NOT NULL COMMENT 'FK → actors',
    actor_role      ENUM('primary', 'secondary') NOT NULL COMMENT 'Vai trò: primary = Tác nhân chính, secondary = Tác nhân phụ',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_uca_use_case FOREIGN KEY (use_case_id) REFERENCES use_cases(id) ON DELETE CASCADE,
    -- FIX(ISSUE-13): RESTRICT — không cho xoá actor nếu đang được liên kết với UC
    CONSTRAINT fk_uca_actor FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_use_case_actor_role (use_case_id, actor_id, actor_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Liên kết Use Case ↔ Tác nhân (N-N, phân biệt chính/phụ)';


-- ============================================================================
-- 7. BẢNG CÁC BƯỚC CỦA USE CASE (Use Case Steps)
-- ============================================================================
CREATE TABLE use_case_steps (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'FK → use_cases',
    step_number     INT NOT NULL COMMENT 'Số thứ tự bước',
    step_description TEXT NOT NULL COMMENT 'Mô tả bước thực hiện',
    step_type       ENUM('main', 'alternative', 'exception') DEFAULT 'main' COMMENT 'Loại: main = luồng chính, alternative = luồng thay thế, exception = ngoại lệ',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản chi tiết cho bước này',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_steps_use_case FOREIGN KEY (use_case_id) REFERENCES use_cases(id) ON DELETE CASCADE,
    UNIQUE KEY uk_step_number (use_case_id, step_number, step_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Các bước chi tiết của Use Case';


-- ============================================================================
-- 8. BẢNG FILE ĐÍNH KÈM (Attachments)
-- ============================================================================
CREATE TABLE use_case_attachments (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'FK → use_cases',
    file_name       VARCHAR(500) NOT NULL COMMENT 'Tên file gốc',
    file_path       VARCHAR(1000) NOT NULL COMMENT 'Đường dẫn lưu trữ file',
    file_size       BIGINT UNSIGNED NULL COMMENT 'Kích thước file (bytes)',
    file_type       VARCHAR(100) NULL COMMENT 'MIME type (image/png, application/pdf...)',
    description     TEXT NULL COMMENT 'Mô tả file đính kèm',
    document_content LONGTEXT NULL COMMENT 'Nội dung văn bản trích xuất từ file (nếu có)',
    created_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,

    CONSTRAINT fk_attachments_use_case FOREIGN KEY (use_case_id) REFERENCES use_cases(id) ON DELETE CASCADE,
    INDEX idx_attachments_file_type (file_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='File đính kèm cho Use Case';


-- ============================================================================
-- 9. BẢNG LỊCH SỬ THAY ĐỔI (Audit Log)
-- ============================================================================
CREATE TABLE use_case_audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'FK → use_cases',
    action          ENUM('create', 'update', 'delete', 'restore', 'status_change') NOT NULL COMMENT 'Hành động',
    field_changed   VARCHAR(100) NULL COMMENT 'Trường bị thay đổi',
    old_value       TEXT NULL COMMENT 'Giá trị cũ',
    new_value       TEXT NULL COMMENT 'Giá trị mới',
    changed_by      BIGINT UNSIGNED NULL COMMENT 'Người thay đổi',
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- FIX(ISSUE-10): RESTRICT thay vì CASCADE — audit logs immutable, không bị xoá khi UC bị force delete
    CONSTRAINT fk_audit_use_case FOREIGN KEY (use_case_id) REFERENCES use_cases(id) ON DELETE RESTRICT,
    INDEX idx_audit_action (action),
    INDEX idx_audit_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lịch sử thay đổi Use Case';


-- ============================================================================
-- 10. BẢNG ARCHIVE AUDIT LOGS (FIX ISSUE-15/16)
-- Lưu trữ audit logs khi UC bị force-delete
-- ============================================================================
CREATE TABLE use_case_audit_logs_archive (
    id              BIGINT UNSIGNED PRIMARY KEY COMMENT 'Giữ nguyên ID gốc từ use_case_audit_logs',
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'UC ID gốc (không FK vì UC đã bị xoá)',
    action          ENUM('create', 'update', 'delete', 'restore', 'status_change') NOT NULL COMMENT 'Hành động',
    field_changed   VARCHAR(100) NULL COMMENT 'Trường bị thay đổi',
    old_value       TEXT NULL COMMENT 'Giá trị cũ',
    new_value       TEXT NULL COMMENT 'Giá trị mới',
    changed_by      BIGINT UNSIGNED NULL COMMENT 'Người thay đổi',
    changed_at      TIMESTAMP NOT NULL COMMENT 'Thời điểm thay đổi gốc',
    -- Metadata archive
    archived_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm chuyển vào archive',
    archived_by     BIGINT UNSIGNED NULL COMMENT 'Admin thực hiện archive',
    archive_reason  VARCHAR(200) NULL COMMENT 'Lý do: force_delete_uc, data_retention, ...',

    INDEX idx_archive_uc (use_case_id),
    INDEX idx_archive_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Archive bảng audit logs — lưu trữ log khi UC bị force-delete. Retention: tối thiểu 2 năm';


-- ============================================================================
-- ============================================================================
-- DỮ LIỆU MẪU (INSERT) — Từ file BangUseCase.xlsx
-- ============================================================================
-- ============================================================================

-- -------------------------------------------
-- DỰ ÁN
-- -------------------------------------------
INSERT INTO projects (id, project_code, project_name, description) VALUES
(1, 'PL3-DANSO',
 'PL3. BẢNG CHUYỂN ĐỔI CHỨC NĂNG SANG TRƯỜNG HỢP SỬ DỤNG PHẦN MỀM DÂN SỐ',
 'Dự án Hệ thống thông tin quản lý Dân số và Kế hoạch hoá gia đình');

-- -------------------------------------------
-- HỆ THỐNG CON (Subsystems) — thuộc dự án 1
-- -------------------------------------------
INSERT INTO subsystems (id, project_id, subsystem_code, subsystem_name, sort_order) VALUES
(1, 1, 'I',  'Website Hệ thống thông tin quản lý Dân số và Kế hoạch hoá gia đình', 1),
(2, 1, 'II', 'Ứng dụng di động Điều tra, thu thập di biến động dân số và kế hoạch hoá gia đình', 2);

-- -------------------------------------------
-- NHÓM CHỨC NĂNG (Function Groups) — thuộc dự án 1
-- ★ Thêm project_id trực tiếp
-- -------------------------------------------
INSERT INTO function_groups (id, project_id, subsystem_id, group_code, group_name, sort_order) VALUES
(1, 1, 1, 'I.1',  'Hệ thống', 1),
(2, 1, 1, 'I.2',  'Cán bộ Dân số, CTV', 2),
(3, 1, 1, 'I.3',  'Phân hệ chức năng dân số', 3),
(4, 1, 2, 'II.1', 'Hệ thống', 4),
(5, 1, 2, 'II.2', 'Phân hệ chức năng dân số', 5);

-- -------------------------------------------
-- TÁC NHÂN (Actors) — thuộc dự án 1
-- -------------------------------------------
INSERT INTO actors (id, project_id, actor_name, actor_type, description) VALUES
(1, 1, 'Quản trị viên',  'human', 'Quản trị viên hệ thống'),
(2, 1, 'Cán bộ Dân số',  'human', 'Cán bộ dân số cấp xã/huyện/tỉnh'),
(3, 1, 'Cộng tác viên',  'human', 'Cộng tác viên dân số tại cộng đồng'),
(4, 1, 'Công tác viên',  'human', 'Công tác viên (alias cho Cộng tác viên)');


-- ============================================================================
-- USE CASES — ★ Tất cả đều có project_id = 1
-- ============================================================================

-- -------------------------------------------
-- NHÓM I.1: Hệ thống (Website)
-- -------------------------------------------
INSERT INTO use_cases (id, project_id, subsystem_id, function_group_id, sequence_number, use_case_code, use_case_name, use_case_description, necessity_level, transaction_count, complexity_level, classification, notes) VALUES
(1, 1, 1, 1, 1, 'UC-I1-001', 'Đăng nhập',
 '1. Hệ thống kiểm tra tồn tại của tài khoản\n2. Thông báo nếu không tài khoản không tồn tại\n3. Tạo phiên làm việc nếu tài khoản tồn tại',
 'Bắt buộc (B)', 3, NULL, 'Dữ liệu đầu vào', NULL),

(2, 1, 1, 1, 2, 'UC-I1-002', 'Đổi mật khẩu',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quy tắc đặt mật khẩu\n3. Cho phép cập nhật mật khẩu mới',
 'Bắt buộc (B)', 3, NULL, 'Dữ liệu đầu vào', NULL),

(3, 1, 1, 1, 3, 'UC-I1-003', 'Đăng xuất',
 '1. Hệ thống huỷ phiên làm việc',
 'Bắt buộc (B)', 1, NULL, 'Dữ liệu đầu vào', NULL);

-- -------------------------------------------
-- NHÓM I.2: Cán bộ Dân số, CTV (Website)
-- -------------------------------------------
INSERT INTO use_cases (id, project_id, subsystem_id, function_group_id, sequence_number, use_case_code, use_case_name, use_case_description, necessity_level, transaction_count, complexity_level, classification) VALUES
(4, 1, 1, 2, 1, 'UC-I2-001', 'Quản lý đơn vị sử dụng',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách đơn vị hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Tìm kiếm đơn vị\n5. Thêm mới đơn vị\n6. Chỉnh sửa đơn vị\n7. Xoá đơn vị\n8. Xuất danh sách dạng excel\n9. In danh sách',
 'Bắt buộc (B)', 9, NULL, 'Dữ liệu đầu vào'),

(5, 1, 1, 2, 2, 'UC-I2-002', 'Quản lý tài khoản',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách tài khoản hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Tìm kiếm tài khoản\n5. Thêm mới tài khoản\n6. Chỉnh sửa tài khoản\n7. Xoá tài khoản\n8. Đặt lại mật khẩu\n9. Xuất danh sách dạng excel\n10. In danh sách',
 'Bắt buộc (B)', 10, NULL, 'Dữ liệu đầu vào'),

(6, 1, 1, 2, 3, 'UC-I2-003', 'Quản lý nhóm quyền',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách nhóm quyền hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Tìm kiếm nhóm quyền\n5. Thêm mới nhóm quyền\n6. Chỉnh sửa nhóm quyền\n7. Xoá nhóm quyền\n8. Xuất danh sách dạng excel\n9. In danh sách',
 'Bắt buộc (B)', 9, NULL, 'Dữ liệu đầu vào'),

(7, 1, 1, 2, 4, 'UC-I2-004', 'Quản lý cập nhật chức năng cho nhóm quyền',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách nhóm quyền hiện hữu theo cấp đơn vị người đăng nhập\n4. Xem danh sách chức năng được gán cho nhóm quyền được chọn\n5. Gán chức năng cho nhóm quyền được chọn',
 'Bắt buộc (B)', 5, NULL, NULL),

(8, 1, 1, 2, 5, 'UC-I2-005', 'Quản lý phân quyền cho tài khoản',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách tài khoản hiện hữu theo cấp đơn vị người đăng nhập\n4. Xem danh sách nhóm quyền theo cấp đơn vị người đăng nhập\n5. Xem danh sách nhóm quyền được gán cho tài khoản được chọn\n6. Gán nhóm quyền cho tài khoản được chọn',
 'Bắt buộc (B)', 6, NULL, NULL),

(9, 1, 1, 2, 6, 'UC-I2-006', 'Quản lý menu',
 '1. Hệ thống kiểm tra session.\n2. Xem danh sách menu hiện hữu\n3. Tìm kiếm nhóm quyền\n4. Thêm mới nhóm quyền\n5. Chỉnh sửa nhóm quyền\n6. Xoá nhóm quyền\n7. Xuất danh sách dạng excel\n8. In danh sách',
 'Bắt buộc (B)', 8, NULL, NULL),

(10, 1, 1, 2, 7, 'UC-I2-007', 'Danh sách chính sách dân số',
 '1. Hệ thống kiểm tra session.\n2. Xem danh sách chính sách dân số.\n3. Thêm mới danh sách chính sách dân số.\n4. Chỉnh sửa danh sách chính sách dân số.',
 'Bắt buộc (B)', 4, NULL, NULL);

-- -------------------------------------------
-- NHÓM I.3: Phân hệ chức năng dân số (Website)
-- -------------------------------------------
INSERT INTO use_cases (id, project_id, subsystem_id, function_group_id, sequence_number, use_case_code, use_case_name, use_case_description, necessity_level, transaction_count, complexity_level, classification) VALUES
(11, 1, 1, 3, 1, 'UC-I3-001', 'Quản lý cộng tác viên',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách cộng tác viên hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Thêm mới cộng tác viên\n5. Chỉnh sửa cộng tác viên',
 'Bắt buộc (B)', 5, NULL, 'Dữ liệu đầu vào'),

(12, 1, 1, 3, 2, 'UC-I3-002', 'Quản lý bảng kê địa chỉ',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách bảng kê địa chỉ hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Thêm mới bảng kê địa chỉ\n5. Chỉnh sửa bảng kê địa chỉ',
 'Bắt buộc (B)', 5, NULL, 'Dữ liệu đầu vào'),

(13, 1, 1, 3, 3, 'UC-I3-003', 'Quản lý danh sách hộ khẩu',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách hộ gia đình hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Thêm mới hộ gia đình\n5. Chuyển đến hộ gia đình\n6. Chỉnh sửa hộ gia đình\n7. Xoá hộ gia đình\n8. Chuyển đi hộ gia đình\n9. Đánh dấu đã rà soát hộ gia đình',
 'Bắt buộc (B)', 9, NULL, 'Dữ liệu đầu vào'),

(14, 1, 1, 3, 4, 'UC-I3-004', 'Quản lý danh sách nhân khẩu',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách nhân khẩu hiện hữu theo hộ gia đình được chọn\n4. Thêm mới nhân khẩu\n5. Chuyển đến nhân khẩu\n6. Chỉnh sửa nhân khẩu\n7. Tạo biến Biến động hôn nhân\n8. Xoá nhân khẩu\n8. Chuyển đi nhân khẩu\n9. Tạo biến động tử vong',
 'Bắt buộc (B)', 9, NULL, 'Dữ liệu đầu vào'),

(15, 1, 1, 3, 5, 'UC-I3-005', 'Quản lý danh sách biện pháp tránh thai',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách kế hoạch hoá gia đình theo nhân khẩu được chọn\n4. Thêm mới biện pháp tránh thai\n5. Chỉnh sửa biện pháp tránh thai\n6. Xoá biện pháp tránh thai',
 'Bắt buộc (B)', 6, NULL, 'Dữ liệu đầu vào'),

(16, 1, 1, 3, 6, 'UC-I3-006', 'Quản lý danh sách sức khoẻ sinh sản',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách sức khoẻ sinh sản theo nhân khẩu được chọn\n4. Thêm mới sức khoẻ sinh sản\n5. Chỉnh sửa sức khoẻ sinh sản\n6. Xoá sức khoẻ sinh sản\n7. Thêm trẻ sinh',
 'Bắt buộc (B)', 7, NULL, 'Dữ liệu đầu vào'),

(17, 1, 1, 3, 7, 'UC-I3-007', 'Quản lý khám phụ khoa',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách khám phụ khoa theo nhân khẩu được chọn\n4. Thêm mới khám sức khoẻ\n5. Chỉnh sửa khám sức khoẻ\n6. Xoá khám sức khoẻ',
 NULL, NULL, NULL, NULL),

(18, 1, 1, 3, 8, 'UC-I3-008', 'Quản lý khám sức khoẻ người cao tuổi tại cộng đồng',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách khám sức khoẻ người cao tuổi theo nhân khẩu được chọn\n4. Thêm mới khám sức khoẻ\n5. Chỉnh sửa khám sức khoẻ\n6. Xoá khám sức khoẻ',
 NULL, NULL, NULL, NULL),

(19, 1, 1, 3, 9, 'UC-I3-009', 'Chăm sóc dinh dưỡng trẻ em',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách chăm sóc dinh dưỡng theo nhân khẩu được chọn\n4. Thêm mới chăm sóc dinh dưỡng\n5. Chỉnh sửa chăm sóc dinh dưỡng\n6. Xoá chăm sóc dinh dưỡng',
 NULL, NULL, NULL, NULL),

(20, 1, 1, 3, 10, 'UC-I3-010', 'Quản lý áp dụng chính sách dân số',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách khám sức khoẻ người cao tuổi theo nhân khẩu được chọn\n4. Thêm mới khám sức khoẻ\n5. Chỉnh sửa khám sức khoẻ\n6. Xoá khám sức khoẻ',
 NULL, NULL, NULL, NULL),

(21, 1, 1, 3, 11, 'UC-I3-011', 'Quản lý danh sách Biến động',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách biến động theo nhân khẩu được chọn\n4. Kiểm tra biến động có thể xoá\n5. Xoá biến động',
 'Bắt buộc (B)', 5, NULL, 'Dữ liệu đầu vào'),

(22, 1, 1, 3, 12, 'UC-I3-012', 'Chuyển địa chỉ',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách địa chỉ được phân quyền\n4. Chuyển địa chỉ trong huyện\n5. Chuyển địa chỉ ngoài huyện',
 'Bắt buộc (B)', 5, NULL, NULL),

(23, 1, 1, 3, 13, 'UC-I3-013', 'Chuyển hộ',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách hộ được phân quyền\n4. Chuyển hộ trong xã\n5. Chuyển hộ ngoài xã',
 'Bắt buộc (B)', 5, NULL, NULL),

(24, 1, 1, 3, 14, 'UC-I3-014', 'Tách hộ',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách nhân khẩu được phân quyền\n4. Tách hộ trong xã\n5. Tách hộ ngoài xã',
 'Bắt buộc (B)', 5, NULL, NULL);

-- -------------------------------------------
-- NHÓM II.1: Hệ thống (Mobile)
-- -------------------------------------------
INSERT INTO use_cases (id, project_id, subsystem_id, function_group_id, sequence_number, use_case_code, use_case_name, use_case_description, necessity_level, transaction_count, complexity_level, classification) VALUES
(25, 1, 2, 4, 1, 'UC-II1-001', 'Đăng nhập',
 '1. Hệ thống kiểm tra tồn tại của tài khoản\n2. Thông báo nếu không tài khoản không tồn tại\n3. Tạo phiên làm việc nếu tài khoản tồn tại',
 'Bắt buộc (B)', 3, 'Đơn giản', 'Dữ liệu đầu vào'),

(26, 1, 2, 4, 2, 'UC-II1-002', 'Đăng xuất',
 '1. Hệ thống huỷ phiên làm việc',
 'Bắt buộc (B)', 1, 'Đơn giản', 'Dữ liệu đầu vào'),

(27, 1, 2, 4, 3, 'UC-II1-003', 'Phân trang',
 '1. Cho phép phân trang',
 NULL, NULL, NULL, NULL);

-- -------------------------------------------
-- NHÓM II.2: Phân hệ chức năng dân số (Mobile)
-- -------------------------------------------
INSERT INTO use_cases (id, project_id, subsystem_id, function_group_id, sequence_number, use_case_code, use_case_name, use_case_description, necessity_level, transaction_count, complexity_level, classification) VALUES
(28, 1, 2, 5, 1, 'UC-II2-001', 'Quản lý hộ gia đình',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách hộ gia đình hiện hữu theo cấp theo cấp đơn vị người đăng nhập\n4. Thêm mới hộ gia đình\n5. Chuyển đến hộ gia đình\n6. Chỉnh sửa hộ gia đình\n7. Xoá hộ gia đình\n8. Chuyển đi hộ gia đình\n9. Đánh dấu đã rà soát hộ gia đình',
 'Bắt buộc (B)', 9, 'Phức tạp', 'Dữ liệu đầu vào'),

(29, 1, 2, 5, 2, 'UC-II2-002', 'Quản lý nhân khẩu',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách nhân khẩu hiện hữu theo hộ gia đình được chọn\n4. Thêm mới nhân khẩu\n5. Chuyển đến nhân khẩu\n6. Chỉnh sửa nhân khẩu\n7. Tạo biến Biến động hôn nhân\n8. Xoá nhân khẩu\n8. Chuyển đi nhân khẩu\n9. Tạo biến động tử vong',
 'Bắt buộc (B)', 9, 'Phức tạp', 'Dữ liệu đầu vào'),

(30, 1, 2, 5, 3, 'UC-II2-003', 'Quản lý thông tin kế hoạch hoá gia đình',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách kế hoạch hoá gia đình theo nhân khẩu được chọn\n4. Thêm mới biện pháp tránh thai\n5. Chỉnh sửa biện pháp tránh thai\n6. Xoá biện pháp tránh thai',
 'Bắt buộc (B)', 6, 'Trung Bình', 'Dữ liệu đầu vào'),

(31, 1, 2, 5, 4, 'UC-II2-004', 'Quản lý thông tin sức khoẻ sinh sản',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách sức khoẻ sinh sản theo nhân khẩu được chọn\n4. Thêm mới sức khoẻ sinh sản\n5. Chỉnh sửa sức khoẻ sinh sản\n6. Xoá sức khoẻ sinh sản\n7. Thêm trẻ sinh',
 'Bắt buộc (B)', 7, 'Trung Bình', 'Dữ liệu đầu vào'),

(32, 1, 2, 5, 5, 'UC-II2-005', 'Quản lý biến động',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách biến động theo nhân khẩu được chọn\n4. Kiểm tra biến động có thể xoá\n5. Xoá biến động',
 'Bắt buộc (B)', 5, 'Trung Bình', 'Dữ liệu đầu vào'),

(33, 1, 2, 5, 6, 'UC-II2-006', 'Quản lý danh sách cụm quản lý',
 '1. Hệ thống kiểm tra session.\n2. Hệ thống kiểm tra quyền theo cấp đơn vị người đăng nhập\n3. Xem danh sách cụm được phân quyền quản lý\n4. Huỷ rà soát toàn bộ cụm được phân quyền quản lý',
 'Bắt buộc (B)', 4, 'Trung Bình', 'Dữ liệu đầu vào');

-- -------------------------------------------
-- LIÊN KẾT USE CASE — TÁC NHÂN
-- -------------------------------------------
-- Nhóm I.1: Tác nhân chính: QTV + CBDS
INSERT INTO use_case_actors (use_case_id, actor_id, actor_role) VALUES
(1, 1, 'primary'), (1, 2, 'primary'),
(2, 1, 'primary'), (2, 2, 'primary'),
(3, 1, 'primary'), (3, 2, 'primary'), (3, 2, 'secondary');

-- Nhóm I.2: Tác nhân chính: QTV, Phụ: CBDS + CTV
INSERT INTO use_case_actors (use_case_id, actor_id, actor_role) VALUES
(4, 1, 'primary'),  (4, 2, 'secondary'),  (4, 4, 'secondary'),
(5, 1, 'primary'),  (5, 2, 'secondary'),  (5, 4, 'secondary'),
(6, 1, 'primary'),  (6, 2, 'secondary'),  (6, 4, 'secondary'),
(7, 1, 'primary'),  (7, 2, 'secondary'),  (7, 4, 'secondary'),
(8, 1, 'primary'),  (8, 2, 'secondary'),  (8, 4, 'secondary'),
(9, 1, 'primary'),  (9, 2, 'secondary'),  (9, 4, 'secondary'),
(10, 1, 'primary'), (10, 2, 'secondary'), (10, 4, 'secondary');

-- Nhóm I.3: Tác nhân chính: CBDS, Phụ: QTV
INSERT INTO use_case_actors (use_case_id, actor_id, actor_role) VALUES
(11, 2, 'primary'), (11, 1, 'secondary'),
(12, 2, 'primary'), (12, 1, 'secondary'),
(13, 2, 'primary'), (13, 1, 'secondary'),
(14, 2, 'primary'), (14, 1, 'secondary'),
(15, 2, 'primary'), (15, 1, 'secondary'),
(16, 2, 'primary'), (16, 1, 'secondary'),
(17, 2, 'primary'), (17, 1, 'secondary'),
(18, 2, 'primary'), (18, 1, 'secondary'),
(19, 2, 'primary'), (19, 1, 'secondary'),
(20, 2, 'primary'), (20, 1, 'secondary'),
(21, 2, 'primary'), (21, 1, 'secondary'),
(22, 2, 'primary'), (22, 1, 'secondary'),
(23, 2, 'primary'), (23, 1, 'secondary'),
(24, 2, 'primary'), (24, 1, 'secondary');

-- Nhóm II: Tác nhân chính: CTV, Phụ: QTV
INSERT INTO use_case_actors (use_case_id, actor_id, actor_role) VALUES
(25, 3, 'primary'), (25, 1, 'secondary'),
(26, 3, 'primary'), (26, 1, 'secondary'),
(27, 3, 'primary'), (27, 1, 'secondary'),
(28, 3, 'primary'), (28, 1, 'secondary'),
(29, 3, 'primary'), (29, 1, 'secondary'),
(30, 3, 'primary'), (30, 1, 'secondary'),
(31, 3, 'primary'), (31, 1, 'secondary'),
(32, 3, 'primary'), (32, 1, 'secondary'),
(33, 3, 'primary'), (33, 1, 'secondary');


-- ============================================================================
-- VIEWS HỖ TRỢ TRUY VẤN
-- ============================================================================

-- ★ View 1: Lấy toàn bộ Use Case của 1 dự án (query phổ biến nhất)
-- Sử dụng: SELECT * FROM v_project_use_cases WHERE project_id = 1;
CREATE OR REPLACE VIEW v_project_use_cases AS
SELECT
    uc.id,
    uc.project_id,
    p.project_code,
    p.project_name,
    uc.use_case_code,
    uc.sequence_number AS tt,
    uc.use_case_name AS ten_use_case,
    -- Subsystem & Group (có thể NULL)
    s.subsystem_code,
    s.subsystem_name,
    fg.group_code,
    fg.group_name,
    -- Tác nhân
    GROUP_CONCAT(
        DISTINCT CASE WHEN uca.actor_role = 'primary' THEN a.actor_name END
        ORDER BY a.actor_name SEPARATOR ', '
    ) AS tac_nhan_chinh,
    GROUP_CONCAT(
        DISTINCT CASE WHEN uca.actor_role = 'secondary' THEN a.actor_name END
        ORDER BY a.actor_name SEPARATOR ', '
    ) AS tac_nhan_phu,
    -- Thông tin chi tiết
    uc.use_case_description AS mo_ta_use_case,
    uc.necessity_level AS muc_do_can_thiet,
    uc.transaction_count AS so_transaction,
    uc.complexity_level AS muc_do_phuc_tap,
    uc.classification AS phan_loai,
    uc.notes AS ghi_chu,
    uc.document_content AS van_ban,
    uc.document_format,
    uc.status,
    uc.version
FROM use_cases uc
JOIN projects p ON uc.project_id = p.id
LEFT JOIN subsystems s ON uc.subsystem_id = s.id
LEFT JOIN function_groups fg ON uc.function_group_id = fg.id
LEFT JOIN use_case_actors uca ON uc.id = uca.use_case_id
LEFT JOIN actors a ON uca.actor_id = a.id
WHERE uc.deleted_at IS NULL
GROUP BY uc.id, uc.project_id, p.project_code, p.project_name,
         uc.use_case_code, uc.sequence_number, uc.use_case_name,
         s.subsystem_code, s.subsystem_name, fg.group_code, fg.group_name,
         uc.use_case_description, uc.necessity_level, uc.transaction_count,
         uc.complexity_level, uc.classification, uc.notes,
         uc.document_content, uc.document_format, uc.status, uc.version
ORDER BY s.sort_order, fg.sort_order, uc.sequence_number;


-- ★ View 2: Thống kê tổng hợp theo dự án
-- Sử dụng: SELECT * FROM v_project_use_case_summary WHERE project_id = 1;
CREATE OR REPLACE VIEW v_project_use_case_summary AS
SELECT
    p.id AS project_id,
    p.project_code,
    p.project_name,
    s.subsystem_code,
    s.subsystem_name,
    fg.group_code,
    fg.group_name,
    COUNT(uc.id) AS total_use_cases,
    SUM(COALESCE(uc.transaction_count, 0)) AS total_transactions,
    SUM(CASE WHEN uc.necessity_level = 'Bắt buộc (B)' THEN 1 ELSE 0 END) AS mandatory_count,
    SUM(CASE WHEN uc.complexity_level = 'Phức tạp' THEN 1 ELSE 0 END) AS complex_count,
    SUM(CASE WHEN uc.complexity_level = 'Trung Bình' THEN 1 ELSE 0 END) AS medium_count,
    SUM(CASE WHEN uc.complexity_level = 'Đơn giản' THEN 1 ELSE 0 END) AS simple_count,
    SUM(CASE WHEN uc.status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
    SUM(CASE WHEN uc.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN uc.status = 'implemented' THEN 1 ELSE 0 END) AS implemented_count
FROM use_cases uc
JOIN projects p ON uc.project_id = p.id
LEFT JOIN subsystems s ON uc.subsystem_id = s.id
LEFT JOIN function_groups fg ON uc.function_group_id = fg.id
WHERE uc.deleted_at IS NULL
GROUP BY p.id, p.project_code, p.project_name,
         s.subsystem_code, s.subsystem_name, fg.group_code, fg.group_name
ORDER BY p.id, s.sort_order, fg.sort_order;


-- ★ View 3: Tổng quan nhanh — đếm UC theo dự án
-- Sử dụng: SELECT * FROM v_project_overview;
-- FIX(ISSUE-2): Sử dụng subqueries riêng biệt để tránh fan-out joins
CREATE OR REPLACE VIEW v_project_overview AS
SELECT
    p.id AS project_id,
    p.project_code,
    p.project_name,
    p.status AS project_status,
    COALESCE(uc_agg.total_use_cases, 0) AS total_use_cases,
    COALESCE(uc_agg.total_transactions, 0) AS total_transactions,
    COALESCE(s_agg.cnt, 0) AS total_subsystems,
    COALESCE(fg_agg.cnt, 0) AS total_function_groups,
    COALESCE(a_agg.cnt, 0) AS total_actors
FROM projects p
LEFT JOIN (
    SELECT project_id,
           COUNT(*) AS total_use_cases,
           SUM(COALESCE(transaction_count, 0)) AS total_transactions
    FROM use_cases WHERE deleted_at IS NULL
    GROUP BY project_id
) uc_agg ON p.id = uc_agg.project_id
LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM subsystems WHERE deleted_at IS NULL
    GROUP BY project_id
) s_agg ON p.id = s_agg.project_id
LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM function_groups WHERE deleted_at IS NULL
    GROUP BY project_id
) fg_agg ON p.id = fg_agg.project_id
LEFT JOIN (
    SELECT project_id, COUNT(*) AS cnt
    FROM actors WHERE deleted_at IS NULL
    GROUP BY project_id
) a_agg ON p.id = a_agg.project_id
WHERE p.deleted_at IS NULL;


-- ============================================================================
-- QUERY MẪU — Cách sử dụng phổ biến
-- ============================================================================

-- Q1: Lấy tất cả Use Case của dự án "PL3-DANSO"
-- SELECT * FROM v_project_use_cases WHERE project_code = 'PL3-DANSO';

-- Q2: Lấy UC theo subsystem (chỉ Website)
-- SELECT * FROM v_project_use_cases WHERE project_id = 1 AND subsystem_code = 'I';

-- Q3: Lấy UC theo nhóm chức năng
-- SELECT * FROM v_project_use_cases WHERE project_id = 1 AND group_code = 'I.3';

-- Q4: Đếm UC theo mức độ phức tạp cho 1 dự án
-- SELECT * FROM v_project_use_case_summary WHERE project_id = 1;

-- Q5: Tổng quan tất cả dự án
-- SELECT * FROM v_project_overview;

-- Q6: Tìm kiếm UC theo tên trong 1 dự án
-- SELECT * FROM use_cases WHERE project_id = 1 AND use_case_name LIKE '%hộ gia đình%';

-- Q7: Lấy UC kèm nội dung văn bản
-- SELECT use_case_name, document_content FROM use_cases WHERE project_id = 1 AND document_content IS NOT NULL;
