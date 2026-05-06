import { render, screen } from '@testing-library/react';
import { NavigationLoadingOverlay } from '@/components/layout/navigation-loading';

describe('NavigationLoadingOverlay', () => {
  it('uses a calm skeleton instead of a blocking spinner', () => {
    render(<NavigationLoadingOverlay />);

    const loadingRegion = screen.getByLabelText('読み込み中');
    expect(loadingRegion).toBeInTheDocument();
    expect(loadingRegion.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('navigation-loading-skeleton')).toHaveLength(3);
  });
});
