import type { TableHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TableProps = TableHTMLAttributes<HTMLTableElement>;

type SectionProps = TableHTMLAttributes<HTMLTableSectionElement>;

type RowProps = TableHTMLAttributes<HTMLTableRowElement>;

type CellProps = TableHTMLAttributes<HTMLTableCellElement>;

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full min-w-max border-collapse text-left text-sm text-foreground', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: SectionProps) {
  return (
    <thead className={cn('bg-slate-50 text-xs uppercase tracking-wide text-slate-500', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: SectionProps) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />;
}

export function TableRow({ className, ...props }: RowProps) {
  return <tr className={cn('hover:bg-slate-50 transition-colors', className)} {...props} />;
}

export function TableHead({ className, ...props }: CellProps) {
  return <th className={cn('px-4 py-3 font-medium', className)} {...props} />;
}

export function TableCell({ className, ...props }: CellProps) {
  return <td className={cn('px-4 py-3 align-top text-sm', className)} {...props} />;
}
