import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'LIVAPON 配送管理システム',
  description:
    'LIVAPON の公式配送管理システム。注文確認から発送処理までをシンプルに効率化します。'
};

const onboardingFlow = [
  {
    step: '01',
    title: '利用申請',
    note: '会社情報・担当者・連絡先を登録'
  },
  {
    step: '02',
    title: '管理者承認',
    note: 'LIVAPON 側で内容確認のうえアカウント発行'
  },
  {
    step: '03',
    title: '利用開始',
    note: 'サインイン後、注文確認と発送登録を開始'
  }
];

export default function HomePage() {
  return (
    <main className="flex min-h-[68vh] flex-col bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <section className="relative flex flex-1 items-center overflow-hidden">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col justify-center gap-8 px-6 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 text-center sm:max-w-2xl sm:text-left">
              <span className="inline-flex items-center gap-2 self-center rounded-full border border-black/10 bg-black/5 px-5 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-[#801010] sm:self-start">
                Official Partner Access
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
                配送管理システム
              </h1>
              <p className="text-sm text-slate-600 sm:text-base lg:text-lg lg:whitespace-nowrap">
                LIVAPON 正式パートナーが、出荷に関わる入力と確認をまとめて行うための専用スペースです。
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
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
                利用申請はこちら
              </Link>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm shadow-black/10 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 sm:text-sm">
                  利用開始までの3ステップ
                </h2>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 sm:text-xs">
                  審査完了後すぐに運用開始
                </span>
              </div>

              <div className="relative">
                <div
                  className="pointer-events-none absolute left-6 right-6 top-5 hidden h-px bg-gradient-to-r from-[#801010]/50 via-[#801010]/35 to-[#801010]/20 sm:block"
                  aria-hidden="true"
                />
                <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                  {onboardingFlow.map((item) => (
                    <li
                      key={item.step}
                      className="relative rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-colors duration-200 hover:border-slate-300 hover:bg-white"
                    >
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#801010]/25 bg-[#801010]/10 px-2 text-[0.64rem] font-semibold tracking-[0.18em] text-[#801010]">
                        {item.step}
                      </span>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{item.note}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
