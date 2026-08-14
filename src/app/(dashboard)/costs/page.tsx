import { getMenuCosts } from "@/lib/data";
import { saveMenuCost } from "./actions";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const costs = await getMenuCosts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">메뉴 원가 관리</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          메뉴명은 업로드 파일의 메뉴명과 정확히 일치해야 대시보드의 마진 표에 반영됩니다.
        </p>
      </div>

      <form
        action={saveMenuCost}
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 grid sm:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-end"
      >
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">메뉴명</label>
          <input
            name="name"
            required
            className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">원가(원)</label>
          <input
            name="cost"
            type="number"
            required
            className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">메모</label>
          <input
            name="note"
            className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium"
        >
          저장
        </button>
      </form>

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
              <th className="py-2 font-normal">메뉴</th>
              <th className="py-2 font-normal text-right">원가</th>
              <th className="py-2 font-normal">메모</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.name} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2">{c.name}</td>
                <td className="py-2 text-right">{c.cost.toLocaleString()}원</td>
                <td className="py-2 text-[var(--text-secondary)]">{c.note ?? ""}</td>
              </tr>
            ))}
            {costs.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-[var(--text-muted)]">
                  등록된 원가가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
