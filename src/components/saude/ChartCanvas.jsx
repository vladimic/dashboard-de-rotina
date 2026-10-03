import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = '#7fa693';

export const GRID_COLOR = 'rgba(63, 107, 87, 0.1)';

// Thin wrapper: (re)builds the Chart.js chart whenever `config` changes.
// Callers memoize `config`, so this only happens when the data or the
// selected period actually changes. `height` is a minimum: the chart grows
// to fill whatever height its card has left (so cards side by side in a
// row line up even when their headers differ).
export default function ChartCanvas({ config, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [config]);

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minHeight: height }}>
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

// x-axis options for thirtyDayAxis() labels, weekends in bold. When the
// chart is too narrow for 30 labels (third-width columns), only every other
// day is labelled — counted back from today, so today always is.
export function thirtyDayScale(axis, fontSize = 10) {
  return {
    grid: { display: false },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      font: (ctx) => ({ size: fontSize, weight: [0, 6].includes(axis[ctx.index]?.weekday) ? '600' : '400' }),
      callback(value, index) {
        const perDay = (this.chart.chartArea?.width || this.chart.width) / axis.length;
        const step = perDay < 17 ? 2 : 1;
        return (axis.length - 1 - index) % step === 0 ? this.getLabelForValue(value) : '';
      },
    },
  };
}
