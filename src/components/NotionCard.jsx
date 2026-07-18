import { useEffect, useState } from 'react';
import styles from './HubSpotCard.module.css';

function TaskRow({ task }) {
  return (
    <div className={styles.row}>
      <div className={styles.dot} />
      <a href={task.link} className={styles.label}>
        <div className={styles.dealName}>{task.label}</div>
      </a>
    </div>
  );
}

export default function NotionCard({ groups, total, loading, error, onRefresh, updatedLabel, extraLink }) {
  const [collapsed, setCollapsed] = useState({});
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.projectLabel]);

  // Always start retracted — both on first load and every time a refresh
  // brings in a new `groups` snapshot.
  useEffect(() => {
    setCollapsed(Object.fromEntries(groups.map((g) => [g.projectLabel, true])));
  }, [groups]);

  function toggleGroup(projectLabel) {
    setCollapsed((c) => ({ ...c, [projectLabel]: !c[projectLabel] }));
  }

  function toggleAll() {
    if (allCollapsed) {
      setCollapsed({});
    } else {
      setCollapsed(Object.fromEntries(groups.map((g) => [g.projectLabel, true])));
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title} style={{ color: '#8a7a2f' }}>
          Notion <span style={{ fontSize: '10px', fontWeight: 500 }}>- Tarefas Vencidas ou de Hoje</span>
        </div>
        <div className={styles.headerRight}>
          {extraLink && (
            <a href={extraLink.href} className={styles.extraLink} title={extraLink.title}>
              {extraLink.label}
            </a>
          )}
          {groups.length > 0 && (
            <div
              className={styles.groupToggleIcon}
              onClick={toggleAll}
              title={allCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
            >
              {allCollapsed ? '⊞' : '⊟'}
            </div>
          )}
          <div className={styles.count} style={{ color: '#8a7a2f' }}>
            {total}
          </div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar: {error}</div>}
      {!error && loading && groups.length === 0 && <div className={styles.empty}>Carregando tarefas...</div>}
      {!error && !loading && groups.length === 0 && <div className={styles.empty}>Nenhuma tarefa vencida ou de hoje.</div>}

      {groups.map((group) => {
        const isCollapsed = !!collapsed[group.projectLabel];
        return (
          <div key={group.projectLabel} className={styles.group}>
            <div className={styles.stageLabel} onClick={() => toggleGroup(group.projectLabel)}>
              <span>
                {group.projectLabel} ({group.tasks.length})
              </span>
              <span className={styles.chevron}>{isCollapsed ? '▸' : '▾'}</span>
            </div>
            {!isCollapsed && group.tasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        );
      })}
    </div>
  );
}
