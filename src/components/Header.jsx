import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../version';
import { VERSION_HISTORY } from '../versionHistory';
import { requestNotificationPermission } from '../hooks/useAppBadge';
import { dateKeySaoPaulo, shiftDateKey } from '../utils/format';
import styles from './Header.module.css';

const TABS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'saude', label: 'Saúde' },
  { key: 'backlog', label: 'Backlog' },
];

const USD_PERIODS = [
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
  { key: 365, label: '365d' },
];

const CHART_W = 280;
const CHART_H = 100;
const CHART_PAD = 4;
const GREEN = '#3fa578';
const RED = '#c4506a';

const USD_SOURCE_LABEL = 'Yahoo Finance';
const USD_SOURCE_URL = 'https://finance.yahoo.com/quote/USDBRL=X';

function fmtBRL(v) {
  return `R$ ${v.toFixed(3).replace('.', ',')}`;
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;
}

function fmtUsdUpdatedAt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtChartDate(dateKey) {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m}`;
}

function buildLinePoints(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.001;
  return values.map((v, i) => {
    const x = CHART_PAD + (i / (values.length - 1 || 1)) * (CHART_W - CHART_PAD * 2);
    const y = CHART_PAD + (1 - (v - min) / range) * (CHART_H - CHART_PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}

function UsdPopover({ series, period, onPeriodChange }) {
  const cutoff = shiftDateKey(dateKeySaoPaulo(), -period);
  const points = series.filter((p) => p.date >= cutoff);
  const hasData = points.length >= 2;
  const values = points.map((p) => p.bid);
  const linePoints = hasData ? buildLinePoints(values) : [];
  const pct = hasData ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : null;
  const minVal = hasData ? Math.min(...values) : null;
  const maxVal = hasData ? Math.max(...values) : null;
  const color = pct != null && pct < 0 ? RED : GREEN;
  const areaPoints = hasData
    ? [`${CHART_PAD},${CHART_H - CHART_PAD}`, ...linePoints, `${(CHART_W - CHART_PAD).toFixed(1)},${CHART_H - CHART_PAD}`].join(' ')
    : '';

  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const handleMouseMove = (e) => {
    if (!hasData || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const step = (CHART_W - CHART_PAD * 2) / (points.length - 1 || 1);
    const index = Math.max(0, Math.min(points.length - 1, Math.round((relX - CHART_PAD) / step)));
    const [px, py] = linePoints[index].split(',').map(Number);
    setHover({ index, x: px, y: py });
  };

  return (
    <div className={styles.usdPopover} onClick={(e) => e.stopPropagation()}>
      <div className={styles.usdTabs}>
        {USD_PERIODS.map((p) => (
          <div
            key={p.key}
            className={styles.usdTab}
            data-active={period === p.key}
            onClick={() => onPeriodChange(p.key)}
          >
            {p.label}
          </div>
        ))}
      </div>
      {pct != null && (
        <div className={styles.usdPeriodRow}>
          <span style={{ color }}>{fmtPct(pct)}</span>
        </div>
      )}
      {hasData ? (
        <>
          <div className={styles.usdChartWrap}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className={styles.usdSvg}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHover(null)}
            >
              <polyline points={areaPoints} fill={`${color}1f`} stroke="none" />
              <polyline
                points={linePoints.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {hover && (
                <>
                  <line x1={hover.x} y1={CHART_PAD} x2={hover.x} y2={CHART_H - CHART_PAD} stroke="#e3d6e8" strokeWidth="1" />
                  <circle cx={hover.x} cy={hover.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
                </>
              )}
            </svg>
            {hover && (
              <div
                className={styles.usdTooltip}
                style={{ left: `${(hover.x / CHART_W) * 100}%`, top: `${(hover.y / CHART_H) * 100}%` }}
              >
                <div className={styles.usdTooltipDate}>{fmtChartDate(points[hover.index].date)}</div>
                <div className={styles.usdTooltipValue}>{fmtBRL(points[hover.index].bid)}</div>
              </div>
            )}
          </div>
          <div className={styles.usdChartLabels}>
            <div className={styles.usdChartStats}>
              <div className={styles.usdChartStat}>
                <span>{fmtChartDate(points[0].date)}</span>
                <span className={styles.usdChartLabelValue}>{fmtBRL(points[0].bid)}</span>
              </div>
              <div className={styles.usdChartStat}>
                <span>Mínimo</span>
                <span className={styles.usdChartLabelValue}>{fmtBRL(minVal)}</span>
              </div>
              <div className={styles.usdChartStat}>
                <span>Máximo</span>
                <span className={styles.usdChartLabelValue}>{fmtBRL(maxVal)}</span>
              </div>
            </div>
            <span>{fmtChartDate(points[points.length - 1].date)}</span>
          </div>
        </>
      ) : (
        <div className={styles.usdChartEmpty}>Sem dados suficientes ainda.</div>
      )}
      <a
        className={styles.usdSource}
        href={USD_SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        fonte: {USD_SOURCE_LABEL}
      </a>
    </div>
  );
}

export default function Header({
  page,
  todayLong,
  updatedAt,
  loading,
  userEmail,
  onGoPage,
  onRefreshAll,
  onSignOut,
  onExportData,
  onResetDay,
  badgeCount,
  usd,
}) {
  const notificationsBlocked = 'Notification' in window && Notification.permission !== 'granted';

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

  const [usdOpen, setUsdOpen] = useState(false);
  const [usdPeriod, setUsdPeriod] = useState(7);
  const usdRef = useRef(null);
  useEffect(() => {
    if (!usdOpen) return undefined;
    const onDocClick = (e) => {
      if (!usdRef.current?.contains(e.target)) setUsdOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [usdOpen]);

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
      <div className={styles.dateCol}>
        <div className={styles.date}>{todayLong}</div>
      </div>
      <div className={styles.usdCol}>
        {usd && (
          <div className={styles.usdWrap} ref={usdRef}>
            <div className={styles.usdPill} onClick={() => setUsdOpen((o) => !o)}>
              <span className={styles.usdLabel}>USD</span>
              <span className={styles.usdValue}>{usd.current ? fmtBRL(usd.current.bid) : '···'}</span>
              {usd.current && (
                <span className={styles.usdPctStack}>
                  <span style={{ color: usd.current.pctChange < 0 ? RED : GREEN }} className={styles.usdDailyPct}>
                    {fmtPct(usd.current.pctChange)}
                  </span>
                  {usd.updatedAt && <span className={styles.usdUpdatedAt}>{fmtUsdUpdatedAt(usd.updatedAt)}</span>}
                </span>
              )}
              <span className={styles.usdChevron} data-open={usdOpen}>
                ▾
              </span>
              <span
                className={styles.usdRefresh}
                title="Atualizar cotação"
                onClick={(e) => {
                  e.stopPropagation();
                  usd.refresh();
                }}
              >
                ⟳
              </span>
            </div>
            {usdOpen && <UsdPopover series={usd.series} period={usdPeriod} onPeriodChange={setUsdPeriod} />}
          </div>
        )}
      </div>
      <div className={styles.right}>
        <div className={styles.rightTop}>
          <div className={styles.updatedAt}>atualizado às {updatedAt}</div>
          <div className={styles.rightButtons}>
            <button type="button" className={styles.refreshAll} onClick={onRefreshAll}>
              Atualizar tudo
            </button>
            {notificationsBlocked && (
              <button type="button" className={styles.refreshAll} onClick={() => requestNotificationPermission(badgeCount)}>
                Ativar notificações
              </button>
            )}
          </div>
        </div>
        <span className={styles.version} title="Versão do dashboard">
          v{APP_VERSION}
        </span>
        {onSignOut && (
          <div className={styles.accountRight}>
            <div className={styles.accountText}>
              {userEmail && <span className={styles.email}>{userEmail}</span>}
              {loading && <span className={styles.loadingMsg}>Carregando informações...</span>}
            </div>
            <div className={styles.emailMenu} data-open={menuOpen} ref={menuRef}>
              <button
                type="button"
                className={styles.menuButton}
                aria-label="Abrir menu"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
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
                  onClick={() => {
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
                    onResetDay();
                  }}
                >
                  Reiniciar dia
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
