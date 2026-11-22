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
      className={`hidden md:block w-full bg-[#03150F]/90 backdrop-blur-md rounded-xl sm:rounded-2xl border border-[#D4AF37]/30 p-1.5 sm:p-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all ${className}`}
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
                  ? 'bg-gradient-to-r from-[#D4AF37]/25 via-[#0A3A2A]/80 to-[#D4AF37]/20 border border-[#D4AF37] text-[#FFEFA6] shadow-[0_0_15px_rgba(212,175,55,0.25)] scale-[1.01]'
                  : 'bg-[#062016]/60 hover:bg-[#0A2E20]/70 border border-[#D4AF37]/15 text-[#C4D9CC] hover:text-[#FFEFA6] hover:border-[#D4AF37]/35 active:scale-95'
              }`}
              title={s.description}
            >
              <span className="text-base sm:text-lg leading-none filter drop-shadow">{s.icon}</span>
              <span className="tracking-wide font-sans">{s.shortLabel}</span>

              {/* Active Indicator Light / Glow */}
              {isActive && (
                <span className="absolute bottom-1 w-6 sm:w-10 h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
