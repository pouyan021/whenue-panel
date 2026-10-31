import { useQuery } from '@apollo/client/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Empty, ErrorBanner, Loading } from '../components/ui';
import { CLUB_STATS, type ClubPeriod, type ClubStats, type ClubStatsDay } from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

export const PERIODS = [7, 30, 90] as const;
type Metric = 'visits' | 'newMembers' | 'revenueRial';

/** The clinic owner's home: how the club did this period, next to the period before. */
export function DashboardPage() {
  const { t } = useI18n();
  const format = useFormat();
  const { organization, hasModule } = useCurrentVenue();
  const [params, setParams] = useSearchParams();
  const asked = Number(params.get('days'));
  const days = (PERIODS as readonly number[]).includes(asked) ? asked : 30;
  const { data, loading, error, refetch } = useQuery(CLUB_STATS, {
    variables: { organizationId: organization.id, days },
    notifyOnNetworkStatusChange: true,
  });
  const stats = data?.clubStats;

  return (
    <section className="dashboard">
      <header className="page-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          {stats && <p className="muted page-sub">{t('dashboard.subtitle', { days: format.number(stats.days) })}</p>}
        </div>
        <div className="segmented" role="group" aria-label={t('dashboard.period')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === days}
              onClick={() => setParams(p === 30 ? {} : { days: String(p) }, { replace: true })}
            >
              {t('dashboard.days', { days: format.number(p) })}
            </button>
          ))}
        </div>
      </header>

      <ErrorBanner error={error} />
      {error && (
        <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
          {t('common.retry')}
        </button>
      )}
      {!stats ? (
        loading && <Loading />
      ) : stats.membersTotal === 0 ? (
        <Empty>
          {t('dashboard.empty')} <Link to="/check-in">{t('nav.checkIn')}</Link>
        </Empty>
      ) : (
        <div className={`stack ${loading ? 'is-refreshing' : ''}`}>
          <Kpis stats={stats} />
          <TrendCard daily={stats.daily} />
          <div className="dashboard-row">
            <TopRewards stats={stats} />
            <ClubHealth stats={stats} referrals={hasModule('REFERRALS')} />
          </div>
        </div>
      )}
    </section>
  );
}

function returningRate(p: ClubPeriod) {
  return p.activeMembers === 0 ? null : p.returningMembers / p.activeMembers;
}

function Kpis({ stats }: { stats: ClubStats }) {
  const { t } = useI18n();
  const format = useFormat();
  const { current: c, previous: p } = stats;
  const rate = returningRate(c);
  const previousRate = returningRate(p);
  return (
    <div className="kpis">
      <Kpi label={t('dashboard.newMembers')} value={format.number(c.newMembers)} delta={change(c.newMembers, p.newMembers)} />
      <Kpi label={t('dashboard.visits')} value={format.number(c.visits)} delta={change(c.visits, p.visits)} />
      <Kpi label={t('dashboard.revenue')} value={format.tomanShort(c.revenueRial)} delta={change(c.revenueRial, p.revenueRial)} />
      <Kpi
        label={t('dashboard.returning')}
        hint={t('dashboard.returningHint', {
          returning: format.number(c.returningMembers),
          active: format.number(c.activeMembers),
        })}
        value={rate == null ? '–' : format.percent(rate)}
        delta={rate == null || previousRate == null ? null : { points: Math.round((rate - previousRate) * 100) }}
      />
    </div>
  );
}

type Delta = { ratio: number } | { points: number } | { fresh: true } | null;

/** Change against the previous period; nothing to compare with when both are zero. */
function change(now: number, before: number): Delta {
  if (before === 0) return now === 0 ? null : { fresh: true };
  return { ratio: (now - before) / before };
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta: Delta; hint?: string }) {
  const { t } = useI18n();
  const format = useFormat();
  let text: string | null = null;
  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (delta && 'fresh' in delta) {
    text = t('dashboard.new');
    direction = 'up';
  } else if (delta && 'ratio' in delta) {
    const r = Math.round(delta.ratio * 100);
    direction = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
    text = format.percent(Math.abs(r) / 100);
  } else if (delta && 'points' in delta) {
    direction = delta.points > 0 ? 'up' : delta.points < 0 ? 'down' : 'flat';
    text = t('dashboard.pointsChange', { points: format.number(Math.abs(delta.points)) });
  }
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {text && (
        <span className={`kpi-delta kpi-${direction}`}>
          {arrow && <span aria-hidden="true">{arrow} </span>}
          {direction === 'up' ? t('dashboard.up', { change: text }) : direction === 'down' ? t('dashboard.down', { change: text }) : t('dashboard.same')}
        </span>
      )}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

const METRIC_LABEL: Record<Metric, MessageKey> = {
  visits: 'dashboard.visits',
  newMembers: 'dashboard.newMembers',
  revenueRial: 'dashboard.revenue',
};

function TrendCard({ daily }: { daily: ClubStatsDay[] }) {
  const { t } = useI18n();
  const [metric, setMetric] = useState<Metric>('visits');
  const [table, setTable] = useState(false);
  return (
    <div className="card">
      <div className="card-header">
        <h2>{t('dashboard.trend')}</h2>
        <div className="segmented segmented-small" role="group" aria-label={t('dashboard.metric')}>
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button key={m} type="button" aria-pressed={m === metric} onClick={() => setMetric(m)}>
              {t(METRIC_LABEL[m])}
            </button>
          ))}
        </div>
      </div>
      {table ? <TrendTable daily={daily} /> : <BarChart daily={daily} metric={metric} />}
      <button type="button" className="link-button" onClick={() => setTable(!table)}>
        {table ? t('dashboard.showChart') : t('dashboard.showTable')}
      </button>
    </div>
  );
}

