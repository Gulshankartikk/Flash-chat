import React, { useState, useEffect, useMemo } from 'react';
import { User, Phone, Mail, FileText, Star, AlertCircle, Sparkles, Check } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';
import { COUNTRY_CODES, formatToE164, isValidE164 } from './phoneUtils';
import { useContactsStore } from './useContacts';
import { useDebounce } from '../../hooks/useDebounce';
import api from '../../services/api';

export const AddContactModal = ({ isOpen, onClose, contactToEdit = null, onSaved, onSelectExisting }) => {
  const { contacts, addContact, updateContact } = useContactsStore();
  const isEditing = Boolean(contactToEdit);

  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onFlashChatHint, setOnFlashChatHint] = useState(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Initialize or reset form values
  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || '');
      setEmail(contactToEdit.email || '');
      setNote(contactToEdit.note || '');
      setIsFavorite(Boolean(contactToEdit.isFavorite));

      const rawPhone = contactToEdit.phone || '';
      const matched = COUNTRY_CODES.find((c) => rawPhone.startsWith(c.code));
      if (matched) {
        setCountryCode(matched.code);
        setPhoneNumber(rawPhone.slice(matched.code.length));
      } else {
        setPhoneNumber(rawPhone);
      }
    } else {
      setName('');
      setPhoneNumber('');
      setEmail('');
      setNote('');
      setIsFavorite(false);
      setErrors({});
      setOnFlashChatHint(null);
    }
  }, [contactToEdit, isOpen]);

  const fullPhone = useMemo(() => {
    return phoneNumber ? formatToE164(phoneNumber, countryCode) : '';
  }, [phoneNumber, countryCode]);

  const debouncedPhone = useDebounce(fullPhone, 400);
  const debouncedEmail = useDebounce(email, 400);

  // Duplicate detection among existing local contacts
  const duplicateContact = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    return contacts.find((c) => {
      if (contactToEdit && c._id === contactToEdit._id) return false;
      const phoneMatch = fullPhone && c.phone === fullPhone;
      const emailMatch = email && c.email?.toLowerCase() === email.trim().toLowerCase();
      return phoneMatch || emailMatch;
    });
  }, [contacts, fullPhone, email, contactToEdit]);

  // Check if contact identifier is already on Flash Chat
  useEffect(() => {
    let active = true;
    if (isEditing || (!debouncedPhone && !debouncedEmail)) {
      setOnFlashChatHint(null);
      return;
    }

    const checkIdentifier = async () => {
      setIsCheckingUser(true);
      try {
        const query = debouncedPhone || debouncedEmail;
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        if (active && res.data.users && res.data.users.length > 0) {
          const matchedUser = res.data.users[0];
          setOnFlashChatHint({
            username: matchedUser.username,
            name: matchedUser.name,
            avatar: matchedUser.avatar
          });
        } else if (active) {
          setOnFlashChatHint(null);
        }
      } catch (_) {
        if (active) setOnFlashChatHint(null);
      } finally {
        if (active) setIsCheckingUser(false);
      }
    };

    checkIdentifier();
    return () => {
      active = false;
    };
  }, [debouncedPhone, debouncedEmail, isEditing]);

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Contact name is required';
    }

    if (!phoneNumber && !email) {
      errs.general = 'Please provide either a phone number or an email';
    }

    if (phoneNumber && !isValidE164(fullPhone)) {
      errs.phone = 'Please enter a valid international phone number';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: fullPhone || undefined,
        email: email.trim().toLowerCase() || undefined,
        note: note.trim() || undefined,
        isFavorite
      };

      let result;
      if (isEditing) {
        result = await updateContact(contactToEdit._id, payload);
      } else {
        result = await addContact(payload);
      }

      if (onSaved) onSaved(result?.contact || result);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save contact';
      setErrors((prev) => ({ ...prev, general: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render on Mobile as BottomSheet, on Desktop as Modal
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const Wrapper = isMobile ? BottomSheet : Modal;

  return (
    <Wrapper
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Contact' : 'Add New Contact'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {errors.general && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Duplicate Contact Alert */}
        {duplicateContact && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>A contact for <strong>{duplicateContact.name}</strong> already exists.</span>
            </div>
            {onSelectExisting && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectExisting(duplicateContact);
                }}
                className="underline font-bold text-primary ml-2 hover:opacity-80"
              >
                View
              </button>
            )}
          </div>
        )}

        {/* On Flash Chat Hint */}
        {onFlashChatHint && (
          <div className="p-3 bg-gradient-to-r from-primary/10 to-secondary/10 border border-line rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-ink flex items-center gap-1">
                <span>Already on Flash Chat!</span>
                <Check className="w-3.5 h-3.5 text-primary" />
              </p>
              <p className="text-[11px] text-muted truncate">
                Matches @{onFlashChatHint.username} ({onFlashChatHint.name})
              </p>
            </div>
          </div>
        )}

        {/* Name input */}
        <Input
          label="Full Name *"
          placeholder="e.g. Sarah Jenkins"
          icon={<User className="w-4 h-4 text-muted" />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />

        {/* Phone input with country code */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink">Phone Number</label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="bg-card text-ink border border-line rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <div className="flex-1">
              <Input
                placeholder="234 567 8900"
                icon={<Phone className="w-4 h-4 text-muted" />}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                error={errors.phone}
              />
            </div>
          </div>
        </div>

        {/* Email input */}
        <Input
          label="Email Address"
          type="email"
          placeholder="sarah@example.com"
          icon={<Mail className="w-4 h-4 text-muted" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        {/* Note textarea */}
        <Textarea
          label="Note (Private)"
          placeholder="Add a note or context (e.g. Met at tech summit)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />

        {/* Favorite Switch */}
        <div className="flex items-center justify-between py-2 border-t border-line/60">
          <div className="flex items-center gap-2">
            <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-500 fill-amber-500' : 'text-muted'}`} />
            <div>
              <p className="text-xs font-bold text-ink">Add to Favorites</p>
              <p className="text-[11px] text-muted">Pin this contact to the top of your list</p>
            </div>
          </div>
          <Switch checked={isFavorite} onChange={setIsFavorite} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} className="flex-1">
            {isEditing ? 'Save Changes' : 'Create Contact'}
          </Button>
        </div>
      </form>
    </Wrapper>
  );
};
