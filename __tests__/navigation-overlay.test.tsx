import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  NavigationOverlayProvider,
  useNavigationOverlay
} from '@/components/layout/navigation-overlay';

let mockPathname = '/admin/orders';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname
}));

function Trigger() {
  const { beginNavigation } = useNavigationOverlay();
  return (
    <button type="button" onClick={beginNavigation}>
      navigate
    </button>
  );
}

describe('NavigationOverlayProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = '/admin/orders';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps overlay visible until pathname changes', () => {
    const view = render(
      <NavigationOverlayProvider>
        <Trigger />
      </NavigationOverlayProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument();

    mockPathname = '/admin/vendors';
    view.rerender(
      <NavigationOverlayProvider>
        <Trigger />
      </NavigationOverlayProvider>
    );

    expect(screen.queryByLabelText('読み込み中')).not.toBeInTheDocument();
  });

  it('does not show overlay for fast navigation', () => {
    const view = render(
      <NavigationOverlayProvider>
        <Trigger />
      </NavigationOverlayProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    mockPathname = '/admin/applications';
    view.rerender(
      <NavigationOverlayProvider>
        <Trigger />
      </NavigationOverlayProvider>
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByLabelText('読み込み中')).not.toBeInTheDocument();
  });
});

