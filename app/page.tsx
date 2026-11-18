import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/editor");

  return (
    <main className="min-h-dvh bg-[var(--color-surface-sunken)] text-[var(--color-ink)]">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-24 text-center sm:pt-32">
        <p className="mb-3 text-[13px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
          Zenex Sports Custom
        </p>
        <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
          專業足球衫訂制服務
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          無論係完全自訂設計，定係用現貨衫加印隊名隊徽，我哋都幫你整到最靚。
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-6 text-[13px] font-semibold text-[var(--color-accent-ink)] transition hover:bg-[var(--color-accent-strong)]"
          >
            免費注冊開始設計
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-line-strong)]"
          >
            登入現有帳戶
          </Link>
        </div>
      </section>

      {/* Product Details Comparison Table */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-10 text-center text-xl font-bold sm:text-2xl">
          產品詳情比較
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line-strong)]">
                <th className="py-3 pr-4 text-left font-semibold text-[var(--color-ink)]">
                  項目
                </th>
                <th className="py-3 pr-4 text-left font-semibold text-[var(--color-accent)]">
                  熱昇華訂制
                </th>
                <th className="py-3 text-left font-semibold text-[var(--color-accent)]">
                  現貨加工印制
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  設計自由度
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  完全自訂，由零開始
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  現成款色加印內容
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  製作時間
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  約 10–14 個工作天
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  約 3–7 個工作天
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  起訂量
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  最少 5 件
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  最少 1 件
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  價錢（每件）
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  約 $120–$180（視設計複雜度）
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  約 $60–$100（視印製內容）
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  顏色選擇
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  全彩無限制
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  現貨顏色為準
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  適合對象
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  有設計概念、追求獨一無二
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  時間緊迫、預算有限
                </td>
              </tr>
              <tr className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  印刷技術
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  熱昇華（全衫印）
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  熱轉印 / 絲印 / 刺繡
                </td>
              </tr>
              <tr className="transition hover:bg-[var(--color-surface-raised)]">
                <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                  耐用度
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  永久唔甩色，色彩持久
                </td>
                <td className="py-3 text-[var(--color-ink-muted)]">
                  視乎技術，一般 1–3 年
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-center text-[13px] text-[var(--color-ink-muted)]">
          唔清楚邊種啱你？{" "}
          <Link
            href="/printing-guide"
            className="text-[var(--color-accent)] underline underline-offset-2 transition hover:text-[var(--color-accent-strong)]"
          >
            睇印刷位置參考指南
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl">
            準備好設計你嘅專屬球衣？
          </h2>
          <p className="mx-auto mb-8 max-w-md text-[14px] text-[var(--color-ink-muted)]">
            免費注冊帳戶，立即使用我哋嘅 3D 設計工具，打造獨一無二嘅球隊形象。
          </p>
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-8 text-[13px] font-semibold text-[var(--color-accent-ink)] transition hover:bg-[var(--color-accent-strong)]"
          >
            免費注冊開始設計
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <p className="text-[12px] text-[var(--color-ink-faint)]">
            © {new Date().getFullYear()} Zenex Sports Custom
          </p>
          <div className="flex gap-6 text-[12px] text-[var(--color-ink-muted)]">
            <Link href="/showcase" className="hover:text-[var(--color-ink)]">
              作品展示
            </Link>
            <Link href="/printing-guide" className="hover:text-[var(--color-ink)]">
              印刷指南
            </Link>
            <Link href="/login" className="hover:text-[var(--color-ink)]">
              登入
            </Link>
            <Link href="/register" className="hover:text-[var(--color-ink)]">
              注冊
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
