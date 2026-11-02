import { useRef, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { bySizeDesc, formatBytes, parseAlbumsFile } from '../../utils/photoAlbums';
import { dateKeySaoPaulo } from '../../utils/format';
import { daysSince } from '../../utils/instagram';
import styles from './PhotoAlbums.module.css';

const MAX_BARS = 10; // the biggest albums get a bar; the rest are summed in "Outros"
const MODES = [
  { key: 'size', label: 'Tamanho', title: 'Álbuns pelo espaço que ocupam' },
  { key: 'qty', label: 'Qtd', title: 'Álbuns pela quantidade de itens' },
];
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
const fmtInt = (n) => n.toLocaleString('pt-BR');
const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Horizontal bar chart: the biggest albums on top, the rest summed in "Outros".
function AlbumChart({ albums, mode }) {
  const [ref, { w: W, h: H }] = useElementSize();
  const L = 150;
  const R = 70;
  let body = null;
  if (W > 0 && H > 0 && albums.length > 0) {
    const byQty = mode === 'qty';
    const metric = (a) => (byQty ? a.items : a.bytes);
    const ordered = [...albums].sort((a, b) => metric(b) - metric(a) || a.name.localeCompare(b.name, 'pt-BR'));
    const top = ordered.slice(0, MAX_BARS).map((a) => ({ name: a.name, items: a.items, bytes: a.bytes }));
    const rest = ordered.slice(MAX_BARS);
    if (rest.length) top.push({ name: `Outros (${rest.length})`, items: rest.reduce((t, a) => t + a.items, 0), bytes: rest.reduce((t, a) => t + a.bytes, 0), other: true });
    const maxB = Math.max(...top.map(metric)) || 1;
    const rh = H / top.length;
    const bh = Math.min(18, rh * 0.62);
    body = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
        {top.map((a, i) => {
          const y = i * rh + (rh - bh) / 2;
          const bw = Math.max(1, ((W - L - R) * metric(a)) / maxB);
          return (
            <g key={a.name}>
              <title>{`${a.name} — ${fmtInt(a.items)} itens — ${formatBytes(a.bytes)}`}</title>
              <text x={L - 8} y={y + bh / 2 + 4} textAnchor="end" className={styles.cat}>
                {shorten(a.name, 24)}
              </text>
              <rect x={L} y={y} width={bw} height={bh} rx="2" fill={a.other ? '#c9bfd6' : '#7a6fc0'} />
              <text x={L + bw + 6} y={y + bh / 2 + 4} className={styles.val}>
                {byQty ? fmtInt(a.items) : formatBytes(a.bytes)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <div className={styles.chartBox} ref={ref}>
      {body}
    </div>
  );
}

// Backlog tab: "Fotos - Álbuns" — the Photos app's albums by size on disk, as a
// column chart and a table whose Total row folds the albums away.
export default function PhotoAlbums({ photos, open, onOpenChange }) {
  const { albums, library, day, loading, error, save } = photos;
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [mode, setMode] = useState('size'); // chart: by size (default) or by number of items
  const fileRef = useRef(null);

  const sorted = bySizeDesc(albums);
  // Albums overlap (one photo can be in several), so the Total is the library's
  // own figure when the file has it; otherwise the sum of the albums.
  const totalItems = library ? library.items : sorted.reduce((t, a) => t + a.items, 0);
  const totalBytes = library ? library.bytes : sorted.reduce((t, a) => t + a.bytes, 0);
  const age = daysSince(day, dateKeySaoPaulo());

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    const parsed = parseAlbumsFile(await file.text(), file.name);
    if (parsed.error) setProblem(parsed.error);
    else setPending({ fileName: file.name, parsed });
  }

  async function confirm() {
    setSaving(true);
    setProblem('');
    try {
      await save(pending.parsed.day, pending.parsed.albums, pending.parsed.library);
      setPending(null);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>Fotos - Álbuns</span>
        <span className={styles.tools}>
          {day && (
            <span className={styles.updated} title={`Última atualização: ${dm(day)}`}>
              atualizado {dm(day)}
              {age === 0 ? ' - hoje' : ` - há ${age} dia${age === 1 ? '' : 's'}`}
            </span>
          )}
          <span className={styles.pills}>
            {MODES.map((m) => (
              <button key={m.key} type="button" className={styles.pill} data-on={mode === m.key} onClick={() => setMode(m.key)} title={m.title}>
                {m.label}
              </button>
            ))}
          </span>
          <button type="button" className={styles.icon} onClick={() => fileRef.current?.click()} title="Importar o arquivo dos álbuns (JSON ou CSV)" aria-label="Importar o arquivo dos álbuns">
            ⬆
          </button>
          <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onFile} />
        </span>
      </div>

      {loading && <div className={styles.empty}>Carregando…</div>}
      {error && <div className={styles.error}>Não deu pra carregar os álbuns: {error}</div>}
      {problem && !pending && <div className={styles.error}>{problem}</div>}
      {!loading && !error && sorted.length === 0 && <div className={styles.empty}>Nenhum álbum ainda. O ⬆ importa o arquivo com álbum, itens e tamanho gerado no Mac.</div>}

      {sorted.length > 0 && (
        <>
          <AlbumChart albums={sorted} mode={mode} />
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Álbum</th>
                <th className={styles.r}>Itens</th>
                <th className={styles.r}>Tamanho</th>
                <th className={styles.r}>% do total</th>
              </tr>
            </thead>
            <tbody>
              <tr className={styles.total}>
                <td>
                  <button type="button" className={styles.caret} onClick={() => onOpenChange(!open)} aria-expanded={open} aria-label={open ? 'Recolher os álbuns' : 'Expandir os álbuns'}>
                    {open ? '▾' : '▸'}
                  </button>
                  {library ? 'Biblioteca' : 'Total'} · {sorted.length} álbuns
                </td>
                <td className={styles.r}>{fmtInt(totalItems)}</td>
                <td className={styles.r}>{formatBytes(totalBytes)}</td>
                <td className={styles.r}>100%</td>
              </tr>
              {open &&
                sorted.map((a) => (
                  <tr key={a.name}>
                    <td className={styles.album} title={a.name}>
                      {a.name}
                    </td>
                    <td className={styles.r}>{fmtInt(a.items)}</td>
                    <td className={styles.r}>
                      <b>{formatBytes(a.bytes)}</b>
                    </td>
                    <td className={styles.r}>{totalBytes ? `${((a.bytes / totalBytes) * 100).toFixed(1).replace('.', ',')}%` : '–'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {pending && (
        <div className={styles.backdrop} onClick={saving ? undefined : () => setPending(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogTitle}>Importar álbuns de fotos</div>
            <div className={styles.line}>
              <span>Arquivo</span>
              <b>{pending.fileName}</b>
            </div>
            <div className={styles.line}>
              <span>Álbuns</span>
              <b>{pending.parsed.albums.length}</b>
            </div>
            <div className={styles.line}>
              <span>Itens</span>
              <b>{fmtInt(pending.parsed.items)}</b>
            </div>
            <div className={styles.line}>
              <span>{pending.parsed.library ? 'Tamanho da biblioteca' : 'Tamanho total'}</span>
              <b>{formatBytes(pending.parsed.bytes)}</b>
            </div>
            <div className={styles.line}>
              <span>Maior álbum</span>
              <b>
                {bySizeDesc(pending.parsed.albums)[0].name} · {formatBytes(bySizeDesc(pending.parsed.albums)[0].bytes)}
              </b>
            </div>
            {pending.parsed.skipped > 0 && <div className={styles.warn}>{pending.parsed.skipped} linha(s) sem nome ou sem número foram descartadas.</div>}
            {problem && <div className={styles.error}>Não gravou: {problem}</div>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={confirm} disabled={saving}>
                {saving ? 'Gravando…' : `Gravar álbuns de ${dm(pending.parsed.day)}`}
              </button>
              <button type="button" className={styles.secondary} onClick={() => { setPending(null); setProblem(''); }} disabled={saving}>
                Cancelar
              </button>
              <span className={styles.hint}>substitui a importação do mesmo dia</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
