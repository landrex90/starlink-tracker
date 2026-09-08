"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

type Antenna = {
  id: number;
  siteName: string;
  location: string | null;
  accountLabel: string | null;
  terminalId: string | null;
  status: string;
  lastSeenAt: string | null;
  signalQuality: string | null;
  planName: string | null;
  monthlyCost: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  online: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  offline: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unknown: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export default function DashboardPage() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/antennas?${params.toString()}`);
    const data = await res.json();
    setAntennas(data.antennas ?? []);
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const stats = useMemo(() => {
    const total = antennas.length;
    const online = antennas.filter((a) => a.status === "online").length;
    const offline = antennas.filter((a) => a.status === "offline").length;
    const monthlyCost = antennas.reduce((sum, a) => sum + (Number(a.monthlyCost) || 0), 0);
    return { total, online, offline, monthlyCost };
  }, [antennas]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/starlink/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error ?? "Error al sincronizar");
      } else if (data.mode === "mock") {
        setSyncMessage(data.message);
      } else {
        const parts = [`${data.updated} antena(s) actualizadas`];
        if (data.unmatched?.length) parts.push(`${data.unmatched.length} terminal(es) sin vincular`);
        if (data.errors?.length)
          parts.push(
            `errores: ${data.errors.map((e: { message: string }) => e.message).join("; ")}`,
          );
        setSyncMessage(parts.join(" — "));
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="En línea" value={stats.online} />
        <StatTile label="Fuera de línea" value={stats.offline} />
        <StatTile label="Costo mensual" value={`$${stats.monthlyCost.toFixed(2)}`} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          placeholder="Buscar por sitio, ubicación o terminal..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="online">En línea</option>
          <option value="offline">Fuera de línea</option>
          <option value="unknown">Desconocido</option>
        </select>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {syncing ? "Sincronizando..." : "Sync now"}
        </button>
      </div>

      {syncMessage && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{syncMessage}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Sitio</th>
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Última conexión</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Costo/mes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && antennas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Sin antenas registradas todavía.
                </td>
              </tr>
            )}
            {antennas.map((a) => (
              <tr
                key={a.id}
                className="border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/antennas/${a.id}`} className="hover:underline font-medium">
                    {a.siteName}
                  </Link>
                  {a.location && (
                    <div className="text-xs text-neutral-500">{a.location}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {a.accountLabel ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? STATUS_STYLES.unknown}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2">{a.planName ?? "—"}</td>
                <td className="px-4 py-2">
                  {a.monthlyCost ? `$${Number(a.monthlyCost).toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
