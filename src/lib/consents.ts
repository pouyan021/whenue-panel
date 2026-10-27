import type { ConsentPurpose } from '../graphql/operations';
import type { MessageKey } from '../i18n/en';

export const CONSENT_PURPOSES: ConsentPurpose[] = [
  'CLUB_MEMBERSHIP',
  'MARKETING_SMS',
  'TESTIMONIAL_RECORDING',
  'PUBLISH_IN_CLINIC',
  'PUBLISH_ON_WEBSITE',
  'PUBLISH_ON_SOCIAL_MEDIA',
];

export const CONSENT_PURPOSE: Record<ConsentPurpose, MessageKey> = {
  CLUB_MEMBERSHIP: 'consent.purpose.membership',
  MARKETING_SMS: 'consent.purpose.marketingSms',
  TESTIMONIAL_RECORDING: 'consent.purpose.recording',
  PUBLISH_IN_CLINIC: 'consent.purpose.inClinic',
  PUBLISH_ON_WEBSITE: 'consent.purpose.website',
  PUBLISH_ON_SOCIAL_MEDIA: 'consent.purpose.social',
};


export const TESTIMONIAL_PURPOSES: ConsentPurpose[] = [
  'TESTIMONIAL_RECORDING',
  'PUBLISH_IN_CLINIC',
  'PUBLISH_ON_WEBSITE',
  'PUBLISH_ON_SOCIAL_MEDIA',
];

/**
 * Version of the paper form's wording. Raise it whenever the wording below changes, so each
 * recorded consent still says which wording the member signed.
 */
export const PAPER_CONSENT_VERSION = 'paper-fa-v1';

/**
 * The wording of the clinic's paper consent form, in Persian because that is what members sign.
 * It is stored with every consent staff enter. Draft wording: to be checked by a lawyer.
 */
export function paperConsentText(purpose: ConsentPurpose, clinic: string) {
  switch (purpose) {
    case 'CLUB_MEMBERSHIP':
      return `با عضویت در باشگاه مشتریان ${clinic} موافقم. نام و شماره موبایل من و سوابق امتیازهایم برای اداره باشگاه نگهداری می‌شود و هر زمان می‌توانم از باشگاه خارج شوم.`;
    case 'MARKETING_SMS':
      return `موافقم ${clinic} پیشنهادها و خبرهای باشگاه را با پیامک برایم بفرستد. هر زمان می‌توانم این موافقت را پس بگیرم.`;
    case 'TESTIMONIAL_RECORDING':
      return `موافقم ویدیویی از تجربه‌ام در ${clinic} ضبط و برای بررسی کلینیک نگهداری شود. با پس گرفتن این موافقت، ویدیو پاک می‌شود.`;
    case 'PUBLISH_IN_CLINIC':
      return `موافقم ویدیوی تجربه‌ام در محل ${clinic} نمایش داده شود.`;
    case 'PUBLISH_ON_WEBSITE':
      return `موافقم ویدیوی تجربه‌ام در وب‌سایت ${clinic} نمایش داده شود.`;
    case 'PUBLISH_ON_SOCIAL_MEDIA':
      return `موافقم ویدیوی تجربه‌ام در شبکه‌های اجتماعی ${clinic} منتشر شود.`;
  }
}
