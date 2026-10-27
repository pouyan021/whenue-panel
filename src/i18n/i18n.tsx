import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { en, type MessageKey } from './en';
import { fa } from './fa';

export type Lang = 'fa' | 'en';
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, fa };
const LANG_KEY = 'whenue.lang';

/** Persian unless the person picked English; clinics in Iran are the first users. */
export const DEFAULT_LANG: Lang = 'fa';

export function langOf(locale: string | null | undefined): Lang {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'fa';
}

export function translator(lang: Lang): Translate {
  const messages = MESSAGES[lang];
  return (key, vars) => {
    const text = messages[key];
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}

type I18n = {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Translate;
  /** The person's own choice, remembered on this browser. */
  setLang: (lang: Lang) => void;
  /** The organization's language, used until the person picks one. */
  adoptDefault: (lang: Lang) => void;
};

const I18nContext = createContext<I18n | null>(null);

function readLang(): Lang | null {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'fa' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ lang: fixed, children }: { lang?: Lang; children: ReactNode }) {
  const [chosen, setChosen] = useState<Lang | null>(() => fixed ?? readLang());
  const [fallback, setFallback] = useState<Lang>(DEFAULT_LANG);
  const lang = chosen ?? fallback;
  const dir = lang === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setChosen(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Not remembered across reloads.
    }
  }, []);

  const value = useMemo(
    () => ({ lang, dir, t: translator(lang), setLang, adoptDefault: setFallback }) satisfies I18n,
    [lang, dir, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n needs an I18nProvider');
  return i18n;
}
