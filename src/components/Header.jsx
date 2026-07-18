import { useEffect, useState } from 'react';
import { APP_VERSION } from '../version';
import styles from './Header.module.css';

const TABS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'saude', label: 'Saúde' },
  { key: 'backlog', label: 'Backlog' },
];

export default function Header({ page, todayLong, updatedAt, userEmail, onGoPage, onRefreshAll, onSignOut }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.header}>
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={styles.tab}
            data-active={page === tab.key}
            onClick={() => onGoPage(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.date}>{todayLong}</div>
      <div className={styles.right}>
        <div className={styles.rightTop}>
          <div className={styles.updatedAt}>atualizado às {updatedAt}</div>
          <button type="button" className={styles.refreshAll} onClick={onRefreshAll}>
            Atualizar tudo
          </button>
        </div>
        {onSignOut && (
          <div className={styles.account}>
            {userEmail && <span className={styles.email}>{userEmail}</span>}
            <span className={styles.version} title="Versão do dashboard">
              v{APP_VERSION}
            </span>
            {loaded && <span title="Página carregada">✅</span>}
            <button type="button" className={styles.signOut} onClick={onSignOut}>
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
