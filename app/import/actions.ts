'use server';

import { recordImportLog } from '@/lib/data/imports';
import { getVendorProfile } from '@/lib/data/vendors';
import { requireAuthContext, assertAuthorizedVendor } from '@/lib/auth';

export type ImportResult = {
  ok: boolean;
  preview: Array<{ orderNumber: string; sku: string; trackingNumber: string; carrier: string }>;
  errors: string[];
};

function parseCsv(text: string, expectedVendorCode: string | null) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ['CSVにデータがありません'] };
  }

  const [header, ...rows] = lines;
  const expectedHeader = ['order_number', 'sku', 'tracking_number', 'carrier'];
  if (
    header
      .split(',')
      .map((value) => value.trim())
      .join(',')
      .toLowerCase() !== expectedHeader.join(',')
  ) {
    return {
      rows: [],
      errors: ['ヘッダー行は "order_number,sku,tracking_number,carrier" にしてください']
    };
  }

  const errors: string[] = [];
  const parsed = rows.map((row, index) => {
    const [orderNumber, rawSku, trackingNumber, carrier] = row.split(',').map((value) => value.trim());

    if (!orderNumber || !rawSku || !trackingNumber || !carrier) {
      errors.push(`${index + 2}行目: 必須カラムのいずれかが空です`);
    }

    const normalizedSku = rawSku ?? '';
    if (normalizedSku && !/^\d{4}-\d{3}-\d{2}$/.test(normalizedSku)) {
      errors.push(`${index + 2}行目: SKU は 0000-000-00 形式で入力してください`);
    }

    if (expectedVendorCode && normalizedSku && !normalizedSku.startsWith(`${expectedVendorCode}-`)) {
      errors.push(`${index + 2}行目: SKU のセラーコードがログイン中のセラーと一致しません`);
    }

    return {
      orderNumber,
      sku: normalizedSku,
      trackingNumber,
      carrier: carrier.toLowerCase()
    };
  });

  return { rows: parsed, errors };
}

export async function processCsvUpload(
  _prevState: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const auth = await requireAuthContext();
  const vendorId = auth.vendorId;
  assertAuthorizedVendor(vendorId);

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return { ok: false, preview: [], errors: ['CSVファイルを選択してください'] };
  }

  let vendorCode: string | null = null;

  try {
    const vendorProfile = await getVendorProfile(vendorId);
    vendorCode = vendorProfile?.code ?? null;
  } catch (error) {
    console.warn('Failed to load vendor profile', error);
  }

  if (!vendorCode) {
    return {
      ok: false,
      preview: [],
      errors: ['セラーコードが未設定のため、CSVを処理できません。管理者にお問い合わせください。']
    };
  }

  const text = await file.text();
  const { rows, errors } = parseCsv(text, vendorCode);

  try {
    await recordImportLog(
      vendorId,
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
