import styles from './Saude.module.css';

export const MA_COLORS = { ma7: 'rgba(229, 160, 58, 0.85)', ma30: 'rgba(107, 95, 199, 0.75)' };

// Dataset for a moving-average line over a 30-day bar/line chart. A unique
// `stack` keeps the lines from stacking on each other on stacked axes.
export function maDataset(days, data) {
  return {
    type: 'line',
    label: `Média ${days}d`,
    data,
    borderColor: days === 7 ? MA_COLORS.ma7 : MA_COLORS.ma30,
    borderWidth: 1.75,
    borderDash: [5, 4],
    pointRadius: 0,
    tension: 0.3,
    spanGaps: true,
    stack: `ma${days}`,
    order: -1,
  };
}

// Hover tooltip like the weight chart's: the day's value plus both moving
// averages (shown whether or not their lines are switched on). `ma7`/`ma30`
// are arrays aligned to the 30-day axis; `fmt` formats a number.
export function maTooltip(ma7, ma30, fmt, noun = 'Média') {
  return {
    // One entry per bar/point: the moving-average lines go in the footer.
    filter: (item) => item.dataset.type !== 'line',
    callbacks: {
      afterBody: (items) => {
        const i = items[0].dataIndex;
        return [[7, ma7[i]], [30, ma30[i]]].filter(([, v]) => v != null).map(([d, v]) => `${noun} ${d}d: ${fmt(v)}`);
      },
    },
  };
}

// The two on/off pills for the 7d / 30d moving-average lines.
export default function MaToggles({ show7, show30, onToggle7, onToggle30 }) {
  return (
    <>
      <button type="button" className={styles.maToggle} data-on={show7} onClick={onToggle7} title="Média móvel de 7 dias">
        <i style={{ borderColor: MA_COLORS.ma7 }} />
        7
      </button>
      <button type="button" className={styles.maToggle} data-on={show30} onClick={onToggle30} title="Média móvel de 30 dias">
        <i style={{ borderColor: MA_COLORS.ma30 }} />
        30
      </button>
    </>
  );
}
