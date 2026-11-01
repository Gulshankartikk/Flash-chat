const { z } = require('zod');
const pushService = require('../services/pushService');
const PushSubscription = require('../models/PushSubscription');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// Validation schema for subscription
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(5)
  }),
  userAgent: z.string().optional()
});

/**
 * GET /api/push/public-key
 * Returns VAPID public key for browser push subscription
 */
exports.getPublicKey = asyncHandler(async (req, res) => {
  const publicKey = pushService.getPublicKey();
  res.json({
    success: true,
    publicKey
  });
});

/**
 * POST /api/push/subscribe
 * Register or update browser PushSubscription
 */
exports.subscribe = asyncHandler(async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid subscription payload',
      errors: parsed.error.issues
    });
  }

  const { endpoint, keys, userAgent } = parsed.data;

  // Upsert subscription for user
  const sub = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: req.user._id,
      endpoint,
      keys,
      userAgent: userAgent || req.headers['user-agent'] || '',
      lastUsedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info({ userId: req.user._id, endpoint: endpoint.slice(0, 30) }, 'Push subscription saved');

  res.status(201).json({
    success: true,
    message: 'Push notifications subscribed successfully.',
    subscriptionId: sub._id
  });
});

/**
 * DELETE /api/push/subscribe
 * Unsubscribe a specific browser endpoint
 */
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (typeof endpoint !== 'string' || !endpoint) {
    return res.status(400).json({
      success: false,
      message: 'Endpoint is required to unsubscribe.'
    });
  }

  const deleted = await PushSubscription.findOneAndDelete({
    user: req.user._id,
    endpoint
  });

  res.json({
    success: true,
    message: 'Push subscription removed.',
    removed: !!deleted
  });
});

/**
 * POST /api/push/test
 * Send a test push notification to user's registered devices
 */
exports.sendTestPush = asyncHandler(async (req, res) => {
  const result = await pushService.sendToUser(req.user._id, {
    category: 'chat',
    title: '⚡ Flash Chat Test Notification',
    body: 'Web push is configured and working perfectly on your device!',
    tag: 'test_notification',
    data: {
      url: '/chats',
      type: 'test'
    }
  });

  res.json({
    success: result.success,
    deliveredCount: result.deliveredCount || 0,
    details: result
  });
});
