import { act, fireEvent, render, screen } from '@testing-library/react';
import { VendorBulkDeleteForm } from '@/components/admin/vendor-bulk-delete-form';

jest.mock('@/app/admin/vendors/actions', () => ({
  deleteVendorAction: jest.fn(),
  bulkDeleteVendorsAction: jest.fn(),
  loadAdminVendorDetailAction: jest.fn()
}));

describe('VendorBulkDeleteForm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('submits bulk delete form after confirm modal closes', () => {
    const requestSubmitSpy = jest
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);

    render(
      <VendorBulkDeleteForm
        vendors={[
          {
            id: 1,
            name: 'テストベンダー',
            code: '0001',
            contactName: '担当者',
            contactEmail: 'vendor@example.com',
            contactPhone: null,
            notifyNewOrders: true,
            createdAt: '2026-02-12T00:00:00.000Z',
            lastApplication: null
          }
        ]}
      />
    );

    const bulkButton = screen.getByRole('button', { name: '選択したベンダーを削除' });
    expect(bulkButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('テストベンダー を削除対象として選択'));
    expect(bulkButton).toBeEnabled();

    fireEvent.click(bulkButton);
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));

    expect(requestSubmitSpy).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
  });
});
