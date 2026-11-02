// Albums of the Photos app (Backlog tab, "Fotos - Álbuns"): reading the file
// made on the Mac and the sizes shown on the chart and table.
import { dateKeySaoPaulo } from './format';
import { parseCsv } from './instagram';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();

const pick = (o, names) => {
  for (const [k, v] of Object.entries(o)) if (names.includes(norm(k)) && v != null && v !== '') return v;
  return null;
};

// "1234", "1.234" and "1,5" -> number; anything else -> null.
function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const cleaned = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const UNIT = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12 };

// Size in bytes from "12,3 GB" / "850 MB" / 1234567 (a bare number is bytes).
function textToBytes(v) {
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^([\d.,]+)\s*([kmgt]?b)?$/i);
  if (!m) return null;
  const n = toNumber(m[1]);
  return n == null ? null : Math.round(n * UNIT[(m[2] || 'b').toLowerCase()]);
}

function sizeOf(o) {
  for (const [names, unit] of [
    [['tamanho bytes', 'size bytes', 'bytes', 'tamanho em bytes'], 1],
    [['tamanho kb', 'size kb', 'kb'], 1e3],
    [['tamanho mb', 'size mb', 'mb'], 1e6],
    [['tamanho gb', 'size gb', 'gb'], 1e9],
  ]) {
    const v = toNumber(pick(o, names));
    if (v != null) return Math.round(v * unit);
  }
  const text = pick(o, ['tamanho', 'size', 'espaco', 'espaco ocupado', 'tamanho ocupado']);
  return text == null ? null : textToBytes(text);
}

// The file: a JSON array (or { albums: [...] }) — or a CSV — with the album
// name, its number of items and its size. The import day is the date in the
// file name or today.
export function parseAlbumsFile(text, fileName, now = new Date()) {
  const today = dateKeySaoPaulo(now);
  let raw;
  let library = null; // the whole library, when the file has it: albums overlap, so they must not be summed
  let generatedDay = null;
  try {
    const json = JSON.parse(text.replace(/^﻿/, ''));
    raw = Array.isArray(json) ? json : json?.por_album || json?.albums || json?.albuns || json?.items;
    if (json && !Array.isArray(json) && json.biblioteca) {
      const bytes = sizeOf(json.biblioteca);
      const items = toNumber(pick(json.biblioteca, ['total', 'itens', 'items']));
      if (bytes != null || items != null) library = { items: Math.max(0, Math.round(items ?? 0)), bytes: Math.max(0, bytes ?? 0) };
    }
    generatedDay = String(json?.gerado_em ?? '').match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  } catch {
    raw = parseCsv(text.replace(/^﻿/, ''));
  }
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Não encontrei a lista de álbuns no arquivo (esperava álbum, itens e tamanho).' };

  const byName = new Map();
  let skipped = 0;
  for (const o of raw) {
    const name = String(pick(o, ['album', 'nome', 'name', 'title', 'titulo']) ?? '').trim();
    const items = toNumber(pick(o, ['itens', 'items', 'qtd', 'quantidade', 'count', 'total', 'fotos']));
    const bytes = sizeOf(o);
    if (!name || (items == null && bytes == null)) {
      skipped++;
      continue;
    }
    const cur = byName.get(name) || { name, items: 0, bytes: 0 };
    cur.items += Math.max(0, Math.round(items ?? 0));
    cur.bytes += Math.max(0, bytes ?? 0);
    byName.set(name, cur);
  }
  const albums = [...byName.values()];
  if (albums.length === 0) return { error: 'Nenhum álbum com nome, itens ou tamanho no arquivo.' };
  const fromName = String(fileName || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const fileDay = fromName || generatedDay;
  const day = fileDay && fileDay <= today ? fileDay : today;
  const items = library ? library.items : albums.reduce((t, a) => t + a.items, 0);
  const bytes = library ? library.bytes : albums.reduce((t, a) => t + a.bytes, 0);
  return { albums, library, skipped, day, items, bytes };
}

// Decimal units, as the Mac shows them: "12,3 GB", "850 MB".
export function formatBytes(b) {
  const n = (v, d) => v.toFixed(d).replace('.', ',');
  if (b >= 1e12) return `${n(b / 1e12, 2)} TB`;
  if (b >= 1e9) return `${n(b / 1e9, b >= 1e10 ? 1 : 2)} GB`;
  if (b >= 1e6) return `${n(b / 1e6, 0)} MB`;
  if (b >= 1e3) return `${n(b / 1e3, 0)} KB`;
  return `${b} B`;
}

export const bySizeDesc = (albums) => [...albums].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name, 'pt-BR'));
