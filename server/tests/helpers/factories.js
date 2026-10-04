/**
 * Flash Chat Test Helpers - Data Factories
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');
const { generateAccessToken, generateRefreshToken } = require('../../services/auth/authService');

let idCounter = 1;

function generateMongoId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const machineId = '4f8b9c';
  const processId = '1234';
  const counter = (idCounter++).toString(16).padStart(6, '0');
  return `${timestamp}${machineId}${processId}${counter}`.slice(0, 24);
}

function createUserFactory(overrides = {}) {
  const id = overrides._id || generateMongoId();
  const username = overrides.username || `user_${id.slice(-6)}`;
  return {
    _id: id,
    id,
    phone: overrides.phone || `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    email: overrides.email || `${username}@flashchat.io`,
    name: overrides.name || `User ${username}`,
    username,
    avatar: overrides.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Test',
    bio: overrides.bio || 'Testing Flash Chat super-app',
    isOnboarded: overrides.isOnboarded !== undefined ? overrides.isOnboarded : true,
    isPrivateAccount: overrides.isPrivateAccount || false,
    privacySettings: {
      lastSeen: overrides.lastSeen || 'everyone',
      profilePhoto: overrides.profilePhoto || 'everyone',
      readReceipts: overrides.readReceipts !== undefined ? overrides.readReceipts : true
    },
    aiSettings: {
      aiEnabled: overrides.aiEnabled !== undefined ? overrides.aiEnabled : true,
      aiInChats: overrides.aiInChats !== undefined ? overrides.aiInChats : true,
      aiUsesPocket: overrides.aiUsesPocket !== undefined ? overrides.aiUsesPocket : false
    },
    pushSettings: {
      pushEnabled: overrides.pushEnabled !== undefined ? overrides.pushEnabled : true,
      pushMessages: overrides.pushMessages !== undefined ? overrides.pushMessages : true,
      pushCalls: overrides.pushCalls !== undefined ? overrides.pushCalls : true,
      pushSocial: overrides.pushSocial !== undefined ? overrides.pushSocial : true,
      pushPreview: overrides.pushPreview !== undefined ? overrides.pushPreview : true,
      quietHours: overrides.quietHours || { start: '', end: '', timezone: 'UTC' }
    },
    ...overrides
  };
}

function createAuthTokens(user) {
  const accessToken = jwt.sign(
    { userId: user._id || user.id, username: user.username },
    config.JWT_ACCESS_SECRET || 'test_jwt_access_secret_super_secure_12345',
    { expiresIn: '15m' }
  );

  const sessionId = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { userId: user._id || user.id, sessionId },
    config.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_super_secure_67890',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken, sessionId };
}

function createMessageFactory(senderId, conversationId, overrides = {}) {
  const id = overrides._id || generateMongoId();
  return {
    _id: id,
    id,
    conversationId,
    senderId,
    text: overrides.text || 'Hello world!',
    type: overrides.type || 'text',
    status: overrides.status || 'sent',
    mediaUrl: overrides.mediaUrl || null,
    clientId: overrides.clientId || `client_${Date.now()}_${Math.random()}`,
    reactions: [],
    readBy: [],
    deliveredTo: [],
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createPocketItemFactory(userId, overrides = {}) {
  const id = overrides._id || generateMongoId();
  return {
    _id: id,
    id,
    userId,
    title: overrides.title || 'Important Project Note',
    type: overrides.type || 'note',
    content: overrides.content || 'Zero-knowledge personal note stored in vault.',
    isEncrypted: overrides.isEncrypted || false,
    isLocked: overrides.isLocked || false,
    folderId: overrides.folderId || null,
    tags: overrides.tags || ['work', 'important'],
    isTrash: false,
    trashedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

module.exports = {
  generateMongoId,
  createUserFactory,
  createAuthTokens,
  createMessageFactory,
  createPocketItemFactory
};
