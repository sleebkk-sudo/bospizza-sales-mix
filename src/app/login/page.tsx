import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-0)] px-4">
      <form
        action={login}
        className="w-full max-w-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-6"
      >
        <p className="font-medium text-base mb-1">보스피자</p>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Sales Mix 대시보드
        </p>
        <label className="block text-sm text-[var(--text-secondary)] mb-2">
          비밀번호
        </label>
        <input
          type="password"
          name="password"
          autoFocus
          className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
        />
        {error && (
          <p className="text-sm text-[var(--text-danger)] mb-3">
            비밀번호가 올바르지 않습니다.
          </p>
        )}
        <button
          type="submit"
          className="w-full h-9 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium"
        >
          입장하기
        </button>
      </form>
    </div>
  );
}
