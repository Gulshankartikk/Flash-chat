import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';

export const ScheduleMessageModal = ({ isOpen, onClose, text, onSchedule }) => {
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // Default to 1 hour from now
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const targetDate = new Date(scheduledDateTime);
    if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
      alert('Please choose a valid time in the future.');
      return;
    }

    onSchedule(targetDate.toISOString());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-card border border-line p-5 shadow-2xl text-ink space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cream border border-line flex items-center justify-center text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-ink">Schedule Message</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-ink hover:bg-cream transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        {text && (
          <div className="p-2.5 rounded-xl bg-cream border border-line text-xs text-muted max-h-20 overflow-y-auto italic">
            "{text}"
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Select Date & Time</span>
            </label>
            <Input
              type="datetime-local"
              value={scheduledDateTime}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
