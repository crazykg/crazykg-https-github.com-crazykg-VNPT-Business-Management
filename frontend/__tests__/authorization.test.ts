import { describe, expect, it } from 'vitest';
import { canAccessTab, canImportModule, canOpenModal, hasPermission, resolveImportPermission } from '../utils/authorization';
import type { AuthUser, ModalType } from '../types';

const buildUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  username: 'tester',
  full_name: 'Test User',
  email: 'tester@example.com',
  status: 'ACTIVE',
  roles: [],
  permissions: [],
  dept_scopes: [],
  ...overrides,
});

describe('authorization helpers', () => {
  describe('hasPermission', () => {
    it('allows empty permission keys', () => {
      expect(hasPermission(null, null)).toBe(true);
      expect(hasPermission(null, undefined)).toBe(true);
    });

    it('rejects protected permissions when user is missing', () => {
      expect(hasPermission(null, 'dashboard.view')).toBe(false);
    });

    it('grants access to admin users', () => {
      const user = buildUser({ roles: ['admin'] });

      expect(hasPermission(user, 'anything.at.all')).toBe(true);
    });

    it('grants access when wildcard permission is present', () => {
      const user = buildUser({ permissions: ['*'] });

      expect(hasPermission(user, 'contracts.delete')).toBe(true);
    });

    it('checks explicit permissions exactly', () => {
      const user = buildUser({ permissions: ['projects.read', 'projects.write'] });

      expect(hasPermission(user, 'projects.read')).toBe(true);
      expect(hasPermission(user, 'projects.delete')).toBe(false);
    });
  });

  describe('canAccessTab', () => {
    it('requires the mapped permission for regular tabs', () => {
      const user = buildUser({ permissions: ['dashboard.view'] });

      expect(canAccessTab(user, 'dashboard')).toBe(true);
      expect(canAccessTab(user, 'projects')).toBe(false);
      expect(canAccessTab(user, 'internal_user_party_members')).toBe(false);
    });

    it('allows support master tab when any related permission is present', () => {
      const user = buildUser({ permissions: ['support_contact_positions.read'] });

      expect(canAccessTab(user, 'support_master_management')).toBe(true);
    });

    it('denies access to unknown tab ids by default', () => {
      const user = buildUser({ permissions: ['dashboard.view'] });

      expect(canAccessTab(user, 'totally_unknown_tab')).toBe(false);
    });

    it('denies support master tab when user has no related permission', () => {
      const user = buildUser({ permissions: [] });

      expect(canAccessTab(user, 'support_master_management')).toBe(false);
    });
  });

  describe('resolveImportPermission', () => {
    it('returns the configured permission for supported modules', () => {
      expect(resolveImportPermission('projects')).toBe('projects.import');
      expect(resolveImportPermission('contracts')).toBe('contracts.import');
      expect(resolveImportPermission('cus_personnel')).toBe('customer_personnel.write');
      expect(resolveImportPermission('internal_user_party_members')).toBe('employee_party.import');
    });

    it('returns null for unsupported modules', () => {
      expect(resolveImportPermission('unknown-module')).toBeNull();
    });
  });

  describe('canImportModule', () => {
    it('only allows modules that have both permission and configured import flow', () => {
      const user = buildUser({ permissions: ['products.import', 'projects.import', 'employee_party.import'] });

      expect(canImportModule(user, 'products')).toBe(true);
      expect(canImportModule(user, 'internal_user_party_members')).toBe(true);
      expect(canImportModule(user, 'projects')).toBe(false);
    });
  });

  describe('canOpenModal', () => {
    it('uses module import permissions for import modal', () => {
      const user = buildUser({ permissions: ['products.import', 'customer_personnel.write'] });

      expect(canOpenModal(user, 'IMPORT_DATA' as ModalType, 'products')).toBe(true);
      expect(canOpenModal(user, 'IMPORT_DATA' as ModalType, 'contracts')).toBe(false);
      expect(canOpenModal(user, 'IMPORT_DATA' as ModalType, 'cus_personnel')).toBe(true);
    });

    it('blocks import modal for modules without configured import flow even if permission exists', () => {
      const user = buildUser({ permissions: ['projects.import'] });

      expect(canOpenModal(user, 'IMPORT_DATA' as ModalType, 'projects')).toBe(false);
    });

    it('uses modal specific permissions for regular modals', () => {
      const user = buildUser({ permissions: ['projects.write'] });

      expect(canOpenModal(user, 'ADD_PROJECT' as ModalType, 'projects')).toBe(true);
      expect(canOpenModal(user, 'DELETE_PROJECT' as ModalType, 'projects')).toBe(false);
    });

    it('uses party profile modal permissions for Đảng viên actions', () => {
      const user = buildUser({ permissions: ['employee_party.write'] });

      expect(canOpenModal(user, 'ADD_PARTY_PROFILE' as ModalType, 'internal_user_party_members')).toBe(true);
      expect(canOpenModal(user, 'EDIT_PARTY_PROFILE' as ModalType, 'internal_user_party_members')).toBe(true);
    });

    it('requires write permission for the product target segment modal', () => {
      const readOnlyUser = buildUser({ permissions: ['products.read'] });
      const writerUser = buildUser({ permissions: ['products.write'] });

      expect(canOpenModal(readOnlyUser, 'PRODUCT_TARGET_SEGMENT' as ModalType, 'products')).toBe(false);
      expect(canOpenModal(writerUser, 'PRODUCT_TARGET_SEGMENT' as ModalType, 'products')).toBe(true);
    });
  });
});
