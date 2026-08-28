import { getAdCampaigns } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmtPct(v: number | null) {
  return v !== null ? `${v}%` : "-";
}

export default async function AdPolicyPage() {
  const campaigns = await getAdCampaigns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">광고정책</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          쿠팡이츠 광고관리 탭에서 매장별로 설정한 광고 상태·기간·CPS%를 봅니다.
        </p>
      </div>

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
        {campaigns.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6 text-center">아직 등록된 광고정책이 없습니다.</p>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">매장명</th>
                <th className="py-2 font-normal">광고 꺼짐/켜짐</th>
                <th className="py-2 font-normal">광고 기간</th>
                <th className="py-2 font-normal text-right">전체 고객 CPS%</th>
                <th className="py-2 font-normal text-right">재주문 고객 CPS%</th>
                <th className="py-2 font-normal text-right">신규 고객 CPS%</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.store_name} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 whitespace-nowrap">{c.store_name}</td>
                  <td className="py-2 whitespace-nowrap">{c.is_active ? "ON" : "OFF"}</td>
                  <td className="py-2 whitespace-nowrap">
                    {c.campaign_started_at ? `${c.campaign_started_at.replaceAll("-", ".")} ~` : "-"}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_all)}</td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_reorder)}</td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_new)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
