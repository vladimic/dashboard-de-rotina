// Sales funnel stages of the Vendas tab, in the order of the HubSpot
// pipeline. "Hot" = the funnel being worked, "cold" = the parked buckets
// (hundreds of deals, so they get their own chart and scale). Inbox, Closed
// won and Closed lost are not part of the photo (see api/_lib/vendasSnapshot.js).
export const STAGES = [
  { id: 'appointmentscheduled', label: 'Contato Quente', group: 'hot', color: '#e3a6ae' },
  { id: '31614330', label: 'Interessado', group: 'hot', color: '#e5a03a' },
  { id: '31607682', label: 'Mapeamento', group: 'hot', color: '#5a9bd5' },
  { id: 'qualifiedtobuy', label: 'Proposta', group: 'hot', color: '#7fb069' },
  { id: 'contractsent', label: 'Negociação & Fechamento', group: 'hot', color: '#3f9d78' },
  { id: '119117852', label: 'Stand-by', group: 'hot', color: '#8f86e0' },
  { id: '161229354', label: 'Momento Ruim', group: 'hot', color: '#b5546b' },
  { id: '1359706222', label: 'Potencial', group: 'hot', color: '#4fb0a6' },
  { id: '121424252', label: 'Remarketing', group: 'cold', color: '#c58a1f' },
  { id: '31607681', label: 'Contato Morno', group: 'cold', color: '#e08a5a' },
  { id: '31607680', label: 'Contato Frio', group: 'cold', color: '#7f9cc0' },
];

const DAY_MS = 86400000;
const dayMs = (key) => new Date(`${key}T12:00:00Z`).getTime();

// Stages of one funnel group with their numbers, from the /api/vendas answer.
// `periodDays` limits the chart to the last N calendar days. A stage HubSpot
// has that isn't listed above shows up at the end of the hot funnel.
export function buildFunnel(data, group, periodDays) {
  const known = new Set(STAGES.map((s) => s.id));
  const extra = Object.keys(data.labels || {})
    .filter((id) => !known.has(id))
    .map((id) => ({ id, label: data.labels[id], group: 'hot', color: '#a9a3c9' }));
  const stages = [...STAGES, ...extra].filter((s) => s.group === group);

  const todayMs = dayMs(data.today);
  const from = todayMs - (periodDays - 1) * DAY_MS;
  const points = data.days
    .filter((d) => dayMs(d.day) >= from)
    .map((d) => ({ day: d.day, t: dayMs(d.day), stages: d.stages }));

  const nowMs = Date.now();
  const rows = stages.map((s) => {
    const todayN = data.days.find((d) => d.day === data.today)?.stages[s.id]?.n ?? 0;
    // Photo from 7 days ago (or the closest earlier one) for the Δ column.
    const past = [...data.days].reverse().find((d) => dayMs(d.day) <= todayMs - 7 * DAY_MS);
    const delta7 = past ? todayN - (past.stages[s.id]?.n ?? 0) : null;
    const ages = data.todayDeals
      .filter((d) => d.stage === s.id && d.enteredAt)
      .map((d) => (nowMs - new Date(d.enteredAt).getTime()) / DAY_MS);
    const avgDays = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
    return { ...s, today: todayN, delta7, avgDays, series: points.map((p) => p.stages[s.id]?.n ?? 0) };
  });
  return { rows, points };
}

export const fmtDay = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
