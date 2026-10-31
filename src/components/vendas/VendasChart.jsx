import { useRef, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { fmtDay } from '../../utils/vendas';
import styles from './Vendas.module.css';

const L = 36;
const R = 46;
const B = 24;
const T = 22;
const SINGLE_BAR = 70;
const LABEL_GAP = 90; // minimum px between two days that carry value labels

// Stacked area of deals per stage over the daily photos, drawn at the size of
// its box. `rows` come in table order (first row = top of the stack). Values
// sit inside the bands, the total above the stack, today's values in the
// right margin; hovering a day lists every stage with its count.
export default function VendasChart({ rows, points }) {
  const [boxRef, { w: W, h: H }] = useElementSize();
  const tipRef = useRef(null);
  const [hover, setHover] = useState(null);

  const empty = points.length === 0;
  const ready = W > 0 && H > 0 && !empty;

  let svg = null;
  let hp = null;
  if (ready) {
    const list = [...rows].reverse(); // base first
    const valueOf = (p, s) => p.stages[s.id]?.n ?? 0;
    const totalOf = (p) => list.reduce((t, s) => t + valueOf(p, s), 0);
    const maxT = Math.max(...points.map(totalOf), 1);
    const step = maxT > 150 ? 100 : maxT > 60 ? 20 : maxT > 25 ? 10 : 5;
    const top = Math.ceil((maxT + 1) / step) * step;
    const n = points.length;
    const t0 = points[0].t;
    const t1 = points.at(-1).t;
    const X = (p) => (n === 1 ? (L + W - R) / 2 : L + ((p.t - t0) / (t1 - t0)) * (W - L - R));
    const Y = (v) => T + (1 - v / top) * (H - T - B);
    const cum = (p, k) => list.slice(0, k + 1).reduce((t, s) => t + valueOf(p, s), 0);
    const lowOf = (p, k) => (k ? cum(p, k - 1) : 0);
    const lastPoint = points.at(-1);

    // Days that carry value labels: spaced apart, clear of both edges.
    const labelIdx = [];
    if (n === 1) labelIdx.push(0);
    else {
      let lastX = -999;
      points.forEach((p, i) => {
        if (i > 0 && i < n - 1 && X(p) - lastX >= LABEL_GAP && X(p) >= L + 30 && X(lastPoint) - X(p) >= 70) {
          labelIdx.push(i);
          lastX = X(p);
        }
      });
    }

    // Day ticks on the axis: first, middle and last.
    const tickIdx = n === 1 ? [0] : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];

    // Today's values in the right margin, kept apart from each other.
    let lastY = -99;
    const rightLabels = [...list]
      .map((s, k) => ({ s, y: (Y(lowOf(lastPoint, k)) + Y(cum(lastPoint, k))) / 2 }))
      .reverse()
      .filter(({ s }) => valueOf(lastPoint, s) > 0)
      .map(({ s, y }) => {
        const yy = Math.max(y, lastY + 13);
        lastY = yy;
        return { s, y: yy };
      });

    const onMove = (e) => {
      const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
      const x = e.clientX - r.left;
      let best = 0;
      points.forEach((p, i) => {
        if (Math.abs(X(p) - x) < Math.abs(X(points[best]) - x)) best = i;
      });
      setHover({ i: best, x, y: e.clientY - r.top });
    };
    hp = hover && points[hover.i] ? points[hover.i] : null;

    svg = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
        {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#ece4f0" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" className={styles.axis}>
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
                points={[...points.map((p) => `${X(p)},${Y(cum(p, k))}`), ...[...points].reverse().map((p) => `${X(p)},${Y(lowOf(p, k))}`)].join(' ')}
              />
            ))}

        {labelIdx.map((i) => {
          const p = points[i];
          return (
            <g key={i}>
              {list.map((s, k) => {
                const v = valueOf(p, s);
                const lo = Y(lowOf(p, k));
                const hi = Y(cum(p, k));
                return v > 0 && lo - hi >= 14 ? (
                  <text key={s.id} x={X(p)} y={(lo + hi) / 2 + 4} textAnchor="middle" className={styles.lab}>
                    {v}
                  </text>
                ) : null;
              })}
              {i < n - 1 && (
                <text x={X(p)} y={Y(totalOf(p)) - 5} textAnchor="middle" className={styles.total}>
                  {totalOf(p)}
                </text>
              )}
            </g>
          );
        })}

        <text x={X(lastPoint) + 2} y={Y(totalOf(lastPoint)) - 5} textAnchor="end" className={styles.total}>
          Total {totalOf(lastPoint)}
        </text>
        {rightLabels.map(({ s, y }) => (
          <text key={s.id} x={W - R + 6} y={y + 4} className={styles.end} style={{ fill: s.color }}>
            {valueOf(lastPoint, s)}
          </text>
        ))}

        {tickIdx.map((i) => (
          <text key={i} x={X(points[i])} y={H - 6} textAnchor={n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle'} className={styles.axis}>
            {fmtDay(points[i].day)}
          </text>
        ))}

        {hp && <line x1={X(hp)} x2={X(hp)} y1={T} y2={H - B} stroke="#2a2230" strokeDasharray="3 3" />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
    );
  }

  const isToday = hp && hp === points.at(-1);
  const totalHover = hp ? rows.reduce((t, s) => t + (hp.stages[s.id]?.n ?? 0), 0) : 0;

  return (
    <div className={styles.chartBox} ref={boxRef}>
      {empty && <div className={styles.empty}>Sem fotos neste período.</div>}
      {svg}
      {hp && (
        <div ref={tipRef} className={styles.tip} style={{ left: Math.min(hover.x + 14, W - 270), top: Math.max(0, Math.min(hover.y - 20, H - 260)) }}>
          <div className={styles.tipHead}>
            {fmtDay(hp.day)}
            {isToday ? ' · hoje' : ''}
          </div>
          {rows.map((s) => {
            const st = hp.stages[s.id];
            if (!st) return null;
            return (
              <div key={s.id} className={styles.tipRow}>
                <span>
                  <i className={styles.dot} style={{ background: s.color }} />
                  {s.label}
                </span>
                <b>{st.n}</b>
              </div>
            );
          })}
          <div className={`${styles.tipRow} ${styles.tipTotal}`}>
            <span>Total</span>
            <span>{totalHover}</span>
          </div>
        </div>
      )}
    </div>
  );
}
