import { useRouteError } from 'react-router';

import { useI18n } from '../i18n/i18n';
import { Button } from './ui';

/**
 * Shown in place of a page that crashed while rendering, so one broken page does not blank the
 * whole panel. The raw message is for developers, so it goes to the console, not on screen.
 */
export function RouteError() {
  const { t } = useI18n();
  const error = useRouteError();
  console.error(error);
  return (
    <div role="alert">
      <p className="error-banner">{t('error.generic')}</p>
      <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
    </div>
  );
}
