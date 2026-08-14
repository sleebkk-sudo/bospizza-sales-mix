import { Nav } from "@/components/Nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">{children}</main>
    </>
  );
}
