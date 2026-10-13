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
// below it (Peso, IAH, Hábitos / Energia, Exercício, Passos / Dormiu, Sono,
// Qualidade). Each: today's value, the last 30 days for the sparkline (the
// last 7 drawn darker) and the 7d / 30d arrows. `good` is the direction
// that counts as better (green arrow); the other one is red.
export function buildSaudeSummary({ weightDaily, weightLatest, iahLog, iahPending = 0, qualityLog, qualityPending = 0, nights, activityDays, habitosLog, habitIds }, now = new Date()) {
  const keys = lastNDateKeys(30, now);
  const series = (valueOf) => keys.map(valueOf);
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
  const rolling = (valueOf, stableBelow, fmt) => [7, 30].map((days) => {
    const t = dailyTrend(valueOf, days, stableBelow, now);
    return {
      days,
      direction: t?.direction || null,
      tip: t ? `Média de ${days} dias: ${fmt(t.avg)} · ontem: ${fmt(t.prevAvg)} · ${DIR_LABEL[t.direction]}` : `${days} dias: dados insuficientes`,
    };
  });

  const weightByKey = new Map(weightDaily.map((p) => [p.key, p.value]));

  return [
    {
      id: 'peso',
      title: 'Peso',
      value: weightLatest != null ? formatKg(weightLatest) : null,
      unit: 'kg',
      good: 'down',
      series: series((k) => weightByKey.get(k) ?? null),
      // Weight keeps its own arrows: change over the window (latest minus
      // the first weigh-in in it), like the weight chart.
      trends: [7, 30].map((days) => {
        const t = weightTrend(weightDaily, days, now.getTime());
        return {
          days,
          direction: t?.direction || null,
          tip: t ? `${days} dias: de ${formatKg(t.start)} para ${formatKg(t.start + t.diff)} kg (${t.diff > 0 ? '+' : ''}${formatKg(t.diff)}) · ${DIR_LABEL[t.direction]}` : `${days} dias: pesagens insuficientes`,
        };
      }),
      tip: 'Peso: última pesagem do app Saúde. Linha: média de cada dia nos últimos 30 (os 7 mais recentes em destaque). Setas: variação da pesagem mais antiga da janela até a atual; verde = perdeu.',
    },
    {
      id: 'iah',
      // Days of the last 35 with neither a value nor "sem info": orange dot.
      pending: iahPending,
      title: 'IAH',
      value: lastOf(iahLog) != null ? num1(lastOf(iahLog)) : null,
      good: 'down',
      series: series(logged(iahLog)),
      trends: rolling(logged(iahLog), 0.1, num1),
      tip: 'IAH: eventos de apneia por hora da última noite lançada no card IAH. Setas: média de 7 e 30 dias hoje vs. ontem; verde = caindo.',
    },
    {
      id: 'habitos',
      title: 'Hábitos',
      value: habit(today) != null ? int(habit(today)) : null,
      unit: '%',
      good: 'up',
      series: series(habit),
      trends: rolling(habit, 1, (v) => `${int(v)}%`),
      tip: 'Hábitos: % dos hábitos com ✓ hoje (diários feitos + a evitar evitados). Hoje ainda está em andamento. Setas: média de 7 e 30 dias hoje vs. ontem.',
    },
    {
      id: 'energia',
      title: 'Energia',
      value: act('kcal')(today) != null ? int(act('kcal')(today)) : null,
      unit: 'kcal',
      good: 'up',
      series: series(act('kcal')),
      trends: rolling(act('kcal'), 5, (v) => `${int(v)} kcal`),
      tip: 'Energia ativa de hoje (kcal, app Saúde). Hoje é parcial, então a média de 7 dias tende a cair até o fim do dia. Setas: média de 7 e 30 dias hoje vs. ontem.',
    },
    {
      id: 'exercicio',
      title: 'Exercício',
      value: act('exMin')(today) != null ? int(act('exMin')(today)) : null,
      unit: 'min',
      good: 'up',
      series: series(act('exMin')),
      trends: rolling(act('exMin'), 1, (v) => `${int(v)} min`),
      tip: 'Minutos de exercício de hoje (anel verde do Apple Watch). Hoje é parcial. Setas: média de 7 e 30 dias hoje vs. ontem.',
    },
    {
      id: 'passos',
      title: 'Passos',
      value: act('steps')(today) != null ? int(act('steps')(today)) : null,
      good: 'up',
      series: series(act('steps')),
      trends: rolling(act('steps'), 100, int),
      tip: 'Passos de hoje (app Saúde, maior fonte entre iPhone e Watch). Hoje é parcial. Setas: média de 7 e 30 dias hoje vs. ontem.',
    },
    {
      id: 'dormiu',
      title: 'Dormiu',
      value: lastNight ? formatClockSP(lastNight.bedtime) : null,
      good: 'down',
      series: series(night((n) => bedtimeHour(n.bedtime) * 60)),
      trends: rolling(night((n) => bedtimeHour(n.bedtime) * 60), 1, clockFromMin),
      tip: 'Dormiu: horário em que pegou no sono na última noite (São Paulo). Linha mais alta = mais tarde. Setas: horário médio de 7 e 30 dias hoje vs. ontem; verde = dormindo mais cedo.',
      tipAlign: 'right',
    },
    {
      id: 'sono',
      title: 'Sono',
      value: lastNight ? formatDuration(lastNight.asleepMin) : null,
      good: 'up',
      series: series(night((n) => n.asleepMin)),
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
      series: series(logged(qualityLog)),
      trends: rolling(logged(qualityLog), 1, (v) => int(v)),
      tip: 'Qualidade: nota (0–100) do app Saúde da última noite lançada. Setas: média de 7 e 30 noites hoje vs. ontem; verde = melhorando.',
      tipAlign: 'right',
    },
  ];
}
