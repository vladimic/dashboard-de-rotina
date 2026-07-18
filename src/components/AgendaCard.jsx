import styles from './AgendaCard.module.css';

export default function AgendaCard({
  title,
  toggleLabel,
  onToggleDay,
  onRefresh,
  updatedLabel,
  height,
  hours,
  events,
  error,
  nowLineTop,
  nowLineLabel,
  calendarAppUrl,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        <div className={styles.headerRight}>
          {calendarAppUrl && (
            <a href={calendarAppUrl} className={styles.toggleLabel} title="Abrir no Fantastical">
              Abrir no Calendário
            </a>
          )}
          <div className={styles.toggleLabel} onClick={onToggleDay}>
            {toggleLabel}
          </div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>
      {error && <div className={styles.error}>Não deu pra carregar o calendário: {error}</div>}
      <div className={styles.timeline} style={{ height }}>
        {hours.map((hr, i) => (
          <div key={i}>
            <div className={styles.hourLabel} style={{ top: hr.top }}>
              {hr.label}
            </div>
            <div className={styles.hourLine} style={{ top: hr.top }} />
          </div>
        ))}
        <div className={styles.eventsLayer}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className={styles.event}
              style={{
                top: ev.top,
                height: ev.height,
                left: `${ev.leftPct}%`,
                width: `calc(${ev.widthPct}% - 4px)`,
                background: ev.bg,
                borderLeftColor: ev.border,
              }}
            >
              <div className={styles.eventContent}>
                <div className={styles.eventLabel} style={{ color: ev.text }}>
                  {ev.label}
                </div>
                <div className={styles.eventTime} style={{ color: ev.textFaint }}>
                  {ev.timeLabel}
                </div>
              </div>
              <div className={styles.eventTooltip}>
                <div className={styles.tooltipTitle}>{ev.label}</div>
                <div className={styles.tooltipTime}>{ev.timeLabel}</div>
                {ev.location && <div className={styles.tooltipLocation}>📍 {ev.location}</div>}
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noreferrer" className={styles.tooltipLink}>
                    Abrir link
                  </a>
                )}
                {ev.description && <div className={styles.tooltipDescription}>{ev.description}</div>}
              </div>
            </div>
          ))}
        </div>
        {nowLineTop != null && (
          <>
            <div className={styles.nowLine} style={{ top: nowLineTop }} />
            <div className={styles.nowDot} style={{ top: nowLineTop }} />
            {nowLineLabel && (
              <div className={styles.nowLabel} style={{ top: nowLineTop }}>
                {nowLineLabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
