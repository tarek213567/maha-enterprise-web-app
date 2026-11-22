import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dbService } from '../services/api';

export type ThemeId =
  | 'dark'
  | 'light'
  | 'obsidian-gold'
  | 'royal-sapphire'
  | 'emerald-rice'
  | 'midnight-oled'
  | 'deep-ocean'
  | 'vintage-amber'
  | 'nordic-slate'
  | 'luxury-ruby'
  | string;

export type DigitMode = 'BN' | 'EN';

export interface ThemeColors {
  sidebar: string;
  sidebarActive: string;
  header: string;
  primary: string;
  success: string;
  mainBg: string;
  cardBg: string;
  primaryText: string;
  border: string;
  goldAccent?: string;
  mutedText?: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  englishName: string;
  style: string;
  description: string;
  badge: string;
  isDark: boolean;
  colors: ThemeColors;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'পিউর ব্ল্যাক (ডার্ক)',
    englishName: 'Pure Black Dark Mode',
    style: 'Pure Pitch Black / High Contrast White',
    description: 'চোখের আরামদায়ক ১০০% পিচ-ব্ল্যাক ব্যাকগ্রাউন্ড ও উজ্জ্বল সাদা টেক্সট।',
    badge: 'ডিফল্ট ডার্ক',
    isDark: true,
    colors: {
      sidebar: '#000000',
      sidebarActive: '#FFFFFF',
      header: '#000000',
      mainBg: '#000000',
      cardBg: '#0A0A0A',
      primaryText: '#FFFFFF',
      mutedText: '#A3A3A3',
      goldAccent: '#FFFFFF',
      primary: '#FFFFFF',
      success: '#FFFFFF',
      border: '#262626',
    },
  },
  {
    id: 'light',
    name: 'পিউর হোয়াইট (লাইট)',
    englishName: 'Pure White Light Mode',
    style: 'Pure Crisp White / High Contrast Black',
    description: 'উজ্জ্বল ১০০% পিউর হোয়াইট ব্যাকগ্রাউন্ড ও স্পষ্ট কালো টেক্সট।',
    badge: 'লাইট মোড',
    isDark: false,
    colors: {
      sidebar: '#FFFFFF',
      sidebarActive: '#000000',
      header: '#FFFFFF',
      primary: '#000000',
      success: '#000000',
      mainBg: '#FFFFFF',
      cardBg: '#FFFFFF',
      primaryText: '#000000',
      border: '#E5E5E5',
      mutedText: '#525252',
    },
  },
];

interface ThemeContextType {
  theme: ThemeId;
  digitMode: DigitMode;
  isDark: boolean;
  themes: ThemeDefinition[];
  currentThemeDef: ThemeDefinition;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  toggleDigitMode: () => void;
}

const DEFAULT_THEME: ThemeId = 'dark';
const STORAGE_KEY = 'maha_theme';

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  digitMode: 'BN',
  isDark: true,
  themes: THEMES,
  currentThemeDef: THEMES[0],
  setTheme: () => {},
  toggleTheme: () => {},
  toggleDigitMode: () => {},
});

function normalizeTheme(t: any): 'dark' | 'light' {
  if (t === 'light' || t === 'royal-sapphire' || t === 'nordic-slate' || t === 'emerald-rice') {
    return 'light';
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeTheme(saved);
    } catch {}
    return DEFAULT_THEME;
  });

  const [digitMode, setDigitMode] = useState<DigitMode>(() => {
    return (localStorage.getItem('maha_digits') as DigitMode) || 'BN';
  });

  const isDark = normalizeTheme(theme) === 'dark';
  const currentThemeDef = isDark ? THEMES[0] : THEMES[1];

  // Apply theme attributes to documentElement
  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = isDark ? 'dark' : 'light';
    root.setAttribute('data-theme', resolvedTheme);
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem(STORAGE_KEY, resolvedTheme);
  }, [theme, isDark]);

  useEffect(() => {
    localStorage.setItem('maha_digits', digitMode);
  }, [digitMode]);

  // Load saved settings from SQLite backend
  useEffect(() => {
    dbService.system
      .getSettings()
      .then((settings) => {
        if (settings.theme_mode) {
          setThemeState(normalizeTheme(settings.theme_mode));
        }
        if (settings.digit_display && (settings.digit_display === 'BN' || settings.digit_display === 'EN')) {
          setDigitMode(settings.digit_display);
        }
      })
      .catch(console.error);
  }, []);

  const setTheme = (newTheme: ThemeId) => {
    const normalized = normalizeTheme(newTheme);
    setThemeState(normalized);
    dbService.system.updateSetting('theme_mode', normalized).catch(console.error);
  };

  const toggleTheme = () => {
    const nextTheme: ThemeId = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const toggleDigitMode = () => {
    const nextMode: DigitMode = digitMode === 'BN' ? 'EN' : 'BN';
    setDigitMode(nextMode);
    dbService.system.updateSetting('digit_display', nextMode).catch(console.error);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        digitMode,
        isDark,
        themes: THEMES,
        currentThemeDef,
        setTheme,
        toggleTheme,
        toggleDigitMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
