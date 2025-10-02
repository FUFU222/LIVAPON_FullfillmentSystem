'use client';

import { useFormState } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { processCsvUpload, type ImportResult } from './actions';

const initialState: ImportResult = { ok: false, preview: [], errors: [] };

export function UploadForm() {
  const [state, formAction] = useFormState(processCsvUpload, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="file" className="font-medium text-foreground">
            CSVファイル
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            className="w-full rounded-md border border-dashed border-slate-300 bg-muted px-4 py-6 text-center text-sm"
            required
          />
          <p className="text-xs text-slate-500">
            フォーマット: order_number,line_item_id,tracking_number,carrier
          </p>
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="vendorId" className="font-medium text-foreground">
            ベンダーID (任意)
          </label>
          <input
            id="vendorId"
            name="vendorId"
            type="number"
            inputMode="numeric"
            placeholder="1"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70"
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit">プレビューを生成</Button>
        </div>
      </form>

      {state.errors.length > 0 && (
        <Alert variant="destructive">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">エラー</span>
            {state.errors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        </Alert>
      )}

      {state.preview.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">プレビュー</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>注文番号</TableHead>
                <TableHead>Line Item ID</TableHead>
                <TableHead>追跡番号</TableHead>
                <TableHead>配送業者</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.preview.map((row, index) => (
                <TableRow key={`${row.orderNumber}-${index}`}>
                  <TableCell>{row.orderNumber}</TableCell>
                  <TableCell>{row.lineItemId}</TableCell>
                  <TableCell>{row.trackingNumber}</TableCell>
                  <TableCell className="capitalize">{row.carrier}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {state.ok && state.errors.length === 0 && state.preview.length > 0 && (
        <Alert variant="success">CSVの検証が完了しました。Supabaseバッチ処理と連携してください。</Alert>
      )}
    </div>
  );
}
