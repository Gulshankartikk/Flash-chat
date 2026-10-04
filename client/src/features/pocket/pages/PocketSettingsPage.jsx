import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Unlock,
  KeyRound,
  HardDrive,
  Trash2,
  Download,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  PieChart,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Music,
  FileCheck
} from 'lucide-react';
import { fetchPocketStorage, removeVaultPinApi, purgeAllPocketData } from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';
import { PinPadModal } from '../components/PinPadModal';

export const PocketSettingsPage = () => {
  const navigate = useNavigate();
  const {
    isUnlocked,
    lockVault,
    autoLockMinutes,
    setAutoLockMinutes
  } = usePocketStore();

  const [storageData, setStorageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // PIN modal state
  const [pinModalMode, setPinModalMode] = useState(null); // 'setup' | 'change' | null
  const [showRemovePinConfirm, setShowRemovePinConfirm] = useState(false);
  const [removePinInput, setRemovePinInput] = useState('');

  // Danger Zone purge modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeInput, setPurgeInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    fetchPocketStorage()
      .then((res) => setStorageData(res.storage || null))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const formatMB = (bytes = 0) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const handleRemovePin = async (e) => {
    e.preventDefault();
    if (!removePinInput) return;
    try {
      await removeVaultPinApi(removePinInput);
      alert('Vault PIN removed successfully.');
      setShowRemovePinConfirm(false);
      setRemovePinInput('');
    } catch (err) {
      alert(err.message || 'Failed to remove PIN.');
    }
  };

  const handlePurgeAll = async (e) => {
    e.preventDefault();
    if (purgeInput !== 'DELETE') return;

    setIsPurging(true);
    try {
      await purgeAllPocketData();
      lockVault();
      alert('All Pocket data has been permanently wiped.');
      navigate('/pocket');
    } catch (err) {
      alert(err.message || 'Purge failed.');
    } finally {
      setIsPurging(false);
      setShowPurgeModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7ED] p-3 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Navbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/pocket')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:bg-[#FED7AA]/40 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Pocket</span>
        </button>

        <h1 className="text-sm font-black text-[#1F2937]">Pocket Settings & Vault Security</h1>
      </div>

      {/* Security & PIN Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#F97316] flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2937]">Master Vault PIN Security</h2>
            <p className="text-[11px] text-[#6B7280]">Protect locked items with bcrypt hashing & lockout defense</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => setPinModalMode('setup')}
            className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] hover:bg-[#FED7AA]/40 text-xs font-bold text-[#1F2937] text-left transition-colors flex items-center justify-between"
          >
            <span>Set or Update Vault PIN</span>
            <Lock className="w-4 h-4 text-[#F97316]" />
          </button>

          <button
            onClick={() => setShowRemovePinConfirm(true)}
            className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] hover:bg-rose-50 text-xs font-bold text-rose-700 text-left transition-colors flex items-center justify-between"
          >
            <span>Remove Vault PIN</span>
            <Unlock className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-Lock Timer */}
        <div className="pt-3 border-t border-[#FED7AA]/50 space-y-2">
          <label className="text-xs font-bold text-[#1F2937] block">Auto-Lock Inactivity Timer</label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 5, 15, 30, 0].map((mins) => (
              <button
                key={mins}
                onClick={() => setAutoLockMinutes(mins)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  autoLockMinutes === mins
                    ? 'bg-[#F97316] text-white border-[#F97316] shadow-sm'
                    : 'bg-[#FFF7ED] text-[#1F2937] border-[#FED7AA] hover:bg-[#FED7AA]/50'
                }`}
              >
                {mins === 0 ? 'Never' : `${mins}m`}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#6B7280]">
            Vault automatically locks when switching tabs or after specified inactivity.
          </p>
        </div>

        {isUnlocked && (
          <div className="pt-2">
            <button
              onClick={lockVault}
              className="px-4 py-2 rounded-xl bg-[#1F2937] text-white text-xs font-bold hover:bg-black transition-colors"
            >
              Lock Vault Now
            </button>
          </div>
        )}
      </div>

      {/* Storage Breakdown Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937]">Storage Usage Breakdown</h2>
              <p className="text-[11px] text-[#6B7280]">
                {storageData ? `${formatMB(storageData.usedBytes)} of ${formatMB(storageData.limitBytes)} used` : 'Loading storage...'}
              </p>
            </div>
          </div>

          {storageData && (
            <span className="text-xs font-black text-[#F97316]">{storageData.percent}%</span>
          )}
        </div>

        {/* Gradient Storage Bar */}
        {storageData && (
          <div className="w-full h-3 rounded-full bg-[#FFF7ED] border border-[#FED7AA] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#F97316] to-[#EC4899] transition-all duration-300"
              style={{ width: `${Math.min(100, storageData.percent || 0)}%` }}
            />
          </div>
        )}

        {/* Warning if storage > 80% */}
        {storageData && storageData.percent >= 80 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Vault storage is nearly full. Delete old files or empty trash to free space.</span>
          </div>
        )}

        {/* Category Breakdown list */}
        {storageData?.breakdown && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#F97316]" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Notes & Snippets</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.notes?.bytes)}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <ImageIcon className="w-4 h-4 text-[#EC4899]" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Photos & Videos</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.media?.bytes)}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <FileCheck className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Documents</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.documents?.bytes)}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <Music className="w-4 h-4 text-rose-500" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Voice & Audio</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.audio?.bytes)}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <LinkIcon className="w-4 h-4 text-[#F97316]" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Saved Links</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.links?.bytes)}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#EC4899]" />
              <div>
                <p className="text-[10px] font-bold text-[#6B7280]">Other & AI</p>
                <p className="text-xs font-black text-[#1F2937]">{formatMB(storageData.breakdown.other?.bytes)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/pocket/export')}
          className="p-4 rounded-3xl bg-white border border-[#FED7AA] hover:border-[#F97316] shadow-sm flex items-center justify-between text-left transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] group-hover:text-[#F97316]">Export Vault Archive</h3>
              <p className="text-[11px] text-[#6B7280]">Download JSON manifest & Markdown notes</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/pocket/trash')}
          className="p-4 rounded-3xl bg-white border border-[#FED7AA] hover:border-rose-400 shadow-sm flex items-center justify-between text-left transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] group-hover:text-rose-600">Trash Bin</h3>
              <p className="text-[11px] text-[#6B7280]">Manage soft-deleted items (30-day window)</p>
            </div>
          </div>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-sm font-black text-rose-700">Danger Zone</h2>
        </div>
        <p className="text-xs text-[#6B7280] leading-relaxed">
          Permanently delete all your Pocket vault items, folders, encryption keys, and preferences. This action
          cannot be reversed.
        </p>
        <button
          onClick={() => setShowPurgeModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-xs transition-colors"
        >
          Delete All Pocket Data
        </button>
      </div>

      {/* PIN Setup/Change Modal */}
      <PinPadModal
        isOpen={!!pinModalMode}
        onClose={() => setPinModalMode(null)}
        mode={pinModalMode || 'setup'}
        title={pinModalMode === 'setup' ? 'Set Master PIN' : 'Change Master PIN'}
      />

      {/* Remove PIN Confirm Modal */}
      <AnimatePresence>
        {showRemovePinConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#FED7AA] space-y-4"
            >
              <h3 className="text-sm font-black text-[#1F2937]">Remove Vault PIN</h3>
              <p className="text-xs text-[#6B7280]">Enter your current PIN to remove lock protection.</p>
              <form onSubmit={handleRemovePin} className="space-y-3">
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={removePinInput}
                  onChange={(e) => setRemovePinInput(e.target.value)}
                  placeholder="Enter current PIN..."
                  className="w-full text-xs p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRemovePinConfirm(false)}
                    className="px-3 py-1.5 text-xs text-[#6B7280]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
                  >
                    Remove PIN
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Danger Zone Purge All Modal */}
      <AnimatePresence>
        {showPurgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-rose-300 space-y-4"
            >
              <h3 className="text-sm font-black text-rose-700">Wipe All Pocket Data?</h3>
              <p className="text-xs text-[#6B7280]">
                To confirm permanent deletion of your vault, type <span className="font-bold text-rose-600">DELETE</span> below.
              </p>
              <form onSubmit={handlePurgeAll} className="space-y-3">
                <input
                  type="text"
                  required
                  value={purgeInput}
                  onChange={(e) => setPurgeInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full text-xs p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPurgeModal(false)}
                    className="px-3 py-1.5 text-xs text-[#6B7280]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={purgeInput !== 'DELETE' || isPurging}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-40"
                  >
                    {isPurging ? 'Purging...' : 'Wipe Data Forever'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PocketSettingsPage;
