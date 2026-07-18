import { useState } from 'react';
import styles from './HubSpotCard.module.css';

export default function HubSpotDealsWithoutTasksCard({ groups, total, loading, error, onRefresh, updatedLabel, extraLink }) {
  const [expanded, setExpanded] = useState({});
  const allExpanded = groups.length > 0 && groups.every((g) => expanded[g.stageLabel]);

  function toggleGroup(stageLabel) {
    setExpanded((e) => ({ ...e, [stageLabel]: !e[stageLabel] }));
  }

  function toggleAll() {
    if (allExpanded) {
      setExpanded({});
    } else {
      setExpanded(Object.fromEntries(groups.map((g) => [g.stageLabel, true])));
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          HubSpot <span style={{ fontSize: '10px', fontWeight: 500 }}>- Deals sem Tarefa</span>
        </div>
        <div className={styles.headerRight}>
          {extraLink && (
            <a href={extraLink.href} target="_blank" rel="noreferrer" className={styles.extraLink} title={extraLink.title}>
              {extraLink.label}
            </a>
          )}
          {groups.length > 0 && (
            <div
              className={styles.groupToggleIcon}
              onClick={toggleAll}
              title={allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
            >
              {allExpanded ? '⊟' : '⊞'}
            </div>
          )}
          <div className={styles.count}>{total}</div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar: {error}</div>}
      {!error && loading && groups.length === 0 && <div className={styles.empty}>Carregando...</div>}
      {!error && !loading && groups.length === 0 && <div className={styles.empty}>Todos os deals têm tarefa em aberto.</div>}

      {groups.map((group) => {
        const isExpanded = !!expanded[group.stageLabel];
        return (
          <div key={group.stageLabel} className={styles.group}>
            <div className={styles.stageLabel} onClick={() => toggleGroup(group.stageLabel)}>
              <span>
                {group.stageLabel} ({group.deals.length})
              </span>
              <span className={styles.chevron}>{isExpanded ? '▾' : '▸'}</span>
            </div>
            {isExpanded &&
              group.deals.map((deal) => (
                <div key={deal.id} className={styles.row}>
                  <div className={styles.dot} />
                  <a href={deal.link} target="_blank" rel="noreferrer" className={styles.label}>
                    <div className={styles.dealName}>{deal.name}</div>
                  </a>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
