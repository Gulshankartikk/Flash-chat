import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Star,
  UserPlus,
  Phone,
  Mail,
  MoreVertical,
  Check,
  Send,
  AlertCircle,
  RefreshCw,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { useChatStore } from '../../store/useChatStore';
import { formatDisplayPhone } from './phoneUtils';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

export const ContactList = ({
  contacts = [],
  isLoading = false,
  error = null,
  onRetry,
  onSelectContact,
  onMessageContact,
  onAddContact,
  onInviteContact
}) => {
  const [search, setSearch] = useState('');
  const sectionRefs = useRef({});

  // Filter contacts by search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const phoneMatch = c.phone?.includes(q);
      const emailMatch = c.email?.toLowerCase().includes(q);
      const noteMatch = c.note?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch || noteMatch;
    });
  }, [contacts, search]);

  // Separate favorites
  const favorites = useMemo(() => {
    return filtered.filter((c) => c.isFavorite);
  }, [filtered]);

  // Group alphabetical contacts
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((c) => {
      const firstChar = (c.name || '#')[0].toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Sort within each group
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return groups;
  }, [filtered]);

  const activeLetters = useMemo(() => {
    return Object.keys(grouped).sort();
  }, [grouped]);

  const scrollToLetter = (letter) => {
    const el = sectionRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading && contacts.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-line">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && contacts.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-ink mb-1">Failed to load contacts</h3>
        <p className="text-xs text-muted mb-4">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full select-none overflow-hidden">
      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search contacts by name, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-line rounded-2xl text-xs font-semibold text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          />
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Add your friends and team to message them directly on Flash Chat."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus className="w-4 h-4" />}
                onClick={onAddContact}
              >
                Add First Contact
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs font-bold text-ink">No contacts found</p>
            <p className="text-[11px] text-muted mt-1">No results matching "{search}"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Favorites Section */}
            {favorites.length > 0 && !search && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 pl-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  <span>Favorites</span>
                </div>
                <div className="space-y-2">
                  {favorites.map((contact) => (
                    <ContactRow
                      key={contact._id}
                      contact={contact}
                      onSelect={() => onSelectContact && onSelectContact(contact)}
                      onMessage={() => onMessageContact && onMessageContact(contact)}
                      onInvite={(e) => {
                        e.stopPropagation();
                        if (onInviteContact) onInviteContact(contact);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Alphabetical Groups */}
            {activeLetters.map((letter) => (
              <div
                key={letter}
                ref={(el) => (sectionRefs.current[letter] = el)}
                className="space-y-2"
              >
                <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm py-1 pl-1 text-xs font-black text-primary border-b border-line/40">
                  {letter}
                </div>
                <div className="space-y-2">
                  {grouped[letter].map((contact) => (
                    <ContactRow
                      key={contact._id}
                      contact={contact}
                      onSelect={() => onSelectContact && onSelectContact(contact)}
                      onMessage={() => onMessageContact && onMessageContact(contact)}
                      onInvite={(e) => {
                        e.stopPropagation();
                        if (onInviteContact) onInviteContact(contact);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alphabet Scroller Bar on Right */}
      {contacts.length > 5 && (
        <nav
          aria-label="Alphabetical contacts navigation"
          className="w-6 flex flex-col items-center justify-center py-2 pr-1 select-none"
        >
          {ALPHABET.map((letter) => {
            const hasGroup = Boolean(grouped[letter]);
            return (
              <button
                key={letter}
                type="button"
                tabIndex={0}
                aria-label={`Jump to letter ${letter}`}
                disabled={!hasGroup}
                onClick={() => scrollToLetter(letter)}
                className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  hasGroup
                    ? 'text-primary hover:bg-primary hover:text-white cursor-pointer'
                    : 'text-muted/30 cursor-default'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

const ContactRow = ({ contact, onSelect, onMessage, onInvite }) => {
  const { onlineUsers } = useChatStore();
  const isLinked = Boolean(contact.linkedUser);
  const linkedUserId = contact.linkedUser?._id
    ? String(contact.linkedUser._id)
    : contact.linkedUser
    ? String(contact.linkedUser)
    : null;
  const isOnline = linkedUserId
    ? (onlineUsers instanceof Set ? onlineUsers.has(linkedUserId) : false) || Boolean(contact.linkedUser?.isOnline)
    : false;
  const subtitle = [
    contact.phone ? formatDisplayPhone(contact.phone) : null,
    contact.email
  ].filter(Boolean).join(' • ');

  return (
    <div
      onClick={onSelect}
      className="flex items-center justify-between p-3 bg-card hover:bg-orange-50/40 border border-line rounded-2xl cursor-pointer transition shadow-xs group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          src={contact.avatar || contact.linkedUser?.avatar}
          name={contact.name}
          size="md"
          isOnline={isOnline}
          showStatus={isLinked}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-ink truncate group-hover:text-primary transition-colors">
              {contact.name}
            </span>
            {contact.isFavorite && (
              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
            )}
            {contact.isOffline && (
              <span className="text-[10px] bg-muted/20 text-muted px-1.5 py-0.2 rounded-full font-medium">
                Waiting to sync
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted truncate">{subtitle || 'No details'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onMessage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMessage(contact);
            }}
            className="px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            title="Chat with contact"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        )}

        {isLinked ? (
          <span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold items-center gap-1">
            <span>On Flash Chat</span>
            <Check className="w-3 h-3" />
          </span>
        ) : (
          <button
            type="button"
            onClick={onInvite}
            className="px-2.5 py-1 rounded-full bg-cream border border-line hover:border-primary text-ink text-[11px] font-semibold transition cursor-pointer"
          >
            Invite
          </button>
        )}
      </div>
    </div>
  );
};
