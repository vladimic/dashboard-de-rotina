import { dateKeySaoPaulo, lastNDateKeys } from './format';

// Workout kinds the Atividade card colors (the webhook maps Health's
// workout names onto these).
export const WORKOUT_TYPES = {
  walk: { label: 'Caminhada', color: '#2f8a5c' },
  run: { label: 'Corrida', color: '#e08a1e' },
  str: { label: 'Musculação', color: '#2f6fae' },
  other: { label: 'Outros', color: '#8f86e0' },
};

// Steps / active energy arrive as daily totals or raw samples; either way
// they're summed per São Paulo day. iPhone and Watch both log steps, so each
// day's total is taken per source and the biggest source wins instead of
// adding them (which would count the same walk twice).
function dailyTotals(samples) {
  const bySource = new Map();
  for (const s of samples) {
    const key = dateKeySaoPaulo(new Date(s.t));
    const sources = bySource.get(key) || new Map();
    sources.set(s.source, (sources.get(s.source) || 0) + s.value);
    bySource.set(key, sources);
  }
  const totals = new Map();
  for (const [key, sources] of bySource) totals.set(key, Math.max(...sources.values()));
  return totals;
}

// One entry per day for the last `n` days, oldest first:
// { key, workouts: [{ type, min, kcal }], exMin, kcal, steps, main }
// (workouts are optional — Shortcuts can't list them on every iOS version.)
// `kcal` is the day's active energy (falls back to the workouts' own energy).
export function activityDays(stepSamples, energySamples, exerciseSamples, workoutSamples, n = 31) {
  const steps = dailyTotals(stepSamples);
  const energy = dailyTotals(energySamples);
  const exercise = dailyTotals(exerciseSamples);

  const workoutsByDay = new Map();
  const seen = new Set();
  for (const w of workoutSamples) {
    const dedupe = `${w.t}|${w.unit}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const key = dateKeySaoPaulo(new Date(w.t));
    const list = workoutsByDay.get(key) || [];
    list.push({ type: w.unit in WORKOUT_TYPES ? w.unit : 'other', min: Math.round(w.value), kcal: Math.round(w.energyKcal || 0) });
    workoutsByDay.set(key, list);
  }

  return lastNDateKeys(n).map((key) => {
    const workouts = workoutsByDay.get(key) || [];
    // Minutes of exercise: Apple's own daily total when sent, else the sum
    // of the individual workouts.
    const exMin = Math.round(exercise.get(key) ?? workouts.reduce((a, w) => a + w.min, 0));
    const workoutKcal = workouts.reduce((a, w) => a + w.kcal, 0);
    const main = [...workouts].sort((a, b) => b.min - a.min)[0]?.type || null;
    return {
      key,
      workouts,
      exMin,
      kcal: Math.round(energy.get(key) ?? workoutKcal),
      steps: Math.round(steps.get(key) ?? 0),
      main,
    };
  });
}
