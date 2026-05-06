export function NavigationLoadingOverlay() {
  return (
    <div
      className="grid w-full gap-3 py-2"
      role="status"
      aria-label="読み込み中"
      aria-live="polite"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          data-testid="navigation-loading-skeleton"
          className="rounded-md border border-slate-200 bg-white p-4"
        >
          <div className="h-3 w-24 rounded-full bg-slate-100" />
          <div className="mt-3 h-4 w-full max-w-md rounded-full bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
