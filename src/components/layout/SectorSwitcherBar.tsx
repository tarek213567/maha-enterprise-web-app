import React from 'react';
import { useSector, SECTORS } from '../../context/SectorContext';

interface SectorSwitcherBarProps {
  className?: string;
  compact?: boolean;
}

export const SectorSwitcherBar: React.FC<SectorSwitcherBarProps> = ({ className = '', compact = false }) => {
  const { activeSector, setActiveSector } = useSector();

  return (
    <div
      className={`hidden md:block w-full bg-white dark:bg-black rounded-xl sm:rounded-2xl border border-neutral-200 dark:border-neutral-800 p-1.5 sm:p-2 shadow-xs transition-all ${className}`}
      role="tablist"
      aria-label="সেক্টর নির্বাচন বার"
    >
      {/* Responsive layout: 2x2 grid on very small screens, 4-column inline strip on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {SECTORS.map((s) => {
          const isActive = activeSector === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSector(s.id)}
              className={`relative flex items-center justify-center gap-1.5 sm:gap-2.5 px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer select-none ${
                isActive
                  ? 'bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white shadow-xs scale-[1.01]'
                  : 'bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 active:scale-95'
              }`}
              title={s.description}
            >
              <span className="text-base sm:text-lg leading-none">{s.icon}</span>
              <span className="tracking-wide font-sans">{s.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
