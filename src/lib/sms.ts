// How many SMS parts a text takes, which is what operators charge for. Latin-only text fits the
// GSM alphabet (160 characters, 153 per part when split); anything else, Persian included, is
// sent as UCS-2 (70 characters, 67 per part).

const GSM = /^[\n\r @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
const NAME = '{name}';
/** Room left for a first name where {name} is; names are almost always in Persian. */
const NAME_ROOM = 8;

export type SmsSize = { characters: number; parts: number; unicode: boolean };

export function smsSize(text: string): SmsSize {
  const named = text.includes(NAME);
  const filled = text.split(NAME).join('x'.repeat(NAME_ROOM));
  const characters = [...filled].length;
  const unicode = named || !GSM.test(filled);
  const [single, part] = unicode ? [70, 67] : [160, 153];
  const parts = characters === 0 ? 0 : characters <= single ? 1 : Math.ceil(characters / part);
  return { characters, parts, unicode };
}
