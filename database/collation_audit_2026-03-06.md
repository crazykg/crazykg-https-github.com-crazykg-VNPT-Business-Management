# Collation Audit 2026-03-06

Nguon du lieu:
- Database live: `vnpt_business_db`
- Database charset: `utf8mb4`
- Database collation: `utf8mb4_unicode_ci`
- Cach doi chieu: xem bang/cot text co collation khac `@@collation_database`

Tom tat:
- 13 bang lech collation so voi database default
- 59 cot text lech collation so voi database default
- 0 cot text lech collation so voi collation cua chinh bang no

Ket luan nhanh:
- Tat ca sai lech hien tai deu la nhom bang/cot dang dung `utf8mb4_0900_ai_ci`.
- Khong co truong hop cot text trong cung mot bang bi lech nhau.
- `document_product_links` lech o cap bang, nhung khong co cot text nao.

Danh sach bang lech:

| Table | Table collation | Text columns lech |
| --- | --- | ---: |
| async_exports | utf8mb4_0900_ai_ci | 8 |
| auth_login_attempts | utf8mb4_0900_ai_ci | 5 |
| customer_requests | utf8mb4_0900_ai_ci | 9 |
| document_product_links | utf8mb4_0900_ai_ci | 0 |
| integration_settings | utf8mb4_0900_ai_ci | 9 |
| opportunity_stages | utf8mb4_0900_ai_ci | 3 |
| request_raci_assignments | utf8mb4_0900_ai_ci | 2 |
| support_contact_positions | utf8mb4_0900_ai_ci | 3 |
| support_request_statuses | utf8mb4_0900_ai_ci | 3 |
| support_request_tasks | utf8mb4_0900_ai_ci | 3 |
| workflow_form_field_configs | utf8mb4_0900_ai_ci | 4 |
| workflow_status_catalogs | utf8mb4_0900_ai_ci | 6 |
| worklog_activity_types | utf8mb4_0900_ai_ci | 4 |

Danh sach cot lech:

| Table | Column |
| --- | --- |
| async_exports | uuid |
| async_exports | module |
| async_exports | format |
| async_exports | status |
| async_exports | filters_json |
| async_exports | file_path |
| async_exports | file_name |
| async_exports | error_message |
| auth_login_attempts | username |
| auth_login_attempts | status |
| auth_login_attempts | reason |
| auth_login_attempts | ip_address |
| auth_login_attempts | user_agent |
| customer_requests | uuid |
| customer_requests | request_code |
| customer_requests | summary |
| customer_requests | requester_name |
| customer_requests | status |
| customer_requests | sub_status |
| customer_requests | priority |
| customer_requests | reference_ticket_code |
| customer_requests | notes |
| integration_settings | provider |
| integration_settings | account_email |
| integration_settings | folder_id |
| integration_settings | scopes |
| integration_settings | impersonate_user |
| integration_settings | file_prefix |
| integration_settings | service_account_json |
| integration_settings | last_test_status |
| integration_settings | last_test_message |
| opportunity_stages | stage_code |
| opportunity_stages | stage_name |
| opportunity_stages | description |
| request_raci_assignments | request_code |
| request_raci_assignments | raci_role |
| support_contact_positions | position_code |
| support_contact_positions | position_name |
| support_contact_positions | description |
| support_request_statuses | status_code |
| support_request_statuses | status_name |
| support_request_statuses | description |
| support_request_tasks | task_code |
| support_request_tasks | task_link |
| support_request_tasks | status |
| workflow_form_field_configs | field_key |
| workflow_form_field_configs | field_label |
| workflow_form_field_configs | field_type |
| workflow_form_field_configs | excel_column |
| workflow_status_catalogs | status_code |
| workflow_status_catalogs | status_name |
| workflow_status_catalogs | canonical_status |
| workflow_status_catalogs | canonical_sub_status |
| workflow_status_catalogs | flow_step |
| workflow_status_catalogs | form_key |
| worklog_activity_types | code |
| worklog_activity_types | name |
| worklog_activity_types | description |
| worklog_activity_types | phase_hint |

File xuat:
- `database/collation_mismatch_tables_2026-03-06.csv`
- `database/collation_mismatch_columns_2026-03-06.csv`

Truy van da dung:

```sql
SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
  AND TABLE_COLLATION <> @@collation_database
ORDER BY TABLE_NAME;
```

```sql
SELECT c.TABLE_NAME, c.COLUMN_NAME, c.ORDINAL_POSITION, c.DATA_TYPE,
       c.CHARACTER_SET_NAME, c.COLLATION_NAME
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.COLLATION_NAME IS NOT NULL
  AND c.COLLATION_NAME <> @@collation_database
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
```
