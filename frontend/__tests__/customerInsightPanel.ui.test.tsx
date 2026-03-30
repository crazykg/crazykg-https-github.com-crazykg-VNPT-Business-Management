import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import CustomerInsightPanel from '../components/CustomerInsightPanel';
import type { Customer, CustomerInsight, UpsellProductDetail } from '../types/customer';

const fetchCustomerInsightMock = vi.hoisted(() => vi.fn());
const fetchUpsellProductDetailMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api/customerApi', () => ({
  fetchCustomerInsight: fetchCustomerInsightMock,
  fetchUpsellProductDetail: fetchUpsellProductDetailMock,
}));

const baseCustomer: Customer = {
  id: 1,
  uuid: 'customer-1',
  customer_code: 'KH001',
  customer_name: 'BV Thanh Pho',
  tax_code: '0101',
  address: 'Ha Noi',
  customer_sector: 'HEALTHCARE',
  healthcare_facility_type: 'PUBLIC_HOSPITAL',
  bed_capacity: 320,
};

const baseInsight: CustomerInsight = {
  customer: baseCustomer,
  contracts_summary: {
    total_count: 2,
    total_value: 500000000,
    active_value: 500000000,
    by_status: { SIGNED: 2 },
  },
  services_used: [
    {
      product_id: 99,
      product_name: 'Core HIS',
      service_group: 'GROUP_A',
      contract_count: 1,
      total_value: 250000000,
      unit: 'nam',
    },
  ],
  crc_summary: {
    total_cases: 1,
    open_cases: 1,
    by_status: { in_progress: 1 },
  },
  upsell_candidates: [
    {
      product_id: 11,
      product_code: 'HIS_PRO',
      product_name: 'HIS Pro',
      product_description: 'Giai phap quan ly benh vien.',
      standard_price: 600000000,
      unit: 'nam',
      service_group: 'GROUP_A',
      service_group_label: 'Dich vu nhom A',
      reason: 'De xuat phu hop',
      popularity: 24,
      is_priority: true,
      recommendation_type: 'targeted',
      segment_priority: 1,
      sales_notes: 'Nhan manh tich hop BHYT.',
      similar_customers: [
        {
          customer_name: 'BV Da Khoa A',
          customer_sector: 'HEALTHCARE',
          healthcare_facility_type: 'PUBLIC_HOSPITAL',
          is_same_type: true,
        },
      ],
      reference_customers: ['BV Da Khoa A'],
    },
    {
      product_id: 12,
      product_code: 'CRM_BASIC',
      product_name: 'CRM Basic',
      product_description: 'Quan ly cham soc khach hang.',
      standard_price: 120000000,
      unit: 'goi',
      service_group: 'GROUP_B',
      service_group_label: 'Dich vu nhom B',
      reason: 'San pham pho bien',
      popularity: 45,
      is_priority: false,
      recommendation_type: 'popular',
      segment_priority: null,
      sales_notes: null,
      similar_customers: [
        {
          customer_name: 'UBND Quan',
          customer_sector: 'GOVERNMENT',
          healthcare_facility_type: null,
          is_same_type: false,
        },
      ],
      reference_customers: ['UBND Quan'],
    },
  ],
};

