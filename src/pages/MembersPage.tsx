import { useApolloClient, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { ImportMembersDialog } from '../components/ImportMembersDialog';
import { InviteMemberDialog, Mobile, memberName, TierBadge } from '../components/members';
import { Button, Empty, ErrorBanner, ListMore, Loading } from '../components/ui';
import { MEMBERS, MEMBERS_COUNT, type MemberSummary } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { config } from '../lib/config';
import { useFormat } from '../lib/format';
import { nationalMobile } from '../lib/numbers';
import { download, toCsv } from '../lib/spreadsheet';
import { useCurrentVenue } from '../lib/venue';

const EXPORT_PAGE = 100;
const EXPORT_MAX = 50_000;

/**
 * People who joined the club, and on a second tab the people the clinic added (imported or
 * invited) who have not joined yet.
 */
export function MembersPage() {
  const { t } = useI18n();
  const format = useFormat();
  const navigate = useNavigate();
  const { organization, canManage } = useCurrentVenue();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const joined = params.get('tab') !== 'not-joined';
  const [size, setSize] = useState(config.pageSize);
  const [inviting, setInviting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { data, loading, error } = useQuery(MEMBERS, {
    variables: { organizationId: organization.id, search: search.trim() || null, joined, page: 0, size },
  });
  const members = data?.members ?? [];
  const total = useQuery(MEMBERS_COUNT, {
    variables: { organizationId: organization.id, search: search.trim() || null, joined },
  }).data?.membersCount;

  function update(next: { q?: string; tab?: string }) {
    const merged = { q: search, tab: joined ? '' : 'not-joined', ...next };
    setSize(config.pageSize);
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)), { replace: true });
  }

  return (
    <section>
      <header className="page-header">
        <h1>{t('members.title')}</h1>
        <div className="header-actions">
          {canManage && <ExportButton joined={joined} />}
          {canManage && <Button onClick={() => setImporting(true)}>{t('import.open')}</Button>}
          <Button variant="primary" onClick={() => setInviting(true)}>
            {t('members.invite')}
          </Button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={joined} onClick={() => update({ tab: '' })}>
          {t('members.tab.joined')}
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={!joined}
          onClick={() => update({ tab: 'not-joined' })}
        >
          {t('members.tab.notJoined')}
        </button>
      </div>

      <input
        type="search"
        className="search"
        placeholder={t('members.search')}
        aria-label={t('members.search')}
        value={search}
        onChange={(e) => update({ q: e.target.value })}
      />

      <ErrorBanner error={error} />
      {loading && members.length === 0 ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty>{search ? t('members.noMatch') : joined ? t('members.empty') : t('members.notJoinedEmpty')}</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('member.name')}</th>
              <th>{t('member.mobile')}</th>
              {joined && <th>{t('member.balance')}</th>}
              {joined && <th>{t('members.tier')}</th>}
              <th>{joined ? t('member.since') : t('members.added')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/members/${m.id}`}>{memberName(m, t('member.noName'))}</Link>
                </td>
                <td>{m.mobile ? <Mobile value={m.mobile} /> : <span className="muted">–</span>}</td>
                {joined && <td>{format.points(m.pointsBalance)}</td>}
                {joined && <td>{m.tier ? <TierBadge name={m.tier.name} /> : <span className="muted">–</span>}</td>}
                <td>
                  {joined ? (
                    m.memberSince ? (
                      format.date(m.memberSince)
                    ) : (
                      <span className="muted">–</span>
                    )
                  ) : (
                    format.date(m.createdAt)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ListMore
        shown={members.length}
        size={size}
        total={total}
        loading={loading}
        onMore={() => setSize(size + config.pageSize)}
      />

      {inviting && (
        <InviteMemberDialog
          onClose={() => setInviting(false)}
          onInvited={(member) => navigate(`/members/${member.id}`)}
        />
      )}
      {importing && <ImportMembersDialog onClose={() => setImporting(false)} />}
    </section>
  );
}

/** Every member (or everyone not joined yet) as a CSV file Excel opens, with Jalali dates in Persian. */
function ExportButton({ joined }: { joined: boolean }) {
  const { t } = useI18n();
  const format = useFormat();
  const client = useApolloClient();
  const { organization } = useCurrentVenue();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);

  async function exportAll() {
    setBusy(true);
    setFailed(null);
    try {
      const all: MemberSummary[] = [];
      for (let page = 0; all.length < EXPORT_MAX; page++) {
        const { data } = await client.query({
          query: MEMBERS,
          variables: { organizationId: organization.id, joined, page, size: EXPORT_PAGE },
          fetchPolicy: 'network-only',
        });
        const rows = data?.members ?? [];
        all.push(...rows);
        if (rows.length < EXPORT_PAGE) break;
      }
      const header = joined
        ? [t('member.name'), t('member.mobile'), t('member.balance'), t('members.tier'), t('member.since')]
        : [t('member.name'), t('member.mobile'), t('members.added')];
      const rows = all.map((m) =>
        joined
          ? [
              m.name,
              m.mobile ? nationalMobile(m.mobile) : '',
              m.pointsBalance,
              m.tier?.name ?? '',
              m.memberSince ? format.date(m.memberSince) : '',
            ]
          : [m.name, m.mobile ? nationalMobile(m.mobile) : '', format.date(m.createdAt)],
      );
      const day = new Date().toISOString().slice(0, 10);
      download(`${organization.slug}-${joined ? 'members' : 'not-joined'}-${day}.csv`, toCsv([header, ...rows]));
    } catch (e) {
      setFailed(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => void exportAll()} disabled={busy}>
        {busy ? t('common.loading') : t('members.export')}
      </Button>
      {failed != null && <ErrorBanner error={failed} />}
    </>
  );
}
