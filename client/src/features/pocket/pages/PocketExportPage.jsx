import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileArchive,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { startPocketExportApi, fetchExportStatusApi } from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';

export const PocketExportPage = () => {
  const navigate = useNavigate();
  const { isUnlocked } = usePocketStore();

  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle'); // 'idle' | 'processing' | 'completed' | 'failed'
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const pollTimerRef = useRef(null);

  // Polling loop
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await fetchExportStatusApi(jobId);
        if (res.job) {
          setJobStatus(res.job.status);
          setProgress(res.job.progress || 0);

          if (res.job.status === 'completed') {
            setDownloadUrl(res.job.downloadUrl);
            clearInterval(pollTimerRef.current);
          } else if (res.job.status === 'failed') {
            setErrorMessage(res.job.error || 'Export archive generation failed.');
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.error('Export poll error', err);
      }
    };

    pollTimerRef.current = setInterval(pollStatus, 2500);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [jobId, jobStatus]);

  const handleStartExport = async () => {
    setJobStatus('processing');
    setProgress(10);
    setErrorMessage('');
    setDownloadUrl(null);

    try {
      const res = await startPocketExportApi();
      setJobId(res.jobId);
    } catch (err) {
      setJobStatus('failed');
      setErrorMessage(err.message || 'Failed to start export job. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7ED] p-3 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Navbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/pocket/settings')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:bg-[#FED7AA]/40 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings</span>
        </button>

        <h1 className="text-sm font-black text-[#1F2937]">Vault Data Export</h1>
      </div>

      {/* Main Export Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white flex items-center justify-center shadow-md shadow-orange-500/20 flex-shrink-0">
            <FileArchive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#1F2937]">Download Pocket Archive (.ZIP)</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Generate a portable backup containing all your notes (as organized Markdown files), media links,
              and a comprehensive <code className="text-[#F97316] font-mono font-bold">manifest.json</code>.
            </p>
          </div>
        </div>

        {/* Status Indicators & Progress */}
        {jobStatus === 'processing' && (
          <div className="p-5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#1F2937]">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
                <span>Generating archive... ({progress}%)</span>
              </span>
              <span>Please keep this page open</span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#FED7AA]/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F97316] to-[#EC4899] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {jobStatus === 'completed' && downloadUrl && (
          <div className="p-5 rounded-2xl bg-cream border border-line space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Archive ready for download!</span>
            </div>
            <p className="text-[11px] text-muted">
              Your ZIP backup is packaged and ready. The download link remains active for 1 hour.
            </p>
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gradient text-white text-xs font-bold shadow-soft transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP Archive</span>
            </a>
          </div>
        )}

        {jobStatus === 'failed' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Export Failed</span>
            </div>
            <p>{errorMessage}</p>
            <button
              onClick={handleStartExport}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-100 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Export</span>
            </button>
          </div>
        )}

        {/* Export trigger button */}
        {jobStatus === 'idle' && (
          <button
            onClick={handleStartExport}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Start Vault Export</span>
          </button>
        )}

        {/* Security Disclaimers & Details */}
        <div className="pt-4 border-t border-[#FED7AA]/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1F2937]">Locked Items</h4>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {isUnlocked
                  ? 'Vault is currently unlocked. Locked items will be included in the export.'
                  : 'Vault is currently locked. Locked items are excluded from the export.'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1F2937]">Client Encryption</h4>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Client-encrypted items are exported as AES ciphertext. They remain zero-knowledge protected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PocketExportPage;
