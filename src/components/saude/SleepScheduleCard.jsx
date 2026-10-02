import { useMemo, useState } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { formatDuration, hourFloatIn, thirtyDayAxis, timezoneForNight, TRAVEL_TIMEZONES } from '../../utils/health';
import { dateKeySaoPaulo } from '../../utils/format';
import styles from './Saude.module.css';

// y axis runs bottom-up from 21:00 to 09:00. Evening hours are stored as
// negative (22:30 → -1.5) so the night is one continuous range.
const Y_MIN = -3;
const Y_MAX = 9;

const IDEAL_BEDTIME = -2; // 22:00
const LATE_BEDTIME = -1; // 23:00

function nightHour(t, tz) {
  const h = hourFloatIn(t, tz);
  return h >= 12 ? h - 24 : h;
}

function hourLabel(v) {
  const h = ((Math.floor(v) % 24) + 24) % 24;
  const m = Math.round((v - Math.floor(v)) * 60);
  return `${String(m === 60 ? (h + 1) % 24 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
}

const tzLabel = (tz) => TRAVEL_TIMEZONES.find((t) => t.tz === tz)?.label || tz;
const shortDate = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

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

function averages(nights, keys, travels) {
  const list = keys.map((k) => nights.get(k)).filter(Boolean);
  if (!list.length) return null;
  const avg = (fn) => list.reduce((a, n) => a + fn(n), 0) / list.length;
  return {
    bed: avg((n) => nightHour(n.bedtime, timezoneForNight(n.key, travels))),
    wake: avg((n) => nightHour(n.wake, timezoneForNight(n.key, travels))),
    dur: avg((n) => n.asleepMin),
  };
}

// Last 30 nights: a bar from when you fell asleep to when you woke up, in
// the clock time of wherever you slept (see travel periods below).
export default function SleepScheduleCard({ nights, travels = [], onAddTravel, onRemoveTravel }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const avg7 = averages(nights, axis.slice(-7).map((d) => d.key), travels);
  const avg30 = averages(nights, axis.map((d) => d.key), travels);
  const hasNights = axis.some((d) => nights.has(d.key));

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', tz: TRAVEL_TIMEZONES[0].tz });
  const [formError, setFormError] = useState('');

  const config = useMemo(() => {
    const inWindow = axis.map((d) => nights.get(d.key) || null);
    const tzs = axis.map((d) => timezoneForNight(d.key, travels));
    const clamp = (v) => Math.min(Y_MAX, Math.max(Y_MIN, v));
    return {
      type: 'bar',
      data: {
        // Half-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: [
          {
            data: inWindow.map((n, i) => (n ? [clamp(nightHour(n.bedtime, tzs[i])), clamp(nightHour(n.wake, tzs[i]))] : null)),
            backgroundColor: inWindow.map((n, i) => (n && nightHour(n.bedtime, tzs[i]) > LATE_BEDTIME ? '#b7aee8' : '#7f73d6')),
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
                const i = item.dataIndex;
                const n = inWindow[i];
                const tz = tzs[i];
                const where = tz === 'America/Sao_Paulo' ? '' : ` (${tzLabel(tz)})`;
                return `dormiu ${hourLabel(nightHour(n.bedtime, tz))} · acordou ${hourLabel(nightHour(n.wake, tz))} · ${formatDuration(n.asleepMin)}${where}`;
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
  }, [axis, nights, travels]);

  function addTravel(e) {
    e.preventDefault();
    if (!form.from || !form.to || form.to < form.from) {
      setFormError('Escolha a data de início e a de fim (fim depois do início)');
      return;
    }
    onAddTravel(form);
    setForm({ from: '', to: '', tz: form.tz });
    setFormError('');
    setEditing(false);
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Horário do sono · 30 dias</span>
        {avg30 && (
          <div className={styles.avgTable}>
            {[
              ['7d', avg7],
              ['30d', avg30],
            ].map(([label, a]) => (
              <span key={label} className={styles.muted}>
                {label}: dormiu <b className={styles.strong}>{a ? hourLabel(a.bed) : '–'}</b> · acordou{' '}
                <b className={styles.strong}>{a ? hourLabel(a.wake) : '–'}</b> · <b className={styles.strong}>{a ? formatDuration(a.dur) : '–'}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {hasNights ? (
        <ChartCanvas config={config} height={280} />
      ) : (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}

      <div className={styles.footer}>
        <span className={styles.legend}>
          <i style={{ background: '#5aa84f' }} />
          22:00
        </span>
        <span className={styles.legend}>
          <i style={{ background: '#d9534f' }} />
          23:00
        </span>
        <span className={styles.legend}>
          <i style={{ background: '#b7aee8', height: 8, width: 8, borderRadius: 2 }} />
          depois das 23:00
        </span>
        <button type="button" className={`${styles.maToggle} ${styles.footerRight}`} data-on="true" onClick={() => setEditing((v) => !v)}>
          ✈ Viagens{travels.length ? ` (${travels.length})` : ''}
        </button>
      </div>

      {editing && (
        <div className={styles.travelBox}>
          <div className={styles.muted}>
            Noites dormidas fora do Brasil aparecem no horário do lugar. Datas = dia em que você acordou.
          </div>
          {travels.map((t) => (
            <div key={t.id} className={styles.travelRow}>
              <span>
                {shortDate(t.from)} a {shortDate(t.to)} · {tzLabel(t.tz)}
              </span>
              <button type="button" className={styles.travelRemove} onClick={() => onRemoveTravel(t.id)} aria-label="Remover viagem">
                ✕
              </button>
            </div>
          ))}
          <form className={styles.travelRow} onSubmit={addTravel}>
            <input type="date" className={styles.input} value={form.from} max={dateKeySaoPaulo()} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            <span className={styles.muted}>a</span>
            <input type="date" className={styles.input} value={form.to} max={dateKeySaoPaulo()} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <select className={styles.input} value={form.tz} onChange={(e) => setForm({ ...form, tz: e.target.value })}>
              {TRAVEL_TIMEZONES.map((t) => (
                <option key={t.tz} value={t.tz}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="submit" className={styles.saveBtn}>
              Adicionar
            </button>
          </form>
          {formError && <div className={styles.error}>{formError}</div>}
        </div>
      )}
    </div>
  );
}
