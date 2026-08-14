export type MetricCardRole = "accent" | "success" | "warning" | "danger" | "neutral";

export function MetricCard({
  label,
  value,
  role,
}: {
  label: string;
  value: string;
  role?: MetricCardRole;
}) {
  if (!role) {
    return (
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl p-4" style={{ background: `var(--bg-${role})` }}>
      <p className="text-xs mb-1" style={{ color: `var(--text-${role})` }}>
        {label}
      </p>
      <p className="text-lg font-semibold" style={{ color: `var(--text-${role})` }}>
        {value}
      </p>
    </div>
  );
}
