import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BusinessList } from '../components/BusinessList';
import { VendorList } from '../components/VendorList';
import { ProjectList } from '../components/ProjectList';
import type { Business, Product, Project, Vendor } from '../types';

describe('Import availability UI', () => {
  it('hides import actions for unsupported business, vendor, and project modules', () => {
    const businesses: Business[] = [{
      id: 'business-1',
      uuid: 'business-1',
      domain_code: 'KD001',
      domain_name: 'Y tế',
    }];
    const products: Product[] = [{
      id: 'product-1',
      product_code: 'SP001',
      product_name: 'Dịch vụ 1',
      domain_id: 'business-1',
      vendor_id: 'vendor-1',
      standard_price: 1000,
      is_active: true,
    }];
    const vendors: Vendor[] = [{
      id: 'vendor-1',
      uuid: 'vendor-1',
      vendor_code: 'NCC001',
      vendor_name: 'Nhà cung cấp 1',
    }];
    const projects: Project[] = [{
      id: 'project-1',
      project_code: 'DA001',
      project_name: 'Dự án 1',
      customer_id: 'customer-1',
      status: 'CHUAN_BI',
    } as Project];

    const { rerender } = render(
      <BusinessList
        businesses={businesses}
        products={products}
        onOpenModal={vi.fn()}
        canImport={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Nhập/i })).not.toBeInTheDocument();

    rerender(
      <VendorList
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Nhập/i })).not.toBeInTheDocument();

    rerender(
      <ProjectList
        projects={projects}
        customers={[]}
        onOpenModal={vi.fn()}
        canImport={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Nhập/i })).not.toBeInTheDocument();
  });
});
