import Link from "next/link";
import { logout } from "@/app/logout-action";

const links = [
  { href: "/", label: "대시보드" },
  { href: "/upload", label: "업로드" },
  { href: "/reviews", label: "리뷰" },
];

export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-2)]">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <span className="font-medium text-sm">보스피자 Sales Mix</span>
          <nav className="flex items-center gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
