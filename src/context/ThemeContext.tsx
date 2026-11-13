import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dbService } from '../services/api';

export type ThemeId =
  | 'obsidian-gold'
  | 'royal-sapphire'
  | 'emerald-rice'
  | 'midnight-oled'
  | 'deep-ocean'
  | 'vintage-amber'
  | 'nordic-slate'
  | 'luxury-ruby';

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
    id: 'obsidian-gold',
    name: 'অবসিডিয়ান গোল্ড (ডার্ক)',
    englishName: 'Obsidian Gold Dark',
    style: 'Luxury Dark / Charcoal / Gold',
    description: 'চোখের আরামদায়ক গভীর ডার্ক চারকোল ব্যাকগ্রাউন্ড এবং উজ্জ্বল রাজকীয় সোনালী বাটন ও হেডিং।',
    badge: 'ডিফল্ট থিম',
    isDark: true,
    colors: {
      sidebar: '#070b14',
      sidebarActive: '#1e293b',
      header: '#070b14',
      mainBg: '#0b111e',
      cardBg: '#111927',
      primaryText: '#f8fafc',
      mutedText: '#94a3b8',
      goldAccent: '#f59e0b',
      primary: '#f59e0b',
      success: '#10b981',
      border: '#1e293b',
    },
  },
  {
    id: 'royal-sapphire',
    name: 'লাইট মোড',
    englishName: 'Light Mode',
    style: 'Classic Slate Light / Dark Sidebar',
    description: 'উজ্জ্বল সাদা ও স্লেট ব্যাকগ্রাউন্ড এবং স্থায়ী ডার্ক সাইডবার সমৃদ্ধ ক্লাসিক ব্যবসায়িক ইন্টারফেস।',
    badge: 'লাইট মোড',
    isDark: false,
    colors: {
      sidebar: '#0b1528',
      sidebarActive: '#1678e8',
      header: '#070b14',
      primary: '#1678e8',
      success: '#059669',
      mainBg: '#f1f5f9',
      cardBg: '#ffffff',
      primaryText: '#0f172a',
      border: '#e2e8f0',
      mutedText: '#64748b',
    },
  },
  {
    id: 'emerald-rice',
    name: 'এমারেল্ড গ্রিন',
    englishName: 'Emerald Agricultural Premium',
    style: 'Premium Green / Ivory / Soft Gold',
    description: 'শস্য আড়ত ও পাইকারি ব্যবসার উপযোগী গাঢ় পান্না সবুজ, হাতির দাঁত সাদা এবং সোনালী আভা।',
    badge: 'কৃষি ও বাণিজ্য',
    isDark: false,
    colors: {
      sidebar: '#145943',
      sidebarActive: '#24754B',
      header: '#145943',
      primary: '#24754B',
      goldAccent: '#D5AB57',
      mainBg: '#F2F7F1',
      cardBg: '#FFFFFF',
      primaryText: '#25483C',
      border: '#DBE8DD',
      success: '#1E824C',
      mutedText: '#537467',
    },
  },
  {
    id: 'midnight-oled',
    name: 'মিডনাইট ওলেড',
    englishName: 'Midnight OLED Black',
    style: 'Pitch-Black / Neon Cyan Glow',
    description: 'গভীর পিচ-ব্ল্যাক ব্যাকগ্রাউন্ড ও নিয়ন সাইয়ান একসেন্ট যা রাতের কাজে দারুণ সুবিধা দেয়।',
    badge: 'ওলেড নিয়ন',
    isDark: true,
    colors: {
      sidebar: '#000000',
      sidebarActive: '#082F49',
      header: '#000000',
      primary: '#06B6D4',
      goldAccent: '#22D3EE',
      mainBg: '#020617',
      cardBg: '#090D16',
      primaryText: '#F0FDFA',
      border: '#1E293B',
      success: '#10B981',
      mutedText: '#64748B',
    },
  },
  {
    id: 'deep-ocean',
    name: 'ডিপ ওশান ইন্ডিগো',
    englishName: 'Deep Ocean Indigo',
    style: 'Regal Navy / Purple & Indigo Glow',
    description: 'রাজকীয় নেভি ব্লু ও মার্জিত পার্পল গ্লো সমৃদ্ধ আধুনিক ইন্টারফেস।',
    badge: 'নেভি ইন্ডিগো',
    isDark: true,
    colors: {
      sidebar: '#0A1128',
      sidebarActive: '#1C2541',
      header: '#0A1128',
      primary: '#6366F1',
      goldAccent: '#818CF8',
      mainBg: '#060B18',
      cardBg: '#0F172A',
      primaryText: '#EEF2FF',
      border: '#1E293B',
      success: '#10B981',
      mutedText: '#818CF8',
    },
  },
  {
    id: 'vintage-amber',
    name: 'ভিন্টেজ অ্যাম্বার উড',
    englishName: 'Vintage Amber & Timber',
    style: 'Classic Timber / Rich Amber & Bronze',
    description: 'শস্য ব্যবসার ঐতিহ্যবাহী ক্লাসিক উডেন/ব্রোঞ্জ ও উষ্ণ অ্যাম্বার ভাইব।',
    badge: 'ঐতিহ্যবাহী ব্রোঞ্জ',
    isDark: true,
    colors: {
      sidebar: '#1C140E',
      sidebarActive: '#2B1F17',
      header: '#1C140E',
      primary: '#D97706',
      goldAccent: '#F59E0B',
      mainBg: '#140D08',
      cardBg: '#231812',
      primaryText: '#FEF3C7',
      border: '#452A1C',
      success: '#15803D',
      mutedText: '#B45309',
    },
  },
  {
    id: 'nordic-slate',
    name: 'নর্ডিক স্লেট লাইট',
    englishName: 'Nordic Minimal Slate',
    style: 'Clean Slate-Gray / Soft Light Card',
    description: 'চোখের আরামদায়ক ক্লিন স্লেট-গ্রে ও সফট হোয়াইট সম্বলিত ফ্রেশ ভিজ্যুয়াল লুক।',
    badge: 'মিনিমাল স্লেট',
    isDark: false,
    colors: {
      sidebar: '#1E293B',
      sidebarActive: '#334155',
      header: '#1E293B',
      primary: '#0284C7',
      goldAccent: '#0EA5E9',
      mainBg: '#F1F5F9',
      cardBg: '#FFFFFF',
      primaryText: '#0F172A',
      border: '#CBD5E1',
      success: '#059669',
      mutedText: '#64748B',
    },
  },
  {
    id: 'luxury-ruby',
    name: 'লাক্সারি রুবি ডার্ক',
    englishName: 'Luxury Ruby Dark',
    style: 'Deep Charcoal / Crimson Ruby Accent',
    description: 'ডিপ চারকোল ব্যাকগ্রাউন্ড ও রুবি রেড প্রিমিয়াম কনট্রাস্ট।',
    badge: 'লাক্সারি রুবি',
    isDark: true,
    colors: {
      sidebar: '#140A0D',
      sidebarActive: '#281119',
      header: '#140A0D',
      primary: '#E11D48',
      goldAccent: '#F43F5E',
      mainBg: '#0A0507',
      cardBg: '#180E12',
      primaryText: '#FFF1F2',
      border: '#371521',
      success: '#10B981',
      mutedText: '#FB7185',
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

const DEFAULT_THEME: ThemeId = 'obsidian-gold';
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

function isValidTheme(t: any): t is ThemeId {
  return THEMES.some((themeDef) => themeDef.id === t);
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isValidTheme(saved)) return saved;
      if (saved === 'dark') return 'obsidian-gold';
      if (saved === 'light') return 'royal-sapphire';
    } catch {}
    return DEFAULT_THEME;
  });

  const [digitMode, setDigitMode] = useState<DigitMode>(() => {
    return (localStorage.getItem('maha_digits') as DigitMode) || 'BN';
  });

  const currentThemeDef = THEMES.find((t) => t.id === theme) || THEMES[0];
  const isDark = currentThemeDef.isDark;

  // Apply theme attributes to documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
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
          if (isValidTheme(settings.theme_mode)) {
            setThemeState(settings.theme_mode);
          } else if (settings.theme_mode === 'dark') {
            setThemeState('obsidian-gold');
          } else if (settings.theme_mode === 'light') {
            setThemeState('royal-sapphire');
          }
        }
        if (settings.digit_display && (settings.digit_display === 'BN' || settings.digit_display === 'EN')) {
          setDigitMode(settings.digit_display);
        }
      })
      .catch(console.error);
  }, []);

  const setTheme = (newTheme: ThemeId) => {
    if (!isValidTheme(newTheme)) return;
    setThemeState(newTheme);
    dbService.system.updateSetting('theme_mode', newTheme).catch(console.error);
  };

  const toggleTheme = () => {
    // If currently dark, switch to royal-sapphire (light); if light, switch to obsidian-gold (dark)
    const nextTheme: ThemeId = isDark ? 'royal-sapphire' : 'obsidian-gold';
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
