import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = '#7fa693';

export const GRID_COLOR = 'rgba(63, 107, 87, 0.1)';

// Thin wrapper: (re)builds the Chart.js chart whenever `config` changes.
// Callers memoize `config`, so this only happens when the data or the
// selected period actually changes.
export default function ChartCanvas({ config, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [config]);

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// Dashed vertical line between the last day of a month and the 1st of the
// next, for the charts built on thirtyDayAxis().
export function monthDividerPlugin(axis) {
  return {
    id: 'monthDivider',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      axis.forEach((day, i) => {
        if (!day.monthStart) return;
        const x = (scales.x.getPixelForValue(i) + scales.x.getPixelForValue(i - 1)) / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(63, 107, 87, 0.35)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      });
    },
  };
}

// x-axis options for thirtyDayAxis() labels: all 30 days shown, weekends
// in bold.
export function thirtyDayScale(axis) {
  return {
    grid: { display: false },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      font: (ctx) => ({ size: 10, weight: [0, 6].includes(axis[ctx.index]?.weekday) ? '600' : '400' }),
    },
  };
}
