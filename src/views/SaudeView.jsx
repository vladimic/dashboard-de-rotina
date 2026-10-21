import WeightCard from '../components/saude/WeightCard';
import IahCard from '../components/saude/IahCard';
import SleepCard from '../components/saude/SleepCard';
import SleepScheduleCard from '../components/saude/SleepScheduleCard';
import SleepQualityCard from '../components/saude/SleepQualityCard';
import ActivityCard from '../components/saude/ActivityCard';
import DailyBarCard from '../components/saude/DailyBarCard';
import HabitsPanel from '../components/HabitsPanel';
import styles from './SaudeView.module.css';

const int = (v) => Math.round(v).toLocaleString('pt-BR');
// Axis / bar labels for steps: "8,2k".
const thousands = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k` : String(Math.round(v)));

// Three rows of three, in the same order as the nine tiles in the header:
// body (habits, weight, IAH) / activity (energy, exercise, steps) / sleep
// (bedtime, duration, quality).
export default function SaudeView({ state, dispatch, weight, sleep, nights, activity, habitTracker }) {
  const toggle = (key) => dispatch({ type: 'TOGGLE_FLAG', key });
  return (
    <div className={styles.stack}>
      <div className={styles.threeCols}>
        {/* Its height comes from the charts in the row; long lists scroll. */}
        <div className={styles.fitCell}>
          <HabitsPanel state={state} dispatch={dispatch} habitTracker={habitTracker} alwaysOpen />
        </div>
        <WeightCard
          samples={weight.samples}
          loading={weight.loading}
          error={weight.error}
          skipped={state.weightSkip || {}}
          onSkip={(date) => dispatch({ type: 'SKIP_DAY', skipKey: 'weightSkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_DAY', skipKey: 'weightSkip', date })}
          showMa7={state.weightShowMa7}
          showMa30={state.weightShowMa30}
          showCurrent={state.weightShowCurrent}
          showMin={state.weightShowMin}
          onToggleFlag={toggle}
        />
        <IahCard
          log={state.iahLog}
          skipped={state.iahSkip || {}}
          onSave={(date, value) => dispatch({ type: 'SET_IAH', date, value })}
          onSkip={(date) => dispatch({ type: 'SKIP_ENTRY', logKey: 'iahLog', skipKey: 'iahSkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_ENTRY', logKey: 'iahLog', skipKey: 'iahSkip', date })}
          showMa7={state.iahShowMa7}
          showMa30={state.iahShowMa30}
          onToggleFlag={toggle}
        />

        <DailyBarCard
          title="Energia"
          tip="Energia ativa: kcal gastas em movimento a cada dia (anel vermelho do Apple Watch), sem o metabolismo basal. Tracejadas: médias móveis de 7 e 30 dias. 7 e 30 comparam a média de hoje com a de ontem; hoje ainda é parcial."
          activity={activity}
          field="kcal"
          unit="kcal"
          color="#d9534f"
          fmt={int}
          stableBelow={5}
          yStep={300}
          showMa7={state.energyShowMa7}
          showMa30={state.energyShowMa30}
          onToggle7={() => toggle('energyShowMa7')}
          onToggle30={() => toggle('energyShowMa30')}
        />
        <ActivityCard activity={activity} showMa7={state.exerciseShowMa7} showMa30={state.exerciseShowMa30} onToggleFlag={toggle} />
        <DailyBarCard
          title="Passos"
          tip="Passos de cada dia (app Saúde; quando iPhone e Watch contam a mesma caminhada vale a maior fonte, sem somar). Tracejadas: médias móveis de 7 e 30 dias. 7 e 30 comparam a média de hoje com a de ontem; hoje ainda é parcial."
          activity={activity}
          field="steps"
          unit="passos"
          color="#5a9bd5"
          fmt={int}
          labelFmt={thousands}
          stableBelow={100}
          yStep={4000}
          showMa7={state.stepsShowMa7}
          showMa30={state.stepsShowMa30}
          onToggle7={() => toggle('stepsShowMa7')}
          onToggle30={() => toggle('stepsShowMa30')}
        />

        <SleepScheduleCard
          nights={nights}
          skipped={state.scheduleSkip || {}}
          onSkip={(date) => dispatch({ type: 'SKIP_DAY', skipKey: 'scheduleSkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_DAY', skipKey: 'scheduleSkip', date })}
          showMa7={state.scheduleShowMa7}
          showMa30={state.scheduleShowMa30}
          onToggleFlag={toggle}
        />
        <SleepCard
          nights={nights}
          loading={sleep.loading}
          error={sleep.error}
          skipped={state.sleepSkip || {}}
          onSkip={(date) => dispatch({ type: 'SKIP_DAY', skipKey: 'sleepSkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_DAY', skipKey: 'sleepSkip', date })}
          showAwake={state.sleepShowAwake}
          onToggleAwake={() => toggle('sleepShowAwake')}
          showMa7={state.sleepShowMa7}
          showMa30={state.sleepShowMa30}
          onToggleFlag={toggle}
        />
        <SleepQualityCard
          log={state.qualityLog || {}}
          skipped={state.qualitySkip || {}}
          onSave={(date, value) => dispatch({ type: 'SET_QUALITY', date, value })}
          onSkip={(date) => dispatch({ type: 'SKIP_ENTRY', logKey: 'qualityLog', skipKey: 'qualitySkip', date })}
          onClear={(date) => dispatch({ type: 'CLEAR_ENTRY', logKey: 'qualityLog', skipKey: 'qualitySkip', date })}
          showMa7={state.qualityShowMa7}
          showMa30={state.qualityShowMa30}
          onToggleFlag={toggle}
        />
      </div>
    </div>
  );
}
