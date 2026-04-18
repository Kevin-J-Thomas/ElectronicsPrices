import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-gray-900 text-gray-100 p-4">
        <h2 className="text-lg font-bold mb-6">Admin</h2>
        <nav className="flex flex-col gap-2">
          <Link href="/admin" className="hover:bg-gray-800 rounded px-3 py-2">Overview</Link>
          <Link href="/admin/sites" className="hover:bg-gray-800 rounded px-3 py-2">Sites</Link>
          <Link href="/admin/schedule" className="hover:bg-gray-800 rounded px-3 py-2">Scheduler</Link>
          <Link href="/admin/runs" className="hover:bg-gray-800 rounded px-3 py-2">Run History</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
