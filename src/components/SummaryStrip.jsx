import styles from './SummaryStrip.module.css';
import { formatClockSP, formatDuration, formatKg, sleepQuality, TREND_UI } from '../utils/health';

function StatCard({ title, value, suffix, className, done, tip, tipAlign }) {
  return (
    <div className={`${styles.card} ${className || ''} ${done ? styles.cardDone : ''}`} data-tip={tip} data-tip-align={tipAlign}>
      {done && (
        <div className={styles.doneBadge}>
          <span className={styles.doneBadgeCheck}>✓</span>
        </div>
      )}
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>
        {value}
        {suffix != null && <span className={styles.cardSuffix}>{suffix}</span>}
      </div>
    </div>
  );
}

const WEIGHT_TIP = 'Peso: última pesagem registrada no app Saúde (kg). As setas comparam com a pesagem mais antiga de cada janela — 7, 30 e 90 dias: ▼ perdeu, ▲ ganhou, ▬ variação menor que 0,2 kg.';
const QUALITY_TIP =
  'Qualidade: estimativa da nota do app Saúde (que nenhum app consegue ler), com os mesmos 3 pilares: Duração até 50 pts (≈7h45 = 50), Hora de dormir até 30 pts (quanto mais perto da média das 13 noites anteriores, melhor) e Interrupções até 20 pts (tempo acordado). ≥81 alta, 61–80 regular, abaixo baixa.';
const IAH_TIP = 'IAH (índice de apneia-hipopneia): quantos eventos de apneia/hipopneia por hora de sono o CPAP registrou na última noite lançada. Menos é melhor; abaixo de 5 é considerado normal.';
const SONO_TIP = 'Sono: tempo total dormindo na última noite (profundo + essencial + REM). Não conta o tempo acordado nem “na cama”.';
const DORMIU_TIP = 'Dormiu: horário em que você pegou no sono na última noite (primeiro trecho de sono, não de “na cama”), no fuso de São Paulo.';
const ACORDOU_TIP = 'Acordou: horário do fim do último trecho de sono da noite, no fuso de São Paulo.';

export default function SummaryStrip({ page, counts, saude, lists, dayProgressPercent }) {
  const isHoje = page === 'hoje';
  const isSaude = page === 'saude';

  return (
    <div className={styles.strip}>
      <div className={styles.hojeGroup} data-dim={isSaude}>
        <div className={styles.kpiScroll}>
          <StatCard title="Meu Dia" value={counts.meuDiaCount} className={styles.hojeCard} done={counts.meuDiaCount === 0} />
          <StatCard title="Lembretes" value={lists.lembretesTotal} className={styles.hojeCard} done={lists.lembretesTotal === 0} />
          <StatCard title="Notion" value={lists.notionTotal} className={styles.hojeCard} done={lists.notionTotal === 0} />
          <StatCard title="HubSpot" value={counts.hubspotTotal} className={styles.hojeCard} done={counts.hubspotTotal === 0} />
          <div className={styles.geralCard}>
            <div className={styles.geralTop}>
              <div className={styles.geralTitle}>Geral</div>
              <div className={styles.geralSubtotal}>
                {counts.meuDiaCount + lists.lembretesTotal + lists.notionTotal + counts.hubspotTotal}
              </div>
            </div>
            <div className={styles.geralBottom}>
              <div
                className={styles.geralRing}
                style={{
                  background: `conic-gradient(#8fd9b6 ${dayProgressPercent * 3.6}deg, rgba(255,255,255,0.18) 0deg)`,
                }}
              >
                <div className={styles.geralRingInner}>{dayProgressPercent}%</div>
              </div>
              <div className={styles.geralValue}>{counts.geralTotal}</div>
            </div>
          </div>
          <StatCard title="Starting Day" value={counts.manhaPend} className={styles.hojeCard} done={counts.manhaPend === 0} />
          <StatCard title="Ending Day" value={counts.noitePend} className={styles.hojeCard} done={counts.noitePend === 0} />
          <StatCard title="TickTick" value={lists.ticktickTotal} className={styles.hojeCard} done={lists.ticktickTotal === 0} />
          <StatCard title="Hábitos" value={counts.habitosPend} className={styles.hojeCard} done={counts.habitosPend === 0} />
        </div>
      </div>

      <div className={styles.saudeGroup} data-dim={isHoje}>
        <div className={`${styles.card} ${styles.saudeCard}`}>
          <div className={styles.cardTitle} data-tip={WEIGHT_TIP}>Peso</div>
          <div className={styles.weightRow}>
            <div className={styles.weightTrends}>
              {(saude.weight?.trends || []).map(({ days, trend }) => (
                <span
                  key={days}
                  className={styles.weightTrend}
                  data-dir={trend?.direction || 'none'}
                  data-tip={trend ? `${days} dias: ${TREND_UI[trend.direction].label} (${trend.diff > 0 ? '+' : ''}${formatKg(trend.diff)} kg)` : `${days} dias: pesagens insuficientes`}
                >
                  {trend ? TREND_UI[trend.direction].symbol : '–'}
                </span>
              ))}
            </div>
            <div className={styles.cardValue} data-tip={WEIGHT_TIP} data-tip-align="right">
              {saude.weight ? formatKg(saude.weight.value) : '–'}
              <span className={styles.cardSuffix}>kg</span>
            </div>
          </div>
        </div>
        <StatCard title="IAH" value={saude.iah != null ? formatKg(saude.iah) : '–'} className={styles.saudeCard} tip={IAH_TIP} />
        <StatCard title="Sono" value={saude.lastNight ? formatDuration(saude.lastNight.asleepMin) : '–'} className={styles.saudeCard} tip={SONO_TIP} />
        <StatCard title="Qualidade" value={saude.lastNight ? sleepQuality(saude.lastNight, saude.nights).score : '–'} className={styles.saudeCard} tip={QUALITY_TIP} />
        <StatCard title="Dormiu" value={saude.lastNight ? formatClockSP(saude.lastNight.bedtime) : '–'} className={styles.saudeCard} tip={DORMIU_TIP} />
        <StatCard title="Acordou" value={saude.lastNight ? formatClockSP(saude.lastNight.wake) : '–'} className={styles.saudeCard} tip={ACORDOU_TIP} tipAlign="right" />
        {/* Filled in once the Shortcut also sends steps and exercise. */}
        <StatCard title="Passos" value="–" className={styles.saudeCard} tip="Passos: total do dia no app Saúde. Ainda não sincronizado — o atalho “Sincronizar Saúde” só envia peso e sono por enquanto." />
        <StatCard title="Exercício" value="–" className={styles.saudeCard} tip="Exercício: minutos de treino do dia no app Saúde. Ainda não sincronizado — o atalho só envia peso e sono por enquanto." tipAlign="right" />
      </div>
    </div>
  );
}
