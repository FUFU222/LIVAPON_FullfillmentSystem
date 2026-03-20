jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw error;
  })
}));

jest.mock('@/lib/data/vendors', () => ({
  deleteVendor: jest.fn(),
  getVendorDetailForAdmin: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  assertAdmin: jest.fn(),
  getAuthContext: jest.fn(),
  isAdmin: jest.fn()
}));

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteVendor, getVendorDetailForAdmin } from '@/lib/data/vendors';
import { requireAuthContext, assertAdmin, getAuthContext, isAdmin } from '@/lib/auth';
import {
  bulkDeleteVendorsAction,
  deleteVendorAction,
  loadAdminVendorDetailAction
} from '@/app/admin/vendors/actions';

function buildRedirectError(url: string) {
  return expect.objectContaining({
    message: 'NEXT_REDIRECT',
    digest: `NEXT_REDIRECT;${url}`
  });
}

function buildDeleteFormData(vendorId: string) {
  const formData = new FormData();
  formData.set('vendorId', vendorId);
  return formData;
}

function buildBulkDeleteFormData(ids: string[]) {
  const formData = new FormData();
  ids.forEach((id) => formData.append('vendorIds', id));
  return formData;
}

describe('admin vendor actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (redirect as jest.Mock).mockImplementation((url: string) => {
      const error = new Error('NEXT_REDIRECT');
      (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
      throw error;
    });
    (requireAuthContext as jest.Mock).mockResolvedValue({
      role: 'admin',
      user: { id: 'admin-1' }
    });
    (assertAdmin as jest.Mock).mockImplementation(() => undefined);
    (deleteVendor as jest.Mock).mockResolvedValue(undefined);
    (getAuthContext as jest.Mock).mockResolvedValue({ role: 'admin', user: { id: 'admin-1' } });
    (isAdmin as jest.Mock).mockReturnValue(true);
    (getVendorDetailForAdmin as jest.Mock).mockResolvedValue({
      id: 12,
      name: 'テストセラー'
    });
  });

  it('redirects immediately when deleteVendorAction receives an invalid vendor id', async () => {
    await expect(deleteVendorAction(buildDeleteFormData('NaN'))).rejects.toMatchObject(
      buildRedirectError('/admin/vendors?error=%E3%82%BB%E3%83%A9%E3%83%BCID%E3%81%8C%E4%B8%8D%E6%AD%A3%E3%81%A7%E3%81%99%E3%80%82')
    );

    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(deleteVendor).not.toHaveBeenCalled();
  });

  it('deletes a vendor, revalidates pages, and redirects to the deleted status', async () => {
    await expect(deleteVendorAction(buildDeleteFormData('12'))).rejects.toMatchObject(
      buildRedirectError('/admin/vendors?status=deleted')
    );

    expect(requireAuthContext).toHaveBeenCalledTimes(1);
    expect(assertAdmin).toHaveBeenCalledTimes(1);
    expect(deleteVendor).toHaveBeenCalledWith(12);
    expect(revalidatePath).toHaveBeenCalledWith('/admin/vendors');
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
    expect(redirect).toHaveBeenCalledWith('/admin/vendors?status=deleted');
  });

  it('redirects with an error message when deleteVendor fails', async () => {
    (deleteVendor as jest.Mock).mockRejectedValueOnce(new Error('関連データが残っています'));

    await expect(deleteVendorAction(buildDeleteFormData('12'))).rejects.toMatchObject(
      buildRedirectError('/admin/vendors?error=%E9%96%A2%E9%80%A3%E3%83%87%E3%83%BC%E3%82%BF%E3%81%8C%E6%AE%8B%E3%81%A3%E3%81%A6%E3%81%84%E3%81%BE%E3%81%99')
    );

    expect(revalidatePath).toHaveBeenCalledWith('/admin/vendors');
    expect(deleteVendor).toHaveBeenCalledWith(12);
  });

  it('bulkDeleteVendorsAction redirects when no vendors are selected', async () => {
    await expect(bulkDeleteVendorsAction(buildBulkDeleteFormData([]))).rejects.toMatchObject(
      buildRedirectError('/admin/vendors?error=%E5%89%8A%E9%99%A4%E3%81%99%E3%82%8B%E3%82%BB%E3%83%A9%E3%83%BC%E3%82%92%E9%81%B8%E6%8A%9E%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82')
    );

    expect(requireAuthContext).not.toHaveBeenCalled();
  });

  it('bulkDeleteVendorsAction redirects with aggregated failures after revalidation', async () => {
    (deleteVendor as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('削除に失敗しました'));

    await expect(
      bulkDeleteVendorsAction(buildBulkDeleteFormData(['10', 'invalid', '11']))
    ).rejects.toMatchObject(
      buildRedirectError(
        '/admin/vendors?error=ID%20NaN%3A%20%E3%82%BB%E3%83%A9%E3%83%BCID%E3%81%8C%E4%B8%8D%E6%AD%A3%E3%81%A7%E3%81%99%20%2F%20ID%2011%3A%20%E5%89%8A%E9%99%A4%E3%81%AB%E5%A4%B1%E6%95%97%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F'
      )
    );

    expect(deleteVendor).toHaveBeenCalledWith(10);
    expect(deleteVendor).toHaveBeenCalledWith(11);
    expect(revalidatePath).toHaveBeenCalledWith('/admin/vendors');
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('bulkDeleteVendorsAction redirects to deleted when all selected vendors are removed', async () => {
    await expect(bulkDeleteVendorsAction(buildBulkDeleteFormData(['10', '11']))).rejects.toMatchObject(
      buildRedirectError('/admin/vendors?status=deleted')
    );

    expect(deleteVendor).toHaveBeenCalledWith(10);
    expect(deleteVendor).toHaveBeenCalledWith(11);
  });

  it('loadAdminVendorDetailAction validates vendor ids and admin access', async () => {
    await expect(loadAdminVendorDetailAction(0)).resolves.toEqual({
      status: 'error',
      message: '有効なセラーIDではありません。'
    });

    (getAuthContext as jest.Mock).mockResolvedValueOnce({ role: 'vendor' });
    (isAdmin as jest.Mock).mockReturnValueOnce(false);

    await expect(loadAdminVendorDetailAction(12)).resolves.toEqual({
      status: 'error',
      message: '権限がありません。'
    });
  });

  it('loadAdminVendorDetailAction returns not_found, success, and error states', async () => {
    (getVendorDetailForAdmin as jest.Mock).mockResolvedValueOnce(null);
    await expect(loadAdminVendorDetailAction(12)).resolves.toEqual({ status: 'not_found' });

    (getVendorDetailForAdmin as jest.Mock).mockResolvedValueOnce({
      id: 12,
      name: 'テストセラー'
    });
    await expect(loadAdminVendorDetailAction(12)).resolves.toEqual({
      status: 'success',
      detail: {
        id: 12,
        name: 'テストセラー'
      }
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getVendorDetailForAdmin as jest.Mock).mockRejectedValueOnce(new Error('read failed'));

    await expect(loadAdminVendorDetailAction(12)).resolves.toEqual({
      status: 'error',
      message: 'セラー詳細の取得に失敗しました。'
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load vendor detail for admin',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
