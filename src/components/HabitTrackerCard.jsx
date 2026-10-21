import { weekdayLetter } from '../utils/format';
import styles from './HabitTrackerCard.module.css';

// Sits on the same row as the group title, right-aligned above the day
// cells in the rows below it (same width/gap as `.days` there).
function DaysHeader({ days }) {
  return (
    <div className={styles.days}>
      {days.map((d) => (
        <div key={d} className={styles.dayLetter}>
          {weekdayLetter(d)}
        </div>
      ))}
    </div>
  );
}

function EditRows({ items, days, onCycleMark, onUpdateText, onUpdateLink, onRemoveItem, onDragStart, onDrop }) {
  return items.map((h) => (
    <div
      key={h.id}
      draggable
      onDragStart={() => onDragStart(h.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(h.id)}
      className={styles.editRow}
    >
      <div className={styles.editRowTop}>
        <span className={styles.dragHandle}>⠿</span>
        <input className={styles.editInput} value={h.label} onChange={(e) => onUpdateText(h.id, e.target.value)} />
        <span className={styles.removeBtn} onClick={() => onRemoveItem(h.id)}>
          ×
        </span>
      </div>
      <input
        className={styles.linkInput}
        value={h.link || ''}
        onChange={(e) => onUpdateLink(h.id, e.target.value)}
        placeholder="Link (opcional)"
      />
      <div className={styles.editDays}>
        {days.map((d, i) => (
          <div key={d} className={styles.cell} data-state={h.marks[i] || 'blank'} onClick={() => onCycleMark(h.id, d)} />
        ))}
      </div>
    </div>
  ));
}

function AddRow({ value, onChange, onAdd, placeholder, linkValue, onLinkChange }) {
  return (
    <>
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAdd();
          }}
          placeholder={placeholder}
        />
        <button type="button" className={styles.addBtn} onClick={onAdd}>
          +
        </button>
      </div>
      <input
        className={styles.addLinkInput}
        value={linkValue || ''}
        onChange={(e) => onLinkChange(e.target.value)}
        placeholder="Link (opcional)"
      />
    </>
  );
}

// Same muted color ChecklistCard uses for a checked-off item — a marked
// (done or skipped) habit fades the same way a finished Starting Day item
// does, regardless of which list it's in.
const MARKED_LABEL_COLOR = '#c3b3c9';

function HabitRows({ rows, days, badColor, onCycleMark }) {
  const todayKey = days[days.length - 1];
  return rows.map((h) => {
    const todayMark = h.marks[h.marks.length - 1] || 'blank';
    const labelColor = todayMark !== 'blank' ? MARKED_LABEL_COLOR : badColor;
    const labelStyle = labelColor ? { color: labelColor } : undefined;
    const labelContent = (
      <>
        {h.label} <span className={styles.streak}>({h.streak})</span>
      </>
    );
    return (
      <div key={h.id} className={styles.habitRow}>
        <div
          className={styles.checkbox}
          data-state={todayMark}
          onClick={() => onCycleMark(h.id, todayKey)}
        >
          {todayMark === 'done' && '✓'}
          {todayMark === 'skipped' && '–'}
        </div>
        {h.link ? (
          <a href={h.link} target="_blank" rel="noreferrer" className={styles.habitLabel} style={labelStyle}>
            {labelContent}
          </a>
        ) : (
          <div className={styles.habitLabel} style={labelStyle}>
            {labelContent}
          </div>
        )}
        <div className={styles.days}>
          {days.map((d, i) => (
            <div
              key={d}
              className={styles.cell}
              data-state={h.marks[i] || 'blank'}
              title={`${d.slice(8)}/${d.slice(5, 7)}`}
              onClick={() => onCycleMark(h.id, d)}
            />
          ))}
        </div>
      </div>
    );
  });
}

