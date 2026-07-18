import StatFolderCard from '../components/StatFolderCard';
import { formatClock } from '../utils/format';
import styles from './BacklogView.module.css';

export default function BacklogView({ state, dispatch }) {
  const refresh = (key) => dispatch({ type: 'REFRESH', key });
  const toggle = (key) => dispatch({ type: 'TOGGLE_FLAG', key });

  return (
    <div className={styles.columns}>
      <div className={styles.col}>
        <StatFolderCard
          bg="#eee3f7"
          title="Downloads"
          titleColor="#8a72a0"
          mutedColor="#a897ad"
          countColor="#5b4a63"
          caption="arquivos na pasta"
          borderColor="rgba(90,60,100,.12)"
          count={state.downloadsCount}
          open={state.downloadsOpen}
          sub={state.downloadsSub}
          onToggleOpen={() => toggle('downloadsOpen')}
          onRefresh={() => refresh('downloadsUpdated')}
          updatedLabel={formatClock(state.downloadsUpdated)}
        />
      </div>

      <div className={styles.col}>
        <StatFolderCard
          bg="#fdf3d0"
          title="Backlog"
          titleColor="#8a7a2f"
          mutedColor="#bda968"
          countColor="#8a7a2f"
          caption="arquivos no diretório"
          borderColor="rgba(138,122,47,.15)"
          count={state.backlogCount}
          open={state.backlogOpen}
          sub={state.backlogSub}
          onToggleOpen={() => toggle('backlogOpen')}
          onRefresh={() => refresh('backlogUpdated')}
          updatedLabel={formatClock(state.backlogUpdated)}
        />
      </div>

      <div className={styles.col}>
        <StatFolderCard
          bg="#dbeaf7"
          title="Fotos"
          titleColor="#3f5c78"
          mutedColor="#7f9ab5"
          countColor="#3f5c78"
          caption="fotos no app"
          borderColor="rgba(63,92,120,.15)"
          count={state.fotosCount}
          open={state.fotosOpen}
          sub={state.fotosSub}
          onToggleOpen={() => toggle('fotosOpen')}
          onRefresh={() => refresh('fotosUpdated')}
          updatedLabel={formatClock(state.fotosUpdated)}
        />
      </div>

      <div className={styles.spacer} />
    </div>
  );
}
