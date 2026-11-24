"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const MENU_MIX_ANCHOR = "menu-mix";

// 상단 메뉴의 "메뉴 믹스" 바로가기. 다른 화면에서는 대시보드로 이동하면서 메뉴 믹스
// 위치로 내려가고, 이미 대시보드에 있을 때는 페이지를 다시 불러오지 않고 스크롤만
// 한다 — 그래야 지금 걸어둔 기간·매장·채널 필터가 그대로 유지된다.
export function MenuMixLink({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <Link
      href={`/#${MENU_MIX_ANCHOR}`}
      className={className}
      onClick={(e) => {
        if (pathname !== "/") return;
        const target = document.getElementById(MENU_MIX_ANCHOR);
        if (!target) return;
        e.preventDefault();
        // 매장별 표가 길어 메뉴 믹스까지 거리가 멀다 — 부드러운 스크롤은 몇 초씩 걸려서 바로 이동시킨다.
        target.scrollIntoView({ behavior: "auto", block: "start" });
      }}
    >
      메뉴 믹스
    </Link>
  );
}
