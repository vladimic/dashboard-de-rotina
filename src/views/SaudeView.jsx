import WeightCard from '../components/saude/WeightCard';
import IahCard from '../components/saude/IahCard';
import styles from './SaudeView.module.css';

// Sleep schedule, sleep quality, steps and exercise come next — they need
// the Shortcut to start sending those Health types too.
export default function SaudeView({ state, dispatch, weight }) {
  return (
    <div className={styles.stack}>
      <div className={styles.twoCols}>
        <WeightCard samples={weight.samples} loading={weight.loading} error={weight.error} onRefresh={weight.refresh} />
        {/* Right half reserved for the next panel. */}
        <div />
      </div>
      <IahCard log={state.iahLog} onSave={(date, value) => dispatch({ type: 'SET_IAH', date, value })} />
    </div>
  );
}
