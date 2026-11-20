// "Conteúdo Digital" database (Notion): every idea by Status and Responsável.
// Pure functions so they can be tested without Notion.

const STATUS_ORDER = ['Ideia', 'Triada', 'Roteirizada', 'Com a Ada', 'Produzida', 'Agendada', 'Publicada', 'Descartada'];
const OWNER_ORDER = ['Vladi', 'Ada', 'Edite'];
export const NO_OWNER_LABEL = 'Sem responsável';
export const NO_STATUS_LABEL = 'Sem status';

const rank = (order, name) => {
  const i = order.indexOf(name);
  return i === -1 ? order.length : i;
};

// Reads the three properties off a Notion page ("Ideia" is the title).
export function readContentPage(page) {
  const props = page.properties || {};
  const title = Object.values(props).find((p) => p?.type === 'title');
  return {
    id: page.id,
    title: (title?.title || []).map((t) => t.plain_text).join('').trim() || '(sem título)',
    status: props.Status?.status?.name || props.Status?.select?.name || NO_STATUS_LABEL,
    owner: props['Responsável']?.select?.name || NO_OWNER_LABEL,
    due: props['Data prevista']?.date?.start ? String(props['Data prevista'].date.start).slice(0, 10) : null,
  };
}

// items: [{ id, title, status, owner, due }] -> rows by status, columns by owner.
export function summarizeContent(items) {
  const owners = [...new Set(items.map((i) => i.owner))].sort((a, b) => {
    const noA = a === NO_OWNER_LABEL;
    const noB = b === NO_OWNER_LABEL;
    return noA - noB || rank(OWNER_ORDER, a) - rank(OWNER_ORDER, b) || a.localeCompare(b, 'pt-BR');
  });
  // Every known status shows up (even empty), in the pipeline's order.
  const names = [...new Set([...STATUS_ORDER, ...items.map((i) => i.status)])].sort((a, b) => rank(STATUS_ORDER, a) - rank(STATUS_ORDER, b) || a.localeCompare(b, 'pt-BR'));
  const statuses = names.map((name) => {
    const list = items
      .filter((i) => i.status === name)
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'pt-BR'));
    const byOwner = Object.fromEntries(owners.map((o) => [o, list.filter((i) => i.owner === o).length]));
    return { name, total: list.length, byOwner, items: list.map(({ id, title, owner, due }) => ({ id, title, owner, due })) };
  });
  const byOwner = Object.fromEntries(owners.map((o) => [o, items.filter((i) => i.owner === o).length]));
  return { owners, statuses, total: items.length, byOwner };
}
