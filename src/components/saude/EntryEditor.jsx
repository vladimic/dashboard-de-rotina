import { useRef, useState } from 'react';
import styles from './Saude.module.css';

const dayLabel = (key) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function Row({ dayKey, value, skipped, placeholder, format, parse, onSet, onSkip, onClear }) {
  const [text, setText] = useState(value != null ? format(value) : '');
  const [error, setError] = useState('');

  function save() {
    const result = parse(text);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError('');
    onSet(dayKey, result.value);
  }

  return (
    <div className={styles.entryRow} data-skipped={skipped}>
      <span className={styles.entryDay}>{dayLabel(dayKey)}</span>
      {skipped ? (
        <>
          <span className={styles.entrySkipped}>sem informação</span>
          <button type="button" className={styles.entryLink} onClick={() => onClear(dayKey)}>
            Desfazer
          </button>
        </>
      ) : (
        <>
          <input
            className={styles.input}
            style={{ width: 64 }}
            inputMode="decimal"
            placeholder={placeholder}
            value={text}
            data-invalid={Boolean(error)}
            title={error || undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
          />
          <button type="button" className={styles.saveBtn} onClick={save}>
            {value != null ? 'Salvar' : 'OK'}
          </button>
          {value != null ? (
            <button type="button" className={styles.entryLink} onClick={() => onClear(dayKey)}>
              Remover
            </button>
          ) : (
            <button type="button" className={styles.entryLink} onClick={() => onSkip(dayKey)}>
              Sem info
            </button>
          )}
          {error && <span className={styles.entryError}>{error}</span>}
        </>
      )}
    </div>
  );
}

// Overlay over the card for typing/editing a hand-filled daily log over the
// last 35 days. Shows the blank days first (by default only those), each with
// OK / "Sem info" (leave blank on purpose), and lets filled days be edited or
// removed. "Concluir" closes it.
export default function EntryEditor({ title, keys, log, skipped, placeholder, format, parse, onSet, onSkip, onClear, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const boxRef = useRef(null);
  const pending = keys.filter((k) => log[k] == null && !skipped[k]);
  const visible = showAll ? keys : pending;

  // After each action the list shifts up; put the cursor back on the first
  // field so the blank days can be typed through one after another.
  const refocus = () => requestAnimationFrame(() => boxRef.current?.querySelector('input')?.focus());
  const wrap = (fn) => (...args) => {
    fn(...args);
    refocus();
  };

  return (
    <div className={styles.entryPanel} ref={boxRef}>
      <div className={styles.entryHead}>
        <span className={styles.title}>{title}</span>
        <span className={styles.muted}>
          {pending.length === 0 ? 'tudo em dia' : `${pending.length} em branco · últimos ${keys.length} dias`}
        </span>
        <button type="button" className={styles.entryLink} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Só em branco' : 'Ver todos'}
        </button>
        <button type="button" className={styles.saveBtn} onClick={onClose}>
          Concluir
        </button>
      </div>
      <div className={styles.entryList}>
        {visible.length === 0 && <div className={styles.empty}>Nenhum dia em branco nos últimos {keys.length} dias.</div>}
        {visible.map((key) => (
          <Row
            key={`${key}:${log[key] ?? ''}:${skipped[key] ? 's' : ''}`}
            dayKey={key}
            value={log[key] ?? null}
            skipped={Boolean(skipped[key])}
            placeholder={placeholder}
            format={format}
            parse={parse}
            onSet={wrap(onSet)}
            onSkip={wrap(onSkip)}
            onClear={wrap(onClear)}
          />
        ))}
      </div>
    </div>
  );
}
