import { useRef, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { bySizeDesc, formatBytes, parseAlbumsFile } from '../../utils/photoAlbums';
import { dateKeySaoPaulo } from '../../utils/format';
import { daysSince } from '../../utils/instagram';
import styles from './PhotoAlbums.module.css';

const MAX_COLUMNS = 16; // the biggest albums get a column; the rest are summed in "Outros"
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
const fmtInt = (n) => n.toLocaleString('pt-BR');
const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A "nice" axis step (1, 2, 5 × 10^k) so the scale has about four ticks.
function niceStep(max) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * mag >= raw) || 10) * mag;
}

// Column chart: one column per album, the biggest first.
function AlbumChart({ albums }) {
  const [ref, { w: W, h: H }] = useElementSize();
  const L = 46;
  const R = 8;
  const T = 20;
  const B = 76;
  let body = null;
  if (W > 0 && H > 0 && albums.length > 0) {
    const top = albums.slice(0, MAX_COLUMNS).map((a) => ({ name: a.name, items: a.items, bytes: a.bytes }));
    const rest = albums.slice(MAX_COLUMNS);
    if (rest.length) top.push({ name: `Outros (${rest.length})`, items: rest.reduce((t, a) => t + a.items, 0), bytes: rest.reduce((t, a) => t + a.bytes, 0), other: true });
    const unit = Math.max(...top.map((a) => a.bytes)) >= 1e9 ? { div: 1e9, label: 'GB' } : { div: 1e6, label: 'MB' };
    const maxV = Math.max(...top.map((a) => a.bytes)) / unit.div || 1;
    const step = niceStep(maxV);
    const topV = Math.ceil(maxV / step) * step;
    const cw = (W - L - R) / top.length;
    const Y = (v) => T + (1 - v / topV) * (H - T - B);
    body = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
        {Array.from({ length: Math.round(topV / step) + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#ece4f0" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" className={styles.axis}>
              {`${v.toLocaleString('pt-BR')} ${unit.label}`}
            </text>
          </g>
        ))}
        {top.map((a, i) => {
          const x = L + i * cw + cw * 0.15;
          const bw = cw * 0.7;
          const y = Y(a.bytes / unit.div);
          return (
            <g key={a.name}>
              <title>{`${a.name} — ${fmtInt(a.items)} itens — ${formatBytes(a.bytes)}`}</title>
              <rect x={x} y={y} width={bw} height={Math.max(0, H - B - y)} rx="2" fill={a.other ? '#c9bfd6' : '#7a6fc0'} />
              {cw >= 36 && (
                <text x={x + bw / 2} y={y - 5} textAnchor="middle" className={styles.val}>
                  {formatBytes(a.bytes)}
                </text>
              )}
              <text transform={`translate(${x + bw / 2 + 4},${H - B + 10}) rotate(-40)`} textAnchor="end" className={styles.cat}>
                {shorten(a.name, 18)}
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
  const { albums, day, loading, error, save } = photos;
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const fileRef = useRef(null);

  const sorted = bySizeDesc(albums);
  const totalItems = sorted.reduce((t, a) => t + a.items, 0);
  const totalBytes = sorted.reduce((t, a) => t + a.bytes, 0);
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
      await save(pending.parsed.day, pending.parsed.albums);
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
            <span className={styles.updated} title={`Última importação: ${dm(day)}`}>
              importado {dm(day)}
              {age === 0 ? ' · hoje' : ` · há ${age} dia${age === 1 ? '' : 's'}`}
            </span>
          )}
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
          <AlbumChart albums={sorted} />
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
                  Total · {sorted.length} álbuns
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
              <span>Tamanho total</span>
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
