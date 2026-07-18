import styles from './TaskListCard.module.css';

export default function TaskListCard({ title, titleColor, itemColor, tasks, onRefresh, updatedLabel, extraLink }) {
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
          <div className={styles.count} style={{ color: titleColor }}>
            {tasks.length}
          </div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>
      {tasks.map((task) => (
        <div key={task.id} className={styles.row}>
          <div className={styles.dot} />
          {task.link ? (
            <a href={task.link} target="_blank" rel="noreferrer" className={styles.label} style={{ color: itemColor }}>
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
