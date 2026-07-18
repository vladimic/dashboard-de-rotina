import { useRef, useState } from 'react';
import styles from './MeuDiaCard.module.css';

// Notes are always this pastel yellow, regardless of any color previously
// stored on the note (older data may still carry other bg/tc values).
const NOTE_BG = '#fdf3d0';
const NOTE_TC = '#8a7a2f';

export default function MeuDiaCard({
  notes,
  newNoteText,
  onNoteTextChange,
  onAddNote,
  onRemoveNote,
  onUpdateNoteText,
  onRefresh,
  onDragStart,
  onDrop,
}) {
  const inputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  function addAndRefocus() {
    onAddNote();
    inputRef.current?.focus();
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Meu Dia</div>
        <div className={styles.headerRight}>
          <div className={styles.count}>{notes.length}</div>
          {onRefresh && (
            <div className={styles.refresh} onClick={onRefresh} title="Buscar dados mais recentes">
              ⟳
            </div>
          )}
        </div>
      </div>
      <div className={styles.addRow}>
        <input
          ref={inputRef}
          className={styles.input}
          value={newNoteText}
          onChange={(e) => onNoteTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addAndRefocus();
          }}
          placeholder="Adicionar nota..."
        />
        <button type="button" className={styles.addBtn} onClick={addAndRefocus}>
          +
        </button>
      </div>
      <div className={styles.grid}>
        {notes.map((n) => (
          <div
            key={n.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(n.id)}
            className={styles.note}
            style={{ background: NOTE_BG }}
          >
            <div className={styles.noteHeader}>
              <span
                draggable
                onDragStart={() => onDragStart(n.id)}
                className={styles.dragHandle}
                style={{ color: `${NOTE_TC}88` }}
              >
                ⠿
              </span>
              <span className={styles.noteActions}>
                <span
                  className={styles.edit}
                  style={{ color: `${NOTE_TC}aa` }}
                  onClick={() => setEditingId(editingId === n.id ? null : n.id)}
                  title="Editar nota"
                >
                  ✎
                </span>
                <span className={styles.remove} style={{ color: `${NOTE_TC}aa` }} onClick={() => onRemoveNote(n.id)}>
                  ×
                </span>
              </span>
            </div>
            {editingId === n.id ? (
              <textarea
                autoFocus
                ref={(el) => {
                  if (el) {
                    const end = el.value.length;
                    el.setSelectionRange(end, end);
                  }
                }}
                className={styles.textEdit}
                style={{ color: NOTE_TC }}
                value={n.text}
                onChange={(e) => onUpdateNoteText(n.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <div className={styles.text} style={{ color: NOTE_TC }}>
                {n.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
