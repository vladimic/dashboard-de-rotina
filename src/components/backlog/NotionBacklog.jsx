import { formatClock } from '../../utils/format';
import styles from './NotionBacklog.module.css';

const CATEGORY_COLORS = { Trabalho: '#5b4a63', Particular: '#3f9d78', Família: '#d26d8a', Imóveis: '#4a8fa8', Outros: '#9a8fa6', 'Sem categoria': '#b9aec2' };
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;

// Columns, in order: overdue, this week, the three weeks after it (headed by
// the Monday of each), later, no deadline.
const COLUMNS = ['overdue', 'w0', 'w1', 'w2', 'w3', 'later', 'none'];
const HEAT = { overdue: '217,83,79', w0: '90,155,213', w1: '90,155,213', w2: '90,155,213', w3: '90,155,213', later: '120,130,160', none: '229,160,58' };
const STEP = { none: 0.012 };

function heat(key, v) {
  if (!v) return undefined;
  const alpha = Math.min(0.14 + v * (STEP[key] ?? 0.09), 0.8);
  return { background: `rgba(${HEAT[key]},${alpha})`, color: alpha > 0.5 ? '#fff' : undefined };
}

const sumRows = (rows) => rows.reduce((t, r) => ({ open: t.open + r.open, ...Object.fromEntries(COLUMNS.map((c) => [c, t[c] + r[c]])) }), { open: 0, ...Object.fromEntries(COLUMNS.map((c) => [c, 0])) });

// Backlog tab, half width: "Notion - Atividades Abertas". Every open task by
// category (collapsible) and project, split by the week of its deadline.
export default function NotionBacklog({ notion, collapsed, onCollapsedChange }) {
  const { data, loading, refreshing, error, refresh } = notion;
  const groups = data?.groups || [];
  const isCollapsed = (category) => Boolean(collapsed[category]);
  const toggle = (category) => onCollapsedChange({ ...collapsed, [category]: !collapsed[category] });
  const setAll = (value) => onCollapsedChange(Object.fromEntries(groups.map((g) => [g.category, value])));
  const total = sumRows(groups.flatMap((g) => g.projects));
  const heads = { overdue: 'Vencidas', w0: 'Esta semana', w1: data && dm(data.weeks[1]), w2: data && dm(data.weeks[2]), w3: data && dm(data.weeks[3]), later: 'Depois', none: 'Sem prazo' };

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>Notion - Atividades Abertas</span>
        <span className={styles.tools}>
          <button type="button" className={styles.icon} onClick={() => setAll(true)} title="Recolher todas as categorias" aria-label="Recolher todas as categorias">
            ⊟
          </button>
          <button type="button" className={styles.icon} onClick={() => setAll(false)} title="Expandir todas as categorias" aria-label="Expandir todas as categorias">
            ⊞
          </button>
          {data?.updatedAt && <span className={styles.updated}>atualizado {formatClock(data.updatedAt)}</span>}
          <button type="button" className={styles.refresh} data-busy={refreshing} data-error={Boolean(error)} onClick={refresh} disabled={refreshing} title={error ? `Falhou: ${error}` : 'Atualizar'} aria-label="Atualizar as atividades do Notion">
            ↻
          </button>
        </span>
      </div>

      {loading && !data && <div className={styles.empty}>Carregando…</div>}
      {error && !data && <div className={styles.error}>Não deu pra carregar as atividades: {error}</div>}
      {data && (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Categoria / projeto</th>
                <th className={styles.r}>Abertos</th>
                {COLUMNS.map((c) => (
                  <th key={c} className={styles.c} data-col={c}>
                    {heads[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const color = CATEGORY_COLORS[g.category] || CATEGORY_COLORS['Sem categoria'];
                const s = sumRows(g.projects);
                const open = !isCollapsed(g.category);
                return [
                  <tr key={g.category} className={styles.cat}>
                    <td>
                      <button type="button" className={styles.caret} onClick={() => toggle(g.category)} aria-label={`${open ? 'Recolher' : 'Expandir'} ${g.category}`} aria-expanded={open}>
                        {open ? '▾' : '▸'}
                      </button>
                      <i className={styles.dot} style={{ background: color }} />
                      {g.category}
                    </td>
                    <td className={styles.r}>{s.open}</td>
                    {COLUMNS.map((c) => (
                      <td key={c} className={styles.c} data-col={c}>
                        {s[c] || ''}
                      </td>
                    ))}
                  </tr>,
                  ...(open
                    ? g.projects.map((p) => (
                        <tr key={`${g.category}/${p.name}`}>
                          <td className={styles.project} title={p.name}>
                            {p.name}
                          </td>
                          <td className={styles.r}>
                            <b>{p.open}</b>
                          </td>
                          {COLUMNS.map((c) => (
                            <td key={c} className={styles.cell} style={heat(c, p[c])}>
                              {p[c] || ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    : []),
                ];
              })}
              <tr className={styles.total}>
                <td>Total</td>
                <td className={styles.r}>{total.open}</td>
                {COLUMNS.map((c) => (
                  <td key={c} className={styles.c} data-col={c}>
                    {total[c]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
