import { useMutation } from '@apollo/client/react';
import { useState } from 'react';

import { IMPORT_PEOPLE, type PersonImportInput } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { cleanMobile, guessColumns, hasHeader, readTable, type Column, type Table } from '../lib/spreadsheet';
import { useCurrentVenue } from '../lib/venue';
import { Button, Dialog, ErrorBanner, Field } from './ui';

const CHUNK = 500;
const MAX_ROWS = 20_000;
const COLUMNS: Column[] = ['name', 'mobile', 'externalRef'];

type Mapping = Record<Column, number>;
type Outcome = { created: number; updated: number; invited: number; failed: { line: number; message: string }[] };

/** One row of the file as the API gets it, or why it is skipped before sending. */
export function toRow(cells: string[], mapping: Mapping): PersonImportInput | 'noName' | 'noContact' | 'badMobile' {
  const cell = (column: Column) => (mapping[column] >= 0 ? (cells[mapping[column]] ?? '').trim() : '');
  const name = cell('name');
  const rawMobile = cell('mobile');
  const mobile = rawMobile ? cleanMobile(rawMobile) : null;
  const externalRef = cell('externalRef');
  if (rawMobile && !mobile) return 'badMobile';
  if (!mobile && !externalRef) return 'noContact';
  if (!name) return 'noName';
  return { name, mobile, externalRef: externalRef || null };
}

/** Owners bring their existing patient list from Excel or CSV; people join the club themselves later. */
export function ImportMembersDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const format = useFormat();
  const { organization } = useCurrentVenue();
  const [importPeople, { error }] = useMutation(IMPORT_PEOPLE, { refetchQueries: ['Members'] });
  const [table, setTable] = useState<Table | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [header, setHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({ name: -1, mobile: -1, externalRef: -1 });
  const [invite, setInvite] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    setOutcome(null);
    try {
      const rows = await readTable(file);
      if (rows.length === 0) throw new Error('empty');
      if (rows.length > MAX_ROWS) throw new Error('tooBig');
      const titled = hasHeader(rows);
      setTable(rows);
      setHeader(titled);
      setMapping(titled ? guessColumns(rows[0]) : { name: 0, mobile: 1, externalRef: -1 });
    } catch (e) {
      const reason = e instanceof Error ? e.message : '';
      setTable(null);
      setFileError(
        reason === 'xls'
          ? t('import.xls')
          : reason === 'empty'
            ? t('import.empty')
            : reason === 'tooBig'
              ? t('import.tooBig', { max: format.number(MAX_ROWS) })
              : t('import.unreadable'),
      );
    }
  }

  const width = table ? Math.max(...table.map((r) => r.length)) : 0;
  const titles = table && header ? table[0] : Array.from({ length: width }, (_, i) => t('import.columnN', { n: format.number(i + 1) }));
  const firstLine = header ? 2 : 1;
  const body = table ? table.slice(header ? 1 : 0) : [];
  const checked = body.map((cells) => toRow(cells, mapping));
  const ready = checked.flatMap((row, i) => (typeof row === 'object' ? [{ row, line: i + firstLine }] : []));
  const skipped = checked.flatMap((row, i) => (typeof row === 'string' ? [{ reason: row, line: i + firstLine }] : []));

  async function submit() {
    const total: Outcome = { created: 0, updated: 0, invited: 0, failed: [] };
    setProgress(0);
    for (let start = 0; start < ready.length; start += CHUNK) {
      const chunk = ready.slice(start, start + CHUNK);
      const result = await importPeople({
        variables: { organizationId: organization.id, rows: chunk.map((r) => r.row), invite },
      }).catch(() => null);
      if (!result?.data) {
        setProgress(null);
        return;
      }
      const r = result.data.importPeople;
      total.created += r.created;
      total.updated += r.updated;
      total.invited += r.invited;
      total.failed.push(...r.failed.map((f) => ({ line: chunk[f.row].line, message: f.message })));
      setProgress(Math.min(ready.length, start + CHUNK));
    }
    setProgress(null);
    setOutcome(total);
  }

  if (outcome) {
    return (
      <Dialog title={t('import.title')} onClose={onClose} wide>
        <div className="stack">
          <p role="status" className="success">
            {t('import.done', {
              created: format.number(outcome.created),
              updated: format.number(outcome.updated),
              invited: format.number(outcome.invited),
            })}
          </p>
          <IssueList
            title={t('import.failedRows', { count: format.number(outcome.failed.length + skipped.length) })}
            items={[
              ...skipped.map((s) => ({ line: s.line, message: t(`import.skip.${s.reason}`) })),
              ...outcome.failed,
            ].sort((a, b) => a.line - b.line)}
          />
          <p className="muted">{t('import.notMembersYet')}</p>
          <div className="form-actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={t('import.title')} onClose={onClose} wide>
      <div className="stack">
        <p className="muted">{t('import.intro')}</p>
        <Field label={t('import.file')} hint={t('import.fileHint')}>
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </Field>
        {fileError && (
          <p role="alert" className="error-banner">
            {fileError}
          </p>
        )}

        {table && (
          <>
            <label className="checkbox">
              <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />
              {t('import.hasHeader')}
            </label>
            <div className="import-mapping">
              {COLUMNS.map((column) => (
                <Field key={column} label={t(`import.map.${column}`)}>
                  <select
                    value={mapping[column]}
                    onChange={(e) => setMapping({ ...mapping, [column]: Number(e.target.value) })}
                  >
                    <option value={-1}>{t('import.none')}</option>
                    {titles.map((title, i) => (
                      <option key={i} value={i}>
                        {title || t('import.columnN', { n: format.number(i + 1) })}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('import.line')}</th>
                    <th>{t('member.name')}</th>
                    <th>{t('member.mobile')}</th>
                    <th>{t('import.externalRef')}</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td>{format.number(i + firstLine)}</td>
                      {typeof row === 'object' ? (
                        <>
                          <td>{row.name}</td>
                          <td dir="ltr">{row.mobile ?? ''}</td>
                          <td dir="ltr">{row.externalRef ?? ''}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="muted">
                          {t(`import.skip.${row}`)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              {t('import.summary', { ready: format.number(ready.length), skipped: format.number(skipped.length) })}
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
              {t('import.invite')}
            </label>
            {invite && <p className="muted">{t('import.inviteHint')}</p>}
          </>
        )}

        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!table || ready.length === 0 || progress != null || mapping.name < 0}
            onClick={() => void submit()}
          >
            {progress != null
              ? t('import.progress', { done: format.number(progress), total: format.number(ready.length) })
              : t('import.submit', { count: format.number(ready.length) })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function IssueList({ title, items }: { title: string; items: { line: number; message: string }[] }) {
  const { t } = useI18n();
  const format = useFormat();
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="issue-title">{title}</h3>
      <ul className="issue-list">
        {items.slice(0, 50).map((item) => (
          <li key={`${item.line}-${item.message}`}>
            <span className="muted">{t('import.lineN', { n: format.number(item.line) })}</span> {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
