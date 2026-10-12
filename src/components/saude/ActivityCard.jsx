import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, dayTitle, thirtyDayScale } from './ChartCanvas';
import { thirtyDayAxis, TREND_UI } from '../../utils/health';
import { WORKOUT_TYPES } from '../../utils/activity';
import styles from './Saude.module.css';

const dayMonth = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekday = (key) => WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()];

// One dot per workout under each day's label, in the workout's color.
function workoutDots(days) {
  return {
    id: 'workoutDots',
    afterDraw(chart) {
      const { ctx, scales } = chart;
      ctx.save();
      days.forEach((d, i) => {
        d.workouts.slice(0, 2).forEach((w, k) => {
          ctx.fillStyle = WORKOUT_TYPES[w.type].color;
          ctx.beginPath();
          ctx.arc(scales.x.getPixelForValue(i), chart.height - 8 + k * 7, 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.restore();
    },
  };
}

// Atividade: daily active energy (bars, colored by the main workout), steps
// (dashed line), a dot per workout, recent workouts and today's totals.
// `activity.days` is activityDays() output: the last 31 days, oldest first.
export default function ActivityCard({ activity }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const all = activity.days;
  const days = useMemo(() => all.slice(-30), [all]);
  const today = all.at(-1);

  const avg = (n, offset = 0) => {
    const win = all.slice(all.length - n - offset, all.length - offset);
    return Math.round(win.reduce((a, d) => a + d.exMin, 0) / win.length);
  };
  const trends = [7, 30].map((n) => {
    const a = avg(n);
    const b = avg(n, 1);
    return { days: n, avg: a, prev: b, direction: Math.abs(a - b) < 1 ? 'stable' : a > b ? 'up' : 'down' };
  });

  const config = useMemo(
    () => ({
      type: 'bar',
      data: {
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase()]),
        datasets: [
          {
            label: 'Energia ativa',
            data: days.map((d) => d.kcal),
            // Colored by the day's main workout when workouts are known; otherwise
            // green for a day with exercise, pale for one without.
            backgroundColor: days.map((d) => (d.main ? WORKOUT_TYPES[d.main].color : d.exMin > 0 ? '#2f8a5c' : 'rgba(143, 134, 224, 0.28)')),
            borderRadius: 3,
            barPercentage: 0.75,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Passos',
            data: days.map((d) => d.steps),
            borderColor: 'rgba(95, 139, 117, 0.8)',
            borderDash: [3, 3],
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { bottom: 14 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const d = days[items[0].dataIndex];
                return `${weekday(d.key)} ${dayMonth(d.key)}`;
              },
              label: (item) => {
                const d = days[item.dataIndex];
                if (item.datasetIndex === 1) return `${d.steps.toLocaleString('pt-BR')} passos`;
                return [`${d.kcal} kcal ativas`, `${d.exMin} min de exercício`, ...d.workouts.map((w) => `${WORKOUT_TYPES[w.type].label} ${w.min} min`)];
              },
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: 0, max: 900, grid: { color: GRID_COLOR }, ticks: { stepSize: 300 } },
          y1: { display: false, min: 0, max: 14000 },
        },
      },
      plugins: [workoutDots(days)],
    }),
    [axis, days]
  );

  const recent = [...all]
    .reverse()
    .filter((d) => d.workouts.length)
    .slice(0, 3)
    .flatMap((d) => d.workouts.map((w) => ({ ...w, key: d.key, isToday: d === today })));
  const week = all.slice(-7).reduce((a, d) => a + d.exMin, 0);

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Atividade: cada barra é a energia ativa do dia (kcal), na cor do treino principal; a linha tracejada são os passos e cada ponto sob o dia é um treino. O número grande são os minutos de exercício de hoje; 7 e 30 comparam a média móvel de hoje com a de ontem.">Atividade</span>
          <span className={styles.bigValue}>
            {today.exMin}
            <span className={styles.unit}> min</span>
          </span>
          <div className={styles.trends}>
            {trends.map((t) => (
              <span
                key={t.days}
                className={styles.trend}
                data-tone={t.direction === 'up' ? 'good' : 'flat'}
                data-tip={`Média dos últimos ${t.days} dias: ${t.avg} min de exercício. Média de ontem: ${t.prev} min · ${TREND_UI[t.direction].label}`}
              >
                {t.days}
                <b>{TREND_UI[t.direction].symbol}</b>
                <span className={styles.trendValue}>{t.avg}m</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {activity.error && <div className={styles.error}>Não deu pra carregar a atividade: {activity.error}</div>}
      {!activity.error && !activity.loading && !activity.hasData ? (
        <div className={styles.empty}>Nenhuma atividade ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      ) : (
        <ChartCanvas config={config} height={150} />
      )}
      {recent.length > 0 && (
      <div className={styles.actList}>
        {recent.map((w, i) => (
          <div key={i} className={styles.actRow}>
            <i style={{ background: WORKOUT_TYPES[w.type].color }} />
            <span>{WORKOUT_TYPES[w.type].label}</span>
            <span className={styles.muted}>{w.isToday ? 'hoje' : `${weekday(w.key)} ${dayMonth(w.key)}`}</span>
            <b>{w.min} min</b>
          </div>
        ))}
      </div>
      )}
      <div className={styles.actStrip}>
        <span>
          <b>{today.steps.toLocaleString('pt-BR')}</b> passos
        </span>
        <span>
          <b>{today.kcal}</b> kcal ativas
        </span>
        <span>
          7 dias: <b>{week}</b> min
        </span>
      </div>
    </div>
  );
}
