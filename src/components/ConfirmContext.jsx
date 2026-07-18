import { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './ConfirmContext.module.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((message, confirmLabel = 'Remover', cancelLabel = 'Cancelar') => {
    setDialog({ message, confirmLabel, cancelLabel });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handle(result) {
    setDialog(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog != null && (
        <div className={styles.overlay} onClick={() => handle(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.message}>{dialog.message}</div>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => handle(false)}>
                {dialog.cancelLabel}
              </button>
              <button type="button" className={styles.confirmBtn} onClick={() => handle(true)}>
                {dialog.confirmLabel}
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
