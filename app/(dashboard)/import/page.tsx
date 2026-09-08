"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = { created: number; updated: number; errors: string[] };

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    setResult(data);
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Importar antenas desde CSV</h1>

      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-neutral-600 dark:text-neutral-400">
        <p className="mb-2">Columnas esperadas (encabezados sin distinguir mayúsculas):</p>
        <code className="text-xs">
          site_name, location, terminal_id, kit_serial_number, plan_name, monthly_cost, status, notes
        </code>
        <p className="mt-2">
          Solo <code>site_name</code> es obligatorio. Si <code>terminal_id</code> ya existe, la fila
          actualiza esa antena en vez de crear una nueva.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="self-start rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Importando..." : "Importar"}
        </button>
      </form>

      {result && (
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
          <p>
            {result.created} creada(s), {result.updated} actualizada(s)
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-600 dark:text-red-400">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <button onClick={() => router.push("/")} className="mt-3 text-blue-600 dark:text-blue-400 hover:underline">
            Ver dashboard
          </button>
        </div>
      )}
    </div>
  );
}
