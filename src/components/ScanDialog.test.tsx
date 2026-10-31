import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../i18n/i18n';
import { ScanDialog } from './ScanDialog';

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true });
}

function renderScan() {
  return render(
    <I18nProvider lang="en">
      <ScanDialog onScanned={vi.fn()} onClose={vi.fn()} />
    </I18nProvider>,
  );
}

describe('ScanDialog', () => {
  afterEach(() => setMediaDevices(undefined));

  it('says when the browser has no camera access', () => {
    setMediaDevices(undefined);
    renderScan();
    expect(screen.getByRole('alert')).toHaveTextContent(/https|No camera/);
  });

  it('explains a refused camera permission', async () => {
    setMediaDevices({ getUserMedia: () => Promise.reject(new DOMException('no', 'NotAllowedError')) });
    renderScan();
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed to use the camera');
  });

  it('shows the camera while it waits for a card', () => {
    setMediaDevices({ getUserMedia: () => new Promise(() => undefined) });
    renderScan();
    expect(screen.getByLabelText('Camera')).toBeInTheDocument();
    expect(screen.getByText(/Hold the member's club card/)).toBeInTheDocument();
  });
});