export default function HabitTrackerCard({
  open,
  collapsible = true,
  twoColumns = false,
  edit,
  onToggleOpen,
  onToggleEdit,
  days,
  bons,
  ruins,
  onCycleMark,
  newBomText,
  onNewBomTextChange,
  newBomLink,
  onNewBomLinkChange,
  onAddBom,
  onUpdateBomText,
  onUpdateBomLink,
  onRemoveBom,
  onDragStartBom,
  onDropBom,
  newRuimText,
  onNewRuimTextChange,
  newRuimLink,
  onNewRuimLinkChange,
  onAddRuim,
  onUpdateRuimText,
  onUpdateRuimLink,
  onRemoveRuim,
  onDragStartRuim,
  onDropRuim,
}) {
  const pend = bons.pend + ruins.pend;
  const total = bons.total + ruins.total;

  // Everything below (both edit- and view-mode rows) is gated on `open` —
  // force it open so "Editar" actually shows something to edit instead of
  // silently doing nothing while the card is collapsed.
  const handleEditClick = () => {
    if (!edit && !open) onToggleOpen();
    onToggleEdit();
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Hábitos</div>
        <div className={styles.headerRight}>
          {collapsible && (
            <div className={styles.toggleIcon} onClick={onToggleOpen} title={open ? 'Recolher' : 'Expandir'}>
              {open ? '⊟' : '⊞'}
            </div>
          )}
          <div className={styles.pend}>
            {pend}/{total}
          </div>
          {edit ? (
            <div className={styles.editLink} onClick={handleEditClick}>
              Concluir
            </div>
          ) : (
            <button type="button" className={styles.editBtn} onClick={handleEditClick} title="Editar os hábitos" aria-label="Editar os hábitos">
              ✎
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className={twoColumns ? styles.twoCols : undefined}>
          <div className={styles.group}>
          <div className={styles.groupHeader}>
            <div className={styles.groupHeaderLeft}>
              <span className={styles.groupLabel}>{twoColumns ? 'Diários' : 'Hábitos Diários'}</span>
              <span className={styles.groupCount}>
                {bons.pend}/{bons.total}
              </span>
            </div>
            {!edit && <DaysHeader days={days} />}
          </div>
          {edit ? (
            <EditRows
              items={bons.rows}
              days={days}
              onCycleMark={onCycleMark}
              onUpdateText={onUpdateBomText}
              onUpdateLink={onUpdateBomLink}
              onRemoveItem={onRemoveBom}
              onDragStart={onDragStartBom}
              onDrop={onDropBom}
            />
          ) : (
            <HabitRows rows={bons.rows} days={days} onCycleMark={onCycleMark} />
          )}
          {edit && (
            <AddRow
              value={newBomText}
              onChange={onNewBomTextChange}
              onAdd={onAddBom}
              placeholder="Novo hábito..."
              linkValue={newBomLink}
              onLinkChange={onNewBomLinkChange}
            />
          )}

          </div>
          {!twoColumns && <div className={styles.divider} />}
          <div className={styles.group}>

          <div className={styles.groupHeader}>
            <div className={styles.groupHeaderLeft}>
              <span className={styles.groupLabelBad}>{twoColumns ? 'A evitar' : 'Hábitos a Evitar'}</span>
              <span className={styles.groupCount}>
                {ruins.pend}/{ruins.total}
              </span>
            </div>
            {!edit && <DaysHeader days={days} />}
          </div>
          {edit ? (
            <EditRows
              items={ruins.rows}
              days={days}
              onCycleMark={onCycleMark}
              onUpdateText={onUpdateRuimText}
              onUpdateLink={onUpdateRuimLink}
              onRemoveItem={onRemoveRuim}
              onDragStart={onDragStartRuim}
              onDrop={onDropRuim}
            />
          ) : (
            <HabitRows rows={ruins.rows} days={days} badColor="#b5546b" onCycleMark={onCycleMark} />
          )}
          {edit && (
            <AddRow
              value={newRuimText}
              onChange={onNewRuimTextChange}
              onAdd={onAddRuim}
              placeholder="Novo item a evitar..."
              linkValue={newRuimLink}
              onLinkChange={onNewRuimLinkChange}
            />
          )}
          </div>
        </div>
      )}
    </div>
  );
}
