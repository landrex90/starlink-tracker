/** Minimal RFC4180-ish CSV parser: handles quoted fields, commas/newlines inside quotes, "" escapes. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type AntennaCsvRow = {
  site_name: string;
  location?: string;
  terminal_id?: string;
  kit_serial_number?: string;
  plan_name?: string;
  monthly_cost?: string;
  status?: string;
  notes?: string;
};

export function parseAntennaCsv(text: string): {
  rows: AntennaCsvRow[];
  errors: string[];
} {
  const rawRows = parseCsvRows(text);
  const errors: string[] = [];
  if (rawRows.length === 0) return { rows: [], errors: ["El archivo está vacío"] };

  const headers = rawRows[0].map((h) => h.trim().toLowerCase());
  const siteNameIndex = headers.indexOf("site_name");
  if (siteNameIndex === -1) {
    return { rows: [], errors: ["La columna requerida 'site_name' no fue encontrada"] };
  }

  const rows: AntennaCsvRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? "").trim();
    });

    if (!record.site_name) {
      errors.push(`Fila ${i + 1}: falta site_name, se omite`);
      continue;
    }

    rows.push(record as AntennaCsvRow);
  }

  return { rows, errors };
}

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}
