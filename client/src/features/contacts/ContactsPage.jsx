import React, { useState, useEffect } from 'react';
import { UserPlus, UploadCloud, Undo2, Plus, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { ContactList } from './ContactList';
import { AddContactModal } from './AddContactModal';
import { ContactDetailModal } from './ContactDetailModal';
import { ContactImportModal } from './ContactImportModal';
import { useContactsStore } from './useContacts';

export const ContactsPage = () => {
  const { contacts, isLoading, error, fetchContacts, restoreContact } = useContactsStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactToEdit, setContactToEdit] = useState(null);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleContactDeleted = (deletedContact) => {
    setUndoToast({
      message: `Contact "${deletedContact.name}" deleted.`,
      contact: deletedContact
    });
    setTimeout(() => {
      setUndoToast((prev) => (prev?.contact._id === deletedContact._id ? null : prev));
    }, 6000);
  };

  const handleUndoDelete = async () => {
    if (!undoToast?.contact) return;
    try {
      await restoreContact(undoToast.contact);
      setUndoToast(null);
    } catch (_) {}
  };

  return (
    <div className="relative flex flex-col h-full bg-cream select-none overflow-hidden">
      {/* Top Header */}
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} saved contacts`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<UploadCloud className="w-4 h-4 text-muted" />}
              onClick={() => setIsImportOpen(true)}
            >
              Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                setContactToEdit(null);
                setIsAddOpen(true);
              }}
            >
              Add Contact
            </Button>
          </div>
        }
      />

      {/* Main List with bottom padding so FAB does not cover items */}
      <div className="flex-1 overflow-hidden pb-20 md:pb-0">
        <ContactList
          contacts={contacts}
          isLoading={isLoading}
          error={error}
          onRetry={fetchContacts}
          onSelectContact={(c) => setSelectedContact(c)}
          onAddContact={() => {
            setContactToEdit(null);
            setIsAddOpen(true);
          }}
          onInviteContact={(c) => setSelectedContact(c)}
        />
      </div>

      {/* Mobile 56px Floating Action Button (FAB) placed above bottom nav with safe-area insets */}
      <div
        className="md:hidden fixed right-5 z-30 pointer-events-none"
        style={{
          bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <button
          type="button"
          aria-label="Add contact"
          onClick={() => {
            setContactToEdit(null);
            setIsAddOpen(true);
          }}
          className="pointer-events-auto w-14 h-14 rounded-full bg-brand text-white shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-primary/40 cursor-pointer"
        >
          <Plus className="w-7 h-7 stroke-[2.5px]" />
        </button>
      </div>

      {/* Undo Toast */}
      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-ink text-cream rounded-2xl shadow-xl border border-line text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="flex items-center gap-1 text-primary hover:underline font-bold ml-1 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <AddContactModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setContactToEdit(null);
        }}
        contactToEdit={contactToEdit}
        onSelectExisting={(c) => setSelectedContact(c)}
      />

      {/* Contact Details Modal */}
      <ContactDetailModal
        isOpen={Boolean(selectedContact)}
        onClose={() => setSelectedContact(null)}
        contact={selectedContact}
        onEdit={(c) => {
          setContactToEdit(c);
          setIsAddOpen(true);
        }}
        onDeleted={handleContactDeleted}
      />

      {/* Bulk Import Modal */}
      <ContactImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportCompleted={() => fetchContacts()}
      />
    </div>
  );
};

export default ContactsPage;
