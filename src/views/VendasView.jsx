import { useEffect, useRef, useState } from 'react';
import VendasChart from '../components/vendas/VendasChart';
import VendasTable from '../components/vendas/VendasTable';
import { useVendas } from '../hooks/useVendas';
import { buildFunnel } from '../utils/vendas';
import styles from './VendasView.module.css';
import cardStyles from '../components/vendas/Vendas.module.css';

const PERIODS = [7, 30, 90];

// One funnel: the chart (2/3) and its table (1/3).
function Funnel({ title, group, data, period, onPeriod }) {
  const { rows, points } = buildFunnel(data, group, period);
  return (
    <div className={styles.row}>
      <div className={cardStyles.card}>
        <div className={cardStyles.head}>
          <span className={cardStyles.title}>
            <b>{title}</b> · deals por estágio
          </span>
          <div className={cardStyles.pills}>
            {PERIODS.map((d) => (
              <button key={d} type="button" className={cardStyles.pill} data-on={period === d} onClick={() => onPeriod(d)}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <VendasChart rows={rows} points={points} names={group === 'hot'} />
      </div>
      <div className={cardStyles.card}>
        <div className={cardStyles.head}>
          <span className={cardStyles.title}>{title} · hoje por estágio</span>
        </div>
        <VendasTable rows={rows} />
      </div>
    </div>
  );
}

// Vendas tab: a daily photo of the HubSpot funnel — hot (8 stages) above,
// cold (Remarketing, Morno, Frio) below, each with its chart and table.
export default function VendasView() {
  const { data, loading, error } = useVendas(90);
  const [period, setPeriod] = useState(30);

  // Fill the screen under the header: the two funnels split what is left.
  const stackRef = useRef(null);
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const fit = () => {
      const top = stackRef.current?.getBoundingClientRect().top;
      if (top != null) setHeight(Math.max(560, window.innerHeight - top - 14));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [loading, error]);

  if (error) return <div className={cardStyles.card}><div className={cardStyles.error}>Não deu pra carregar o funil: {error}</div></div>;
  if (loading || !data) return <div className={cardStyles.card}><div className={cardStyles.empty}>Carregando o funil…</div></div>;

  return (
    <div className={styles.stack} ref={stackRef} style={height ? { height } : undefined}>
      <Funnel title="Funil quente" group="hot" data={data} period={period} onPeriod={setPeriod} />
      <Funnel title="Funil frio" group="cold" data={data} period={period} onPeriod={setPeriod} />
    </div>
  );
}
