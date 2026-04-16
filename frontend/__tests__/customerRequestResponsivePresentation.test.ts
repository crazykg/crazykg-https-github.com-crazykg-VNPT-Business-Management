import { describe, expect, it } from 'vitest';
import {
  resolveCustomerRequestResponsiveLayoutMode,
} from '../components/customer-request/hooks/useCustomerRequestResponsiveLayout';
import {
  resolvePrimaryActionMeta,
} from '../components/customer-request/presentation';
import type { YeuCau } from '../types';

const makeRequest = (partial?: Partial<YeuCau>): YeuCau =>
  ({
    id: partial?.id ?? 7,
    ma_yc: partial?.ma_yc ?? 'CRC-202603-0007',
    request_code: partial?.request_code ?? 'CRC-202603-0007',
    tieu_de: partial?.tieu_de ?? 'Yêu cầu hỗ trợ',
    summary: partial?.summary ?? 'Yêu cầu hỗ trợ',
    trang_thai: partial?.trang_thai ?? 'new_intake',
    current_status_code: partial?.current_status_code ?? 'new_intake',
    current_status_name_vi: partial?.current_status_name_vi ?? 'Mới tiếp nhận',
    warning_level: partial?.warning_level ?? 'missing',
    performer_name: partial?.performer_name ?? 'Lý Thị Ngọc Mai',
    ...partial,
  }) as YeuCau;

describe('customer request responsive helpers', () => {
  it('resolves layout modes from viewport width', () => {
    expect(resolveCustomerRequestResponsiveLayoutMode(390)).toBe('mobile');
    expect(resolveCustomerRequestResponsiveLayoutMode(1024)).toBe('tablet');
    expect(resolveCustomerRequestResponsiveLayoutMode(1366)).toBe('desktopCompact');
    expect(resolveCustomerRequestResponsiveLayoutMode(1600)).toBe('desktopWide');
  });

  it('maps primary action semantics for major CRC cases', () => {
    expect(
      resolvePrimaryActionMeta(
        makeRequest({ warning_level: 'missing', missing_estimate: true }),
        ''
      )
    ).toMatchObject({
      kind: 'estimate',
      label: 'Bo sung estimate',
    });

    expect(
      resolvePrimaryActionMeta(
        makeRequest({
          trang_thai: 'in_progress',
          current_status_code: 'in_progress',
          current_status_name_vi: 'Đang xử lý',
          warning_level: null,
        }),
        'performer'
      )
    ).toMatchObject({
      kind: 'detail',
      label: 'Xem chi tiết',
    });

    expect(
      resolvePrimaryActionMeta(
        makeRequest({
          trang_thai: 'returned_to_manager',
          current_status_code: 'returned_to_manager',
          current_status_name_vi: 'Chuyển trả QL',
          warning_level: null,
          missing_estimate: false,
        }),
        'dispatcher'
      )
    ).toMatchObject({
      kind: 'detail',
      label: 'Xem chi tiết',
    });
  });
});
