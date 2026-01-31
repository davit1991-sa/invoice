/**
 * Minimal CSV parser for simple, comma-separated rows.
 * Supports quoted values with "" escaping.
 * Assumption: first row is header.
 */
export function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = (cols[j] ?? '').trim();
    }
    rows.push(obj);
  }
  return rows;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // escaped quote
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export function toCsv(rows: Array<Record<string, any>>, headers: string[]): string {
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [];
  lines.push(headers.join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  return lines.join('\n') + '\n';
}
