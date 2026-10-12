import { useMemo, useState } from 'react';
import EntryEditor, { EditButton } from './EntryEditor';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import ChartCanvas, { GRID_COLOR, thirtyDayScale } from './ChartCanvas';
import { entryKeys, pendingEntryKeys, qualityLabel, qualityTrend, rollingByKey, thirtyDayAxis, TREND_UI } from '../../utils/health';
import styles from './Saude.module.css';

// Apple's bands: 81+ alta, 61–80 regular, below that baixa.
const bandColor = (score) => (score >= 81 ? '#3f9b6b' : score >= 61 ? '#e5a03a' : '#d9534f');

// Sleep quality score from the Health app, typed in by hand (no app can read
// it). `log` maps the night's wake-up date → score 0–100, the same date the
// Health app prints at the top of its score screen.
export default function SleepQualityCard({ log, skipped, onSave, onSkip, onClear, showMa7, showMa30, onToggleFlag }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const [editing, setEditing] = useState(false);
  const keys = useMemo(() => entryKeys(), []);
  const pendingCount = pendingEntryKeys(keys, log, skipped).length;

  const hasScores = axis.some((d) => log[d.key] != null);
  const trends = [7, 30].map((days) => ({ days, trend: qualityTrend(log, days) }));
  const lastKey = Object.keys(log).sort().at(-1);
  const lastScore = lastKey ? log[lastKey] : null;

  const config = useMemo(() => {
    const scores = axis.map((d) => log[d.key] ?? null);
    const ma = { 7: rollingByKey(axis, (k) => log[k] ?? null, 7), 30: rollingByKey(axis, (k) => log[k] ?? null, 30) };
    const tip = maTooltip(ma[7], ma[30], (v) => Math.round(v));
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
          ...[7, 30]
            .filter((d) => (d === 7 ? showMa7 : showMa30))
            .map((d) => maDataset(d, ma[d])),
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tip,
            callbacks: {
              ...tip.callbacks,
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
      plugins: [],
    };
  }, [axis, log, showMa7, showMa30]);

  const parse = (text) => {
    const value = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isInteger(value) || value < 0 || value > 100) return { error: 'Nota: inteiro de 0 a 100' };
    return { value };
  };

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Qualidade do sono: a nota (0–100) do app Saúde, que nenhum app consegue ler — você digita aqui. A data é a do dia em que você acordou, a mesma que o app Saúde mostra no topo da tela da nota. Faixas: 81+ alta (verde), 61–80 regular (amarelo), abaixo baixa (vermelho).">Qualidade do sono</span>
          {lastScore != null && (
            <>
              <span className={styles.bigValue} title={qualityLabel(lastScore)}>
                {lastScore}
              </span>
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
        <div className={styles.headerRight}>
          <MaToggles show7={showMa7} show30={showMa30} onToggle7={() => onToggleFlag('qualityShowMa7')} onToggle30={() => onToggleFlag('qualityShowMa30')} />
          <EditButton pendingCount={pendingCount} onClick={() => setEditing(true)} />
        </div>
      </div>
      {hasScores ? (
        <ChartCanvas config={config} height={240} />
      ) : (
        <div className={styles.empty}>Nenhuma nota ainda — digite a nota do app Saúde acima.</div>
      )}
      {editing && (
        <EntryEditor
          title="Qualidade · acordou em"
          keys={keys}
          log={log}
          skipped={skipped}
          placeholder=""
          format={String}
          parse={parse}
          onSet={onSave}
          onSkip={onSkip}
          onClear={onClear}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
