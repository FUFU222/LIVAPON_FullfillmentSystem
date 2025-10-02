export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-2 w-2 animate-ping rounded-full bg-foreground" aria-hidden />
      <span>{label ?? '読み込み中...'}</span>
    </div>
  );
}
