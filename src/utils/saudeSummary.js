import { lastNDateKeys } from './format';
import { bedtimeHour, dailyTrend, formatClockSP, formatDuration, formatKg, weightTrend } from './health';

const num1 = (v) => v.toFixed(1).replace('.', ',');
const int = (v) => Math.round(v).toLocaleString('pt-BR');
// Bedtime minutes past midnight (negative = evening) → "23:41".
const clockFromMin = (m) => {
  const t = Math.round(((m % 1440) + 1440) % 1440);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const DIR_LABEL = { up: 'subindo', down: 'descendo', stable: 'estável' };

// Share (0–100) of all habits — good ones done, ones to avoid marked as
// avoided — that got a ✓ on `key`. null before the first day anything was
// marked, so the line doesn't start with weeks of zeros.
function habitPercent(log, habitIds, firstKey, key) {
  if (!habitIds.length || !firstKey || key < firstKey) return null;
  const day = log[key] || {};
  return (habitIds.filter((id) => day[id] === 'done').length / habitIds.length) * 100;
}

// The nine tiles of the Saúde header, in the same order as the 3×3 grid
// below it (Hábitos, Peso, IAH / Energia, Exercício, Passos / Dormiu, Sono,
// Qualidade). Each: today's value and the 7d / 30d arrows, each with its
// average. `good` is the direction
// that counts as better (green arrow); the other one is red.
export function buildSaudeSummary({ weightDaily, weightLatest, weightPending = 0, schedulePending = 0, sleepPending = 0, iahLog, iahPending = 0, qualityLog, qualityPending = 0, nights, activityDays, habitosLog, habitIds }, now = new Date()) {
  const keys = lastNDateKeys(30, now);
  const actByKey = new Map(activityDays.map((d) => [d.key, d]));
  // A day with neither steps nor energy never synced: no data, not zero.
  const act = (field) => (key) => {
    const d = actByKey.get(key);
    return d && (d.kcal > 0 || d.steps > 0) ? d[field] : null;
  };
  const night = (fn) => (key) => (nights.has(key) ? fn(nights.get(key)) : null);
  const logged = (log) => (key) => log?.[key] ?? null;
  const lastNight = [...nights.values()].sort((a, b) => a.key.localeCompare(b.key)).at(-1) || null;
  const lastOf = (log) => {
    const k = Object.keys(log || {}).sort().at(-1);
    return k ? log[k] : null;
  };
  const firstHabitKey = Object.keys(habitosLog || {})
    .filter((k) => Object.keys(habitosLog[k]).length)
    .sort()[0];
  const habit = (key) => habitPercent(habitosLog || {}, habitIds, firstHabitKey, key);
  const today = keys.at(-1);

  // Rolling-average arrows (today's 7/30-day average vs. yesterday's).
  // `short` formats the average printed in the chip (no unit).
  const rolling = (valueOf, stableBelow, fmt, short = fmt, skipToday = false) => [7, 30].map((days) => {
    const t = dailyTrend(valueOf, days, stableBelow, now, skipToday);
    return {
      days,
      direction: t?.direction || null,
      label: t ? short(t.avg) : null,
      tip: t ? `Média de ${days} dias${skipToday ? ' até ontem' : ''}: ${fmt(t.avg)} · ${skipToday ? 'anterior' : 'ontem'}: ${fmt(t.prevAvg)} · ${DIR_LABEL[t.direction]}` : `${days} dias: dados insuficientes`,
    };
  });

  return [
    {
      id: 'habitos',
      title: 'Hábitos',
      value: habit(today) != null ? int(habit(today)) : null,
      unit: '%',
      good: 'up',
      trends: rolling(habit, 1, (v) => `${int(v)}%`, (v) => `${int(v)}%`, true),
      tip: 'Hábitos: % dos hábitos com ✓ hoje (diários feitos + a evitar evitados). Hoje ainda está em andamento e não entra nas médias de 7 e 30 dias, que terminam ontem. Setas: média até ontem vs. até anteontem.',
    },
    {
      id: 'peso',
      pending: weightPending,
      title: 'Peso',
      value: weightLatest != null ? formatKg(weightLatest) : null,
      unit: 'kg',
      good: 'down',
      // Weight keeps its own arrows: change over the window (latest minus
      // the first weigh-in in it), like the weight chart.
      trends: [7, 30].map((days) => {
        const t = weightTrend(weightDaily, days, now.getTime());
        return {
          days,
          direction: t?.direction || null,
          // Same number the arrow stands for: kg gained / lost over the window.
          label: t ? `${t.diff > 0 ? '+' : ''}${formatKg(t.diff)}` : null,
          tip: t ? `${days} dias: de ${formatKg(t.start)} para ${formatKg(t.start + t.diff)} kg (${t.diff > 0 ? '+' : ''}${formatKg(t.diff)}) · ${DIR_LABEL[t.direction]}` : `${days} dias: pesagens insuficientes`,
        };
      }),
      tip: 'Peso: última pesagem do app Saúde. Embaixo, quanto o peso variou em 7 e 30 dias (da pesagem mais antiga da janela até a atual); verde = perdeu.',
    },
    {
      id: 'iah',
      // Days of the last 35 with neither a value nor "sem info": orange dot.
      pending: iahPending,
      title: 'IAH',
      value: lastOf(iahLog) != null ? num1(lastOf(iahLog)) : null,
      good: 'down',
      trends: rolling(logged(iahLog), 0.1, num1),
      tip: 'IAH: eventos de apneia por hora da última noite lançada no card IAH. Setas: média de 7 e 30 dias hoje vs. ontem; verde = caindo.',
    },
    {
      id: 'energia',
      title: 'Energia',
      value: act('kcal')(today) != null ? int(act('kcal')(today)) : null,
      unit: 'kcal',
      good: 'up',
      trends: rolling(act('kcal'), 5, (v) => `${int(v)} kcal`, int, true),
      tip: 'Energia ativa de hoje (kcal, app Saúde). Hoje é parcial e não entra nas médias de 7 e 30 dias, que terminam ontem. Setas: média até ontem vs. até anteontem.',
    },
    {
      id: 'exercicio',
      title: 'Exercício',
      value: act('exMin')(today) != null ? int(act('exMin')(today)) : null,
      unit: 'min',
      good: 'up',
      trends: rolling(act('exMin'), 1, (v) => `${int(v)} min`, int, true),
      tip: 'Minutos de exercício de hoje (anel verde do Apple Watch). Hoje é parcial e não entra nas médias de 7 e 30 dias, que terminam ontem. Setas: média até ontem vs. até anteontem.',
    },
    {
      id: 'passos',
      title: 'Passos',
      value: act('steps')(today) != null ? int(act('steps')(today)) : null,
      good: 'up',
      trends: rolling(act('steps'), 100, int, int, true),
      tip: 'Passos de hoje (app Saúde, maior fonte entre iPhone e Watch). Hoje é parcial e não entra nas médias de 7 e 30 dias, que terminam ontem. Setas: média até ontem vs. até anteontem.',
    },
    {
      id: 'dormiu',
      pending: schedulePending,
      title: 'Dormiu',
      value: lastNight ? formatClockSP(lastNight.bedtime) : null,
      good: 'down',
      trends: rolling(night((n) => bedtimeHour(n.bedtime) * 60), 1, clockFromMin),
      tip: 'Dormiu: horário em que pegou no sono na última noite (São Paulo). Setas: horário médio de 7 e 30 dias hoje vs. ontem; verde = dormindo mais cedo.',
      tipAlign: 'right',
    },
    {
      id: 'sono',
      pending: sleepPending,
      title: 'Sono',
      value: lastNight ? formatDuration(lastNight.asleepMin) : null,
      good: 'up',
      trends: rolling(night((n) => n.asleepMin), 1, formatDuration),
      tip: 'Sono: tempo dormindo na última noite (sem o acordado). Setas: média de 7 e 30 noites hoje vs. ontem; verde = dormindo mais.',
      tipAlign: 'right',
    },
    {
      id: 'qualidade',
      pending: qualityPending,
      title: 'Qualidade',
      value: lastOf(qualityLog) != null ? String(lastOf(qualityLog)) : null,
      good: 'up',
      trends: rolling(logged(qualityLog), 1, (v) => int(v)),
      tip: 'Qualidade: nota (0–100) do app Saúde da última noite lançada. Setas: média de 7 e 30 noites hoje vs. ontem; verde = melhorando.',
      tipAlign: 'right',
    },
  ];
}
