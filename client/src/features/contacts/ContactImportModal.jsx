import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  X,
  ArrowRight,
  ListFilter
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { useContactsStore } from './useContacts';
import { formatToE164, isValidE164 } from './phoneUtils';

export const ContactImportModal = ({ isOpen, onClose, onImportCompleted }) => {
  const { importBulkContacts } = useContactsStore();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('select'); // 'select' | 'preview' | 'result'
  const [parsedContacts, setParsedContacts] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState(null);

  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  const handleNativeContactPicker = async () => {
    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      const contacts = await navigator.contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const formatted = contacts.map((c) => {
          const rawTel = c.tel && c.tel.length > 0 ? c.tel[0] : '';
          const rawEmail = c.email && c.email.length > 0 ? c.email[0] : '';
          const name = Array.isArray(c.name) ? c.name.join(' ') : c.name || 'Unknown';
          return {
            name,
            phone: rawTel ? formatToE164(rawTel) : undefined,
            email: rawEmail || undefined
          };
        }).slice(0, 200);

        setParsedContacts(formatted);
        setStep('preview');
      }
    } catch (err) {
      console.warn('Contact picker dismissed or not supported', err);
    }
  };

  const handleFileUpload = (file) => {
    setParseError(null);
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setParseError('The CSV file does not contain enough data rows.');
          return;
        }

        // Parse header
        const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('first'));
        const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
        const emailIdx = header.findIndex((h) => h.includes('email') || h.includes('mail'));
        const noteIdx = header.findIndex((h) => h.includes('note') || h.includes('desc'));

        if (nameIdx === -1 && phoneIdx === -1 && emailIdx === -1) {
          setParseError('Could not identify Name, Phone, or Email columns in the CSV.');
          return;
        }

        const list = [];
        for (let i = 1; i < lines.length && list.length < 200; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          const name = nameIdx !== -1 ? cols[nameIdx] : '';
          const phone = phoneIdx !== -1 ? cols[phoneIdx] : '';
          const email = emailIdx !== -1 ? cols[emailIdx] : '';
          const note = noteIdx !== -1 ? cols[noteIdx] : '';

          if (name || phone || email) {
            list.push({
              name: name || phone || email,
              phone: phone ? formatToE164(phone) : undefined,
              email: email || undefined,
              note: note || undefined
            });
          }
        }

        if (list.length === 0) {
          setParseError('No valid contacts found in the file.');
          return;
        }

        setParsedContacts(list);
        setStep('preview');
      } catch (err) {
        setParseError('Failed to parse the CSV file. Please check its formatting.');
      }
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    try {
      const results = await importBulkContacts(parsedContacts);
      setImportResults(results);
      setStep('result');
      if (onImportCompleted) onImportCompleted(results);
    } catch (err) {
      setParseError(err.response?.data?.message || 'Bulk import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setParsedContacts([]);
    setImportResults(null);
    setParseError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Contacts" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Privacy reassurance badge */}
        <div className="p-3 bg-cream rounded-2xl border border-line flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <p className="text-xs text-ink">
            <strong>Only contacts you choose are saved.</strong> Flash Chat does not automatically sync or upload your address book in the background.
          </p>
        </div>

        {parseError && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Step 1: Select Method */}
        {step === 'select' && (
          <div className="space-y-3">
            {hasContactPicker && (
              <button
                type="button"
                onClick={handleNativeContactPicker}
                className="w-full p-4 rounded-2xl bg-card border border-line hover:border-primary/50 hover:bg-orange-50/30 transition text-left flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-ink">Choose from Phone Contacts</p>
                  <p className="text-[11px] text-muted">Select specific contacts using device picker</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 border-2 border-dashed border-line rounded-2xl bg-card hover:bg-orange-50/20 hover:border-primary transition cursor-pointer flex flex-col items-center justify-center text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-ink">Upload CSV File</p>
              <p className="text-[11px] text-muted mt-0.5">
                Drag and drop your exported contacts CSV (Max 200 per batch)
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview Contacts */}
        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">
                Found {parsedContacts.length} Contacts to Import
              </span>
              <span className="text-muted text-[11px]">Max 200 per import</span>
            </div>

            <div className="max-h-56 overflow-y-auto bg-card border border-line rounded-2xl divide-y divide-line/40">
              {parsedContacts.map((c, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink truncate">{c.name}</p>
                    <p className="text-[11px] text-muted truncate">
                      {[c.phone, c.email].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setParsedContacts((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-muted hover:text-accent rounded-lg"
                    title="Remove from import"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setStep('select')}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                isLoading={isImporting}
                onClick={handleStartImport}
              >
                Import ({parsedContacts.length}) Contacts
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result Summary */}
        {step === 'result' && importResults && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Import Completed</h3>
              <p className="text-xs text-muted mt-1">
                Successfully added <strong>{importResults.imported || 0}</strong> contacts.
                {importResults.linkedCount > 0 && (
                  <span> ({importResults.linkedCount} already on Flash Chat!)</span>
                )}
              </p>
            </div>

            {Array.isArray(importResults.results) && (
              <div className="max-h-40 overflow-y-auto bg-card border border-line rounded-2xl text-left text-xs p-2 space-y-1.5">
                {importResults.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-ink truncate">{r.name || `Row #${i + 1}`}</span>
                    <span
                      className={`font-semibold ${
                        r.status === 'created'
                          ? 'text-primary'
                          : r.status === 'duplicate'
                          ? 'text-amber-500'
                          : 'text-accent'
                      }`}
                    >
                      {r.status === 'created'
                        ? 'Added'
                        : r.status === 'duplicate'
                        ? 'Duplicate'
                        : r.error || 'Skipped'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button variant="primary" className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
