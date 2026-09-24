import React, { useState } from "react";
import { X, Building2, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import * as businessApi from "../../services/business.service";
import useBusinessStore from "../../store/useBusinessStore";

const CreateOrgModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("Technology");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrganizations = useBusinessStore((s) => s.loadOrganizations);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide an organization name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await businessApi.createOrganization({
        name: name.trim(),
        description: description.trim(),
        website: website.trim(),
        category,
      });

      if (res?.data) {
        toast.success(`Organization '${res.data.name}' created!`);
        await loadOrganizations();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-lg">
            <div className="p-2 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
              <Building2 size={20} />
            </div>
            <span>Create Business Workspace</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
              Company / Organization Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Innovations"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
              Description / Bio
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of your business activities..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
              >
                <option value="Technology">Technology</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Consulting">Consulting</option>
                <option value="Education">Education</option>
                <option value="Customer Support">Support Team</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#FF6B00] hover:bg-[#E05E00] rounded-xl shadow-md shadow-[#FF6B00]/25 transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>Create Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrgModal;
