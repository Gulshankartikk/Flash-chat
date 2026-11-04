const ScheduledMessage = require('../models/ScheduledMessage');
const chatService = require('./chatService');
const Conversation = require('../models/Conversation');
const logger = require('../utils/logger');

let ioInstance = null;
let intervalRef = null;

const initScheduler = (io) => {
  ioInstance = io;
  if (!intervalRef) {
    intervalRef = setInterval(dispatchDueMessages, 15000);
    logger.info('Message scheduler initialized (15s interval)');
  }
};

const stopScheduler = () => {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
};

const dispatchDueMessages = async () => {
  try {
    const now = new Date();
    const dueMessages = await ScheduledMessage.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).limit(50);

    for (const scheduled of dueMessages) {
      try {
        const payload = {
          conversationId: scheduled.conversation.toString(),
          type: scheduled.type,
          text: scheduled.text,
          media: scheduled.media,
          location: scheduled.location,
          poll: scheduled.poll,
          replyTo: scheduled.replyTo ? scheduled.replyTo.toString() : undefined
        };

        const sentMessage = await chatService.sendMessage(scheduled.sender, payload);

        scheduled.status = 'sent';
        await scheduled.save();

        if (ioInstance) {
          ioInstance.to(`conv:${scheduled.conversation}`).emit('message:new', sentMessage);
          try {
            const conv = await Conversation.findById(scheduled.conversation).select('members').lean();
            if (conv?.members) {
              conv.members.forEach((m) => {
                const mId = String(m.user);
                ioInstance.to(`user:${mId}`).emit('conversation:updated', {
                  conversationId: conv._id,
                  lastMessage: sentMessage
                });
                if (mId !== String(scheduled.sender)) {
                  ioInstance.to(`user:${mId}`).emit('message:new', sentMessage);
                }
              });
            }
          } catch (e) {
            // non-blocking
          }
        }
      } catch (err) {
        logger.error({ err: err.message, scheduledId: scheduled._id }, 'Failed to dispatch scheduled message');
        scheduled.status = 'cancelled';
        await scheduled.save();
      }
    }
  } catch (error) {
    logger.error({ err: error.message }, 'Error in dispatchDueMessages');
  }
};

const scheduleMessage = async (userId, data) => {
  const { conversationId, type = 'text', text = '', media = [], location, poll, scheduledFor, replyTo } = data;

  if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
    throw new Error('Scheduled date must be in the future.');
  }

  const isMember = await chatService.isMember(conversationId, userId);
  if (!isMember) {
    throw new Error('You are not a member of this conversation.');
  }

  const scheduled = await ScheduledMessage.create({
    conversation: conversationId,
    sender: userId,
    type,
    text,
    media,
    location,
    poll,
    replyTo: replyTo || null,
    scheduledFor: new Date(scheduledFor),
    status: 'pending'
  });

  return scheduled;
};

const getScheduledMessages = async (userId, conversationId) => {
  const query = { sender: userId, status: 'pending' };
  if (conversationId) {
    query.conversation = conversationId;
  }
  return ScheduledMessage.find(query).sort({ scheduledFor: 1 }).lean();
};

const cancelScheduledMessage = async (userId, id) => {
  const scheduled = await ScheduledMessage.findOne({ _id: id, sender: userId, status: 'pending' });
  if (!scheduled) {
    throw new Error('Scheduled message not found or cannot be cancelled.');
  }
  scheduled.status = 'cancelled';
  await scheduled.save();
  return { success: true, message: 'Scheduled message cancelled' };
};

module.exports = {
  initScheduler,
  stopScheduler,
  dispatchDueMessages,
  scheduleMessage,
  getScheduledMessages,
  cancelScheduledMessage
};
