import WeightCard from '../components/saude/WeightCard';
import IahCard from '../components/saude/IahCard';
import SleepCard from '../components/saude/SleepCard';
import SleepScheduleCard from '../components/saude/SleepScheduleCard';
import styles from './SaudeView.module.css';

// Sleep quality, steps and exercise come next.
export default function SaudeView({ state, dispatch, weight, sleep, nights }) {
  return (
    <div className={styles.stack}>
      <div className={styles.twoCols}>
        <WeightCard
          samples={weight.samples}
          loading={weight.loading}
          error={weight.error}
          showMa7={state.weightShowMa7}
          showMa30={state.weightShowMa30}
          showCurrent={state.weightShowCurrent}
          showMin={state.weightShowMin}
          onToggleFlag={(key) => dispatch({ type: 'TOGGLE_FLAG', key })}
        />
        <SleepCard nights={nights} loading={sleep.loading} error={sleep.error} />
      </div>
      <SleepScheduleCard nights={nights} />
      <IahCard log={state.iahLog} onSave={(date, value) => dispatch({ type: 'SET_IAH', date, value })} />
    </div>
  );
}
