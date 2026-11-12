import React from 'react';
import { Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';

export const CalendarCard = ({
  events = [
    {
      time: '09:30 AM',
      title: 'Realtime Pipeline Sync',
      location: 'Main Voice Lounge',
      accent: 'var(--coral-a)'
    },
    {
      time: '02:00 PM',
      title: 'Flash AI Model Architecture',
      location: 'Virtual Room 4B',
      accent: 'var(--coral-b)'
    }
  ],
  className = ''
}) => {
  const today = new Date();
  const dayNumber = today.getDate();
  const weekdayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthYear = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate 7-day strip centered on current week
  const dayOfWeek = today.getDay(); // 0 is Sunday
  const startOffset = (dayOfWeek + 6) % 7; // Monday as 0
  const monday = new Date(today);
  monday.setDate(today.getDate() - startOffset);

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isToday = d.toDateString() === today.toDateString();
    return {
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      isToday
    };
  });

  return (
    <div
      className={`glass p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Top Section: Date & Month */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-baseline gap-3">
            {/* Bada date number coral color mein */}
            <span className="text-5xl sm:text-6xl font-black text-[#f0735f] tracking-tight leading-none">
              {dayNumber}
            </span>
            <div>
              <div className="text-sm sm:text-base font-bold text-ink leading-tight">
                {weekdayName}
              </div>
              <div className="text-xs text-ink-soft font-medium">
                {monthYear}
              </div>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white/30 border border-edge text-ink flex items-center justify-center">
            <CalendarIcon className="w-4 h-4 text-[#f0735f]" />
          </div>
        </div>

        {/* 7-Day Strip */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 my-4 p-1.5 rounded-2xl bg-white/20 border border-edge/60">
          {weekDays.map((item, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-center transition-all ${
                item.isToday
                  ? 'bg-[#f0735f] text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-ink-soft hover:bg-white/30 text-xs'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {item.dayName.slice(0, 3)}
              </span>
              <span className={`text-xs mt-0.5 ${item.isToday ? 'font-black' : 'font-semibold text-ink'}`}>
                {item.dateNum}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Event Rows: time | coral bar | title + location */}
      <div className="space-y-2.5 pt-1 border-t border-edge/60">
        {events.slice(0, 2).map((ev, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/20 transition-all duration-150"
          >
            {/* Time */}
            <div className="text-xs font-bold text-ink-soft w-16 flex-shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#f0735f] flex-shrink-0" />
              <span>{ev.time}</span>
            </div>

            {/* Coral bar */}
            <div
              className="w-1.5 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: ev.accent || 'var(--coral-a)' }}
            />

            {/* Title + Location */}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-ink truncate leading-tight">
                {ev.title}
              </div>
              <div className="text-[11px] text-ink-soft truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5 text-ink-soft flex-shrink-0" />
                <span>{ev.location}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarCard;
