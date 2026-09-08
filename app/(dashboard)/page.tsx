"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [account, setAccount] = useState("");
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState("last_seen_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, monthlyCost: 0, onlinePct: 0 });

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (account) params.set("account", account);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/antennas?${params.toString()}`);
      const data = await res.json();
      setAntennas(data.antennas ?? []);
      if (!opts.silent) setLoading(false);
    },
    [q, status, account, sortBy, sortDir],
  );

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (account) params.set("account", account);
    const res = await fetch(`/api/antennas/stats?${params.toString()}`);
    const data = await res.json();
    setStats({
      total: data.total ?? 0,
      online: data.online ?? 0,
      offline: data.offline ?? 0,
      monthlyCost: data.monthlyCost ?? 0,
      onlinePct: data.onlinePct ?? 0,
    });
  }, [q, account]);

  useEffect(() => {
    const timeout = setTimeout(loadStats, 200);
    return () => clearTimeout(timeout);
  }, [loadStats]);

  useEffect(() => {
    const interval = setInterval(loadStats, 15_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  function handleSortClick(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const loadAccountOptions = useCallback(() => {
    fetch("/api/antennas/accounts")
      .then((res) => res.json())
      .then((data) => setAccountOptions(data.accounts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAccountOptions();
  }, [loadAccountOptions]);

  // Refresco silencioso: el cron de sincronización actualiza la base cada
  // pocos minutos, esto hace que el dashboard lo refleje sin recargar la página.
  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    setUnmatchedCount(0);
    try {
      const res = await fetch("/api/starlink/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error ?? "Error al sincronizar");
      } else if (data.mode === "mock") {
        setSyncMessage(data.message);
      } else {
        const parts = [`${data.updated} antena(s) actualizadas`];
        if (data.unmatched?.length) {
          parts.push(`${data.unmatched.length} terminal(es) sin vincular`);
          setUnmatchedCount(data.unmatched.length);
        }
        if (data.errors?.length)
          parts.push(
            `errores: ${data.errors.map((e: { message: string }) => e.message).join("; ")}`,
          );
        setSyncMessage(parts.join(" — "));
      }
      await Promise.all([load(), loadStats()]);
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportUnmatched() {
    setImporting(true);
    try {
      const res = await fetch("/api/starlink/import-unmatched", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error ?? "Error al importar");
      } else {
        setSyncMessage(`${data.created} antena(s) nueva(s) agregadas`);
        setUnmatchedCount(0);
        loadAccountOptions();
      }
      await Promise.all([load(), loadStats()]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="En línea" value={stats.online} />
        <StatTile label="% en línea" value={`${stats.onlinePct}%`} />
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
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="">Todas las cuentas</option>
          {accountOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{syncMessage}</p>
          {unmatchedCount > 0 && (
            <button
              onClick={handleImportUnmatched}
              disabled={importing}
              className="self-start rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {importing
                ? "Agregando..."
                : `Agregar estas ${unmatchedCount} antena(s) nueva(s)`}
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
            <tr>
              <SortableHeader column="site_name" label="Sitio" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
              <SortableHeader column="account_label" label="Cuenta" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
              <SortableHeader column="status" label="Estado" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
              <SortableHeader column="last_seen_at" label="Última conexión" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
              <SortableHeader column="plan_name" label="Plan" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
              <SortableHeader column="monthly_cost" label="Costo/mes" sortBy={sortBy} sortDir={sortDir} onClick={handleSortClick} />
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

function SortableHeader({
  column,
  label,
  sortBy,
  sortDir,
  onClick,
}: {
  column: string;
  label: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onClick: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <th
      onClick={() => onClick(column)}
      className="px-4 py-2 font-medium cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {label}
      <span className="ml-1 text-neutral-400">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
    </th>
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
