import { useEffect, useState } from 'react';
import styles from './Saude.module.css';

const dayLabel = (key) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function Row({ dayKey, value, skipped, placeholder, format, parse, onSet, onSkip, onClear }) {
  const [text, setText] = useState(value != null ? format(value) : '');
  const [error, setError] = useState('');

  // Follows the stored value (saved, removed or restored elsewhere).
  useEffect(() => {
    setText(value != null ? format(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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
  const pending = keys.filter((k) => log[k] == null && !skipped[k]);
  // Days blank when the panel opened stay listed after being filled, so the
  // list doesn't shift under the cursor; a day you remove or skip shows up too.
  const [openedBlank] = useState(() => new Set(pending));
  const visible = showAll ? keys : keys.filter((k) => openedBlank.has(k) || pending.includes(k));

  return (
    <div className={styles.entryPanel}>
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
            key={key}
            dayKey={key}
            value={log[key] ?? null}
            skipped={Boolean(skipped[key])}
            placeholder={placeholder}
            format={format}
            parse={parse}
            onSet={onSet}
            onSkip={onSkip}
            onClear={onClear}
          />
        ))}
      </div>
    </div>
  );
}

// Pencil button that opens the editor; orange with a count while there are
// blank days in the last 35.
export function EditButton({ pendingCount, onClick }) {
  return (
    <button
      type="button"
      className={styles.editBtn}
      data-alert={pendingCount > 0}
      onClick={onClick}
      title={pendingCount > 0 ? `Preencher: ${pendingCount} dia(s) em branco nos últimos 35` : 'Editar os registros'}
      aria-label="Preencher ou editar os registros"
    >
      ✎{pendingCount > 0 && <span className={styles.editCount}>{pendingCount}</span>}
    </button>
  );
}
