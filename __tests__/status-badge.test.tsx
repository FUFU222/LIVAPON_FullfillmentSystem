import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/orders/status-badge';

describe('StatusBadge', () => {
  it('renders Japanese label for partial status aliases', () => {
    const { rerender } = render(<StatusBadge status="partial" />);
    expect(screen.getByText('一部発送済')).toBeInTheDocument();

    rerender(<StatusBadge status="partially fulfilled" />);
    expect(screen.getByText('一部発送済')).toBeInTheDocument();
  });

  it('normalizes canceled spelling to Japanese cancelled label', () => {
    render(<StatusBadge status="canceled" />);
    expect(screen.getByText('キャンセル済')).toBeInTheDocument();
  });
});
