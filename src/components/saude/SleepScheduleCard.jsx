import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { formatDuration, thirtyDayAxis } from '../../utils/health';
import { hourFloatInAgendaTZ } from '../../utils/format';
import styles from './Saude.module.css';

// y axis runs bottom-up from 21:00 to 09:00. Evening hours are stored as
// negative (22:30 → -1.5) so the night is one continuous range.
const Y_MIN = -3;
const Y_MAX = 9;

const IDEAL_BEDTIME = -2; // 22:00
const LATE_BEDTIME = -1; // 23:00

function nightHour(t) {
  const h = hourFloatInAgendaTZ(t);
  return h >= 12 ? h - 24 : h;
}

function hourLabel(v) {
  const h = (((Math.floor(v) % 24) + 24) % 24);
  const m = Math.round((v - Math.floor(v)) * 60);
  return `${String(m === 60 ? (h + 1) % 24 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
}

// Green line at the ideal bedtime, red at the latest acceptable one, and
// each night's sleep duration written above its bar.
function scheduleOverlay(durations) {
  return {
    id: 'sleepSchedule',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      for (const [hour, color] of [
        [IDEAL_BEDTIME, '#5aa84f'],
        [LATE_BEDTIME, '#d9534f'],
      ]) {
        const y = scales.y.getPixelForValue(hour);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = '#3f6b57';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((bar, i) => {
        if (durations[i] == null) return;
        ctx.fillText(formatDuration(durations[i]), bar.x, Math.min(bar.y, bar.base) - 3);
      });
      ctx.restore();
    },
  };
}

// Last 30 nights: a bar from when you fell asleep to when you woke up.
export default function SleepScheduleCard({ nights }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const inWindow = axis.map((d) => nights.get(d.key) || null);
  const recorded = inWindow.filter(Boolean);
  const avg = (fn) => (recorded.length ? recorded.reduce((a, n) => a + fn(n), 0) / recorded.length : null);
  const avgBed = avg((n) => nightHour(n.bedtime));
  const avgWake = avg((n) => nightHour(n.wake));
  const avgDur = avg((n) => n.asleepMin);

  const config = useMemo(() => {
    const inWindow = axis.map((d) => nights.get(d.key) || null);
    const clamp = (v) => Math.min(Y_MAX, Math.max(Y_MIN, v));
    const bars = inWindow.map((n) => (n ? [clamp(nightHour(n.bedtime)), clamp(nightHour(n.wake))] : null));
    return {
      type: 'bar',
      data: {
        labels: axis.map((d) => d.label),
        datasets: [
          {
            data: bars,
            backgroundColor: inWindow.map((n) => (n && nightHour(n.bedtime) > LATE_BEDTIME ? '#b7aee8' : '#7f73d6')),
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 14 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => axis[items[0].dataIndex].label.slice(0, 2).join(' '),
              label: (item) => {
                const n = inWindow[item.dataIndex];
                return `dormiu ${hourLabel(nightHour(n.bedtime))} · acordou ${hourLabel(nightHour(n.wake))} · ${formatDuration(n.asleepMin)}`;
              },
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis),
          y: { min: Y_MIN, max: Y_MAX, grid: { color: GRID_COLOR }, ticks: { stepSize: 1, callback: (v) => hourLabel(v) } },
        },
      },
      plugins: [scheduleOverlay(inWindow.map((n) => n?.asleepMin ?? null)), monthDividerPlugin(axis)],
    };
  }, [axis, nights]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Horário do sono · 30 dias</span>
        </div>
        {avgBed != null && (
          <span className={styles.muted}>
            média: dormiu <b className={styles.strong}>{hourLabel(avgBed)}</b> · acordou <b className={styles.strong}>{hourLabel(avgWake)}</b> · duração{' '}
            <b className={styles.strong}>{formatDuration(avgDur)}</b>
          </span>
        )}
      </div>
      {recorded.length === 0 ? (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      ) : (
        <ChartCanvas config={config} height={280} />
      )}
      <div className={styles.footer}>
        <span className={styles.legend}>
          <i style={{ background: '#5aa84f' }} />
          22:00 ideal
        </span>
        <span className={styles.legend}>
          <i style={{ background: '#d9534f' }} />
          23:00 limite
        </span>
        <span className={styles.legend}>
          <i style={{ background: '#b7aee8', height: 8, width: 8, borderRadius: 2 }} />
          dormiu depois das 23:00
        </span>
      </div>
    </div>
  );
}
