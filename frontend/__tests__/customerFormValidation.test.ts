import { describe, expect, it } from 'vitest';
import { inferCustomerSector, validateCustomerForm } from '../components/Modals';

describe('validateCustomerForm', () => {
  it('requires healthcare facility type for healthcare customers', () => {
    const errors = validateCustomerForm({
      customer_code: 'KH001',
      customer_name: 'Benh vien A',
      customer_sector: 'HEALTHCARE',
      healthcare_facility_type: null,
    });

    expect(errors.healthcare_facility_type).toBe('Vui lòng chọn loại hình cơ sở y tế.');
  });

  it('accepts hospital bed capacity when it is a non-negative integer', () => {
    const errors = validateCustomerForm({
      customer_code: 'KH001',
      customer_name: 'Benh vien A',
      customer_sector: 'HEALTHCARE',
      healthcare_facility_type: 'HOSPITAL_TTYT',
      bed_capacity: 350,
    });

    expect(errors.bed_capacity).toBeUndefined();
    expect(errors.healthcare_facility_type).toBeUndefined();
  });

  it('does not require healthcare subtype for government customers', () => {
    const errors = validateCustomerForm({
      customer_code: 'KH002',
      customer_name: 'UBND xa A',
      customer_sector: 'GOVERNMENT',
      healthcare_facility_type: null,
    });

    expect(errors.healthcare_facility_type).toBeUndefined();
  });

  it('rejects invalid hospital bed capacity', () => {
    const errors = validateCustomerForm({
      customer_code: 'KH001',
      customer_name: 'Benh vien A',
      customer_sector: 'HEALTHCARE',
      healthcare_facility_type: 'HOSPITAL_TTYT',
      bed_capacity: -1,
    });

    expect(errors.bed_capacity).toBe('Quy mô giường bệnh phải là số nguyên không âm.');
  });
});

describe('inferCustomerSector', () => {
  it('prioritizes healthcare for common healthcare customer names', () => {
    expect(inferCustomerSector('Bệnh viện Đa khoa tỉnh')).toBe('HEALTHCARE');
    expect(inferCustomerSector('Trung tâm y tế huyện')).toBe('HEALTHCARE');
    expect(inferCustomerSector('Trạm y tế xã A')).toBe('HEALTHCARE');
    expect(inferCustomerSector('Phòng khám tư nhân B')).toBe('HEALTHCARE');
  });

  it('falls back to other for non-healthcare names', () => {
    expect(inferCustomerSector('Công ty Công nghệ ABC')).toBe('OTHER');
  });
});
