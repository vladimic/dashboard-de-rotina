import { useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { dateKeySaoPaulo } from '../../utils/format';
import vendas from '../vendas/Vendas.module.css';
import styles from './PhotoHistory.module.css';

const DAYS = 60;
const DAY_MS = 86400000;
const dayMs = (key) => Date.parse(`${key}T00:00:00Z`);
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
const fmtInt = (n) => n.toLocaleString('pt-BR');

// A "nice" step (1, 2, 5 x 10^k) giving about three intervals over `range`.
function niceStep(range) {
  const raw = Math.max(range, 1) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * mag >= raw) || 10) * mag;
}

// Points of the last 60 days: one per import day, plus the value carried to
// today (and from before the window), so days without an import hold the last count.
function windowPoints(history, today) {
  const start = keyOf(dayMs(today) - (DAYS - 1) * DAY_MS);
  const sorted = [...history].filter((h) => h.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  const before = [...sorted].reverse().find((h) => h.day < start);
  const inside = sorted.filter((h) => h.day >= start);
  const pts = inside.map((h) => ({ day: h.day, items: h.items, real: true }));
  if (before && !(inside[0] && inside[0].day === start)) pts.unshift({ day: start, items: before.items, real: false });
  const last = pts.at(-1);
  if (last && last.day < today) pts.push({ day: today, items: last.items, real: false });
  return pts;
}

function Chart({ points }) {
  const [ref, { w: W, h: H }] = useElementSize();
  const [hover, setHover] = useState(null);
  let body = null;
  if (W > 0 && H > 0 && points.length > 0) {
    const L = 50;
    const R = 14;
    const T = 18;
    const B = 22;
    const vals = points.map((p) => p.items);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const step = niceStep((hi - lo) * 1.4 || hi * 0.01 || 10);
    const yMin = Math.floor((lo - (hi - lo) * 0.2) / step) * step;
    const yMax = Math.max(Math.ceil((hi + (hi - lo) * 0.2) / step) * step, yMin + step);
    const ticks = [];
    for (let v = yMin; v <= yMax + 1e-6; v += step) ticks.push(v);
    const t0 = dayMs(points[0].day);
    const t1 = dayMs(points.at(-1).day);
    const n = points.length;
    const X = (p) => (n === 1 || t1 === t0 ? (L + W - R) / 2 : L + ((dayMs(p.day) - t0) / (t1 - t0)) * (W - L - R));
    const Y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
    // Staircase: a count holds until the next one.
    const line = points.flatMap((p, i) => (i ? [`${X(p)},${Y(points[i - 1].items)}`, `${X(p)},${Y(p.items)}`] : [`${X(p)},${Y(p.items)}`])).join(' ');
    const area = `${X(points[0])},${H - B} ${line} ${X(points.at(-1))},${H - B}`;
    const real = points.filter((p) => p.real);
    const onMove = (e) => {
      const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
      const x = e.clientX - r.left;
      let best = 0;
      points.forEach((p, i) => {
        if (Math.abs(X(p) - x) < Math.abs(X(points[best]) - x)) best = i;
      });
      setHover({ i: best, x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const hp = hover && points[hover.i] ? points[hover.i] : null;
    const prev = hp && hover.i > 0 ? points[hover.i - 1] : null;
    const diff = hp && prev ? hp.items - prev.items : null;
    body = (
      <>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#ece4f0" />
              <text x={L - 6} y={Y(v) + 4} textAnchor="end" className={styles.axis}>
                {fmtInt(v)}
              </text>
            </g>
          ))}
          <polygon points={area} fill="#dbeaf7" opacity="0.7" />
          <polyline points={line} fill="none" stroke="#3f7fb5" strokeWidth="2" strokeLinejoin="round" />
          {real.map((p, i) => (
            <g key={p.day}>
              <circle cx={X(p)} cy={Y(p.items)} r="3.5" fill="#3f7fb5" stroke="#fff" strokeWidth="1.5" />
              {(real.length <= 8 || i === real.length - 1 || i === 0) && (
                <text x={Math.min(Math.max(X(p), L + 18), W - R - 18)} y={Y(p.items) - 9} textAnchor="middle" className={styles.val}>
                  {fmtInt(p.items)}
                </text>
              )}
            </g>
          ))}
          {[points[0], points.at(-1)].filter((p, i, a) => a.indexOf(p) === i).map((p, i) => (
            <text key={p.day} x={i === 0 && n > 1 ? X(p) : n === 1 ? X(p) : X(p)} y={H - 6} textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : 'end'} className={styles.axis}>
              {dm(p.day)}
            </text>
          ))}
          {hp && <line x1={X(hp)} x2={X(hp)} y1={T} y2={H - B} stroke="#2a2230" strokeDasharray="3 3" />}
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
        {hp && (
          <div className={styles.tip} style={{ left: Math.min(hover.x + 14, W - 150), top: Math.max(0, hover.y - 46) }}>
            <b>{dm(hp.day)}</b>
            <span>{fmtInt(hp.items)} itens</span>
            {diff != null && <span>{diff > 0 ? `+${fmtInt(diff)}` : diff < 0 ? `−${fmtInt(-diff)}` : '0'} vs {dm(prev.day)}</span>}
          </div>
        )}
      </>
    );
  }
  return (
    <div className={vendas.chartBox} ref={ref}>
      {body}
    </div>
  );
}

// Backlog tab, under the Instagram chart: items (photos and videos) in the
// library per day, last 60 days. Days between two imports repeat the last count.
export default function PhotoHistory({ photos }) {
  const { history = [], loading } = photos;
  const points = windowPoints(history, dateKeySaoPaulo());
  return (
    <div className={`${vendas.card} ${styles.card}`}>
      <div className={vendas.head}>
        <span className={vendas.title}>
          <b>Fotos - Itens por dia</b>
        </span>
        <span className={styles.note}>fotos e vídeos · {DAYS} dias</span>
      </div>
      {loading ? (
        <div className={vendas.empty}>Carregando…</div>
      ) : points.length === 0 ? (
        <div className={vendas.empty}>Sem contagem ainda. Importe o arquivo dos álbuns (⬆ em Fotos - Álbuns).</div>
      ) : (
        <Chart points={points} />
      )}
    </div>
  );
}
