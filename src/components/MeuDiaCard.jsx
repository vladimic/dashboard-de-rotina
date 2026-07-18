import { useRef, useState } from 'react';
import { NOTE_PALETTE } from '../data/seedData';
import styles from './MeuDiaCard.module.css';

// Fallback for notes saved before per-note colors existed.
const NOTE_BG = '#fdf3d0';
const NOTE_TC = '#8a7a2f';

export default function MeuDiaCard({
  notes,
  newNoteText,
  onNoteTextChange,
  onAddNote,
  onRemoveNote,
  onUpdateNoteText,
  onUpdateNoteColor,
  onRefresh,
  onDragStart,
  onDrop,
}) {
  const inputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [colorPickerId, setColorPickerId] = useState(null);

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
        {notes.map((n) => {
          const bg = n.bg || NOTE_BG;
          const tc = n.tc || NOTE_TC;
          return (
            <div
              key={n.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(n.id)}
              className={styles.note}
              style={{ background: bg, position: 'relative' }}
            >
              <div className={styles.noteHeader}>
                <span
                  draggable
                  onDragStart={() => onDragStart(n.id)}
                  className={styles.dragHandle}
                  style={{ color: `${tc}88` }}
                >
                  ⠿
                </span>
                <span className={styles.noteActions}>
                  <span
                    className={styles.colorBtn}
                    style={{ color: `${tc}aa` }}
                    onClick={() => setColorPickerId(colorPickerId === n.id ? null : n.id)}
                    title="Trocar cor"
                  >
                    ●
                  </span>
                  <span
                    className={styles.edit}
                    style={{ color: `${tc}aa` }}
                    onClick={() => setEditingId(editingId === n.id ? null : n.id)}
                    title="Editar nota"
                  >
                    ✎
                  </span>
                  <span className={styles.remove} style={{ color: `${tc}aa` }} onClick={() => onRemoveNote(n.id)}>
                    ×
                  </span>
                </span>
              </div>
              {colorPickerId === n.id && (
                <div className={styles.colorPicker}>
                  {NOTE_PALETTE.map((c) => (
                    <span
                      key={c.bg}
                      className={styles.swatch}
                      style={{ background: c.bg, borderColor: c.tc }}
                      onClick={() => {
                        onUpdateNoteColor(n.id, c.bg, c.tc);
                        setColorPickerId(null);
                      }}
                    />
                  ))}
                </div>
              )}
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
                  style={{ color: tc }}
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
                <div className={styles.text} style={{ color: tc }}>
                  {n.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
