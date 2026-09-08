"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAntennaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    siteName: "",
    location: "",
    accountLabel: "",
    terminalId: "",
    kitSerialNumber: "",
    planName: "",
    monthlyCost: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/antennas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        monthlyCost: form.monthlyCost || null,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la antena");
      return;
    }

    router.push("/");
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Agregar antena</h1>

      <Field label="Nombre del sitio *">
        <input
          required
          value={form.siteName}
          onChange={(e) => set("siteName", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Ubicación">
        <input value={form.location} onChange={(e) => set("location", e.target.value)} className="input" />
      </Field>
      <Field label="Cuenta Starlink">
        <input
          value={form.accountLabel}
          onChange={(e) => set("accountLabel", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Terminal ID">
        <input
          value={form.terminalId}
          onChange={(e) => set("terminalId", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="# Kit">
        <input
          value={form.kitSerialNumber}
          onChange={(e) => set("kitSerialNumber", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Plan">
        <input value={form.planName} onChange={(e) => set("planName", e.target.value)} className="input" />
      </Field>
      <Field label="Costo mensual">
        <input
          type="number"
          step="0.01"
          value={form.monthlyCost}
          onChange={(e) => set("monthlyCost", e.target.value)}
          className="input"
        />
      </Field>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
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
