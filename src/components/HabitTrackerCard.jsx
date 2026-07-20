import styles from './HabitTrackerCard.module.css';

function EditRows({ items, onUpdateText, onRemoveItem, onDragStart, onDrop }) {
  return items.map((h) => (
    <div
      key={h.id}
      draggable
      onDragStart={() => onDragStart(h.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(h.id)}
      className={styles.editRow}
    >
      <span className={styles.dragHandle}>⠿</span>
      <input className={styles.editInput} value={h.label} onChange={(e) => onUpdateText(h.id, e.target.value)} />
      <span className={styles.removeBtn} onClick={() => onRemoveItem(h.id)}>
        ×
      </span>
    </div>
  ));
}

function AddRow({ value, onChange, onAdd, placeholder }) {
  return (
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
  );
}

function HabitRows({ rows, days, badColor, onCycleMark }) {
  return rows.map((h) => (
    <div key={h.id} className={styles.habitRow}>
      <div className={styles.habitLabel} style={badColor ? { color: badColor } : undefined}>
        {h.label} <span className={styles.streak}>({h.streak})</span>
      </div>
      <div className={styles.days}>
        {days.map((d, i) => (
          <div
            key={d}
            className={styles.cell}
            data-state={h.marks[i] || 'blank'}
            data-bad={badColor ? 'true' : undefined}
            onClick={() => onCycleMark(h.id, d)}
          />
        ))}
      </div>
    </div>
  ));
}

export default function HabitTrackerCard({
  open,
  edit,
  onToggleOpen,
  onToggleEdit,
  days,
  bons,
  ruins,
  onCycleMark,
  newBomText,
  onNewBomTextChange,
  onAddBom,
  onUpdateBomText,
  onRemoveBom,
  onDragStartBom,
  onDropBom,
  newRuimText,
  onNewRuimTextChange,
  onAddRuim,
  onUpdateRuimText,
  onRemoveRuim,
  onDragStartRuim,
  onDropRuim,
}) {
  const pend = bons.pend + ruins.pend;
  const total = bons.total + ruins.total;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Hábitos</div>
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

      {open && (
        <>
          <div className={styles.groupHeader}>
            <span className={styles.groupLabel}>Hábitos</span>
            <span className={styles.groupCount}>
              {bons.pend}/{bons.total}
            </span>
          </div>
          {edit ? (
            <EditRows items={bons.rows} onUpdateText={onUpdateBomText} onRemoveItem={onRemoveBom} onDragStart={onDragStartBom} onDrop={onDropBom} />
          ) : (
            <HabitRows rows={bons.rows} days={days} onCycleMark={onCycleMark} />
          )}
          {edit && <AddRow value={newBomText} onChange={onNewBomTextChange} onAdd={onAddBom} placeholder="Novo hábito..." />}

          <div className={styles.divider} />

          <div className={styles.groupHeader}>
            <span className={styles.groupLabelBad}>A evitar</span>
            <span className={styles.groupCount}>
              {ruins.pend}/{ruins.total}
            </span>
          </div>
          {edit ? (
            <EditRows items={ruins.rows} onUpdateText={onUpdateRuimText} onRemoveItem={onRemoveRuim} onDragStart={onDragStartRuim} onDrop={onDropRuim} />
          ) : (
            <HabitRows rows={ruins.rows} days={days} badColor="#b5546b" onCycleMark={onCycleMark} />
          )}
          {edit && <AddRow value={newRuimText} onChange={onNewRuimTextChange} onAdd={onAddRuim} placeholder="Novo item a evitar..." />}
        </>
      )}
    </div>
  );
}
