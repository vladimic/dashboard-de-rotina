import HabitosCard from '../components/HabitosCard';
import PesoCard from '../components/PesoCard';
import HistoricoCard from '../components/HistoricoCard';
import SonoCard from '../components/SonoCard';
import MetasCard from '../components/MetasCard';
import styles from './SaudeView.module.css';

export default function SaudeView({ state, dispatch, habits, sleepWeek, sleepAvg, goals }) {
  return (
    <div className={styles.columns}>
      <div className={styles.fixedCol}>
        <HabitosCard habits={habits} onToggleHabit={(id) => dispatch({ type: 'TOGGLE_HABIT', id })} />
      </div>

      <div className={styles.fixedCol}>
        <PesoCard
          weight={state.weight}
          weightTarget={state.weightTarget}
          newWeightText={state.newWeightText}
          onWeightTextChange={(v) => dispatch({ type: 'SET_TEXT_FIELD', key: 'newWeightText', value: v })}
          onLogWeight={() => dispatch({ type: 'LOG_WEIGHT' })}
        />
        <HistoricoCard weightLog={state.weightLog} />
      </div>

      <div className={styles.fixedCol}>
        <SonoCard sleepWeek={sleepWeek} sleepAvg={sleepAvg} />
      </div>

      <div className={styles.flexCol}>
        <MetasCard goals={goals} />
      </div>
    </div>
  );
}
