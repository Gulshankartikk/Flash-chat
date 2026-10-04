import React, { useState, useEffect } from 'react';
import { UserPlus, UploadCloud, Undo2, Check } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-cream select-none overflow-hidden">
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

      {/* Main List */}
      <div className="flex-1 overflow-hidden">
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

      {/* Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-ink text-cream rounded-2xl shadow-xl border border-line text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="flex items-center gap-1 text-primary hover:underline font-bold ml-1"
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
