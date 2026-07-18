import { useLayoutEffect, useRef, useState } from 'react';
import { NOTE_PALETTE } from '../data/seedData';
import styles from './MeuDiaCard.module.css';

// Fallback for notes saved before per-note colors existed.
const NOTE_BG = '#fdf3d0';
const NOTE_TC = '#8a7a2f';

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

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
  const textareaRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  // Height of the note's text (as a plain, non-editable div) measured right
  // before switching to edit mode — a <textarea> wraps the very same text
  // slightly differently than a <div> even with identical font/width, so
  // reusing the textarea's own scrollHeight for the *initial* size can jump
  // by a line. Applying the pre-measured height instead guarantees no jump.
  const [editingHeight, setEditingHeight] = useState(null);
  const [colorPickerId, setColorPickerId] = useState(null);

  function addAndRefocus() {
    onAddNote();
    inputRef.current?.focus();
  }

  function toggleEditing(id, textEl) {
    if (editingId === id) {
      setEditingId(null);
    } else {
      setEditingHeight(textEl ? textEl.getBoundingClientRect().height : null);
      setEditingId(id);
    }
  }

  // Only runs when edit mode is entered/exited for a note — not on every
  // keystroke — so the cursor stays where the user is actually typing
  // instead of jumping to the end on each character.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (editingId != null && el) {
      const end = el.value.length;
      el.setSelectionRange(end, end);
      if (editingHeight != null) {
        el.style.height = `${editingHeight}px`;
      } else {
        autoResize(el);
      }
    }
  }, [editingId, editingHeight]);

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
                    onClick={(e) => {
                      const textEl = e.currentTarget.closest(`.${styles.note}`)?.querySelector(`.${styles.text}`);
                      toggleEditing(n.id, textEl);
                    }}
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
                  ref={textareaRef}
                  className={styles.textEdit}
                  style={{ color: tc }}
                  value={n.text}
                  onChange={(e) => {
                    onUpdateNoteText(n.id, e.target.value);
                    autoResize(e.target);
                  }}
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
