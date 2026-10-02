import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, UserCheck, Shield } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { SocialAvatar } from './SocialAvatar';
import {
  fetchPendingFollowRequestsApi,
  acceptFollowRequestApi,
  rejectFollowRequestApi
} from '../api/api';

export const FollowRequestsModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetchPendingFollowRequestsApi();
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load follow requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen]);

  const handleAccept = async (requestId) => {
    // Optimistic removal
    setRequests((prev) => prev.filter((r) => r._id !== requestId));
    try {
      await acceptFollowRequestApi(requestId);
    } catch (err) {
      console.error('Failed to accept request:', err);
      loadRequests();
    }
  };

  const handleReject = async (requestId) => {
    // Optimistic removal
    setRequests((prev) => prev.filter((r) => r._id !== requestId));
    try {
      await rejectFollowRequestApi(requestId);
    } catch (err) {
      console.error('Failed to reject request:', err);
      loadRequests();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Follow Requests" size="sm">
      <div className="flex flex-col max-h-[60vh] p-3 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#FED7AA]/40" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-2.5 rounded-full bg-[#FED7AA]/40" />
                  <div className="w-16 h-2 rounded-full bg-[#FED7AA]/30" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Shield className="w-10 h-10 text-[#FED7AA] mx-auto stroke-1" />
            <p className="text-xs font-bold text-[#1F2937]">No pending follow requests</p>
            <p className="text-[11px] text-[#6B7280]">
              When people request to follow your private account, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req._id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FFF7ED]/50 border border-[#FED7AA]/40"
              >
                <div
                  onClick={() => {
                    onClose();
                    navigate(`/u/${req.follower?.username}`);
                  }}
                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                >
                  <SocialAvatar src={req.follower?.avatar} alt={req.follower?.username} size="sm" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-[#1F2937]">
                        {req.follower?.username}
                      </span>
                      {req.follower?.isVerified && (
                        <span className="w-3 h-3 rounded-full bg-[#F97316] text-white text-[8px] flex items-center justify-center font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#6B7280]">{req.follower?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAccept(req._id)}
                    className="px-3 py-1 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Confirm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(req._id)}
                    className="p-1 rounded-full text-[#6B7280] hover:text-[#F43F5E] hover:bg-rose-50 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
