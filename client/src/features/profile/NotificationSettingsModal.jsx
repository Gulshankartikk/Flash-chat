import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Clock,
  Send,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  PhoneCall,
  Heart,
  Eye
} from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuthStore } from '../../store/useAuthStore';

export const NotificationSettingsModal = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    updatePushSettings
  } = usePushNotifications();

  const settings = user?.pushSettings || {
    pushEnabled: true,
    pushMessages: true,
    pushCalls: true,
    pushSocial: true,
    pushPreview: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }
  };

  const [testStatus, setTestStatus] = useState(null); // 'sending' | 'sent' | 'error'
  const [localQuiet, setLocalQuiet] = useState(settings.quietHours);

  if (!isOpen) return null;

  const handleMasterToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (e) {
      console.error('Push toggle error', e);
    }
  };

  const handleSettingChange = async (key, val) => {
    try {
      await updatePushSettings({ [key]: val });
    } catch (e) {
      console.error('Settings update error', e);
    }
  };

  const handleQuietHoursSave = async () => {
    try {
      await updatePushSettings({ quietHours: localQuiet });
    } catch (e) {
      console.error('Quiet hours update error', e);
    }
  };

  const handleSendTest = async () => {
    setTestStatus('sending');
    try {
      await sendTestNotification();
      setTestStatus('sent');
      setTimeout(() => setTestStatus(null), 4000);
    } catch (err) {
      setTestStatus('error');
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1F2937] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#FED7AA] dark:border-white/10 p-6 space-y-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2937] dark:text-white">Push Notifications</h2>
              <p className="text-xs text-[#6B7280] dark:text-white/60">Manage your alerts & quiet hours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7280] hover:bg-gray-100 dark:hover:bg-white/10 transition"
            aria-label="Close notification settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permission State Feedback Banner */}
        {permission === 'denied' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-[#F43F5E] mt-0.5" />
            <div>
              <p className="font-bold">Notifications Blocked by Browser</p>
              <p className="text-[11px] mt-1 text-rose-600 dark:text-rose-400">
                Tap the lock or site settings icon in your browser address bar and set Notifications to "Allow".
              </p>
            </div>
          </div>
        )}

        {!isSupported && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>Web Push notifications are not supported in this browser version.</span>
          </div>
        )}

        {/* Master Push Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FFF7ED] dark:bg-white/5 border border-[#FED7AA] dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] flex items-center justify-center text-white">
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F2937] dark:text-white">Enable Push Notifications</p>
              <p className="text-[11px] text-[#6B7280] dark:text-white/60">
                {isSubscribed ? 'Active on this device' : 'Receive alerts even when app is closed'}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={loading || !isSupported}
              checked={isSubscribed}
              onChange={handleMasterToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
          </label>
        </div>

        {/* Granular Notification Channels */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-white/50 px-1">
            Notification Categories
          </h3>

          <div className="space-y-2">
            {/* Chat Messages */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-[#F97316]" />
                <span className="text-xs font-medium text-[#1F2937] dark:text-white">Chat Messages</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pushMessages !== false}
                onChange={(e) => handleSettingChange('pushMessages', e.target.checked)}
                className="w-4 h-4 text-[#F97316] rounded border-gray-300 focus:ring-[#F97316]"
              />
            </div>

            {/* Calls */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-[#1F2937] dark:text-white">Incoming Calls</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pushCalls !== false}
                onChange={(e) => handleSettingChange('pushCalls', e.target.checked)}
                className="w-4 h-4 text-[#F97316] rounded border-gray-300 focus:ring-[#F97316]"
              />
            </div>

            {/* Social */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-[#F43F5E]" />
                <span className="text-xs font-medium text-[#1F2937] dark:text-white">Social Activity (Likes, Follows)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pushSocial !== false}
                onChange={(e) => handleSettingChange('pushSocial', e.target.checked)}
                className="w-4 h-4 text-[#F97316] rounded border-gray-300 focus:ring-[#F97316]"
              />
            </div>

            {/* Message Previews */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#6B7280]" />
                <div>
                  <span className="text-xs font-medium text-[#1F2937] dark:text-white block">Show Message Previews</span>
                  <span className="text-[10px] text-[#6B7280] dark:text-white/50">Display sender text in banner</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.pushPreview !== false}
                onChange={(e) => handleSettingChange('pushPreview', e.target.checked)}
                className="w-4 h-4 text-[#F97316] rounded border-gray-300 focus:ring-[#F97316]"
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours Section */}
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F97316]" />
              <h3 className="text-xs font-bold text-[#1F2937] dark:text-white">Quiet Hours</h3>
            </div>
            <input
              type="checkbox"
              checked={localQuiet.enabled}
              onChange={(e) => {
                const next = { ...localQuiet, enabled: e.target.checked };
                setLocalQuiet(next);
                updatePushSettings({ quietHours: next });
              }}
              className="w-4 h-4 text-[#F97316] rounded border-gray-300 focus:ring-[#F97316]"
            />
          </div>

          <p className="text-[11px] text-[#6B7280] dark:text-white/60">
            Mutes push notifications during sleep (urgent calls will still ring).
          </p>

          {localQuiet.enabled && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] uppercase">Starts At</label>
                <input
                  type="time"
                  value={localQuiet.start}
                  onChange={(e) => {
                    const next = { ...localQuiet, start: e.target.value };
                    setLocalQuiet(next);
                  }}
                  onBlur={handleQuietHoursSave}
                  className="w-full mt-1 p-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1F2937] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] uppercase">Ends At</label>
                <input
                  type="time"
                  value={localQuiet.end}
                  onChange={(e) => {
                    const next = { ...localQuiet, end: e.target.value };
                    setLocalQuiet(next);
                  }}
                  onBlur={handleQuietHoursSave}
                  className="w-full mt-1 p-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1F2937] text-xs font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Test Notification Action */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <button
            onClick={handleSendTest}
            disabled={!isSubscribed || testStatus === 'sending'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] text-xs font-bold text-[#F97316] hover:bg-orange-100/60 disabled:opacity-50 transition active:scale-95"
          >
            {testStatus === 'sending' ? (
              <span>Sending test alert...</span>
            ) : testStatus === 'sent' ? (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="w-3.5 h-3.5" /> Test Alert Sent!
              </span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Test Notification</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsModal;
