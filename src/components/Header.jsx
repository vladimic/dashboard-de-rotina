import { APP_VERSION } from '../version';
import { requestNotificationPermission } from '../hooks/useAppBadge';
import styles from './Header.module.css';

const TABS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'saude', label: 'Saúde' },
  { key: 'backlog', label: 'Backlog' },
];

export default function Header({ page, todayLong, updatedAt, loading, userEmail, onGoPage, onRefreshAll, onSignOut, onExportData, badgeCount }) {
  const notificationsBlocked = 'Notification' in window && Notification.permission !== 'granted';

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
              <div className={styles.emailMenu}>
                <span className={styles.email}>{userEmail}</span>
                <div className={styles.dropdown}>
                  <div className={styles.dropdownItem} onClick={onExportData}>
                    Exportar dados
                  </div>
                  <div className={styles.dropdownItem} onClick={onSignOut}>
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
    </div>
  );
}
