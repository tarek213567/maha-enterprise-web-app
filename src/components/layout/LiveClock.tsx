import React, { useState, useEffect, memo } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { toBnDigits } from '../../utils/bengaliNumbers';

const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const months = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

/**
 * LiveClock: Isolated memoized clock/date component
 * Updates strictly internally on a 60-second timer to avoid triggering
 * unnecessary re-renders of parent layouts, views, or database tables.
 */
export const LiveClock: React.FC = memo(() => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    // 60-second gentle interval with strict cleanup
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const formattedDate = `${days[currentDate.getDay()]}, ${toBnDigits(currentDate.getDate())} ${
    months[currentDate.getMonth()]
  } ${toBnDigits(currentDate.getFullYear())}`;

  return (
    <div className="hidden xl:flex items-center gap-3 bg-[var(--surface-secondary)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-secondary)] font-medium">
      <div className="flex items-center gap-1 text-[var(--text-muted)] text-[11px]">
        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
        <span>চাচকৈড় বাজার, নাটোর</span>
      </div>
      <span className="text-[var(--border-color)]">|</span>
      <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] text-xs">
        <Calendar className="w-3.5 h-3.5 text-amber-400" />
        <span>{formattedDate}</span>
      </div>
    </div>
  );
});

LiveClock.displayName = 'LiveClock';
export default LiveClock;

