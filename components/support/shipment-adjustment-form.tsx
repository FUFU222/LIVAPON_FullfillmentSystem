'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { submitShipmentAdjustmentRequest } from '@/app/support/shipment-adjustment/actions';
import { initialShipmentAdjustmentFormState } from '@/app/support/shipment-adjustment/state';
import { shipmentIssueTypeOptions } from '@/app/support/shipment-adjustment/options';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-w-[140px]" disabled={pending}>
      {pending ? '送信中…' : '申請を送信'}
    </Button>
  );
}

export function ShipmentAdjustmentForm({
  defaultContactName,
  defaultContactEmail,
  defaultContactPhone,
  vendorName,
  vendorCode
}: {
  defaultContactName?: string | null;
  defaultContactEmail?: string | null;
  defaultContactPhone?: string | null;
  vendorName?: string | null;
  vendorCode?: string | null;
}) {
  const [state, formAction] = useFormState(
    submitShipmentAdjustmentRequest,
    initialShipmentAdjustmentFormState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-foreground">発送修正申請フォーム</p>
          <p className="text-sm text-slate-500">
            {vendorName ? `${vendorName} (${vendorCode ?? 'ベンダーコード未設定'})` : 'ベンダー情報取得中'}
            <br />
            Shopify 側では管理者が FO を再オープンします。Console から直接未発送へ戻すことはできません。
          </p>
        </div>

        {state.status === 'success' && state.message ? (
          <Alert variant="success" className="mb-4">
            <div className="font-medium">{state.message}</div>
            {state.requestId ? (
              <div className="text-xs text-green-700">申請ID: #{state.requestId}</div>
            ) : null}
            <div className="mt-2 text-xs text-slate-600">
              進捗は管理者からの返信または別途共有されるステータスにてご確認ください。
            </div>
          </Alert>
        ) : null}

        {state.status === 'error' && state.message ? (
          <Alert variant="destructive" className="mb-4">
            {state.message}
          </Alert>
        ) : null}

        <form ref={formRef} action={formAction} className="grid gap-5">
          <section className="grid gap-4">
            <div className="grid gap-2 text-sm">
              <label htmlFor="orderNumber" className="font-medium text-foreground">
                Shopify注文番号 <span className="text-red-500">*</span>
              </label>
              <Input
                id="orderNumber"
                name="orderNumber"
                placeholder="例: #1234 (メモに載っている注文番号をそのまま入力)"
                required
              />
              <p className="text-xs text-slate-500">
                例: <span className="font-mono">#1050</span> / <span className="font-mono">1050</span>. ハッシュタグなしでも可。
              </p>
              {state.fieldErrors?.orderNumber ? (
                <span className="text-xs text-red-500">{state.fieldErrors.orderNumber}</span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
              <label htmlFor="trackingNumber" className="font-medium text-foreground">
                追跡番号 / 配送会社 (任意)
              </label>
              <Input
                id="trackingNumber"
                name="trackingNumber"
                placeholder="例: SG123456789JP / ヤマト運輸"
              />
            </div>

            <div className="grid gap-2 text-sm">
              <label htmlFor="issueType" className="font-medium text-foreground">
                申請区分 <span className="text-red-500">*</span>
              </label>
              <Select id="issueType" name="issueType" defaultValue="tracking_update" required>
                {shipmentIssueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="space-y-1 text-xs text-slate-500">
                {shipmentIssueTypeOptions.map((option) => (
                  <p key={option.value}>
                    <span className="font-medium">{option.label}:</span> {option.helper}
                  </p>
                ))}
              </div>
              {state.fieldErrors?.issueType ? (
                <span className="text-xs text-red-500">{state.fieldErrors.issueType}</span>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4">
            <div className="grid gap-2 text-sm">
              <label htmlFor="issueSummary" className="font-medium text-foreground">
                発生している状況 <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="issueSummary"
                name="issueSummary"
                rows={4}
                required
                placeholder="例: 5/10にSKU 0001-101-Aを3点発送しましたが、Shopify上では4点発送済みとなっており、在庫がマイナスになっています。"
              />
              <p className="text-xs text-slate-500">箇条書きでも構いません。時系列や発覚したきっかけを書いていただくと助かります。</p>
              {state.fieldErrors?.issueSummary ? (
                <span className="text-xs text-red-500">{state.fieldErrors.issueSummary}</span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
              <label htmlFor="desiredChange" className="font-medium text-foreground">
                希望する対応 <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="desiredChange"
                name="desiredChange"
                rows={3}
                required
                placeholder="例: Shopifyで該当FOを未発送に戻し、追跡番号をXXXXへ差し替えたいです。管理者側で必要な操作をお願いします。"
              />
              {state.fieldErrors?.desiredChange ? (
                <span className="text-xs text-red-500">{state.fieldErrors.desiredChange}</span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
              <label htmlFor="lineItemContext" className="font-medium text-foreground">
                対象ラインアイテム / 数量 (任意)
              </label>
              <Textarea
                id="lineItemContext"
                name="lineItemContext"
                rows={3}
                placeholder="例: SKU 0005-210-B (ブルー) 2点 / SKU 0005-210-C (グレー) 1点"
              />
            </div>
          </section>

          <section className="grid gap-4">
            <div className="grid gap-2 text-sm">
              <label htmlFor="contactName" className="font-medium text-foreground">
                ご担当者名 <span className="text-red-500">*</span>
              </label>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={defaultContactName ?? ''}
                placeholder="例: LIVAPON物流　山田"
                required
              />
              {state.fieldErrors?.contactName ? (
                <span className="text-xs text-red-500">{state.fieldErrors.contactName}</span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
              <label htmlFor="contactEmail" className="font-medium text-foreground">
                連絡先メールアドレス <span className="text-red-500">*</span>
              </label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={defaultContactEmail ?? ''}
                placeholder="例: shipping@example.com"
                required
              />
              {state.fieldErrors?.contactEmail ? (
                <span className="text-xs text-red-500">{state.fieldErrors.contactEmail}</span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
            <label htmlFor="contactPhone" className="font-medium text-foreground">
              連絡先電話番号 (任意)
            </label>
            <Input
              id="contactPhone"
              name="contactPhone"
              placeholder="例: 03-1234-5678 / 080-1234-5678"
              defaultValue={defaultContactPhone ?? ''}
            />
          </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <p>送信後は管理者が Shopify 側でFOの再オープン／再同期を行います。進捗はメールにてご連絡します。</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/orders/shipments"
                className="text-sm text-slate-600 underline-offset-4 hover:text-foreground hover:underline"
              >
                ← 発送履歴に戻る
              </Link>
              <SubmitButton />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
