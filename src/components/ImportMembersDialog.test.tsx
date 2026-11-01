import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { IMPORT_PEOPLE } from '../graphql/operations';
import { orgAdmin, renderPage } from '../test/render';
import { ImportMembersDialog, toRow } from './ImportMembersDialog';

const csv = [
  'شماره پرونده,نام بیمار,تلفن همراه',
  'F-1,سارا احمدی,0912 123 4567',
  'F-2,,09351112233',
  'F-3,نیما,021 2222 3333',
  'F-4,علی,',
].join('\n');

describe('ImportMembersDialog', () => {
  it('maps the columns, skips rows it cannot send and reports what the server did', async () => {
    const user = userEvent.setup();
    renderPage(
      <ImportMembersDialog onClose={() => undefined} />,
      [
        {
          request: {
            query: IMPORT_PEOPLE,
            variables: {
              organizationId: '5',
              invite: false,
              rows: [
                { name: 'سارا احمدی', mobile: '09121234567', externalRef: 'F-1' },
                { name: 'علی', mobile: null, externalRef: 'F-4' },
              ],
            },
          },
          result: {
            data: {
              importPeople: {
                __typename: 'PeopleImport',
                created: 1,
                updated: 0,
                invited: 0,
                failed: [{ __typename: 'PersonImportError', row: 1, message: 'Clash' }],
              },
            },
          },
        },
      ],
      { me: orgAdmin },
    );

    await user.upload(screen.getByLabelText(/^File/), new File([csv], 'patients.csv', { type: 'text/csv' }));

    expect(await screen.findByText('2 rows ready to import, 2 skipped.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name column')).toHaveValue('1');
    expect(screen.getByLabelText('Mobile column')).toHaveValue('2');
    expect(screen.getByLabelText('File number column')).toHaveValue('0');

    await user.click(screen.getByRole('button', { name: 'Import 2 rows' }));

    expect(await screen.findByText('Done: 1 added, 0 already on the list, 0 invited.')).toBeInTheDocument();
    expect(screen.getByText('3 rows were not imported')).toBeInTheDocument();
    // Lines count from the top of the file, title row included.
    expect(screen.getByText('Row 3:').parentElement).toHaveTextContent('No name');
    expect(screen.getByText('Row 4:').parentElement).toHaveTextContent('Not a mobile number');
    expect(screen.getByText('Row 5:').parentElement).toHaveTextContent('Clash');
  });
});

describe('toRow', () => {
  const mapping = { name: 0, mobile: 1, externalRef: -1 };
  it('needs a name and a way to find the person', () => {
    expect(toRow(['Sara', '9121234567'], mapping)).toEqual({ name: 'Sara', mobile: '09121234567', externalRef: null });
    expect(toRow(['Sara', ''], mapping)).toBe('noContact');
    expect(toRow(['', '09121234567'], mapping)).toBe('noName');
    expect(toRow(['Sara', '12'], mapping)).toBe('badMobile');
  });
});
