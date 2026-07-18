import { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './ConfirmContext.module.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [message, setMessage] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((msg) => {
    setMessage(msg);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handle(result) {
    setMessage(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {message != null && (
        <div className={styles.overlay} onClick={() => handle(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.message}>{message}</div>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => handle(false)}>
                Cancelar
              </button>
              <button type="button" className={styles.confirmBtn} onClick={() => handle(true)}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
