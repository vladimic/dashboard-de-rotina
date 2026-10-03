import WeightCard from '../components/saude/WeightCard';
import IahCard from '../components/saude/IahCard';
import SleepCard from '../components/saude/SleepCard';
import SleepScheduleCard from '../components/saude/SleepScheduleCard';
import SleepQualityCard from '../components/saude/SleepQualityCard';
import styles from './SaudeView.module.css';

// Two rows of three: weight, bedtime, sleep / IAH, sleep quality, and the
// third slot reserved for exercise (steps + workouts) next.
export default function SaudeView({ state, dispatch, weight, sleep, nights }) {
  return (
    <div className={styles.stack}>
      <div className={styles.threeCols}>
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
        <SleepScheduleCard nights={nights} />
        <SleepCard
          nights={nights}
          loading={sleep.loading}
          error={sleep.error}
          showAwake={state.sleepShowAwake}
          onToggleAwake={() => dispatch({ type: 'TOGGLE_FLAG', key: 'sleepShowAwake' })}
        />
        <IahCard log={state.iahLog} onSave={(date, value) => dispatch({ type: 'SET_IAH', date, value })} />
        <SleepQualityCard nights={nights} />
        <div />
      </div>
    </div>
  );
}
