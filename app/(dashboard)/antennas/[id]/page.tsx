"use client";

import { useEffect, useState, use as usePromise } from "react";

type Antenna = {
  id: number;
  siteName: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  accountLabel: string | null;
  terminalId: string | null;
  kitSerialNumber: string | null;
  status: string;
  lastSeenAt: string | null;
  signalQuality: string | null;
  planName: string | null;
  monthlyCost: string | null;
};

type Note = { id: number; note: string; createdAt: string };

export default function AntennaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [antenna, setAntenna] = useState<Antenna | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/antennas/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setAntenna(data.antenna);
    setNotes(data.notes ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id change
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof Antenna>(key: K, value: Antenna[K]) {
    setAntenna((a) => (a ? { ...a, [key]: value } : a));
  }

  async function handleSave() {
    if (!antenna) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/antennas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName: antenna.siteName,
        location: antenna.location,
        accountLabel: antenna.accountLabel,
        terminalId: antenna.terminalId,
        kitSerialNumber: antenna.kitSerialNumber,
        planName: antenna.planName,
        monthlyCost: antenna.monthlyCost || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    await load();
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    await fetch(`/api/antennas/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote }),
    });
    setNewNote("");
    await load();
  }

  if (!antenna) return <p className="text-neutral-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-lg font-semibold">{antenna.siteName}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre del sitio">
          <input className="input" value={antenna.siteName} onChange={(e) => set("siteName", e.target.value)} />
        </Field>
        <Field label="Ubicación">
          <input className="input" value={antenna.location ?? ""} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Cuenta Starlink">
          <input
            className="input"
            value={antenna.accountLabel ?? ""}
            onChange={(e) => set("accountLabel", e.target.value)}
          />
        </Field>
        <Field label="Terminal ID">
          <input
            className="input"
            value={antenna.terminalId ?? ""}
            onChange={(e) => set("terminalId", e.target.value)}
          />
        </Field>
        <Field label="# Kit">
          <input
            className="input"
            value={antenna.kitSerialNumber ?? ""}
            onChange={(e) => set("kitSerialNumber", e.target.value)}
          />
        </Field>
        <Field label="Plan">
          <input className="input" value={antenna.planName ?? ""} onChange={(e) => set("planName", e.target.value)} />
        </Field>
        <Field label="Costo mensual">
          <input
            className="input"
            type="number"
            step="0.01"
            value={antenna.monthlyCost ?? ""}
            onChange={(e) => set("monthlyCost", e.target.value)}
          />
        </Field>
        {antenna.latitude && antenna.longitude && (
          <Field label="Coordenadas (sincronizado)">
            <a
              href={`https://www.google.com/maps?q=${antenna.latitude},${antenna.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="input block hover:underline text-blue-600 dark:text-blue-400"
            >
              {antenna.latitude}, {antenna.longitude} — Ver en Google Maps
            </a>
          </Field>
        )}
        <Field label="Estado (sincronizado)">
          <input className="input opacity-70" value={antenna.status} readOnly />
        </Field>
        <Field label="Última conexión (sincronizado)">
          <input
            className="input opacity-70"
            value={antenna.lastSeenAt ? new Date(antenna.lastSeenAt).toLocaleString() : "—"}
            readOnly
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>

      <div>
        <h2 className="text-sm font-semibold mb-2">Notas de mantenimiento</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="input"
            placeholder="Agregar una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-2 text-sm whitespace-nowrap"
          >
            Agregar
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {notes.length === 0 && <li className="text-sm text-neutral-500">Sin notas todavía.</li>}
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-xs text-neutral-500 mb-1">{new Date(n.createdAt).toLocaleString()}</div>
              {n.note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
