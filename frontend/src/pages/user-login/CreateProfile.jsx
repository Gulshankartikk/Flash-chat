import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, User, Sparkles, ArrowRight, Trash2, ShieldCheck } from "lucide-react";
import { createProfile } from "../../services/user.service";
import useUserStore from "../../store/useUserStore";

const CreateProfile = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const updateProfileInStore = useUserStore((state) => state.updateProfile);

  const [displayName, setDisplayName] = useState(user?.displayName && !user.displayName.startsWith("User ") ? user.displayName : "");
  const [about, setAbout] = useState(user?.about || "Hey there! I am using Flash Chat");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.profilePicture || user?.avatarUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds 5MB limit.");
      return;
    }

    setError("");
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhotoFile(null);
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      let payload;
      if (photoFile) {
        payload = new FormData();
        payload.append("displayName", displayName.trim());
        payload.append("about", about.trim());
        payload.append("profilePicture", photoFile);
      } else {
        payload = {
          displayName: displayName.trim(),
          about: about.trim(),
          profilePicture: photoPreview || "",
        };
      }

      const res = await createProfile(payload);
      const updatedUser = res?.data?.user || res?.user;

      if (updatedUser) {
        setUser({ ...updatedUser, profileCompleted: true });
      } else {
        updateProfileInStore({
          displayName: displayName.trim(),
          about: about.trim(),
          profilePicture: photoPreview || user?.profilePicture,
          profileCompleted: true,
        });
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Create profile error:", err);
      setError(err?.message || "Unable to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const flashIdDisplay = user?.flashId || (user?._id ? `FC-${user._id.slice(-6).toUpperCase()}` : "FC-FLASH");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white font-sans text-slate-100">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3 group hover:scale-105 transition-transform duration-300">
            <Sparkles className="w-7 h-7 text-slate-950" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/20 mb-2">
            <span>FLASH ⚡</span>
            <span>•</span>
            <span>Welcome</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-50 tracking-tight">
            Create Your Profile
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Set up your public identity on Flash Chat
          </p>

          {/* Flash ID Pill */}
          <div className="mt-3 px-3.5 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs font-mono text-emerald-300 flex items-center gap-2">
            <span className="text-slate-400">⚡ Flash ID:</span>
            <span className="font-bold tracking-wide">{flashIdDisplay}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-medium flex items-center gap-2 animate-shake">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center justify-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 hover:border-emerald-500 cursor-pointer flex items-center justify-center group overflow-hidden transition-all duration-300 shadow-inner"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                  <Camera className="w-7 h-7 mb-1" />
                  <span className="text-[10px] font-medium">+ Photo</span>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                {photoPreview ? "Change Photo" : "+ Add Profile Photo"}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>

          {/* Display Name (Required) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Your Name <span className="text-emerald-400">*</span></span>
              <span className="text-[10px] text-slate-500 lowercase font-normal">Required</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                maxLength={30}
                required
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* About / Bio (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>About / Status</span>
              <span className="text-[10px] text-slate-500 lowercase font-normal">Optional</span>
            </label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Hey there! I am using Flash Chat"
              maxLength={80}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-6 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Complete Profile & Enter Flash</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero passwords • End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default CreateProfile;
