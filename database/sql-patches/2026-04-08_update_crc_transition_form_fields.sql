-- ================================================================================
-- SQL Script: Update CRC Transition Form Fields - Make "Người nhận" & "Ghi chú" Required
-- ================================================================================
-- Date: 2026-04-08
-- Description: Cập nhật form_fields_json trong customer_request_status_catalogs
--              để set required = true cho to_user_id và notes
--
-- Connection info:
--   Host: localhost
--   Port: 3306
--   Database: vnpt_business_db
--   Username: root
--   Password: root
--
-- Usage:
--   mysql -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 < database/sql-patches/2026-04-08_update_crc_transition_form_fields.sql
-- ================================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ================================================================================
-- STEP 1: Backup - Show current state
-- ================================================================================
SELECT '--- BEFORE UPDATE ---' AS status;
SELECT
    id,
    status_code,
    status_name_vi,
    JSON_EXTRACT(form_fields_json, '$[5].name') AS field_5_name,
    JSON_EXTRACT(form_fields_json, '$[5].required') AS field_5_required,
    JSON_EXTRACT(form_fields_json, '$[6].name') AS field_6_name,
    JSON_EXTRACT(form_fields_json, '$[6].required') AS field_6_required
FROM customer_request_status_catalogs
WHERE status_code IN ('analysis', 'analysis_completed', 'coding', 'coding_in_progress', 'dms_transfer', 'in_progress')
ORDER BY status_code;

-- ================================================================================
-- STEP 2: Update form_fields_json - Set to_user_id and notes as required
-- ================================================================================

-- Cập nhật field 'to_user_id' (index 5) thành required = true
UPDATE customer_request_status_catalogs
SET form_fields_json = JSON_SET(
    form_fields_json,
    '$[5].required', TRUE
)
WHERE JSON_EXTRACT(form_fields_json, '$[5].name') = 'to_user_id';

-- Cập nhật field 'notes' (index 6) thành required = true
UPDATE customer_request_status_catalogs
SET form_fields_json = JSON_SET(
    form_fields_json,
    '$[6].required', TRUE
)
WHERE JSON_EXTRACT(form_fields_json, '$[6].name') = 'notes';

-- ================================================================================
-- STEP 3: Verify updated state
-- ================================================================================
SELECT '--- AFTER UPDATE ---' AS status;
SELECT
    id,
    status_code,
    status_name_vi,
    JSON_EXTRACT(form_fields_json, '$[5].name') AS field_5_name,
    JSON_EXTRACT(form_fields_json, '$[5].required') AS field_5_required,
    JSON_EXTRACT(form_fields_json, '$[6].name') AS field_6_name,
    JSON_EXTRACT(form_fields_json, '$[6].required') AS field_6_required
FROM customer_request_status_catalogs
WHERE status_code IN ('analysis', 'analysis_completed', 'coding', 'coding_in_progress', 'dms_transfer', 'in_progress')
ORDER BY status_code;

-- ================================================================================
-- STEP 4: Show full form_fields_json for a sample status (analysis_completed)
-- ================================================================================
SELECT '--- SAMPLE: analysis_completed ---' AS status;
SELECT
    status_code,
    status_name_vi,
    JSON_PRETTY(form_fields_json) AS form_fields_json_pretty
FROM customer_request_status_catalogs
WHERE status_code = 'analysis_completed'
LIMIT 1;

-- ================================================================================
-- DONE
-- ================================================================================
SELECT '✅ Cập nhật form_fields_json thành công! (to_user_id + notes required)' AS status;
