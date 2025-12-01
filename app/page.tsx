import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'LIVAPON 配送管理コンソール',
  description:
    'LIVAPON の公式配送管理コンソール。注文確認から発送処理までをシンプルに効率化します。'
};

const onboardingFlow = [
  {
    step: '01',
    title: 'ベンダー利用申請',
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
                配送管理コンソール
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
                ベンダー申請はこちら
              </Link>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm shadow-black/10 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 sm:text-left">
              {onboardingFlow.map((item, index) => (
                <Fragment key={item.step}>
                  <div className="flex w-full max-w-xs flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#801010]/20 bg-[#801010]/10 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#801010]">
                      {item.step}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{item.title}</h3>
                    <p className="text-xs text-slate-500 sm:text-sm">{item.note}</p>
                  </div>
                  {index < onboardingFlow.length - 1 ? (
                    <>
                      <div className="hidden sm:flex h-[2px] w-12 items-center justify-center" aria-hidden="true">
                        <div className="h-[2px] w-full rounded-full bg-gradient-to-r from-[#801010]/70 via-[#801010]/30 to-transparent" />
                      </div>
                      <div className="flex sm:hidden h-8 w-[2px] items-center justify-center" aria-hidden="true">
                        <div className="h-full w-[2px] rounded-full bg-gradient-to-b from-[#801010]/70 via-[#801010]/30 to-transparent" />
                      </div>
                    </>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
