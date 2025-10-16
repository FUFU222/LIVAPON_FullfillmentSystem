import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'LIVAPON Fulfillment Console',
  description:
    'LIVAPON の公式ベンダー向け配送管理プラットフォーム。注文確認から発送処理までをシンプルに効率化します。'
};

const onboardingFlow = [
  {
    step: '01',
    title: 'ベンダー利用申請',
    description: '申請フォームに会社情報と担当者の連絡先を入力して送信します。'
  },
  {
    step: '02',
    title: '管理者による承認',
    description: 'LIVAPON 管理チームが申請内容を確認し、アカウント発行を行います。'
  },
  {
    step: '03',
    title: '利用開始',
    description: 'サインインすると注文が確認できる様になり、業務をすぐに開始できます。'
  }
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-black/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
        </div>
        <div className="relative flex min-h-screen w-full flex-col justify-center gap-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            LIVAPON とベンダーを結ぶ、
            <br className="hidden sm:block" />
            正式パートナー向け配送コンソール
          </h1>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <Link
              href="/sign-in"
              className={buttonClasses(
                'default',
                'inline-flex items-center gap-2 border border-black/10 bg-black px-6 py-3 text-base text-white shadow-md shadow-black/20 transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:bg-black/90 active:translate-y-0'
              )}
            >
              サインイン
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/apply"
              className={buttonClasses(
                'outline',
                'border-black/20 px-6 py-3 text-base text-slate-900 transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:bg-black/5 active:translate-y-0'
              )}
            >
              ベンダー申請はこちら
            </Link>
          </div>
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-black/5 bg-white p-6 text-center shadow-xl shadow-black/10 sm:flex-row sm:justify-center sm:gap-8">
            {onboardingFlow.map((item, index) => (
              <Fragment key={item.step}>
                <div className="flex h-full w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-md shadow-black/10">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#801010]/30 bg-[#801010]/10 text-xs font-semibold uppercase tracking-[0.3em] text-[#801010]">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
                {index < onboardingFlow.length - 1 ? (
                  <>
                    <div className="hidden sm:flex h-1 w-16 items-center justify-center" aria-hidden="true">
                      <div className="h-1 w-full rounded-full bg-gradient-to-r from-[#801010]/80 via-[#801010]/40 to-transparent" />
                    </div>
                    <div className="flex sm:hidden h-10 w-1 items-center justify-center" aria-hidden="true">
                      <div className="h-full w-1 rounded-full bg-gradient-to-b from-[#801010]/80 via-[#801010]/40 to-transparent" />
                    </div>
                  </>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
