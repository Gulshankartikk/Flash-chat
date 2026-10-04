import React, { useState } from 'react';
import { Modal } from '../Modal';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { useAuthStore } from '../../store/useAuthStore';

export const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim() });
      setMessage('Profile updated successfully!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Profile" maxWidth="max-w-md">
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        {message && (
          <div
            className={`p-3 text-xs font-semibold rounded-xl border ${
              message.startsWith('Error')
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex flex-col items-center gap-2 py-2">
          <Avatar src={user?.avatar} name={user?.name} size="xl" />
          <p className="text-xs text-muted font-medium">{user?.email || user?.phone}</p>
        </div>

        <Input
          label="Full Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="About / Bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell others a little about yourself..."
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving} className="flex-1">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UserProfileModal;
