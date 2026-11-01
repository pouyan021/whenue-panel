import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { memberIdFromCode } from '../lib/numbers';
import { Dialog } from './ui';

type Problem = 'insecure' | 'denied' | 'noCamera' | 'failed';

const PROBLEM_TEXT: Record<Problem, MessageKey> = {
  insecure: 'scan.insecure',
  denied: 'scan.denied',
  noCamera: 'scan.noCamera',
  failed: 'scan.failed',
};

/** Largest side of the frame we decode; smaller is faster and still reads a phone screen. */
const DECODE_SIZE = 480;

/** Missing on plain http (other than localhost) and in old browsers, whatever the types say. */
const mediaDevices = (): MediaDevices | undefined => navigator.mediaDevices;

/**
 * Reads a member card QR code with the device camera (a phone, tablet or webcam), so reception
 * does not need a USB scanner. Decoding is done in the browser with jsQR; no image leaves the device.
 */
export function ScanDialog({ onScanned, onClose }: { onScanned: (memberId: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<Problem | null>(() =>
    mediaDevices() ? null : window.isSecureContext ? 'noCamera' : 'insecure',
  );
  const [foreign, setForeign] = useState(false);
  const done = useRef(onScanned);
  useEffect(() => {
    done.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    const media = mediaDevices();
    if (!media) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const v = video.current;
      if (v && context && v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
        const scale = Math.min(1, DECODE_SIZE / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        context.drawImage(v, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const id = memberIdFromCode(code.data);
          if (id) {
            stopped = true;
            done.current(id);
            return;
          }
          setForeign(true);
        }
      }
      frame = requestAnimationFrame(tick);
    }

    media
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          void v.play().catch(() => undefined);
        }
        frame = requestAnimationFrame(tick);
      })
      .catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : '';
        setProblem(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'noCamera'
              : 'failed',
        );
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <Dialog title={t('scan.title')} onClose={onClose}>
      {problem ? (
        <p role="alert" className="error-banner">
          {t(PROBLEM_TEXT[problem])}
        </p>
      ) : (
        <>
          <div className="scan-view">
            <video ref={video} muted playsInline aria-label={t('scan.camera')} />
            <span className="scan-frame" aria-hidden="true" />
          </div>
          <p className="muted" aria-live="polite">
            {foreign ? t('scan.notACard') : t('scan.hint')}
          </p>
        </>
      )}
    </Dialog>
  );
}
