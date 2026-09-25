import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import en from './en.json';
import ur from './ur.json';

type Dict = Record<string, any>;

const dictionaries: Record<string, Dict> = { en, ur };
const STORAGE_KEY = 'autozap-lang';
const SUPPORTED = ['en', 'ur'];

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  toggle: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLang(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch { /* ignore */ }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<string>(getInitialLang());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
    }
  }, [language]);

  const setLanguage = useCallback((lang: string) => {
    if (SUPPORTED.includes(lang)) setLangState(lang);
  }, []);

  const toggle = useCallback(() => {
    setLangState(prev => (prev === 'ur' ? 'en' : 'ur'));
  }, []);

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggle }}>
      {children}
    </I18nContext.Provider>
  );
}

function lookup(dict: Dict, key: string): string | undefined {
  return key.split('.').reduce<any>((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict);
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

export function useT() {
  const { language } = useI18n();
  const dict = dictionaries[language] || dictionaries.en;
  return useCallback((key: string, vars?: Record<string, string | number>): string => {
    const val: string = lookup(dict, key) ?? lookup(dictionaries.en, key) ?? key;
    if (vars && typeof val === 'string') {
      return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    }
    return val;
  }, [dict]);
}

export function LanguageToggle() {
  const { language, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      title={language === 'ur' ? 'Switch to English' : 'اردو میں تبدیل کریں'}
      className="px-3 py-2 bg-slate-700/30 hover:bg-slate-600/40 text-slate-300 hover:text-white rounded-xl transition-all text-sm font-semibold"
    >
      {language === 'ur' ? 'EN' : 'اردو'}
    </button>
  );
}
