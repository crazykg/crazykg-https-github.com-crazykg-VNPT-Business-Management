import { describe, expect, it } from 'vitest';
import { validateProductForm } from '../components/modals';

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
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.service_group).toBeUndefined();
  });

  it('rejects description longer than 2000 characters', () => {
    const errors = validateProductForm({
      service_group: 'GROUP_B',
      product_code: 'SP001',
      product_name: 'San pham A',
      description: 'A'.repeat(2001),
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.description).toBe('Mô tả không được vượt quá 2000 ký tự.');
  });

  it('rejects product_short_name longer than 255 characters', () => {
    const errors = validateProductForm({
      service_group: 'GROUP_B',
      product_code: 'SP001',
      product_name: 'San pham A',
      product_short_name: 'A'.repeat(256),
      domain_id: 1,
      vendor_id: 1,
      standard_price: 0,
    });

    expect(errors.product_short_name).toBe('Tên viết tắt không được vượt quá 255 ký tự.');
  });
});
