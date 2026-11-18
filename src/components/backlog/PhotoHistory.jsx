import { useState } from 'react';
import VendasChart from '../vendas/VendasChart';
import { dateKeySaoPaulo } from '../../utils/format';
import { buildPhotoSeries } from '../../utils/photoAlbums';
import vendas from '../vendas/Vendas.module.css';
import styles from './PhotoHistory.module.css';

const PERIODS = [7, 30, 90];
const fmtInt = (n) => n.toLocaleString('pt-BR');

// Backlog tab, top of the Fotos column: items (photos and videos) in the
// library per day, in the same layout as the Funil charts (legend, period
// buttons, values on the days, today's value). Days between two imports
// repeat the last count.
export default function PhotoHistory({ photos }) {
  const { history = [], loading } = photos;
  const [period, setPeriod] = useState(30);
  const { rows, points } = buildPhotoSeries(history, dateKeySaoPaulo(), period);
  return (
    <div className={`${vendas.card} ${styles.card}`}>
      <div className={`${vendas.head} ${styles.headWrap}`}>
        <span className={vendas.title}>
          <b>Fotos - Itens por dia</b>
        </span>
        <div className={vendas.legend}>
          {rows.map((s) => (
            <span key={s.id}>
              <i className={vendas.dot} style={{ background: s.color }} />
              {s.label} (fotos e vídeos)
            </span>
          ))}
        </div>
        <div className={vendas.headRight}>
          <div className={vendas.pills}>
            {PERIODS.map((d) => (
              <button key={d} type="button" className={vendas.pill} data-on={period === d} onClick={() => setPeriod(d)}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className={vendas.empty}>Carregando…</div>
      ) : points.length === 0 ? (
        <div className={vendas.empty}>Sem contagem neste período. Importe o arquivo dos álbuns (⬆ em Fotos - Álbuns).</div>
      ) : (
        <VendasChart rows={rows} points={points} format={fmtInt} zoom />
      )}
    </div>
  );
}
