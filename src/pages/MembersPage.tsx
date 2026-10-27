import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { InviteMemberDialog, Mobile, memberName } from '../components/members';
import { Button, Empty, ErrorBanner, Loading } from '../components/ui';
import { MEMBERS } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { config } from '../lib/config';
import { useFormat } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

/** People who joined the club; invited people appear once they accept. */
export function MembersPage() {
  const { t } = useI18n();
  const format = useFormat();
  const navigate = useNavigate();
  const { organization } = useCurrentVenue();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [size, setSize] = useState(config.pageSize);
  const [inviting, setInviting] = useState(false);
  const { data, loading, error } = useQuery(MEMBERS, {
    variables: { organizationId: organization.id, search: search.trim() || null, page: 0, size },
  });
  const members = data?.members ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('members.title')}</h1>
        <Button variant="primary" onClick={() => setInviting(true)}>
          {t('members.invite')}
        </Button>
      </header>

      <input
        type="search"
        className="search"
        placeholder={t('members.search')}
        aria-label={t('members.search')}
        value={search}
        onChange={(e) => {
          setSize(config.pageSize);
          setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
        }}
      />

      <ErrorBanner error={error} />
      {loading && members.length === 0 ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty>{search ? t('members.noMatch') : t('members.empty')}</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('member.name')}</th>
              <th>{t('member.mobile')}</th>
              <th>{t('member.balance')}</th>
              <th>{t('member.since')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/members/${m.id}`}>{memberName(m, t('member.noName'))}</Link>
                </td>
                <td>
                  <Mobile value={m.mobile} />
                </td>
                <td>{format.points(m.pointsBalance)}</td>
                <td>{m.memberSince ? format.date(m.memberSince) : <span className="muted">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {members.length === size && (
        <div className="more">
          <Button onClick={() => setSize(size + config.pageSize)} disabled={loading}>
            {t('common.showMore')}
          </Button>
        </div>
      )}

      {inviting && (
        <InviteMemberDialog
          onClose={() => setInviting(false)}
          onInvited={(member) => navigate(`/members/${member.id}`)}
        />
      )}
    </section>
  );
}
