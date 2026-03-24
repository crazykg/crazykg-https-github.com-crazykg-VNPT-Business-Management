import { describe, expect, it } from 'vitest';
import { validateProductForm } from '../components/Modals';

describe('validateProductForm', () => {
  it('requires a service group selection', () => {
    const errors = validateProductForm({
      service_group: '',
      product_code: 'SP001',
      product_name: 'San pham A',
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.service_group).toBe('Vui lòng chọn nhóm dịch vụ.');
  });

  it('accepts a valid service group', () => {
    const errors = validateProductForm({
      service_group: 'GROUP_B',
      product_code: 'SP001',
      product_name: 'San pham A',
      package_name: 'Goi VNPT HIS 1',
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.service_group).toBeUndefined();
  });

  it('rejects package_name longer than 255 characters', () => {
    const errors = validateProductForm({
      service_group: 'GROUP_B',
      product_code: 'SP001',
      product_name: 'San pham A',
      package_name: 'A'.repeat(256),
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.package_name).toBe('Gói cước không được vượt quá 255 ký tự.');
  });
});
