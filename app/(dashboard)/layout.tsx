import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              Starlink Tracker
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Antenas
              </Link>
              <Link href="/import" className="hover:underline">
                Importar CSV
              </Link>
              <Link href="/antennas/new" className="hover:underline">
                Agregar antena
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
