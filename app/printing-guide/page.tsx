import Link from "next/link";

const positions = [
  {
    id: "front-center",
    name: "胸前正中",
    desc: "最常見嘅隊徽位置，視覺焦點所在",
    maxSize: "W 25cm × H 25cm",
    recommended: "隊徽、贊助商標誌",
  },
  {
    id: "front-left",
    name: "左胸（心口位）",
    desc: "傳統隊徽位置，低調而專業",
    maxSize: "W 10cm × H 10cm",
    recommended: "隊徽、品牌標誌",
  },
  {
    id: "front-right",
    name: "右胸",
    desc: "通常同左胸對稱，可放第二個標誌",
    maxSize: "W 10cm × H 10cm",
    recommended: "贊助商、賽事標誌",
  },
  {
    id: "back-upper",
    name: "背脊上方（領下）",
    desc: "球員姓名最常見位置，遠距離都睇得清",
    maxSize: "W 30cm × H 8cm",
    recommended: "球員姓名、隊名",
  },
  {
    id: "back-center",
    name: "背脊正中",
    desc: "大號碼位置，比賽時最易辨認",
    maxSize: "W 25cm × H 30cm",
    recommended: "球員號碼",
  },
  {
    id: "back-lower",
    name: "背脊下方",
    desc: "次要贊助商或額外資訊位置",
    maxSize: "W 25cm × H 10cm",
    recommended: "贊助商、口號",
  },
  {
    id: "sleeve-left",
    name: "左袖",
    desc: "聯賽章或贊助商常用位置",
    maxSize: "W 8cm × H 8cm",
    recommended: "聯賽章、贊助商",
  },
  {
    id: "sleeve-right",
    name: "右袖",
    desc: "同左袖對稱，可放不同標誌",
    maxSize: "W 8cm × H 8cm",
    recommended: "賽事章、品牌標誌",
  },
  {
    id: "shorts-front",
    name: "短褲褲腳（前）",
    desc: "低調品牌展示位",
    maxSize: "W 8cm × H 8cm",
    recommended: "品牌標誌、隊徽",
  },
  {
    id: "socks",
    name: "球襪",
    desc: "細節位，通常印細隊徽或文字",
    maxSize: "W 6cm × H 6cm",
    recommended: "隊徽、隊名縮寫",
  },
];

const methods = [
  {
    name: "熱昇華 Sublimation",
    pros: ["全彩無限制", "手感零厚度", "永久唔甩色", "可印漸變同相"],
    cons: ["只限白色或淺色底衫", "成本較高"],
    best: "完全自訂設計、全衫印",
  },
  {
    name: "熱轉印 Heat Transfer",
    pros: ["任何顏色底衫都得", "細節清晰", "成本適中"],
    cons: ["有少少厚度感", "長期使用可能裂邊"],
    best: "隊徽、號碼、姓名",
  },
  {
    name: "絲印 Screen Print",
    pros: ["大量訂最平", "顏色飽和", "耐用"],
    cons: ["每色要開版", "複雜圖案唔啱", "有手感"],
    best: "簡單 logo、大量訂購",
  },
  {
    name: "刺繡 Embroidery",
    pros: ["最高質感", "立體效果", "極耐用"],
    cons: ["最貴", "細字唔清晰", "重量增加"],
    best: "高端隊徽、品牌標誌",
  },
];

export default function PrintingGuide() {
  return (
    <main className="min-h-dvh bg-[var(--color-surface-sunken)] text-[var(--color-ink)]">
      {/* Header */}
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-16 sm:pt-24">
        <p className="mb-2 text-[13px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
          Printing Guide
        </p>
        <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
          印刷位置參考指南
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          無論你係設計新衫定係加工現貨，了解每個印刷位置嘅尺寸限制同最佳用途，
          可以幫你做出更專業嘅決定。
        </p>
      </section>

      {/* Position Diagram */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="mb-6 text-xl font-bold sm:text-2xl">常見印刷位置</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line-strong)]">
                <th className="py-3 pr-4 text-left font-semibold text-[var(--color-ink)]">
                  位置
                </th>
                <th className="py-3 pr-4 text-left font-semibold text-[var(--color-ink)]">
                  描述
                </th>
                <th className="py-3 pr-4 text-left font-semibold text-[var(--color-ink)]">
                  最大尺寸
                </th>
                <th className="py-3 text-left font-semibold text-[var(--color-ink)]">
                  建議用途
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--color-line)] transition hover:bg-[var(--color-surface-raised)]"
                >
                  <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">
                    {p.name}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                    {p.desc}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[12px] text-[var(--color-accent)]">
                    {p.maxSize}
                  </td>
                  <td className="py-3 text-[var(--color-ink-muted)]">
                    {p.recommended}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Printing Methods Comparison */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="mb-6 text-xl font-bold sm:text-2xl">印刷方法比較</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {methods.map((m) => (
            <div
              key={m.name}
              className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="mb-3 text-[15px] font-bold">{m.name}</h3>
              <div className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-[var(--color-accent)]">
                  優點
                </p>
                <ul className="space-y-1 text-[13px] text-[var(--color-ink-muted)]">
                  {m.pros.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-[var(--color-warn)]">
                  限制
                </p>
                <ul className="space-y-1 text-[13px] text-[var(--color-ink-muted)]">
                  {m.cons.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-warn)]" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[12px] text-[var(--color-ink-faint)]">
                最適合：{m.best}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
          <h2 className="mb-4 text-lg font-bold">設計貼士</h2>
          <ul className="space-y-3 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <strong className="text-[var(--color-ink)]">對比色最重要：</strong>
                深色衫用淺色印刷，淺色衫用深色印刷，確保遠距離都睇得清。
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <strong className="text-[var(--color-ink)]">字體大細：</strong>
                背脊姓名建議最少 5cm 高，號碼建議 20–25cm 高，確保比賽時清晰可讀。
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <strong className="text-[var(--color-ink)]">隊徽簡化：</strong>
                太複雜嘅隊徽喺細尺寸會失去細節，建議準備簡化版做袖口或褲腳用。
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <strong className="text-[var(--color-ink)]">預留空間：</strong>
                印刷位置四周建議預留 2cm 空間，避免太貼近衫邊或接縫位。
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <strong className="text-[var(--color-ink)]">試印確認：</strong>
                大量訂購前建議先印一件樣版，確認顏色同位置先好落單。
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl">
            準備好開始設計？
          </h2>
          <p className="mx-auto mb-8 max-w-md text-[14px] text-[var(--color-ink-muted)]">
            用我哋嘅 3D 設計工具，即時預覽你嘅設計效果。
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
            <Link href="/" className="hover:text-[var(--color-ink)]">
              主頁
            </Link>
            <Link href="/showcase" className="hover:text-[var(--color-ink)]">
              作品展示
            </Link>
            <Link href="/login" className="hover:text-[var(--color-ink)]">
              登入
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
