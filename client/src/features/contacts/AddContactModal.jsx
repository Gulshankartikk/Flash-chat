import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, FileText, Star, AlertCircle, Sparkles, Check, MessageSquare, Bookmark } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';
import { COUNTRY_CODES, formatToE164, isValidE164, getDefaultCountryCode, parsePastedPhone } from './phoneUtils';
import { useContactsStore } from './useContacts';
import { useAuthStore } from '../../store/useAuthStore';
import { useDebounce } from '../../hooks/useDebounce';
import { NotOnFlashChatSheet } from './NotOnFlashChatSheet';
import api from '../../services/api';

export const AddContactModal = ({
  isOpen,
  onClose,
  contactToEdit = null,
  initialPhone = '',
  onSaved,
  onSelectExisting,
  onChatReady
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { contacts, addContact, updateContact } = useContactsStore();
  const isEditing = Boolean(contactToEdit);

  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState(() => getDefaultCountryCode());
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saveToContacts, setSaveToContacts] = useState(true);

  const [errors, setErrors] = useState({});
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const [isSubmittingSave, setIsSubmittingSave] = useState(false);
  const [onFlashChatHint, setOnFlashChatHint] = useState(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Pending sheet state
  const [pendingData, setPendingData] = useState(null);
  const [isPendingSheetOpen, setIsPendingSheetOpen] = useState(false);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState(null);

  // Initialize or reset form values
  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || '');
      setEmail(contactToEdit.email || '');
      setNote(contactToEdit.note || '');
      setIsFavorite(Boolean(contactToEdit.isFavorite));
      setSaveToContacts(true);

      const rawPhone = contactToEdit.phone || '';
      const matched = COUNTRY_CODES.find((c) => rawPhone.startsWith(c.code));
      if (matched) {
        setCountryCode(matched.code);
        setPhoneNumber(rawPhone.slice(matched.code.length));
      } else {
        setPhoneNumber(rawPhone);
      }
    } else if (initialPhone) {
      const parsed = parsePastedPhone(initialPhone);
      if (parsed) {
        setCountryCode(parsed.countryCode);
        setPhoneNumber(parsed.phoneNumber);
      } else {
        setPhoneNumber(initialPhone);
      }
      setName('');
      setEmail('');
      setNote('');
      setIsFavorite(false);
      setSaveToContacts(true);
      setErrors({});
      setOnFlashChatHint(null);
    } else {
      setName('');
      setPhoneNumber('');
      setCountryCode(getDefaultCountryCode());
      setEmail('');
      setNote('');
      setIsFavorite(false);
      setSaveToContacts(true);
      setErrors({});
      setOnFlashChatHint(null);
    }
  }, [contactToEdit, initialPhone, isOpen]);

  const fullPhone = useMemo(() => {
    return phoneNumber ? formatToE164(phoneNumber, countryCode) : '';
  }, [phoneNumber, countryCode]);

  const isPhoneValid = useMemo(() => {
    return isValidE164(fullPhone);
  }, [fullPhone]);

  const isOwnNumber = useMemo(() => {
    if (!user?.phone || !fullPhone) return false;
    return user.phone.trim() === fullPhone.trim();
  }, [user?.phone, fullPhone]);

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

  // Handle paste for phone
  const handlePhonePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      const parsed = parsePastedPhone(text);
      if (parsed) {
        e.preventDefault();
        setCountryCode(parsed.countryCode);
        setPhoneNumber(parsed.phoneNumber);
      }
    }
  };

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

  const validateForSave = () => {
    const errs = {};
    if (saveToContacts && !name.trim()) {
      errs.name = 'Contact name is required to save';
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

    if (isOwnNumber) {
      errs.phone = "That's your number";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateForChat = () => {
    const errs = {};
    if (!phoneNumber || !isValidE164(fullPhone)) {
      errs.phone = 'Please enter a valid international phone number to chat';
    }

    if (isOwnNumber) {
      errs.phone = "That's your number";
    }

    if (saveToContacts && !name.trim()) {
      errs.name = 'Contact name is required when "Save to contacts" is enabled';
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      errs.general = "You're offline. We'll save the contact and sync it later; chatting needs a connection.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Start Chat by Phone Action
  const handleStartChat = async () => {
    if (!validateForChat()) return;

    setIsSubmittingChat(true);
    setErrors({});
    try {
      const res = await api.post('/chats/by-phone', {
        phone: fullPhone,
        name: name.trim() || undefined,
        saveContact: saveToContacts
      });

      const { status, conversationId, contactId, pendingId } = res.data;

      if (status === 'ready' && conversationId) {
        onClose();
        if (onChatReady) {
          onChatReady(conversationId);
        } else {
          navigate(`/chats/${conversationId}`);
        }
      } else if (status === 'pending') {
        setPendingData({
          pendingId,
          contactId,
          phone: fullPhone,
          name: name.trim()
        });
        setIsPendingSheetOpen(true);
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || '';

      if (status === 429) {
        setErrors({ general: msg || 'Rate limit reached. Please try again later.' });
      } else if (status === 400 && msg.includes('own number')) {
        setErrors({ phone: "That's your number" });
      } else if (status === 400 && msg.includes('valid')) {
        setErrors({ phone: 'Please enter a valid international phone number' });
      } else {
        setErrors({ general: "We couldn't start this chat. Try again later." });
      }
    } finally {
      setIsSubmittingChat(false);
    }
  };

  // Save Contact Only Action
  const handleSaveOnly = async (e) => {
    if (e) e.preventDefault();
    if (!validateForSave()) return;

    setIsSubmittingSave(true);
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
      setIsSubmittingSave(false);
    }
  };

  // Render on Mobile as BottomSheet, on Desktop as Modal
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const Wrapper = isMobile ? BottomSheet : Modal;

  return (
    <>
      <Wrapper
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Contact' : 'Add New Contact'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-1">
          {errors.general && (
            <div
              className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-medium flex items-center gap-2"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Duplicate Contact Alert */}
          {duplicateContact && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  A contact for <strong>{duplicateContact.name}</strong> already exists.
                </span>
              </div>
              {onSelectExisting && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectExisting(duplicateContact);
                  }}
                  className="underline font-bold text-primary ml-2 hover:opacity-80 cursor-pointer"
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

          {/* Phone input with country code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Phone Number</label>
            <div className="flex gap-2">
              <select
                aria-label="Country Dial Code"
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
                  aria-label="Phone number input"
                  placeholder="98765 43210"
                  icon={<Phone className="w-4 h-4 text-muted" />}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onPaste={handlePhonePaste}
                  error={errors.phone}
                />
              </div>
            </div>
          </div>

          {/* Name input */}
          <Input
            label={saveToContacts ? 'Full Name *' : 'Full Name (Optional)'}
            placeholder="e.g. Sarah Jenkins"
            icon={<User className="w-4 h-4 text-muted" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />

          {/* Save to contacts switch */}
          {!isEditing && (
            <div className="flex items-center justify-between py-1 border-t border-line/60">
              <div>
                <p className="text-xs font-bold text-ink">Save to Contacts</p>
                <p className="text-[11px] text-muted">Add to your saved address book</p>
              </div>
              <Switch checked={saveToContacts} onChange={setSaveToContacts} />
            </div>
          )}

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
          <div className="flex gap-2.5 pt-2">
            {!isEditing ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveOnly}
                  isLoading={isSubmittingSave}
                  disabled={isSubmittingChat || (!phoneNumber && !email)}
                  className="flex-1"
                  icon={<Bookmark className="w-3.5 h-3.5" />}
                >
                  Save only
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleStartChat}
                  isLoading={isSubmittingChat}
                  disabled={isSubmittingSave || !isPhoneValid || isOwnNumber}
                  className="flex-1"
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                >
                  Chat
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveOnly}
                  isLoading={isSubmittingSave}
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </Wrapper>

      {/* Unregistered Not on Flash Chat Sheet */}
      {isPendingSheetOpen && pendingData && (
        <NotOnFlashChatSheet
          isOpen={isPendingSheetOpen}
          onClose={() => {
            setIsPendingSheetOpen(false);
            setPendingData(null);
            onClose();
          }}
          pendingData={pendingData}
          onDone={() => {
            setIsPendingSheetOpen(false);
            setPendingData(null);
            onClose();
          }}
        />
      )}
    </>
  );
};

export const AddByNumberSheet = AddContactModal;
export default AddContactModal;
