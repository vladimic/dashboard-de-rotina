import { useRef, useState } from 'react';
import { fmtDay } from '../../utils/vendas';
import styles from './Vendas.module.css';

const W = 700;
const H = 255;
const L = 28;
const R = 40;
const B = 20;
const T = 18;
const SINGLE_BAR = 70;

// Stacked area of deals per stage over the daily photos. `rows` come in table
// order (first row = top of the stack). Values sit inside the bands, the
// total above the stack, today's values in the right margin; hovering a day
// lists every stage (with the deal names when `names` is on).
export default function VendasChart({ rows, points, names }) {
  const boxRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (points.length === 0) return <div className={styles.empty}>Sem fotos neste período.</div>;

  const list = [...rows].reverse(); // base first
  const valueOf = (p, s) => p.stages[s.id]?.n ?? 0;
  const totalOf = (p) => list.reduce((t, s) => t + valueOf(p, s), 0);
  const maxT = Math.max(...points.map(totalOf), 1);
  const step = maxT > 150 ? 100 : maxT > 60 ? 20 : maxT > 25 ? 10 : 5;
  const top = Math.ceil((maxT + 1) / step) * step;

  const t0 = points[0].t;
  const t1 = points.at(-1).t;
  const X = (p) => (points.length === 1 ? (L + W - R) / 2 : L + ((p.t - t0) / (t1 - t0)) * (W - L - R));
  const Y = (v) => T + (1 - v / top) * (H - T - B);
  const cum = (p, k) => list.slice(0, k + 1).reduce((t, s) => t + valueOf(p, s), 0);
  const lowOf = (p, k) => (k ? cum(p, k - 1) : 0);

  // Which days carry value labels: up to 5, away from the edges.
  const n = points.length;
  const labelIdx = n <= 5 ? points.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round(1 + (k * (n - 3)) / 4));
  const labelSet = [...new Set(labelIdx)].filter((i) => i < n - 1 || n === 1);

  const tickIdx = n === 1 ? [0] : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
  const lastPoint = points.at(-1);

  // Today's values in the right margin, kept apart from each other.
  let lastY = -99;
  const rightLabels = [...list]
    .map((s, k) => ({ s, y: (Y(lowOf(lastPoint, k)) + Y(cum(lastPoint, k))) / 2 }))
    .reverse()
    .filter(({ s }) => valueOf(lastPoint, s) > 0)
    .map(({ s, y }) => {
      const yy = Math.max(y, lastY + 10.5);
      lastY = yy;
      return { s, y: yy };
    });

  const onMove = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(X(p) - x) < Math.abs(X(points[best]) - x)) best = i;
    });
    const box = boxRef.current.getBoundingClientRect();
    setHover({ i: best, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const hp = hover ? points[hover.i] : null;
  const isToday = hp && hp === lastPoint;

  return (
    <div className={styles.chartBox} ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
        {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#ece4f0" />
            <text x={L - 4} y={Y(v) + 3} textAnchor="end" className={styles.axis}>
              {v}
            </text>
          </g>
        ))}

        {n === 1
          ? list.map((s, k) => (
              <rect key={s.id} x={X(lastPoint) - SINGLE_BAR / 2} width={SINGLE_BAR} y={Y(cum(lastPoint, k))} height={Math.max(0, Y(lowOf(lastPoint, k)) - Y(cum(lastPoint, k)))} fill={s.color} />
            ))
          : list.map((s, k) => (
              <polygon
                key={s.id}
                fill={s.color}
                opacity="0.93"
                points={[
                  ...points.map((p) => `${X(p)},${Y(cum(p, k))}`),
                  ...[...points].reverse().map((p) => `${X(p)},${Y(lowOf(p, k))}`),
                ].join(' ')}
              />
            ))}

        {labelSet.map((i) => {
          const p = points[i];
          return (
            <g key={i}>
              {list.map((s, k) => {
                const v = valueOf(p, s);
                const lo = Y(lowOf(p, k));
                const hi = Y(cum(p, k));
                return v > 0 && lo - hi >= 11 ? (
                  <text key={s.id} x={X(p)} y={(lo + hi) / 2 + 3.5} textAnchor="middle" className={styles.lab}>
                    {v}
                  </text>
                ) : null;
              })}
              {i < n - 1 && (
                <text x={X(p)} y={Y(totalOf(p)) - 4} textAnchor="middle" className={styles.total}>
                  {totalOf(p)}
                </text>
              )}
            </g>
          );
        })}

        <text x={X(lastPoint) + 4} y={Y(totalOf(lastPoint)) - 4} textAnchor="end" className={styles.totalToday}>
          Total {totalOf(lastPoint)}
        </text>
        {rightLabels.map(({ s, y }) => (
          <text key={s.id} x={W - R + 5} y={y + 3.5} className={styles.end} style={{ fill: s.color }}>
            {valueOf(lastPoint, s)}
          </text>
        ))}

        {tickIdx.map((i) => (
          <text key={i} x={X(points[i])} y={H - 5} textAnchor={i === n - 1 && n > 1 ? 'end' : i === 0 && n > 1 ? 'start' : 'middle'} className={styles.axis}>
            {fmtDay(points[i].day)}
          </text>
        ))}

        {hp && <line x1={X(hp)} x2={X(hp)} y1={T} y2={H - B} stroke="#2a2230" strokeDasharray="3 3" />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>

      {hp && (
        <div className={styles.tip} style={{ left: Math.min(hover.x + 14, (boxRef.current?.clientWidth ?? 600) - 250), top: Math.max(0, hover.y - 20) }}>
          <div className={styles.tipHead}>
            {fmtDay(hp.day)}
            {isToday ? ' · hoje' : ''}
          </div>
          {rows.map((s) => {
            const st = hp.stages[s.id];
            if (!st) return null;
            return (
              <div key={s.id}>
                <div className={styles.tipRow}>
                  <span>
                    <i className={styles.dot} style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <b>{st.n}</b>
                </div>
                {names && st.names.length > 0 && (
                  <div className={styles.tipNames}>
                    {st.names.slice(0, 2).join(', ')}
                    {st.names.length > 2 ? `, + ${st.names.length - 2}` : ''}
                  </div>
                )}
              </div>
            );
          })}
          <div className={`${styles.tipRow} ${styles.tipTotal}`}>
            <span>Total</span>
            <span>{totalOf(hp)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
