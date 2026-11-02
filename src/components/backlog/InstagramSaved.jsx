import { useRef, useState } from 'react';
import VendasChart from '../vendas/VendasChart';
import VendasTable from '../vendas/VendasTable';
import vendas from '../vendas/Vendas.module.css';
import folder from '../StatFolderCard.module.css';
import { buildSavedSeries, daysSince, latestAndPrevious, parseSavedFile, QUEUES, STALE_AFTER_DAYS, totalOf } from '../../utils/instagram';
import { dateKeySaoPaulo, formatClock } from '../../utils/format';
import styles from './InstagramSaved.module.css';

const PERIODS = [7, 30, 90];
const MODES = [
  { key: 'qty', label: 'Qtd' },
  { key: 'pct', label: '%' },
];
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;

// Confirmation before writing: what the file holds, what changed since the
// previous import, and what is left out.
function ImportDialog({ pending, saving, error, onConfirm, onCancel }) {
  const { fileName, parsed, diff } = pending;
  const kept = parsed.rows.length;
  const drop = diff && diff.prevTotal > 0 && kept < diff.prevTotal * 0.5;
  return (
    <div className={styles.backdrop} onClick={saving ? undefined : onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>Importar posts salvos</div>
        <div className={styles.line}>
          <span>Arquivo</span>
          <b>{fileName}</b>
        </div>
        <div className={styles.line}>
          <span>Posts lidos</span>
          <b>{parsed.total}</b>
        </div>
        {QUEUES.map((q) => (
          <div key={q.id} className={styles.line}>
            <span>
              <i className={vendas.dot} style={{ background: q.color }} />
              {q.label}
            </span>
            <b>{parsed.counts[q.id]}</b>
          </div>
        ))}
        <div className={`${styles.line} ${styles.sum}`}>
          <span>Total a processar</span>
          <b>{kept}</b>
        </div>
        <div className={styles.line}>
          <span>Em outras coleções (ignorados)</span>
          <b>{parsed.ignored}</b>
        </div>
        {diff && (
          <div className={styles.line}>
            <span>Desde {dm(diff.since)}: novos · saíram</span>
            <b>
              +{diff.added} · −{diff.left}
            </b>
          </div>
        )}
        {parsed.duplicates > 0 && <div className={styles.warn}>{parsed.duplicates} link(s) repetido(s) no arquivo foram contados uma vez.</div>}
        {parsed.withoutLink > 0 && <div className={styles.warn}>{parsed.withoutLink} item(ns) sem link foram descartados.</div>}
        {drop && <div className={styles.warn}>Atenção: o total caiu de {diff.prevTotal} para {kept}. Se a rolagem não carregou todos os posts, confira o arquivo antes de gravar.</div>}
        {error && <div className={styles.error}>Não gravou: {error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onConfirm} disabled={saving || kept === 0}>
            {saving ? 'Gravando…' : `Gravar contagem de ${dm(parsed.day)}`}
          </button>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <span className={styles.hint}>substitui a contagem do mesmo dia, se houver</span>
        </div>
      </div>
    </div>
  );
}

// Same look as the Downloads / Backlog / Fotos cards: the total of saved posts
// waiting to be processed (the three queues together) and its change since the
// previous import (green = fewer posts).
export function InstagramTotalCard({ instagram }) {
  const { latest, previous } = latestAndPrevious(instagram.imports, dateKeySaoPaulo());
  const total = latest ? totalOf(latest.counts) : null;
  const delta = latest && previous ? total - totalOf(previous.counts) : null;
  return (
    <div className={folder.card} style={{ background: '#fbe3ec' }}>
      <div className={folder.title} style={{ color: '#b5546b' }}>
        Posts salvos · Instagram
      </div>
      <div className={folder.count} style={{ color: '#8a3b52' }}>
        {total ?? '—'}
      </div>
      <div className={folder.caption} style={{ color: '#c99aa8' }}>
        a processar
        {delta != null && (
          <span className={styles.delta} data-tone={delta < 0 ? 'good' : delta > 0 ? 'bad' : 'flat'}>
            {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '0'} desde {dm(previous.day)}
          </span>
        )}
      </div>
    </div>
  );
}

// Backlog tab, top row: saved Instagram posts waiting to be processed, by
// queue (Sem coleção, Inbox, Post backlog) — staircase chart on the left, table
// and the ⬆ import button on the right.
export default function InstagramSaved({ instagram }) {
  const { imports, loading, error, previewDiff, save } = instagram;
  const [period, setPeriod] = useState(30);
  const [mode, setMode] = useState('qty');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const fileRef = useRef(null);

  const today = dateKeySaoPaulo();
  const { rows, points, latest } = buildSavedSeries(imports, today, period);
  const age = daysSince(latest?.day, today);
  const stale = age != null && age > STALE_AFTER_DAYS;

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    const parsed = parseSavedFile(await file.text(), file.name);
    if (parsed.error) {
      setProblem(parsed.error);
      return;
    }
    try {
      setPending({ fileName: file.name, parsed, diff: await previewDiff(parsed.day, parsed.rows) });
    } catch (err) {
      setProblem(err.message);
    }
  }

  async function confirm() {
    setSaving(true);
    setProblem('');
    try {
      await save(pending.parsed.day, pending.parsed.rows);
      setPending(null);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.row}>
      <div className={vendas.card}>
        <div className={vendas.head}>
          <span className={vendas.title}>
            <b>Posts salvos</b> · Instagram
          </span>
          <div className={vendas.legend}>
            {QUEUES.map((q) => (
              <span key={q.id}>
                <i className={vendas.dot} style={{ background: q.color }} />
                {q.label}
              </span>
            ))}
          </div>
          <div className={vendas.headRight}>
            <div className={vendas.pills}>
              {MODES.map((m) => (
                <button key={m.key} type="button" className={vendas.pill} data-on={mode === m.key} onClick={() => setMode(m.key)} title={m.key === 'qty' ? 'Quantidade de posts' : 'Percentual de cada fila (fecha em 100%)'}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className={vendas.pills}>
              {PERIODS.map((d) => (
                <button key={d} type="button" className={vendas.pill} data-on={period === d} onClick={() => setPeriod(d)}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div className={vendas.empty}>Carregando…</div>
        ) : points.length === 0 ? (
          <div className={vendas.empty}>Nenhuma importação neste período. Use o ⬆ ao lado para importar o arquivo dos posts salvos.</div>
        ) : (
          <VendasChart rows={rows} points={points} mode={mode} staircase />
        )}
      </div>

      <div className={vendas.card}>
        <div className={vendas.head}>
          <span className={vendas.title}>Hoje por coleção</span>
          <span className={vendas.refreshBox}>
            {latest && (
              <span className={styles.updated} data-stale={stale} title={`Última importação: ${dm(latest.day)} às ${formatClock(latest.importedAt)}`}>
                importado {dm(latest.day)}
                {age === 0 ? ' · hoje' : ` · há ${age} dia${age === 1 ? '' : 's'}`}
              </span>
            )}
            <button type="button" className={vendas.refresh} onClick={() => fileRef.current?.click()} title="Importar o arquivo dos posts salvos (JSON ou CSV)" aria-label="Importar o arquivo dos posts salvos">
              ⬆
            </button>
            <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onFile} />
          </span>
        </div>
        {error && <div className={vendas.error}>Não deu pra carregar: {error}</div>}
        {problem && !pending && <div className={vendas.error}>{problem}</div>}
        {latest ? (
          <VendasTable rows={rows} showDays={false} firstColumn="Coleção" />
        ) : (
          !loading && <div className={vendas.note}>Sem contagem ainda. O ⬆ importa o arquivo gerado pelo script “exporta salvos”.</div>
        )}
        {stale && <div className={styles.staleNote}>A última contagem tem mais de {STALE_AFTER_DAYS} dias: gere o arquivo de novo e importe.</div>}
      </div>

      {pending && <ImportDialog pending={pending} saving={saving} error={problem} onConfirm={confirm} onCancel={() => { setPending(null); setProblem(''); }} />}
    </div>
  );
}
