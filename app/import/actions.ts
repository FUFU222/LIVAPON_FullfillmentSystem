'use server';

import { recordImportLog } from '@/lib/data/imports';

export type ImportResult = {
  ok: boolean;
  preview: Array<{ orderNumber: string; lineItemId: string; trackingNumber: string; carrier: string }>;
  errors: string[];
};

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ['CSVにデータがありません'] };
  }

  const [header, ...rows] = lines;
  const expectedHeader = ['order_number', 'line_item_id', 'tracking_number', 'carrier'];
  if (
    header
      .split(',')
      .map((value) => value.trim())
      .join(',')
      .toLowerCase() !== expectedHeader.join(',')
  ) {
    return {
      rows: [],
      errors: ['ヘッダー行は "order_number,line_item_id,tracking_number,carrier" にしてください']
    };
  }

  const errors: string[] = [];
  const parsed = rows.map((row, index) => {
    const [orderNumber, lineItemId, trackingNumber, carrier] = row.split(',').map((value) => value.trim());
    if (!orderNumber || !lineItemId || !trackingNumber || !carrier) {
      errors.push(`${index + 2}行目: 必須カラムのいずれかが空です`);
    }
    return { orderNumber, lineItemId, trackingNumber, carrier };
  });

  return { rows: parsed, errors };
}

export async function processCsvUpload(
  _prevState: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const file = formData.get('file');
  const vendorId = formData.get('vendorId');

  if (!(file instanceof File)) {
    return { ok: false, preview: [], errors: ['CSVファイルを選択してください'] };
  }

  const text = await file.text();
  const { rows, errors } = parseCsv(text);

  try {
    await recordImportLog(
      vendorId ? Number(vendorId) : null,
      file.name,
      errors.length === 0 ? 'success' : 'failed',
      errors.join('\n') || undefined
    );
  } catch (error) {
    console.error('Failed to record import log', error);
  }

  return {
    ok: errors.length === 0,
    preview: rows,
    errors
  };
}
