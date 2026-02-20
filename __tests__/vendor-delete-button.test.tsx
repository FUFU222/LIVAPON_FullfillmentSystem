import { act, fireEvent, render, screen } from '@testing-library/react';
import { VendorDeleteButton } from '@/components/admin/vendor-delete-button';

jest.mock('@/app/admin/vendors/actions', () => ({
  deleteVendorAction: jest.fn()
}));

describe('VendorDeleteButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('submits form after confirm dialog closes', () => {
    const requestSubmitSpy = jest
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);

    render(<VendorDeleteButton vendorId={12} vendorName="テストセラー" />);

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));

    expect(requestSubmitSpy).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
  });
});

