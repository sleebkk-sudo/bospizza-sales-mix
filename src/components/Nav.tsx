import Link from "next/link";
import { logout } from "@/app/logout-action";
import { MenuMixLink } from "@/components/MenuMixLink";

const linkClass = "text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

// "메뉴 믹스"는 대시보드 안의 한 구역으로 바로 내려가는 바로가기라서 MenuMixLink로 따로 그린다.
const links = [
  { href: "/", label: "대시보드" },
  { href: "/#menu-mix", label: "메뉴 믹스" },
  { href: "/upload", label: "업로드" },
  { href: "/reviews", label: "리뷰" },
];

export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-2)]">
      {/* 좁은 화면에서는 메뉴가 둘째 줄로 내려간다 — 한 줄에 다 넣으면 글자가 두 줄로 꺾인다. */}
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-0 sm:h-14 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href="/"
          aria-label="보스피자 Sales Mix 홈으로"
          className="font-medium text-sm whitespace-nowrap rounded-sm hover:text-[var(--fill-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--fill-accent)]"
        >
          보스피자 Sales Mix
        </Link>
        <nav className="order-last w-full sm:order-none sm:w-auto flex items-center gap-4 whitespace-nowrap">
          {links.map((l) =>
            l.href === "/#menu-mix" ? (
              <MenuMixLink key={l.href} className={linkClass} />
            ) : (
              <Link key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            )
          )}
        </nav>
        <form action={logout} className="ml-auto">
          <button
            type="submit"
            className="text-sm whitespace-nowrap text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
