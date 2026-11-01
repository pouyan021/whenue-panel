import { useSyncExternalStore } from 'react';

import { useI18n } from '../i18n/i18n';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Tells reception the connection dropped before they wonder why a check-in did not save. */
export function OfflineBanner() {
  const { t } = useI18n();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      {t('offline.banner')}
    </div>
  );
}
