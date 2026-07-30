import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../version';
import { VERSION_HISTORY } from '../versionHistory';
import { requestNotificationPermission } from '../hooks/useAppBadge';
import styles from './Header.module.css';

const TABS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'saude', label: 'Saúde' },
  { key: 'backlog', label: 'Backlog' },
];

export default function Header({ page, todayLong, updatedAt, loading, userEmail, onGoPage, onRefreshAll, onSignOut, onExportData, badgeCount }) {
  const notificationsBlocked = 'Notification' in window && Notification.permission !== 'granted';

  // Hover-to-open only works with a mouse — on touch there's no hover, so
  // the menu also opens on tap and closes on an outside tap.
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

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
          {loading && <div className={styles.loadingMsg}>Carregando informações...</div>}
          <div className={styles.updatedAt}>atualizado às {updatedAt}</div>
          <button type="button" className={styles.refreshAll} onClick={onRefreshAll}>
            Atualizar tudo
          </button>
          {notificationsBlocked && (
            <button type="button" className={styles.refreshAll} onClick={() => requestNotificationPermission(badgeCount)}>
              Ativar notificações
            </button>
          )}
        </div>
        {onSignOut && (
          <div className={styles.account}>
            {userEmail && (
              <div
                className={styles.emailMenu}
                data-open={menuOpen}
                ref={menuRef}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <span className={styles.email}>{userEmail}</span>
                <div className={styles.dropdown}>
                  <div
                    className={styles.dropdownItem}
                    onClick={() => {
                      setMenuOpen(false);
                      onExportData();
                    }}
                  >
                    Exportar dados
                  </div>
                  <div
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setHistoryOpen(true);
                    }}
                  >
                    Histórico de Versões
                  </div>
                  <div
                    className={styles.dropdownItem}
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    Sair
                  </div>
                </div>
              </div>
            )}
            <span className={styles.version} title="Versão do dashboard">
              v{APP_VERSION}
            </span>
          </div>
        )}
      </div>
      {historyOpen && (
        <div className={styles.historyOverlay} onClick={() => setHistoryOpen(false)}>
          <div className={styles.historyDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.historyHeader}>
              <span>Histórico de Versões</span>
              <span className={styles.historyClose} onClick={() => setHistoryOpen(false)}>
                ✕
              </span>
            </div>
            <div className={styles.historyList}>
              {VERSION_HISTORY.map((entry) => (
                <div key={entry.version} className={styles.historyItem}>
                  <div className={styles.historyItemHead}>
                    <span className={styles.historyVersion}>v{entry.version}</span>
                    <span className={styles.historyDate}>{entry.date}</span>
                  </div>
                  <div className={styles.historySummary}>{entry.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
