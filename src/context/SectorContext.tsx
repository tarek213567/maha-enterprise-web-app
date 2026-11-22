import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SectorFilter, SectorType } from '../types';

export interface SectorItem {
  id: SectorFilter;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const SECTORS: SectorItem[] = [
  { id: 'all', label: '🌐 সব সেক্টর', shortLabel: 'সব সেক্টর', icon: '🌐', description: 'সকল শস্য ও গুদামের সম্মিলিত ভিউ' },
  { id: 'jute', label: '🌿 পাট', shortLabel: 'পাট', icon: '🌿', description: 'তোষা, মেস্তা ও দেশি/বগি পাট (ওজনভিত্তিক)' },
  { id: 'maize', label: '🌽 ভুট্টা', shortLabel: 'ভুট্টা', icon: '🌽', description: 'শুকনা ও কাঁচা/ভিজা হলুদ ভুট্টা' },
  { id: 'mustard', label: '🌼 সরিষা', shortLabel: 'সরিষা', icon: '🌼', description: 'মাঘী, টোরি-৭ ও রাই সরিষা' },
];

export function getSectorLabel(sector?: SectorType | SectorFilter | null): string {
  if (!sector || sector === 'all') return '🌐 সব সেক্টর';
  if (sector === 'jute') return '🌿 পাট';
  if (sector === 'maize') return '🌽 ভুট্টা';
  if (sector === 'mustard') return '🌼 সরিষা';
  if (sector === 'general') return '🏢 সাধারণ অফিস খরচ';
  return sector;
}

export function isJute(item?: any): boolean {
  if (!item) return false;
  if (typeof item === 'string') {
    return item === 'jute' || item.includes('পাট');
  }
  if (item.sector === 'jute') return true;
  if (item.name && typeof item.name === 'string' && item.name.includes('পাট')) return true;
  if (item.name_bn && typeof item.name_bn === 'string' && item.name_bn.includes('পাট')) return true;
  if (item.commodity_name && typeof item.commodity_name === 'string' && item.commodity_name.includes('পাট')) return true;
  return false;
}

interface SectorContextValue {
  activeSector: SectorFilter;
  setActiveSector: (s: SectorFilter) => void;
  sectors: SectorItem[];
  getSectorLabel: (sector?: SectorType | SectorFilter | null) => string;
  isJute: (item?: any) => boolean;
}

const SectorContext = createContext<SectorContextValue>({
  activeSector: 'all',
  setActiveSector: () => {},
  sectors: SECTORS,
  getSectorLabel,
  isJute,
});

export const SectorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSector, setActiveSectorState] = useState<SectorFilter>(() => {
    try {
      const saved = localStorage.getItem('maha_active_sector');
      if (saved === 'jute' || saved === 'maize' || saved === 'mustard' || saved === 'all') {
        return saved;
      }
    } catch (_) {}
    return 'all';
  });

  const setActiveSector = (s: SectorFilter) => {
    setActiveSectorState(s);
    try {
      localStorage.setItem('maha_active_sector', s);
    } catch (_) {}
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'maha_active_sector' && e.newValue) {
        if (['all', 'jute', 'maize', 'mustard'].includes(e.newValue)) {
          setActiveSectorState(e.newValue as SectorFilter);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <SectorContext.Provider
      value={{
        activeSector,
        setActiveSector,
        sectors: SECTORS,
        getSectorLabel,
        isJute,
      }}
    >
      {children}
    </SectorContext.Provider>
  );
};

export const useSector = (): SectorContextValue => useContext(SectorContext);

