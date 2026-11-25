"use client";

import { useMemo, useState } from "react";
import {
  REGION_DIMENSIONS,
  summarizeRegionGroups,
  type RegionDimension,
  type RegionStore,
} from "@/lib/regions";

// 매장 수가 이보다 적은 그룹은 한두 매장에 따라 숫자가 크게 흔들려서 "표본 적음"으로 표시한다.
const SMALL_SAMPLE = 5;

const DIMENSION_HELP: Record<RegionDimension, string> = {
  areaType:
    "주소에 읍·면이 있거나 군 지역이면 '읍·면·군', 그 밖에는 서울 / 광역시(동) / 세종(동) / 도 지역 시(동)로 나눕니다.",
  macro: "수도권(서울·인천·경기), 충청권(대전·세종·충남·충북), 영남권, 호남권, 강원, 제주로 묶습니다.",
  sido: "시도별로 묶습니다. 매장이 적은 시도는 참고만 하세요.",
};

export function RegionCompare({
  stores,
  topCut,
  bottomCut,
  periodDays,
  showYogiyoShare,
}: {
  stores: RegionStore[];
  topCut: number;
  bottomCut: number;
  periodDays: number;
  showYogiyoShare: boolean;
}) {
  const [dimension, setDimension] = useState<RegionDimension>("areaType");
  const [selected, setSelected] = useState<string | null>(null);

  const groups = useMemo(
    () => summarizeRegionGroups(stores, dimension, topCut, bottomCut),
    [stores, dimension, topCut, bottomCut]
  );
  const maxMedian = Math.max(...groups.map((g) => g.medianPizzasPerDay), 0.01);

  const listed = useMemo(
    () =>
      stores
        .filter((s) => selected === null || s[dimension] === selected)
        .sort((a, b) => b.pizzasPerDay - a.pizzasPerDay),
    [stores, dimension, selected]
  );

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-1 mb-2" role="tablist" aria-label="비교 기준">
          {REGION_DIMENSIONS.map((d) => {
            const active = d.key === dimension;
            return (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDimension(d.key);
                  setSelected(null);
                }}
                className="text-xs px-2.5 py-1.5 rounded-md border"
                style={
                  active
                    ? { background: "var(--surface-1)", borderColor: "var(--border-strong)", fontWeight: 600 }
                    : { color: "var(--text-secondary)", borderColor: "var(--border)" }
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">{DIMENSION_HELP[dimension]}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">구분</th>
                <th className="py-2 font-normal text-right">매장 수</th>
                <th className="py-2 pl-4 font-normal">매장당 하루 판수 (중간값)</th>
                <th className="py-2 font-normal text-right">평균</th>
                <th className="py-2 font-normal text-right">건단가</th>
                {showYogiyoShare && <th className="py-2 font-normal text-right">요기요 비중</th>}
                <th className="py-2 font-normal text-right">상위 25%</th>
                <th className="py-2 font-normal text-right">하위 25%</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isSelected = g.name === selected;
                return (
                  <tr
                    key={g.name}
                    className={`border-b border-[var(--border)] last:border-0 ${isSelected ? "bg-[var(--bg-accent)]" : ""}`}
                  >
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelected(isSelected ? null : g.name)}
                        className="text-left underline underline-offset-2 decoration-[var(--border-strong)] hover:text-[var(--text-accent)]"
                      >
                        {g.name}
                      </button>
                      {g.storeCount < SMALL_SAMPLE && (
                        <span className="ml-1.5 text-xs text-[var(--text-muted)]">표본 적음</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{g.storeCount}곳</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-right tabular-nums font-medium">
                          {g.medianPizzasPerDay.toFixed(1)}판
                        </span>
                        <span className="h-2 flex-1 min-w-[60px] rounded-full bg-[var(--surface-1)]">
                          <span
                            className="block h-2 rounded-full bg-[var(--fill-accent)]"
                            style={{ width: `${Math.max(2, (g.medianPizzasPerDay / maxMedian) * 100)}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{g.meanPizzasPerDay.toFixed(1)}판</td>
                    <td className="py-2 text-right tabular-nums">
                      {g.avgTicket !== null ? `${g.avgTicket.toLocaleString()}원` : "-"}
                    </td>
                    {showYogiyoShare && (
                      <td className="py-2 text-right tabular-nums">
                        {g.yogiyoShare !== null ? `${(g.yogiyoShare * 100).toFixed(0)}%` : "-"}
                      </td>
                    )}
                    <td className="py-2 text-right tabular-nums">{g.topCount}곳</td>
                    <td className="py-2 text-right tabular-nums">{g.bottomCount}곳</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          상위·하위 25%는 전체 매장 중 하루 {topCut.toFixed(1)}판 이상 / {bottomCut.toFixed(1)}판 이하인 매장 수입니다.
          구분 이름을 누르면 아래에 그 지역 매장만 나옵니다.
        </p>
      </div>

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm font-medium">
            {selected ?? "전체"} 매장 ({listed.length}곳)
          </p>
          {selected !== null && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-[var(--text-accent)] underline underline-offset-2"
            >
              전체 매장 보기
            </button>
          )}
        </div>
        <div className="overflow-auto max-h-[28rem]">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">매장</th>
                <th className="py-2 font-normal">지역</th>
                <th className="py-2 font-normal">동네 유형</th>
                <th className="py-2 font-normal text-right">하루 판수</th>
                <th className="py-2 font-normal text-right">하루 주문</th>
                <th className="py-2 font-normal text-right">건단가</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((s) => (
                <tr key={s.storeName} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-2">
                    {s.storeName}
                    {s.days < periodDays && (
                      <span className="ml-1.5 text-xs text-[var(--text-muted)]">{s.days}일 기준</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {s.sido} {s.sigungu !== s.sido ? s.sigungu : ""}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">{s.areaType}</td>
                  <td className="py-2 text-right tabular-nums">{s.pizzasPerDay.toFixed(1)}판</td>
                  <td className="py-2 text-right tabular-nums">{s.ordersPerDay.toFixed(1)}건</td>
                  <td className="py-2 text-right tabular-nums">
                    {s.avgTicket !== null ? `${s.avgTicket.toLocaleString()}원` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