const detailByProductId: Record<string, UpsellProductDetail> = {
  '11': {
    product: {
      id: 11,
      product_code: 'HIS_PRO',
      product_name: 'HIS Pro',
      description: 'Giai phap quan ly benh vien.',
      standard_price: 600000000,
      unit: 'nam',
      service_group: 'GROUP_A',
    },
    feature_groups: [
      {
        id: 101,
        group_name: 'Kham benh',
        features: [
          { feature_name: 'Dang ky kham', detail_description: 'Tiep nhan benh nhan' },
        ],
      },
    ],
    sector_customers: [
      {
        customer_name: 'BV Da Khoa A',
        customer_sector: 'HEALTHCARE',
        healthcare_facility_type: 'PUBLIC_HOSPITAL',
        contract_count: 3,
        total_value: 1200000000,
      },
    ],
    segment_match: {
      priority: 1,
      sales_notes: 'Nhan manh tich hop BHYT.',
      match_criteria: 'Linh vuc: Y te | Loai hinh: Benh vien cong lap',
    },
  },
  '12': {
    product: {
      id: 12,
      product_code: 'CRM_BASIC',
      product_name: 'CRM Basic',
      description: 'Quan ly cham soc khach hang.',
      standard_price: 120000000,
      unit: 'goi',
      service_group: 'GROUP_B',
    },
    feature_groups: [
      {
        id: 102,
        group_name: 'Cham soc KH',
        features: [
          { feature_name: 'Lich su tuong tac', detail_description: 'Theo doi lien he' },
        ],
      },
    ],
    sector_customers: [
      {
        customer_name: 'UBND Quan',
        customer_sector: 'GOVERNMENT',
        healthcare_facility_type: null,
        contract_count: 2,
        total_value: 300000000,
      },
    ],
    segment_match: null,
  },
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('CustomerInsightPanel upsell tab', () => {
  beforeEach(() => {
    fetchCustomerInsightMock.mockReset();
    fetchUpsellProductDetailMock.mockReset();
    fetchCustomerInsightMock.mockResolvedValue({ data: baseInsight });
    fetchUpsellProductDetailMock.mockImplementation((_customerId: string | number, productId: string | number) => (
      Promise.resolve({ data: detailByProductId[String(productId)] })
    ));
  });

  it('renders targeted and popular sections with profile summary and same-type badge', async () => {
    const user = userEvent.setup();

    render(<CustomerInsightPanel customer={baseCustomer} onClose={vi.fn()} />);

    await screen.findByText('BV Thanh Pho');
    await user.click(screen.getByRole('button', { name: /Gợi ý bán hàng/i }));

    expect(screen.getByText('Gợi ý sản phẩm phù hợp')).toBeInTheDocument();
    expect(screen.queryByText(/Tach ro san pham phu hop/i)).not.toBeInTheDocument();
    expect(screen.getByText('Đề xuất phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm phổ biến khác')).toBeInTheDocument();
    expect(screen.getByText(/Đang dùng: 1 SP/)).toBeInTheDocument();
    expect(screen.getByText('cùng loại')).toBeInTheDocument();
    expect(screen.getByText('Nhan manh tich hop BHYT.')).toBeInTheDocument();
  });

  it('loads and renders product detail when expanding a card', async () => {
    const user = userEvent.setup();

    render(<CustomerInsightPanel customer={baseCustomer} onClose={vi.fn()} />);

    await screen.findByText('BV Thanh Pho');
    await user.click(screen.getByRole('button', { name: /Gợi ý bán hàng/i }));

    const hisCard = screen.getByText('HIS Pro').closest('article');
    expect(hisCard).not.toBeNull();

    await user.click(within(hisCard as HTMLElement).getByRole('button', { name: /Xem chi tiết chức năng/i }));

    expect(await screen.findByText('Chức năng sản phẩm')).toBeInTheDocument();
    expect(await screen.findByText('Dang ky kham')).toBeInTheDocument();
    expect(await screen.findByText('KH cùng loại đang triển khai')).toBeInTheDocument();
  });

  it('ignores stale detail responses when expanding product A then B quickly', async () => {
    const user = userEvent.setup();
    const detailA = deferred<{ data: UpsellProductDetail }>();
    const detailB = deferred<{ data: UpsellProductDetail }>();

    fetchUpsellProductDetailMock.mockImplementation((_customerId: string | number, productId: string | number) => {
      return String(productId) === '11' ? detailA.promise : detailB.promise;
    });

    render(<CustomerInsightPanel customer={baseCustomer} onClose={vi.fn()} />);

    await screen.findByText('BV Thanh Pho');
    await user.click(screen.getByRole('button', { name: /Gợi ý bán hàng/i }));

    const hisCard = screen.getByText('HIS Pro').closest('article');
    const crmCard = screen.getByText('CRM Basic').closest('article');
    expect(hisCard).not.toBeNull();
    expect(crmCard).not.toBeNull();

    await user.click(within(hisCard as HTMLElement).getByRole('button', { name: /Xem chi tiết chức năng/i }));
    await user.click(within(crmCard as HTMLElement).getByRole('button', { name: /Xem chi tiết chức năng/i }));

    detailB.resolve({ data: detailByProductId['12'] });
    await screen.findByText('Lich su tuong tac');

    detailA.resolve({ data: detailByProductId['11'] });

    await waitFor(() => {
      expect(screen.getByText('Lich su tuong tac')).toBeInTheDocument();
      expect(screen.queryByText('Dang ky kham')).not.toBeInTheDocument();
    });
  });

  it('resolves inferred healthcare profile labels for legacy customers with null classification', async () => {
    const user = userEvent.setup();
    const legacyInsight: CustomerInsight = {
      ...baseInsight,
      customer: {
        ...baseCustomer,
        customer_name: 'Trạm Y tế Phường III',
        customer_sector: null,
        healthcare_facility_type: null,
        bed_capacity: null,
      },
    };

    fetchCustomerInsightMock.mockResolvedValueOnce({ data: legacyInsight });

    render(<CustomerInsightPanel customer={legacyInsight.customer} onClose={vi.fn()} />);

    await screen.findByText('Trạm Y tế Phường III');
    await user.click(screen.getByRole('button', { name: /Gợi ý bán hàng/i }));

    expect(screen.getByText('Lĩnh vực: Y tế')).toBeInTheDocument();
    expect(screen.getByText('Loại hình: TYT và PKĐK')).toBeInTheDocument();
    expect(screen.queryByText('Lĩnh vực: Khác')).not.toBeInTheDocument();
  });
});
