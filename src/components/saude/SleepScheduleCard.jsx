import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { formatDuration, hourFloatSP, thirtyDayAxis } from '../../utils/health';
import styles from './Saude.module.css';

// y axis runs bottom-up from 21:00 to 09:00. Evening hours are stored as
// negative (22:30 → -1.5) so the night is one continuous range.
const Y_MIN = -3;
const Y_MAX = 9;

const IDEAL_BEDTIME = -2; // 22:00
const LATE_BEDTIME = -1; // 23:00

function nightHour(t) {
  const h = hourFloatSP(t);
  return h >= 12 ? h - 24 : h;
}

function hourLabel(v) {
  const h = ((Math.floor(v) % 24) + 24) % 24;
  const m = Math.round((v - Math.floor(v)) * 60);
  return `${String(m === 60 ? (h + 1) % 24 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
}

// Green line at the ideal bedtime, red at the latest acceptable one, and
// each night's duration written sideways inside its bar (half-width chart:
// there's no room for it above).
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
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      meta.data.forEach((bar, i) => {
        if (durations[i] == null || Math.abs(bar.base - bar.y) < 34) return;
        ctx.save();
        ctx.translate(bar.x, (bar.y + bar.base) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(formatDuration(durations[i]), 0, 0);
        ctx.restore();
      });
      ctx.restore();
    },
  };
}

// Last 30 nights: a bar from when you fell asleep to when you woke up.
export default function SleepScheduleCard({ nights }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const hasNights = axis.some((d) => nights.has(d.key));

  const config = useMemo(() => {
    const inWindow = axis.map((d) => nights.get(d.key) || null);
    const clamp = (v) => Math.min(Y_MAX, Math.max(Y_MIN, v));
    return {
      type: 'bar',
      data: {
        // Half-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: [
          {
            data: inWindow.map((n) => (n ? [clamp(nightHour(n.bedtime)), clamp(nightHour(n.wake))] : null)),
            backgroundColor: '#7f73d6',
            borderRadius: 4,
            borderSkipped: false,
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
              label: (item) => {
                const n = inWindow[item.dataIndex];
                return `dormiu ${hourLabel(nightHour(n.bedtime))} · acordou ${hourLabel(nightHour(n.wake))} · ${formatDuration(n.asleepMin)}`;
              },
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: Y_MIN, max: Y_MAX, grid: { color: GRID_COLOR }, ticks: { stepSize: 1, callback: (v) => hourLabel(v) } },
        },
      },
      plugins: [scheduleOverlay(inWindow.map((n) => n?.asleepMin ?? null)), monthDividerPlugin(axis)],
    };
  }, [axis, nights]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Horário do sono</span>
      </div>
      {hasNights ? (
        <ChartCanvas config={config} height={260} />
      ) : (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
    </div>
  );
}
