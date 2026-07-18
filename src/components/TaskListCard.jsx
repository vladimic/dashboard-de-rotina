import { useEffect, useState } from 'react';
import styles from './TaskListCard.module.css';

export default function TaskListCard({ title, titleColor, itemColor, tasks, onRefresh, updatedLabel, extraLink, collapsible }) {
  const [collapsed, setCollapsed] = useState(collapsible);

  // Always start retracted — both on first load and every time a refresh
  // brings in a new `tasks` snapshot (mirrors HubSpotCard's group toggle).
  useEffect(() => {
    if (collapsible) setCollapsed(true);
  }, [tasks, collapsible]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title} style={{ color: titleColor }}>
          {title}
        </div>
        <div className={styles.headerRight}>
          {extraLink && (
            <a href={extraLink.href} className={styles.extraLink} title={extraLink.title}>
              {extraLink.label}
            </a>
          )}
          {collapsible && (
            <div
              className={styles.groupToggleIcon}
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expandir' : 'Recolher'}
            >
              {collapsed ? '⊞' : '⊟'}
            </div>
          )}
          <div className={styles.count} style={{ color: titleColor }}>
            {tasks.length}
          </div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>
      {!collapsed && tasks.map((task) => (
        <div key={task.id} className={styles.row}>
          <div className={styles.dot} />
          {task.link ? (
            <a href={task.link} className={styles.label} style={{ color: itemColor }}>
              {task.label}
            </a>
          ) : (
            <div className={styles.label} style={{ color: itemColor }}>
              {task.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
