import { describe, expect, it } from 'vitest';
import { normalizeYeuCauProcessDetail } from '../services/v5Api';

describe('normalizeYeuCauProcessDetail', () => {
  it('syncs nested current runtime process metadata with filtered allowed transitions', () => {
    const normalized = normalizeYeuCauProcessDetail({
      yeu_cau: {
        id: 18,
        ma_yc: 'CRC-202603-0011',
        request_code: 'CRC-202603-0011',
        trang_thai: 'new_intake',
        current_status_code: 'new_intake',
        current_status_name_vi: 'Mới tiếp nhận',
      },
      current_status: {
        process_code: 'new_intake',
        process_label: 'Mới tiếp nhận',
        group_code: 'intake',
        group_label: 'Tiếp nhận',
        table_name: 'customer_request_cases',
        default_status: 'new_intake',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [
          'not_executed',
          'waiting_customer_feedback',
          'in_progress',
          'analysis',
          'returned_to_manager',
        ],
        form_fields: [],
        list_columns: [],
      },
      current_process: {
        process_code: 'new_intake',
        process_label: 'Mới tiếp nhận',
        group_code: 'intake',
        group_label: 'Tiếp nhận',
        table_name: 'customer_request_cases',
        default_status: 'new_intake',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [
          'not_executed',
          'waiting_customer_feedback',
          'in_progress',
          'analysis',
          'returned_to_manager',
        ],
        form_fields: [],
        list_columns: [],
      },
      process: {
        process_code: 'new_intake',
        process_label: 'Mới tiếp nhận',
        group_code: 'intake',
        group_label: 'Tiếp nhận',
        table_name: 'customer_request_cases',
        default_status: 'new_intake',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [
          'not_executed',
          'waiting_customer_feedback',
          'in_progress',
          'analysis',
          'returned_to_manager',
        ],
        form_fields: [],
        list_columns: [],
      },
      allowed_next_processes: [
        {
          process_code: 'in_progress',
          process_label: 'Đang xử lý',
          group_code: 'processing',
          group_label: 'Xử lý',
          table_name: 'customer_request_cases',
          default_status: 'in_progress',
          read_roles: [],
          write_roles: [],
          allowed_next_processes: [],
          form_fields: [],
          list_columns: [],
        },
        {
          process_code: 'returned_to_manager',
          process_label: 'Chuyển trả QL',
          group_code: 'processing',
          group_label: 'Xử lý',
          table_name: 'customer_request_cases',
          default_status: 'returned_to_manager',
          read_roles: [],
          write_roles: [],
          allowed_next_processes: [],
          form_fields: [],
          list_columns: [],
        },
      ],
      allowed_previous_processes: [
        {
          process_code: 'new_intake',
          process_label: 'Mới tiếp nhận',
          group_code: 'intake',
          group_label: 'Tiếp nhận',
          table_name: 'customer_request_cases',
          default_status: 'new_intake',
          read_roles: [],
          write_roles: [],
          allowed_next_processes: [],
          form_fields: [],
          list_columns: [],
        },
      ],
    });

    expect(normalized.allowed_next_processes.map((item) => item.process_code)).toEqual([
      'in_progress',
      'returned_to_manager',
    ]);
    expect(normalized.current_status?.allowed_next_processes).toEqual([
      'in_progress',
      'returned_to_manager',
    ]);
    expect(normalized.current_process?.allowed_next_processes).toEqual([
      'in_progress',
      'returned_to_manager',
    ]);
    expect(normalized.process.allowed_next_processes).toEqual([
      'in_progress',
      'returned_to_manager',
    ]);
    expect(normalized.current_process?.allowed_previous_processes).toEqual(['new_intake']);
  });

  it('does not rewrite nested metadata for a different process code', () => {
    const normalized = normalizeYeuCauProcessDetail({
      yeu_cau: {
        id: 19,
        ma_yc: 'CRC-202603-0019',
        request_code: 'CRC-202603-0019',
        trang_thai: 'new_intake',
        current_status_code: 'new_intake',
      },
      current_process: {
        process_code: 'analysis',
        process_label: 'Phân tích',
        group_code: 'analysis',
        group_label: 'Phân tích',
        table_name: 'customer_request_cases',
        default_status: 'analysis',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: ['coding'],
        form_fields: [],
        list_columns: [],
      },
      allowed_next_processes: [
        {
          process_code: 'in_progress',
          process_label: 'Đang xử lý',
          group_code: 'processing',
          group_label: 'Xử lý',
          table_name: 'customer_request_cases',
          default_status: 'in_progress',
          read_roles: [],
          write_roles: [],
          allowed_next_processes: [],
          form_fields: [],
          list_columns: [],
        },
      ],
    });

    expect(normalized.current_process?.process_code).toBe('analysis');
    expect(normalized.current_process?.allowed_next_processes).toEqual(['coding']);
  });
});
