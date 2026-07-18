import styles from './ChecklistCard.module.css';

export default function ChecklistCard({
  title,
  items,
  pend,
  total,
  open,
  edit,
  newText,
  newLink,
  onToggleOpen,
  onToggleEdit,
  onToggleItem,
  onUpdateText,
  onUpdateLink,
  onRemoveItem,
  onDragStart,
  onDrop,
  onNewTextChange,
  onNewLinkChange,
  onAddItem,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        <div className={styles.headerRight}>
          <div className={styles.toggleIcon} onClick={onToggleOpen} title={open ? 'Recolher' : 'Expandir'}>
            {open ? '⊟' : '⊞'}
          </div>
          <div className={styles.pend}>
            {pend}/{total}
          </div>
          <div className={styles.editLink} onClick={onToggleEdit}>
            {edit ? 'Concluir' : 'Editar'}
          </div>
        </div>
      </div>

      {open && edit && (
        <>
          {items.map((m) => (
            <div
              key={m.id}
              draggable
              onDragStart={() => onDragStart(m.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(m.id)}
              className={styles.editRow}
            >
              <div className={styles.editRowTop}>
                <span className={styles.dragHandle}>⠿</span>
                <input
                  className={styles.editInput}
                  value={m.label}
                  onChange={(e) => onUpdateText(m.id, e.target.value)}
                />
                <span className={styles.removeBtn} onClick={() => onRemoveItem(m.id)}>
                  ×
                </span>
              </div>
              <input
                className={styles.linkInput}
                value={m.link || ''}
                onChange={(e) => onUpdateLink(m.id, e.target.value)}
                placeholder="Link (opcional)"
              />
            </div>
          ))}
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              value={newText}
              onChange={(e) => onNewTextChange(e.target.value)}
              placeholder="Novo item..."
            />
            <button type="button" className={styles.addBtn} onClick={onAddItem}>
              +
            </button>
          </div>
          <input
            className={styles.addLinkInput}
            value={newLink || ''}
            onChange={(e) => onNewLinkChange(e.target.value)}
            placeholder="Link (opcional)"
          />
        </>
      )}

      {open && !edit && (
        <div>
          {items.map((m) => {
            const color = m.done ? '#c3b3c9' : '#5b4a63';
            return (
              <div key={m.id} className={styles.viewRow}>
                <input
                  type="checkbox"
                  checked={!!m.done}
                  onChange={() => onToggleItem(m.id)}
                  className={styles.checkbox}
                />
                {m.link ? (
                  <a href={m.link} target="_blank" rel="noreferrer" style={{ color }} className={styles.itemLink}>
                    {m.label}
                  </a>
                ) : (
                  <span onClick={() => onToggleItem(m.id)} style={{ color }} className={styles.itemLabel}>
                    {m.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
