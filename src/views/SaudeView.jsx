import WeightCard from '../components/saude/WeightCard';
import IahCard from '../components/saude/IahCard';
import SleepCard from '../components/saude/SleepCard';
import SleepScheduleCard from '../components/saude/SleepScheduleCard';
import SleepQualityCard from '../components/saude/SleepQualityCard';
import ActivityCard from '../components/saude/ActivityCard';
import styles from './SaudeView.module.css';

// Two rows of three: weight, bedtime, sleep / IAH, sleep quality, and the
// activity card (steps, active energy and workouts from Health).
export default function SaudeView({ state, dispatch, weight, sleep, nights, activity }) {
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
        <SleepScheduleCard
          nights={nights}
          showMa7={state.scheduleShowMa7}
          showMa30={state.scheduleShowMa30}
          onToggleFlag={(key) => dispatch({ type: 'TOGGLE_FLAG', key })}
        />
        <SleepCard
          nights={nights}
          loading={sleep.loading}
          error={sleep.error}
          showAwake={state.sleepShowAwake}
          onToggleAwake={() => dispatch({ type: 'TOGGLE_FLAG', key: 'sleepShowAwake' })}
          showMa7={state.sleepShowMa7}
          showMa30={state.sleepShowMa30}
          onToggleFlag={(key) => dispatch({ type: 'TOGGLE_FLAG', key })}
        />
        <IahCard
          log={state.iahLog}
          skipped={state.iahSkip || {}}
          onSave={(date, value) => dispatch({ type: 'SET_IAH', date, value })}
          onSkip={(date) => dispatch({ type: 'SKIP_ENTRY', logKey: 'iahLog', skipKey: 'iahSkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_ENTRY', logKey: 'iahLog', skipKey: 'iahSkip', date })}
          showMa7={state.iahShowMa7}
          showMa30={state.iahShowMa30}
          onToggleFlag={(key) => dispatch({ type: 'TOGGLE_FLAG', key })}
        />
        <SleepQualityCard
          log={state.qualityLog || {}}
          skipped={state.qualitySkip || {}}
          onSave={(date, value) => dispatch({ type: 'SET_QUALITY', date, value })}
          onSkip={(date) => dispatch({ type: 'SKIP_ENTRY', logKey: 'qualityLog', skipKey: 'qualitySkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_ENTRY', logKey: 'qualityLog', skipKey: 'qualitySkip', date })}
          showMa7={state.qualityShowMa7}
          showMa30={state.qualityShowMa30}
          onToggleFlag={(key) => dispatch({ type: 'TOGGLE_FLAG', key })}
        />
        <ActivityCard activity={activity} />
      </div>
    </div>
  );
}