function useDayLabel() {
  const { lang } = useI18n();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    // Calendar days from the API: read them at noon UTC so no time zone moves them.
    return (date: string) => f.format(new Date(`${date}T12:00:00Z`));
  }, [lang]);
}

const W = 720;
const H = 200;
const TOP = 12;
const BOTTOM = 22;
const LEFT = 44;

/** A round axis maximum just above the data, so the bars fill most of the height. */
export function niceMax(max: number) {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]) {
    const nice = Math.round(step * power * 100) / 100;
    if (nice >= max) return nice;
  }
  return 10 * power;
}

function BarChart({ daily, metric }: { daily: ClubStatsDay[]; metric: Metric }) {
  const { t } = useI18n();
  const format = useFormat();
  const dayLabel = useDayLabel();
  const [hover, setHover] = useState<number | null>(null);
  const value = (d: ClubStatsDay) => d[metric];
  const show = (n: number) => (metric === 'revenueRial' ? format.toman(n) : format.number(n));
  const axis = (n: number) => (metric === 'revenueRial' ? format.number(Math.round(n / 10 / 1_000_000)) : format.number(n));
  const max = niceMax(Math.max(...daily.map(value)));
  const plotW = W - LEFT;
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / daily.length;
  const gap = Math.min(2, slot * 0.25);
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => TOP + plotH - (v / max) * plotH;
  // A middle line only where it lands on a whole number.
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const labelEvery = Math.ceil(daily.length / 6);
  const hovered = hover == null ? null : daily[hover];

  return (
    <div className="chart" dir="ltr" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('dashboard.chartLabel', { metric: t(METRIC_LABEL[metric]) })}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={W} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={LEFT - 6} y={y(tick)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
              {axis(tick)}
            </text>
          </g>
        ))}
        {metric === 'revenueRial' && (
          <text x={LEFT - 6} y={TOP - 4} className="chart-axis" textAnchor="end">
            {t('dashboard.millionToman')}
          </text>
        )}
        {daily.map((d, i) => {
          const v = value(d);
          const x = LEFT + i * slot + gap / 2;
          const h = Math.max(0, TOP + plotH - y(v));
          const r = Math.min(4, barW / 2, h);
          const top = TOP + plotH - h;
          return (
            <g key={d.date}>
              {/* Hit target: the whole slot, taller than the bar. */}
              <rect
                x={LEFT + i * slot}
                y={TOP}
                width={slot}
                height={plotH}
                className="chart-hit"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              />
              {h > 0 && (
                <path
                  className={`chart-bar ${hover === i ? 'is-hover' : ''}`}
                  d={`M${x},${TOP + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${TOP + plotH} Z`}
                />
              )}
              {(i % labelEvery === 0 || i === daily.length - 1) && (daily.length - 1 - i >= labelEvery / 2 || i === daily.length - 1) && (
                <text
                  x={i === daily.length - 1 ? x + barW : x + barW / 2}
                  y={H - 6}
                  className="chart-axis"
                  textAnchor={i === daily.length - 1 ? 'end' : 'middle'}
                >
                  {dayLabel(d.date)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={LEFT} x2={W} y1={TOP + plotH} y2={TOP + plotH} className="chart-baseline" />
      </svg>
      {hovered && hover != null && (
        <div
          className="chart-tooltip"
          style={{ left: `${((LEFT + (hover + 0.5) * slot) / W) * 100}%` }}
          role="status"
        >
          <strong>{dayLabel(hovered.date)}</strong>
          <span>{show(value(hovered))}</span>
        </div>
      )}
    </div>
  );
}

function TrendTable({ daily }: { daily: ClubStatsDay[] }) {
  const { t } = useI18n();
  const format = useFormat();
  const dayLabel = useDayLabel();
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{t('dashboard.day')}</th>
            <th>{t('dashboard.visits')}</th>
            <th>{t('dashboard.newMembers')}</th>
            <th>{t('dashboard.revenue')}</th>
          </tr>
        </thead>
        <tbody>
          {[...daily].reverse().map((d) => (
            <tr key={d.date}>
              <td>{dayLabel(d.date)}</td>
              <td>{format.number(d.visits)}</td>
              <td>{format.number(d.newMembers)}</td>
              <td>{format.toman(d.revenueRial)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopRewards({ stats }: { stats: ClubStats }) {
  const { t } = useI18n();
  const format = useFormat();
  const max = Math.max(1, ...stats.topRewards.map((r) => r.redemptions));
  return (
    <div className="card">
      <h2>{t('dashboard.topRewards')}</h2>
      {stats.topRewards.length === 0 ? (
        <Empty>{t('dashboard.noRedemptions')}</Empty>
      ) : (
        <ul className="meter-list">
          {stats.topRewards.map((r) => (
            <li key={r.rewardId}>
              <div className="meter-row">
                <span>{r.name}</span>
                <span className="muted">{t('dashboard.times', { count: format.number(r.redemptions) })}</span>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${(r.redemptions / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClubHealth({ stats, referrals }: { stats: ClubStats; referrals: boolean }) {
  const { t } = useI18n();
  const format = useFormat();
  const c = stats.current;
  const rows: [string, string][] = [
    [t('dashboard.membersTotal'), format.number(stats.membersTotal)],
    [t('dashboard.activeMembers'), format.number(c.activeMembers)],
    [t('dashboard.pointsEarned'), format.points(c.pointsEarned)],
    [t('dashboard.pointsRedeemed'), t('dashboard.pointsRedeemedValue', { points: format.points(c.pointsRedeemed), count: format.number(c.redemptions) })],
  ];
  if (referrals) rows.push([t('dashboard.referrals'), format.number(c.referralsQualified)]);
  return (
    <div className="card">
      <h2>{t('dashboard.club')}</h2>
      <dl className="facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
