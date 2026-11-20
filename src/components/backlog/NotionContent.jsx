import { formatClock } from '../../utils/format';
import base from './NotionBacklog.module.css';
import styles from './NotionContent.module.css';

const STATUS_COLORS = { Ideia: '#9a8fa6', Triada: '#4a8fa8', Roteirizada: '#d4a72c', 'Com a Ada': '#e08a3c', Produzida: '#8a6fc0', Agendada: '#d26d8a', Publicada: '#3f9d78', Descartada: '#d9534f' };
// Notion's option colors.
const NOTION_COLORS = { default: '#9a8fa6', gray: '#9a8fa6', brown: '#a07a5a', orange: '#e08a3c', yellow: '#d4a72c', green: '#3f9d78', blue: '#4a8fa8', purple: '#8a6fc0', pink: '#d26d8a', red: '#d9534f' };
const OWNER_COLORS = { Vladi: '90,155,213', Ada: '224,138,60', Edite: '210,109,138' };
const NO_OWNER_RGB = '154,143,166';
const dm = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
const notionUrl = (id) => `notion://www.notion.so/${String(id).replace(/-/g, '')}`;

function heat(owner, v) {
  if (!v) return undefined;
  const alpha = Math.min(0.14 + v * 0.07, 0.8);
  return { background: `rgba(${OWNER_COLORS[owner] || NO_OWNER_RGB},${alpha})`, color: alpha > 0.5 ? '#fff' : undefined };
}

// Backlog tab, under "Notion - Atividades Abertas": the Conteúdo Digital ideas
// by Status (rows, collapsible to list the ideas) and Responsável (columns,
// with how many each one has). `opened` = { [status]: true }.
export default function NotionContent({ content, opened, onOpenedChange }) {
  const { data, loading, refreshing, error, refresh } = content;
  const statuses = data?.statuses || [];
  const owners = data?.owners || [];
  const toggle = (name) => onOpenedChange({ ...opened, [name]: !opened[name] });
  const setAll = (value) => onOpenedChange(Object.fromEntries(statuses.map((s) => [s.name, value])));

  return (
    <div className={base.card}>
      <div className={base.head}>
        <span className={base.title}>Notion - Conteúdo Digital</span>
        <span className={base.tools}>
          <button type="button" className={base.icon} onClick={() => setAll(false)} title="Recolher todos os status" aria-label="Recolher todos os status">
            ⊟
          </button>
          <button type="button" className={base.icon} onClick={() => setAll(true)} title="Expandir todos os status" aria-label="Expandir todos os status">
            ⊞
          </button>
          {data?.updatedAt && <span className={base.updated}>atualizado {formatClock(data.updatedAt)}</span>}
          <button type="button" className={base.refresh} data-busy={refreshing} data-error={Boolean(error)} onClick={refresh} disabled={refreshing} title={error ? `Falhou: ${error}` : 'Atualizar'} aria-label="Atualizar o Conteúdo Digital">
            ↻
          </button>
        </span>
      </div>

      {loading && !data && <div className={base.empty}>Carregando…</div>}
      {error && !data && <div className={base.error}>Não deu pra carregar o Conteúdo Digital: {error}</div>}
      {data && (
        <div className={base.scroll}>
          <table className={base.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th className={base.r}>Itens</th>
                {owners.map((o) => (
                  <th key={o} className={base.c}>
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => {
                const open = Boolean(opened[s.name]);
                return [
                  <tr key={s.name} className={base.cat}>
                    <td>
                      <button type="button" className={base.caret} onClick={() => toggle(s.name)} aria-label={`${open ? 'Recolher' : 'Expandir'} ${s.name}`} aria-expanded={open} disabled={s.total === 0}>
                        {open ? '▾' : '▸'}
                      </button>
                      <i className={base.dot} style={{ background: NOTION_COLORS[s.color] || STATUS_COLORS[s.name] || '#b9aec2' }} />
                      {s.name}
                    </td>
                    <td className={base.r}>{s.total || ''}</td>
                    {owners.map((o) => (
                      <td key={o} className={base.c}>
                        {s.byOwner[o] || ''}
                      </td>
                    ))}
                  </tr>,
                  ...(open
                    ? s.items.map((it) => (
                        <tr key={it.id}>
                          <td className={`${base.project} ${styles.item}`}>
                            <a className={base.link} href={notionUrl(it.id)} title={`Abrir "${it.title}" no Notion`}>
                              {it.title}
                            </a>
                            {it.due && <span className={styles.due}>{dm(it.due)}</span>}
                          </td>
                          <td className={base.r} />
                          {owners.map((o) => (
                            <td key={o} className={base.cell} style={heat(o, it.owner === o ? 1 : 0)}>
                              {it.owner === o ? '1' : ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    : []),
                ];
              })}
              <tr className={base.total}>
                <td>Total</td>
                <td className={base.r}>{data.total}</td>
                {owners.map((o) => (
                  <td key={o} className={base.c}>
                    {data.byOwner[o] || ''}
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
