import React, { useState, useEffect } from 'react';
import { Clock as ClockIcon, Calendar as CalendarIcon } from 'lucide-react';

interface LiveClockProps {
  className?: string;
  variant?: 'hero' | 'compact' | 'detailed';
  showSeconds?: boolean;
}

export const LiveClock: React.FC<LiveClockProps> = ({
  className = '',
  variant = 'hero',
  showSeconds = true,
}) => {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    // Update immediately every 1000ms
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format date: "Saturday, September 26, 2026"
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(time);

  // Format time: "11:24:05 AM" or with user's local timezone
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(time);

  // Timezone abbreviation (e.g., PDT, EST, GMT+1)
  const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const shortTz = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short',
  })
    .formatToParts(time)
    .find((p) => p.type === 'timeZoneName')?.value || '';

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 text-xs font-mono ${className}`}>
        <span className="text-slate-300 font-medium">{formattedDate}</span>
        <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-rose-400 font-bold">{formattedTime}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs sm:text-sm font-sans select-none ${className}`}
      aria-label={`Current Date and Time: ${formattedDate}, ${formattedTime}`}
    >
      {/* Date badge */}
      <div className="flex items-center gap-1.5 text-slate-200 font-medium">
        <CalendarIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span className="tracking-wide">{formattedDate}</span>
      </div>

      <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-white/20" />

      {/* Live Time with ticking indicator */}
      <div className="flex items-center gap-1.5 font-mono">
        <ClockIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-bold tracking-wider text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 shadow-inner">
          {formattedTime}
        </span>
        <span className="text-[10px] uppercase font-semibold text-sky-300/80 tracking-wider">
          GMT+3
        </span>
      </div>
    </div>
  );
};
