import styles from './StatFolderCard.module.css';

export default function StatFolderCard({
  bg,
  title,
  titleColor,
  mutedColor,
  countColor,
  caption,
  borderColor,
  count,
  open,
  sub,
  onToggleOpen,
  onRefresh,
  updatedLabel,
}) {
  return (
    <div className={styles.card} style={{ background: bg }}>
      <div className={styles.header}>
        <div className={styles.titleRow} onClick={onToggleOpen}>
          <div className={styles.title} style={{ color: titleColor }}>
            {title}
          </div>
          <div className={styles.chevron} style={{ color: mutedColor }}>
            {open ? '▾' : '▸'}
          </div>
        </div>
        <div className={styles.refresh} style={{ color: mutedColor }} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
          ⟳
        </div>
      </div>
      <div className={styles.count} style={{ color: countColor }}>
        {count}
      </div>
      <div className={styles.caption} style={{ color: mutedColor }}>
        {caption}
      </div>
      {open && (
        <div className={styles.subList} style={{ borderTopColor: borderColor }}>
          {sub.map((f, i) => (
            <div key={i} className={styles.subRow} style={{ color: countColor }}>
              <span>{f.name}</span>
              <span style={{ color: mutedColor }}>{f.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
