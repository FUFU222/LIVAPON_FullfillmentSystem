import {
  resolveRoleFromAuthUser,
  resolveVendorIdFromAuthUser
} from '@/lib/auth-metadata';

type MetadataUserInput = Exclude<Parameters<typeof resolveRoleFromAuthUser>[0], null>;

describe('auth metadata resolution', () => {
  it('resolves vendor id from app_metadata only', () => {
    const user = {
      app_metadata: {
        vendor_id: '42'
      },
      user_metadata: {
        vendor_id: '999'
      }
    } as MetadataUserInput;

    expect(resolveVendorIdFromAuthUser(user)).toBe(42);
  });

  it('returns null for invalid vendor id values', () => {
    const user = {
      app_metadata: {
        vendor_id: 'not-a-number'
      },
      user_metadata: {}
    } as MetadataUserInput;

    expect(resolveVendorIdFromAuthUser(user)).toBeNull();
  });

  it('prefers role from app_metadata', () => {
    const user = {
      app_metadata: {
        role: 'ADMIN'
      },
      user_metadata: {
        role: 'pending_vendor'
      }
    } as MetadataUserInput;

    expect(resolveRoleFromAuthUser(user)).toBe('admin');
  });

  it('allows pending_vendor fallback from user_metadata', () => {
    const user = {
      app_metadata: {},
      user_metadata: {
        role: ' pending_vendor '
      }
    } as MetadataUserInput;

    expect(resolveRoleFromAuthUser(user)).toBe('pending_vendor');
  });

  it('rejects privileged role fallback from user_metadata', () => {
    const user = {
      app_metadata: {},
      user_metadata: {
        role: 'admin'
      }
    } as MetadataUserInput;

    expect(resolveRoleFromAuthUser(user)).toBeNull();
  });
});
