import { render, screen } from '@testing-library/react';
import { Modal } from '@/components/ui/modal';

describe('Modal', () => {
  it('uses a mobile sheet layout with a sticky footer', () => {
    render(
      <Modal
        open
        onClose={jest.fn()}
        title="注文詳細"
        footer={<button type="button">閉じる</button>}
      >
        <p>本文</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: '注文詳細' });
    expect(dialog).toHaveClass('rounded-t-lg');
    expect(dialog).toHaveClass('sm:rounded-lg');
    expect(screen.getByTestId('modal-footer')).toHaveClass('sticky');
    expect(screen.getByTestId('modal-footer')).toHaveClass('bottom-0');
  });
});
