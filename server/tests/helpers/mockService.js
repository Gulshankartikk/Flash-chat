/**
 * Flash Chat Test Helpers - Service Mocks & Spies
 */

class MockStorage {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
  }

  async get(key) {
    if (this.expirations.has(key) && Date.now() > this.expirations.get(key)) {
      this.store.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key, value, mode, duration) {
    this.store.set(key, value);
    if (mode === 'EX' && duration) {
      this.expirations.set(key, Date.now() + duration * 1000);
    }
    return 'OK';
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        this.expirations.delete(key);
        count++;
      }
    }
    return count;
  }

  async incr(key) {
    const val = parseInt(this.store.get(key) || '0', 10) + 1;
    this.store.set(key, String(val));
    return val;
  }

  async expire(key, seconds) {
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  clear() {
    this.store.clear();
    this.expirations.clear();
  }
}

const mockRedis = new MockStorage();

const recordedCalls = {
  sms: [],
  emails: [],
  push: [],
  cloudinary: [],
  gemini: []
};

const mockTwilio = {
  messages: {
    create: async (payload) => {
      recordedCalls.sms.push(payload);
      return { sid: `SM_${Date.now()}`, ...payload };
    }
  },
  verify: {
    v2: {
      services: () => ({
        verifications: {
          create: async (payload) => {
            recordedCalls.sms.push(payload);
            return { status: 'pending', ...payload };
          }
        }
      })
    }
  }
};

const mockNodemailer = {
  createTransport: () => ({
    sendMail: async (mailOptions) => {
      recordedCalls.emails.push(mailOptions);
      return { messageId: `msg_${Date.now()}`, ...mailOptions };
    }
  })
};

const mockWebPush = {
  sendNotification: async (subscription, payload, options) => {
    if (subscription.endpoint?.includes('expired-410')) {
      const err = new Error('Subscription expired');
      err.statusCode = 410;
      throw err;
    }
    recordedCalls.push.push({ subscription, payload, options });
    return { statusCode: 201 };
  },
  generateVAPIDKeys: () => ({
    publicKey: 'mock_vapid_public_key_1234567890',
    privateKey: 'mock_vapid_private_key_0987654321'
  }),
  setVapidDetails: () => {}
};

const mockCloudinary = {
  uploader: {
    upload_stream: (options, callback) => {
      recordedCalls.cloudinary.push({ action: 'upload', options });
      const stream = {
        write: () => {},
        end: () => {
          callback(null, {
            secure_url: 'https://res.cloudinary.com/flashchat/image/upload/v1234/test.jpg',
            public_id: `flash_chat_${Date.now()}`,
            bytes: 1024,
            format: 'jpg'
          });
        }
      };
      return stream;
    },
    destroy: async (publicId) => {
      recordedCalls.cloudinary.push({ action: 'destroy', publicId });
      return { result: 'ok' };
    }
  }
};

function resetMocks() {
  mockRedis.clear();
  recordedCalls.sms = [];
  recordedCalls.emails = [];
  recordedCalls.push = [];
  recordedCalls.cloudinary = [];
  recordedCalls.gemini = [];
}

module.exports = {
  mockRedis,
  recordedCalls,
  mockTwilio,
  mockNodemailer,
  mockWebPush,
  mockCloudinary,
  resetMocks
};
