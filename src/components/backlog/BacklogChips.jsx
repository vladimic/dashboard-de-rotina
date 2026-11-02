import { dateKeySaoPaulo } from '../../utils/format';
import { latestAndPrevious, totalOf } from '../../utils/instagram';
import styles from './BacklogChips.module.css';

const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
const fmtInt = (n) => n.toLocaleString('pt-BR');

// Instagram - Posts Salvos: how many saved posts are waiting (the three queues).
export function InstagramChip({ instagram }) {
  const { latest } = latestAndPrevious(instagram.imports, dateKeySaoPaulo());
  const total = latest ? totalOf(latest.counts) : null;
  return (
    <div className={styles.chip} style={{ background: '#fbe3ec' }} title="Posts salvos do Instagram a processar (Sem coleção, Inbox e Post backlog)">
      <span className={styles.label} style={{ color: '#b5546b' }}>
        Instagram - Posts Salvos
      </span>
      <b className={styles.count} style={{ color: '#8a3b52' }}>
        {total == null ? '—' : fmtInt(total)}
      </b>
    </div>
  );
}

// Fotos: items in the library and how that changed since the previous count
// (every import of the albums file keeps its day, so the history builds up).
export function PhotosChip({ photos }) {
  const { library, albums, history = [] } = photos;
  const total = library ? library.items : albums.length ? albums.reduce((t, a) => t + a.items, 0) : null;
  const prev = history.length > 1 ? history.at(-2) : null;
  const delta = prev && history.at(-1) && total != null ? total - prev.items : null;
  return (
    <div className={styles.chip} style={{ background: '#dbeaf7' }} title="Itens (fotos e vídeos) na biblioteca do app Fotos, pela última contagem importada">
      <span className={styles.label} style={{ color: '#3f5c78' }}>
        Fotos
      </span>
      <b className={styles.count} style={{ color: '#3f5c78' }}>
        {total == null ? '—' : fmtInt(total)}
      </b>
      <span className={styles.delta} style={{ color: '#5f7d99' }}>
        {delta == null ? (total == null ? '' : '1ª contagem') : `${delta > 0 ? `+${fmtInt(delta)}` : delta < 0 ? `−${fmtInt(-delta)}` : '0'} desde ${dm(prev.day)}`}
      </span>
    </div>
  );
}
