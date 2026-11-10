'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  translate,
  type Language,
} from '@/lib/i18n/messages';

const STORAGE_KEY = 'withyouly-language';
const COOKIE_KEY = 'withyouly-language';

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalize(value: string | null | undefined): Language | null {
  if (!value) return null;
  const base = value.toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as Language) : null;
}

export function I18nProvider({
  initialLanguage = DEFAULT_LANGUAGE,
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    const stored = normalize(window.localStorage.getItem(STORAGE_KEY));
    if (stored && stored !== language) {
      setLanguageState(stored);
    }
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* storage is optional */
    }
    document.cookie = `${COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(normalize(next) ?? DEFAULT_LANGUAGE);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
