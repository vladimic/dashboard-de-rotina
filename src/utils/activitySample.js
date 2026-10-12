import { lastNDateKeys } from './format';

// Placeholder activity data, so the Atividade card can be seen before the
// Shortcut sends real steps and workouts. Deterministic (same every load).
export const WORKOUT_TYPES = {
  walk: { label: 'Caminhada', color: '#2f8a5c' },
  run: { label: 'Corrida', color: '#e08a1e' },
  str: { label: 'Musculação', color: '#2f6fae' },
  other: { label: 'Outros', color: '#8f86e0' },
};

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One entry per day for the last `n` days, oldest first:
// { key, workouts: [{ type, min, kcal }], exMin, kcal, steps, main }
export function sampleActivity(n = 31) {
  const rand = rng(12);
  const keys = lastNDateKeys(n);
  return keys.map((key, i) => {
    const wd = new Date(`${key}T12:00:00Z`).getUTCDay();
    const workouts = [];
    if (rand() < 0.62) {
      const kind = wd === 1 || wd === 3 || wd === 5 ? (rand() < 0.7 ? 'str' : 'walk') : rand() < 0.45 ? 'run' : 'walk';
      const min = kind === 'str' ? 40 + Math.round(rand() * 25) : kind === 'run' ? 25 + Math.round(rand() * 25) : 22 + Math.round(rand() * 30);
      workouts.push({ type: kind, min, kcal: Math.round(min * (kind === 'run' ? 10 : kind === 'str' ? 6.5 : 4.2)) });
      if (rand() < 0.15) workouts.push({ type: 'other', min: 15 + Math.round(rand() * 15), kcal: 90 });
    }
    if (i === n - 1) workouts.splice(0, workouts.length, { type: 'walk', min: 38, kcal: 160 });
    const exMin = workouts.reduce((a, w) => a + w.min, 0);
    const kcal = i === n - 1 ? 410 : Math.round(220 + rand() * 120 + workouts.reduce((a, w) => a + w.kcal, 0));
    const steps = i === n - 1 ? 7842 : Math.round(4200 + rand() * 3000 + exMin * 95);
    const main = [...workouts].sort((a, b) => b.min - a.min)[0]?.type || null;
    return { key, workouts, exMin, kcal, steps, main };
  });
}
