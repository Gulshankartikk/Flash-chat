const callService = require('../services/callService');
const Conversation = require('../models/Conversation');
const Call = require('../models/Call');
const logger = require('../utils/logger');

// Store active ring timeouts: callId -> timeoutId
const ringTimeouts = new Map();

// Store disconnect grace timers: userId -> timeoutId
const disconnectGraceTimers = new Map();

/**
 * Register Call & WebRTC signaling socket handlers
 */
const registerCallHandlers = (io, socket, { onlineUserSockets }) => {
  const userId = socket.user._id.toString();

  // If this user recently disconnected with grace timer, clear it on reconnect
  if (disconnectGraceTimers.has(userId)) {
    clearTimeout(disconnectGraceTimers.get(userId));
    disconnectGraceTimers.delete(userId);
    logger.info({ userId }, 'User reconnected within 15s grace period for active call');
  }

  // ---------------------------------------------------------------------------
  // 1. call:start
  // ---------------------------------------------------------------------------
  socket.on('call:start', async (payload, ack) => {
    try {
      const { conversationId, type = 'audio' } = payload;
      if (!conversationId) {
        if (ack) ack({ success: false, message: 'conversationId is required.' });
        return;
      }

      // 1. Verify membership
      const conv = await Conversation.findOne({
        _id: conversationId,
        'members.user': userId
      }).populate('members.user', '_id name username avatar isOnline lastSeen privacy');

      if (!conv) {
        if (ack) ack({ success: false, message: 'Conversation not found or not a member.' });
        return;
      }

      // Check if caller is already in an active call
      const callerActiveCall = await callService.getActiveCall(userId);
      if (callerActiveCall) {
        if (ack) ack({ success: false, message: 'You are already in an active call.' });
        return;
      }

      const isGroup = conv.type === 'group';
      const otherMembers = conv.members.filter(
        (m) => String(m.user._id || m.user) !== userId
      );

      // Check group limit: max 4 participants in mesh WebRTC
      if (isGroup && conv.members.length > 4) {
        if (ack) ack({ success: false, message: 'Group calls currently limited to max 4 participants.' });
        return;
      }

      // 1:1 call checks (offline & busy checks)
      if (!isGroup && otherMembers.length === 1) {
        const calleeId = String(otherMembers[0].user._id || otherMembers[0].user);
        const calleeSockets = onlineUserSockets.get(calleeId);
        const isCalleeOnline = calleeSockets && calleeSockets.size > 0;

        // If callee is offline
        if (!isCalleeOnline) {
          const call = await Call.create({
            conversation: conversationId,
            caller: userId,
            participants: [
              { user: userId, status: 'joined', joinedAt: new Date() },
              { user: calleeId, status: 'missed', leftAt: new Date() }
            ],
            type,
            isGroup: false,
            status: 'ended',
            startedAt: new Date(),
            endedAt: new Date(),
            duration: 0,
            endReason: 'offline'
          });

          await callService.insertCallSystemMessage(call, 'offline', 0);

          if (ack) {
            ack({
              success: false,
              status: 'offline',
              message: 'Recipient is currently offline.',
              call
            });
          }
          return;
        }

        // Check if callee is already in another call
        const calleeActiveCall = await callService.getActiveCall(calleeId);
        if (calleeActiveCall) {
          const call = await Call.create({
            conversation: conversationId,
            caller: userId,
            participants: [
              { user: userId, status: 'joined', joinedAt: new Date() },
              { user: calleeId, status: 'declined', leftAt: new Date() }
            ],
            type,
            isGroup: false,
            status: 'busy',
            startedAt: new Date(),
            endedAt: new Date(),
            duration: 0,
            endReason: 'busy'
          });

          await callService.insertCallSystemMessage(call, 'busy', 0);

          if (ack) {
            ack({
              success: false,
              status: 'busy',
              message: 'Recipient is on another call.',
              call
            });
          }
          return;
        }
      }

      // Create new call record
      const call = await callService.createCall({
        conversationId,
        callerId: userId,
        type
      });

      // Join caller to call room
      socket.join(`call:${call._id}`);

      // Ring all other participants
      otherMembers.forEach((m) => {
        const targetUserId = String(m.user._id || m.user);
        io.to(`user:${targetUserId}`).emit('call:incoming', {
          call,
          caller: socket.user
        });
      });

      // 45-second ring timeout
      const ringTimer = setTimeout(async () => {
        try {
          ringTimeouts.delete(String(call._id));
          const currentCall = await Call.findById(call._id);
          if (currentCall && currentCall.status === 'ringing') {
            await callService.endCall(call._id, userId, 'missed');

            // Notify caller & participants
            io.to(`call:${call._id}`).emit('call:missed', { callId: call._id });
            otherMembers.forEach((m) => {
              const targetUserId = String(m.user._id || m.user);
              io.to(`user:${targetUserId}`).emit('call:missed', { callId: call._id });
            });
          }
        } catch (err) {
          logger.warn({ err: err.message, callId: call._id }, 'Error during ring timeout');
        }
      }, 45000);

      ringTimeouts.set(String(call._id), ringTimer);

      if (ack) ack({ success: true, status: 'ringing', call });
    } catch (err) {
      logger.error({ err: err.message }, 'Error in call:start');
      if (ack) ack({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. call:accept
  // ---------------------------------------------------------------------------
  socket.on('call:accept', async ({ callId }, ack) => {
    try {
      if (!callId) return;

      // Clear ring timeout if active
      if (ringTimeouts.has(String(callId))) {
        clearTimeout(ringTimeouts.get(String(callId)));
        ringTimeouts.delete(String(callId));
      }

      const updatedCall = await callService.acceptCall(callId, userId);

      // Join socket to call room
      socket.join(`call:${callId}`);

      // Notify caller and peers in room
      const callerId = String(updatedCall.caller._id || updatedCall.caller);
      io.to(`user:${callerId}`).emit('call:accepted', {
        callId,
        participant: socket.user
      });

      socket.to(`call:${callId}`).emit('call:participant-joined', {
        callId,
        user: socket.user
      });

      if (ack) ack({ success: true, call: updatedCall });
    } catch (err) {
      logger.error({ err: err.message, callId }, 'Error in call:accept');
      if (ack) ack({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. call:decline
  // ---------------------------------------------------------------------------
  socket.on('call:decline', async ({ callId }, ack) => {
    try {
      if (!callId) return;

      // Clear ring timeout
      if (ringTimeouts.has(String(callId))) {
        clearTimeout(ringTimeouts.get(String(callId)));
        ringTimeouts.delete(String(callId));
      }

      const updatedCall = await callService.declineCall(callId, userId, 'declined');

      const callerId = String(updatedCall.caller._id || updatedCall.caller);
      io.to(`user:${callerId}`).emit('call:declined', {
        callId,
        participantId: userId
      });

      if (ack) ack({ success: true });
    } catch (err) {
      logger.error({ err: err.message, callId }, 'Error in call:decline');
      if (ack) ack({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. call:cancel (caller cancels while ringing)
  // ---------------------------------------------------------------------------
  socket.on('call:cancel', async ({ callId }, ack) => {
    try {
      if (!callId) return;

      if (ringTimeouts.has(String(callId))) {
        clearTimeout(ringTimeouts.get(String(callId)));
        ringTimeouts.delete(String(callId));
      }

      const call = await Call.findById(callId);
      if (call && call.status === 'ringing') {
        await callService.endCall(callId, userId, 'canceled');
        socket.to(`call:${callId}`).emit('call:ended', {
          callId,
          reason: 'canceled'
        });

        // Notify participants in personal rooms in case not joined call room yet
        call.participants.forEach((p) => {
          const targetUserId = String(p.user);
          if (targetUserId !== userId) {
            io.to(`user:${targetUserId}`).emit('call:ended', {
              callId,
              reason: 'canceled'
            });
          }
        });
      }

      if (ack) ack({ success: true });
    } catch (err) {
      logger.error({ err: err.message, callId }, 'Error in call:cancel');
      if (ack) ack({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. call:end
  // ---------------------------------------------------------------------------
  socket.on('call:end', async ({ callId }, ack) => {
    try {
      if (!callId) return;

      if (ringTimeouts.has(String(callId))) {
        clearTimeout(ringTimeouts.get(String(callId)));
        ringTimeouts.delete(String(callId));
      }

      const endedCall = await callService.endCall(callId, userId, 'completed');

      if (endedCall) {
        io.to(`call:${callId}`).emit('call:ended', {
          callId,
          reason: 'completed',
          duration: endedCall.duration
        });

        // Also notify conversation room
        io.to(`conv:${endedCall.conversation}`).emit('call:ended', {
          callId,
          reason: 'completed',
          duration: endedCall.duration
        });
      }

      socket.leave(`call:${callId}`);
      if (ack) ack({ success: true, call: endedCall });
    } catch (err) {
      logger.error({ err: err.message, callId }, 'Error in call:end');
      if (ack) ack({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. WebRTC Mesh Signaling: call:offer
  // ---------------------------------------------------------------------------
  socket.on('call:offer', ({ callId, toUserId, sdp }) => {
    if (!toUserId || !sdp) return;
    io.to(`user:${toUserId}`).emit('call:offer', {
      callId,
      fromUserId: userId,
      sdp
    });
  });

  // ---------------------------------------------------------------------------
  // 7. WebRTC Mesh Signaling: call:answer
  // ---------------------------------------------------------------------------
  socket.on('call:answer', ({ callId, toUserId, sdp }) => {
    if (!toUserId || !sdp) return;
    io.to(`user:${toUserId}`).emit('call:answer', {
      callId,
      fromUserId: userId,
      sdp
    });
  });

  // ---------------------------------------------------------------------------
  // 8. WebRTC Mesh Signaling: call:ice
  // ---------------------------------------------------------------------------
  socket.on('call:ice', ({ callId, toUserId, candidate }) => {
    if (!toUserId || !candidate) return;
    io.to(`user:${toUserId}`).emit('call:ice', {
      callId,
      fromUserId: userId,
      candidate
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Call Track Toggle (Mute mic, camera toggle)
  // ---------------------------------------------------------------------------
  socket.on('call:toggle', ({ callId, audio, video }) => {
    if (!callId) return;
    socket.to(`call:${callId}`).emit('call:peer-toggle', {
      callId,
      fromUserId: userId,
      audio,
      video
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Switch Audio to Video
  // ---------------------------------------------------------------------------
  socket.on('call:switch-to-video', async ({ callId }) => {
    if (!callId) return;
    try {
      await Call.findByIdAndUpdate(callId, { type: 'video' });
      io.to(`call:${callId}`).emit('call:switch-to-video', {
        callId,
        fromUserId: userId
      });
    } catch (err) {
      logger.warn({ err: err.message, callId }, 'Error in call:switch-to-video');
    }
  });
};

/**
 * Handle user disconnection with 15s grace period for active calls
 */
const handleCallDisconnect = async (io, userId) => {
  try {
    const activeCallId = await callService.getActiveCall(userId);
    if (!activeCallId) return;

    logger.info({ userId, activeCallId }, 'User disconnected with active call, starting 15s grace period');

    // Give 15 seconds grace for reconnect
    const timer = setTimeout(async () => {
      try {
        disconnectGraceTimers.delete(userId);
        const currentActive = await callService.getActiveCall(userId);
        if (String(currentActive) === String(activeCallId)) {
          logger.info({ userId, activeCallId }, 'Grace period expired, ending active call');
          const endedCall = await callService.endCall(activeCallId, userId, 'disconnected');
          if (endedCall) {
            io.to(`call:${activeCallId}`).emit('call:ended', {
              callId: activeCallId,
              reason: 'disconnected',
              duration: endedCall.duration
            });
          }
        }
      } catch (err) {
        logger.warn({ err: err.message, userId }, 'Error in call disconnect grace timeout');
      }
    }, 15000);

    disconnectGraceTimers.set(userId, timer);
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Error handling call disconnect');
  }
};

module.exports = {
  registerCallHandlers,
  handleCallDisconnect
};
