import { useMemo, useRef, useState } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { pendingQualityKeys, qualityLabel, qualityTrend, thirtyDayAxis, TREND_UI } from '../../utils/health';
import { dateKeySaoPaulo } from '../../utils/format';
import styles from './Saude.module.css';

// Apple's bands: 81+ alta, 61–80 regular, below that baixa.
const bandColor = (score) => (score >= 81 ? '#3f9b6b' : score >= 61 ? '#e5a03a' : '#d9534f');

// Sleep quality score from the Health app, typed in by hand (no app can read
// it). `log` maps the night's wake-up date → score 0–100, the same date the
// Health app prints at the top of its score screen.
export default function SleepQualityCard({ nights, log, onSave }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const pending = pendingQualityKeys(nights, log);
  const [dateKey, setDateKey] = useState(() => pending[0] || dateKeySaoPaulo());
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState('');
  const inputRef = useRef(null);

  const hasScores = axis.some((d) => log[d.key] != null);
  const trends = [7, 30].map((days) => ({ days, trend: qualityTrend(log, days) }));
  const lastKey = Object.keys(log).sort().at(-1);
  const lastScore = lastKey ? log[lastKey] : null;

  const config = useMemo(() => {
    const scores = axis.map((d) => log[d.key] ?? null);
    return {
      type: 'bar',
      data: {
        // Third-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: [
          {
            data: scores,
            backgroundColor: scores.map((v) => (v != null ? bandColor(v) : 'transparent')),
            borderRadius: 3,
            barPercentage: 0.75,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => axis[items[0].dataIndex].label.slice(0, 2).join(' '),
              label: (item) => `Nota ${item.parsed.y}/100 · ${qualityLabel(item.parsed.y)}`,
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: 0, max: 100, grid: { color: GRID_COLOR }, ticks: { stepSize: 20 } },
        },
      },
      plugins: [monthDividerPlugin(axis)],
    };
  }, [axis, log]);

  function save() {
    const value = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isInteger(value) || value < 0 || value > 100) {
      setInputError('Digite a nota, um número inteiro de 0 a 100');
      return;
    }
    onSave(dateKey, value);
    setText('');
    setInputError('');
    // Jump to the next night still blank, so a backlog is filled in order.
    const next = pending.filter((k) => k !== dateKey)[0];
    if (next) setDateKey(next);
  }

  function goToOldestPending() {
    if (pending[0]) setDateKey(pending[0]);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Qualidade do sono: a nota (0–100) do app Saúde, que nenhum app consegue ler — você digita aqui. A data é a do dia em que você acordou, a mesma que o app Saúde mostra no topo da tela da nota. Faixas: 81+ alta (verde), 61–80 regular (amarelo), abaixo baixa (vermelho).">Qualidade do sono</span>
          {lastScore != null && (
            <>
              <span className={styles.bigValue}>{lastScore}</span>
              <span className={styles.muted}>{qualityLabel(lastScore)}</span>
            </>
          )}
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => {
              const ui = trend ? TREND_UI[trend.direction] : null;
              const tone = !trend || trend.direction === 'stable' ? 'flat' : trend.direction === 'up' ? 'good' : 'bad';
              return (
                <span
                  key={days}
                  className={styles.trend}
                  data-tone={tone}
                  data-tip={trend ? `Média dos últimos ${days} dias: ${Math.round(trend.avg)}. Média de ontem: ${Math.round(trend.prevAvg)} · ${ui.label}` : `${days} dias: notas insuficientes`}
                >
                  {days}
                  <b>{ui ? ui.symbol : '–'}</b>
                  {trend && <span className={styles.trendValue}>{Math.round(trend.avg)}</span>}
                </span>
              );
            })}
          </div>
        </div>
        <form
          className={styles.headerRight}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input type="date" className={styles.input} value={dateKey} max={dateKeySaoPaulo()} onChange={(e) => setDateKey(e.target.value)} />
          <input
            ref={inputRef}
            className={styles.input}
            style={{ width: 56 }}
            inputMode="numeric"
            placeholder="75"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInputError('');
            }}
          />
          <button type="submit" className={styles.saveBtn}>
            Registrar
          </button>
        </form>
      </div>
      {pending.length > 0 && (
        <button type="button" className={styles.pendingBadge} onClick={goToOldestPending}>
          {pending.length} {pending.length === 1 ? 'noite sem nota' : 'noites sem nota'} · preencher
        </button>
      )}
      {inputError && <div className={styles.error}>{inputError}</div>}
      {hasScores ? (
        <ChartCanvas config={config} height={240} />
      ) : (
        <div className={styles.empty}>Nenhuma nota ainda — digite a nota do app Saúde acima.</div>
      )}
    </div>
  );
}
