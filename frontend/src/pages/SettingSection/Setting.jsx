import React, { useState, useEffect } from "react";
import useThemeStore from "../../store/useThemeStore";
import useUserStore from "../../store/useUserStore";
import useChatStore from "../../store/chatStore";
import StatusSelector from "../../components/status/StatusSelector";
import { updateUserProfile, updatePrivacySettings } from "../../services/user.service";
import { toast } from "react-toastify";
import axios from "axios";
import ActiveSessionsModal from "../../components/settings/ActiveSessionsModal";
import BackupPreviewModal from "../../components/settings/BackupPreviewModal";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";
const api = axios.create({ baseURL: API, withCredentials: true });

const Setting = () => {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const currentUser = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const updatePrivacy = async (key, value) => {
    try {
      const currentSettings = currentUser?.privacySettings || {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        about: "everyone",
        readReceipts: true
      };

      const newSettings = {
        ...currentSettings,
        [key]: value
      };

      const res = await updatePrivacySettings(newSettings);
      if (res && res.success) {
        useUserStore.getState().updateProfile({
          privacySettings: {
            ...currentSettings,
            ...res.data
          }
        });
        toast.success("Privacy settings updated");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update privacy settings");
    }
  };

  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState(currentUser?.username || "");
  const [editAbout, setEditAbout] = useState(currentUser?.about || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentUser?.profilePicture || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportBackup = async () => {
    const password = window.prompt(
      "Enter a secure password to encrypt your backup file.\nYou will need this password to restore your chats later."
    );
    if (!password) {
      if (password === "") toast.error("Password cannot be empty.");
      return;
    }

    setIsExporting(true);
    try {
      const { data } = await api.get("/api/chat/backup");
      if (data && data.success && data.data) {
        // Client-side Encrypt the backup
        const { encryptBackup } = await import("../../utils/crypto");
        const encryptedString = await encryptBackup(data.data, password);
        
        const blob = new Blob([encryptedString], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `flash_chat_backup_${new Date().toISOString().slice(0, 10)}.enc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Encrypted backup exported successfully!");
      } else {
        toast.error(data?.message || "Failed to export backup");
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export backup: " + (err.response?.data?.message || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [previewBackupData, setPreviewBackupData] = useState(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let backupData;
          const fileContent = event.target.result;

          if (fileContent.startsWith("e2ee-backup:")) {
            const password = window.prompt("This backup file is encrypted. Please enter the password to decrypt it:");
            if (!password) {
              e.target.value = "";
              return;
            }
            const { decryptBackup } = await import("../../utils/crypto");
            backupData = await decryptBackup(fileContent, password);
          } else {
            backupData = JSON.parse(fileContent);
          }

          setPreviewBackupData(backupData);
          setIsRestoreModalOpen(true);
        } catch (parseErr) {
          console.error("Failed to parse or decrypt file:", parseErr);
          toast.error("Decryption or parsing failed: " + parseErr.message);
        } finally {
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to read backup file: " + err.message);
      e.target.value = "";
    }
  };

  const handleConfirmRestore = async (mergeStrategy) => {
    if (!previewBackupData) return;

    setIsImporting(true);
    try {
      const { data } = await api.post("/api/chat/restore", {
        backupData: previewBackupData,
        mergeStrategy,
      });

      if (data && data.success) {
        toast.success(data.message || "Backup restored successfully!");
        setIsRestoreModalOpen(false);
        setPreviewBackupData(null);
        const fetchConversations = useChatStore.getState().fetchConversations;
        if (fetchConversations) {
          await fetchConversations();
        }
      } else {
        toast.error(data?.message || "Failed to restore backup");
      }
    } catch (err) {
      console.error("Restore error:", err);
      toast.error("Failed to restore backup: " + (err.response?.data?.message || err.message));
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setEditUsername(currentUser.username || "");
      setEditAbout(currentUser.about || "");
      setPreviewUrl(currentUser.profilePicture || "");
    }
  }, [currentUser]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout?.();
    }
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "This will permanently delete your account. This action cannot be undone. Continue?"
      )
    ) {
      console.log("Account deletion triggered");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSaveSuccess(false);
      setSaveError("");
    }
  };

  const handleSave = async () => {
    if (!editUsername.trim()) {
      setSaveError("Username is required");
      return;
    }
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      let payload;
      if (selectedFile) {
        payload = new FormData();
        payload.append("media", selectedFile);
        payload.append("username", editUsername.trim());
        payload.append("about", editAbout.trim());
      } else {
        payload = {
          username: editUsername.trim(),
          about: editAbout.trim(),
        };
      }

      const res = await updateUserProfile(payload);
      if (res && res.success && res.data) {
        // Update Zustand store
        useUserStore.getState().setUser(res.data);
        setSaveSuccess(true);
        // Automatically return to main settings after short delay
        setTimeout(() => {
          setIsEditingProfile(false);
          setSaveSuccess(false);
          setSelectedFile(null);
        }, 1200);
      } else {
        setSaveError(res?.message || "Failed to update profile");
      }
    } catch (err) {
      setSaveError(err?.message || "Something went wrong while saving changes");
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  if (isEditingProfile) {
    return (
      <div className="h-full overflow-y-auto bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111] flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => {
              setIsEditingProfile(false);
              setSaveError("");
              setSaveSuccess(false);
              setSelectedFile(null);
              setPreviewUrl(currentUser?.profilePicture || "");
            }}
            className="text-[#FF6B00] hover:text-[#E05E00] text-xl font-bold flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            ←
          </button>
          <h2 className="text-xl font-bold">Edit Profile</h2>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col gap-6">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-28 h-28 group mx-auto">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Profile"
                  className="w-28 h-28 rounded-full object-cover border-2 border-[#FF6B00] shadow-md shadow-[#FF6B00]/10"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-[#FF6B00] text-[#FFFFFF] flex items-center justify-center font-bold text-3xl shadow-md shadow-[#FF6B00]/10">
                  {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}

              {/* Hover Overlay */}
              <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-[#FF6B00]/50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Change Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">Upload JPG, PNG or GIF</p>
          </div>

          {/* Feedback Messages */}
          {saveError && (
            <div className="bg-[#FF3D71]/10 border border-[#FF3D71]/20 text-[#FF3D71] text-xs font-semibold px-4 py-3 rounded-xl">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-xs font-semibold px-4 py-3 rounded-xl">
              Profile updated successfully!
            </div>
          )}

          {/* Form Fields */}
          <div className="flex flex-col gap-4 text-left">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A0A0A0]">
                Username
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter username"
                className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl p-3 text-sm focus:border-[#FF6B00] outline-none text-slate-800 dark:text-[#FFFFFF] w-full transition-colors"
              />
            </div>

            {/* About / Bio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A0A0A0]">
                About / Bio
              </label>
              <textarea
                value={editAbout}
                onChange={(e) => setEditAbout(e.target.value)}
                placeholder="Tell us about yourself"
                rows={3}
                className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl p-3 text-sm focus:border-[#FF6B00] outline-none text-slate-800 dark:text-[#FFFFFF] w-full resize-none transition-colors"
              />
            </div>

            {/* Read-only account info */}
            <div className="mt-2 border-t border-slate-200 dark:border-[#222222] pt-4 flex flex-col gap-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-slate-400 dark:text-[#A0A0A0]">Email</span>
                <span className="text-xs text-slate-800 dark:text-white font-medium">{currentUser?.email || "Not set"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-slate-400 dark:text-[#A0A0A0]">Phone number</span>
                <span className="text-xs text-slate-800 dark:text-white font-medium">
                  {currentUser?.phoneNumber
                    ? `${currentUser?.phoneSuffix || ""} ${currentUser?.phoneNumber}`
                    : "Not set"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-slate-400 dark:text-[#A0A0A0]">Joined date</span>
                <span className="text-xs text-slate-800 dark:text-white font-medium">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-sm font-bold transition-colors shadow-lg shadow-[#FF6B00]/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setIsEditingProfile(false);
                setSaveError("");
                setSaveSuccess(false);
                setSelectedFile(null);
                setPreviewUrl(currentUser?.profilePicture || "");
              }}
              disabled={isSaving}
              className="w-full py-3 rounded-xl border border-slate-200 dark:border-[#222222] hover:bg-slate-100 dark:hover:bg-[#111111] text-slate-800 dark:text-[#FFFFFF] text-sm font-bold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111] flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-xl font-bold">Settings</h2>
        <StatusSelector />
      </div>

      {/* Profile card */}
      <div
        onClick={() => setIsEditingProfile(true)}
        className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer"
      >
        {currentUser?.profilePicture ? (
          <img
            src={currentUser.profilePicture}
            alt=""
            className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#FF6B00] text-[#FFFFFF] flex items-center justify-center font-bold text-lg flex-shrink-0">
            {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
            {currentUser?.username || currentUser?.name || "Your name"}
          </p>
          <p className="text-xs text-slate-400 dark:text-[#A0A0A0] truncate mt-1">
            {currentUser?.about || "Hey there! I am using Flash Chat"}
          </p>
        </div>
        <span className="text-[#A0A0A0] text-lg font-bold">›</span>
      </div>

      {/* Account section */}
      <SectionLabel text="Account" />
      <SettingRow
        label="Phone number"
        value={currentUser?.phoneNumber ? `${currentUser?.phoneSuffix || ""} ${currentUser?.phoneNumber}` : "Not set"}
      />
      <SettingRow
        label="Email"
        value={currentUser?.email || "Not set"}
      />

      {/* Appearance */}
      <SectionLabel text="Appearance" />
      <ToggleRow
        label="Dark theme"
        checked={isDark}
        onChange={toggleTheme}
      />

      {/* Notifications */}
      <SectionLabel text="Notifications" />
      <ToggleRow
        label="Message notifications"
        checked={notificationsEnabled}
        onChange={() => setNotificationsEnabled((prev) => !prev)}
      />

      {/* Privacy */}
      <SectionLabel text="Privacy" />
      <ToggleRow
        label="Read receipts"
        checked={currentUser?.privacySettings?.readReceipts !== false}
        onChange={() => updatePrivacy("readReceipts", !(currentUser?.privacySettings?.readReceipts !== false))}
      />
      <SelectRow
        label="Last seen visibility"
        value={currentUser?.privacySettings?.lastSeen || "everyone"}
        options={[
          { label: "Everyone", value: "everyone" },
          { label: "My Contacts", value: "contacts" },
          { label: "Nobody", value: "nobody" }
        ]}
        onChange={(val) => updatePrivacy("lastSeen", val)}
      />
      <SelectRow
        label="Profile photo visibility"
        value={currentUser?.privacySettings?.profilePhoto || "everyone"}
        options={[
          { label: "Everyone", value: "everyone" },
          { label: "My Contacts", value: "contacts" },
          { label: "Nobody", value: "nobody" }
        ]}
        onChange={(val) => updatePrivacy("profilePhoto", val)}
      />
      <SelectRow
        label="About visibility"
        value={currentUser?.privacySettings?.about || "everyone"}
        options={[
          { label: "Everyone", value: "everyone" },
          { label: "My Contacts", value: "contacts" },
          { label: "Nobody", value: "nobody" }
        ]}
        onChange={(val) => updatePrivacy("about", val)}
      />

      {/* Backup & Restore */}
      <SectionLabel text="Backup & Restore" />
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111] text-left">
        <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">
          Save your chats and messages to your local device or restore them from a previous backup file.
        </p>
        <div className="flex gap-3 mt-1">
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-[#FF6B00]/10"
          >
            {isExporting ? "Exporting..." : "📤 Export Backup"}
          </button>
          <label className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#222222] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-[#FFFFFF] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center">
            {isImporting ? "Restoring..." : "📥 Restore Backup"}
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Security & Sessions */}
      <SectionLabel text="Security & Devices" />
      <div
        onClick={() => setIsSessionsModalOpen(true)}
        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
      >
        <SettingRow
          label="Active login sessions"
          value="Manage devices"
          arrow={true}
        />
      </div>

      {/* Help */}
      <SectionLabel text="Help" />
      <SettingRow label="App version" value="1.0.0" arrow={false} />

      {/* Danger zone */}
      <div className="mt-6 border-t border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111]">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-3.5 border-b border-slate-200 dark:border-[#222222] text-[#FF9E00] hover:bg-slate-100 dark:hover:bg-[#1c1c1c] font-semibold text-sm transition-colors"
        >
          Logout
        </button>
        <button
          onClick={handleDeleteAccount}
          className="w-full text-left px-4 py-3.5 text-[#FF3D71] hover:bg-slate-100 dark:hover:bg-[#1c1c1c] font-semibold text-sm transition-colors"
        >
          Delete account
        </button>
      </div>

      {/* Modals */}
      <ActiveSessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
      />

      <BackupPreviewModal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setPreviewBackupData(null);
        }}
        backupData={previewBackupData}
        onConfirmRestore={handleConfirmRestore}
        isRestoring={isImporting}
      />
    </div>
  );
};

const SectionLabel = ({ text }) => (
  <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A0A0A0] text-left">
    {text}
  </p>
);

const SettingRow = ({ label, value, arrow = true }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111]">
    <span className="text-sm text-slate-800 dark:text-[#FFFFFF]">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 dark:text-[#A0A0A0]">{value}</span>
      {arrow && <span className="text-[#A0A0A0] text-sm">›</span>}
    </div>
  </div>
);

const ToggleRow = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111]">
    <span className="text-sm text-slate-800 dark:text-[#FFFFFF]">{label}</span>
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`w-10 h-6 rounded-full relative transition-colors ${
        checked ? "bg-[#00E676]" : "bg-slate-200 dark:bg-[#222222]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

const SelectRow = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#111111]">
    <span className="text-sm text-slate-800 dark:text-[#FFFFFF]">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-xs text-[#FF6B00] font-bold border-none outline-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#111111] text-slate-800 dark:text-[#FFFFFF]">
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export default Setting;