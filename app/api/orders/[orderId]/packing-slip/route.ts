// GET /api/orders/[orderId]/packing-slip
//
// 認可: admin もしくは「該当注文に line_item を持つ vendor」
//   - vendor が他社の注文IDで叩いた場合 → 404 を返す(存在情報を漏らさない)
// 認可境界は lib/packing-slip/getPackingSlipPDF 内で RLS + content filtering により担保される。
//
// UX:
//   - 本エンドポイントは <a target="_blank"> から叩かれるブラウザナビゲーション。
//     未ログインの場合は JSON ではなく sign-in 画面へリダイレクトし、
//     ログイン後に同じ URL へ戻れるようにする(redirectTo)。
//   - 認可違反や not found 等の他エラーは JSON で返す(ブラウザに JSON 生表示は許容)。
//
// セキュリティヘッダー:
//   - Cache-Control: private, no-store(共有キャッシュに乗らないように)
//   - Content-Disposition: inline(ブラウザでプレビュー優先、必要なら attachment に切替え)

import { NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthenticatedError,
  requireAuthContext
} from '@/lib/auth';
import { getServerActionClient } from '@/lib/supabase/server';
import {
  PackingSlipEmptyError,
  PackingSlipNotFoundError,
  getPackingSlipPDF
} from '@/lib/packing-slip';
import type { IssuanceContext } from '@/lib/packing-slip';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  let orderIdRaw: string;
  try {
    const params = await context.params;
    orderIdRaw = params.orderId;
  } catch (error) {
    console.error('Failed to resolve packing-slip route params', error);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const orderId = Number(orderIdRaw);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'invalid_order_id' }, { status: 400 });
  }

  let auth;
  try {
    auth = await requireAuthContext();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      // ブラウザから直接開かれているので、sign-in へリダイレクトする方が親切
      // (ログイン後に同じ URL に戻る)
      const requestUrl = new URL(request.url);
      const redirectTo = requestUrl.pathname + requestUrl.search;
      const signInUrl = new URL('/sign-in', requestUrl.origin);
      signInUrl.searchParams.set('redirectTo', redirectTo);
      return NextResponse.redirect(signInUrl, { status: 303 });
    }
    throw error;
  }

  // ロール → IssuanceContext を構築
  let issuanceCtx: IssuanceContext;
  if (auth.role === 'admin') {
    issuanceCtx = { role: 'admin', userId: auth.user.id };
  } else if (auth.role === 'vendor' && Number.isInteger(auth.vendorId)) {
    issuanceCtx = { role: 'vendor', userId: auth.user.id, vendorId: auth.vendorId as number };
  } else {
    // 'pending_vendor' や vendorId なしのロール → 拒否
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const client = await getServerActionClient();

  try {
    const { buffer, filename } = await getPackingSlipPDF(client, orderId, issuanceCtx);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    if (error instanceof PackingSlipNotFoundError) {
      // 存在情報を漏らさないため、認可違反も「404」 で返す
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (error instanceof PackingSlipEmptyError) {
      return NextResponse.json({ error: 'empty_order' }, { status: 422 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    console.error('Failed to generate packing slip PDF', { orderId, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
