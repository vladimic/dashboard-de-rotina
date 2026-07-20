import { useEffect, useState } from 'react';
import styles from './HubSpotCard.module.css';

const OVERDUE_COLOR = '#b5546b';

function TaskRow({ task }) {
  const overdue = task.due === 'vencido';
  const textStyle = overdue ? { color: OVERDUE_COLOR } : undefined;
  const emoji = overdue ? '🔴 ' : '✅ ';
  const content = task.dealName ? (
    <>
      <div className={styles.dealName} style={textStyle}>
        {emoji}
        {task.dealName}
      </div>
      <div className={styles.taskName} style={textStyle}>
        {task.title}
      </div>
      {task.debugRaw !== undefined && (
        <div style={{ fontSize: 9, color: '#a897ad' }}>
          DEBUG raw={String(task.debugRaw)} dueMs={task.debugDueMs} now={task.debugNow} due={task.due}
        </div>
      )}
    </>
  ) : (
    <div className={styles.dealName} style={textStyle}>
      {emoji}
      {task.title}
      {task.debugRaw !== undefined && (
        <div style={{ fontSize: 9, color: '#a897ad' }}>
          DEBUG raw={String(task.debugRaw)} dueMs={task.debugDueMs} now={task.debugNow} due={task.due}
        </div>
      )}
    </div>
  );
  return (
    <div className={styles.row}>
      <div className={styles.dot} />
      {task.link ? (
        <a href={task.link} target="_blank" rel="noreferrer" className={styles.label}>
          {content}
        </a>
      ) : (
        <div className={styles.label}>{content}</div>
      )}
    </div>
  );
}

export default function HubSpotCard({ groups, vencidas, hoje, loading, error, onRefresh, updatedLabel, extraLink }) {
  const [collapsed, setCollapsed] = useState({});
  const total = vencidas + hoje;
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.stageLabel]);

  // Always start retracted — both on first load and every time a refresh
  // brings in a new `groups` snapshot.
  useEffect(() => {
    setCollapsed(Object.fromEntries(groups.map((g) => [g.stageLabel, true])));
  }, [groups]);

  function toggleGroup(stageLabel) {
    setCollapsed((c) => ({ ...c, [stageLabel]: !c[stageLabel] }));
  }

  function toggleAll() {
    if (allCollapsed) {
      setCollapsed({});
    } else {
      setCollapsed(Object.fromEntries(groups.map((g) => [g.stageLabel, true])));
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          HubSpot <span style={{ fontSize: '10px', fontWeight: 500 }}>- Tarefas Vencidas ou de Hoje</span>
        </div>
        <div className={styles.headerRight}>
          {extraLink && (
            <a href={extraLink.href} target="_blank" rel="noreferrer" className={styles.extraLink} title={extraLink.title}>
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
          <div className={styles.count}>{total}</div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar: {error}</div>}
      {!error && loading && groups.length === 0 && <div className={styles.empty}>Carregando tarefas...</div>}
      {!error && !loading && groups.length === 0 && <div className={styles.empty}>Nenhuma tarefa vencida ou de hoje.</div>}

      {groups.map((group) => {
        const isCollapsed = !!collapsed[group.stageLabel];
        return (
          <div key={group.stageLabel} className={styles.group}>
            <div className={styles.stageLabel} onClick={() => toggleGroup(group.stageLabel)}>
              <span>
                {group.stageLabel} ({group.tasks.length})
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
