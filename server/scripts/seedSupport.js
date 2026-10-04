/**
 * Seed Support System Data (Flash Support bot, 2 Agents, 8 FAQs, 5 Canned Replies)
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const SupportFaq = require('../models/SupportFaq');
const SupportCannedReply = require('../models/SupportCannedReply');
const config = require('../config/env');
const logger = require('../utils/logger');

const seedSupportData = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.MONGO_URI);
      logger.info('Connected to MongoDB for support seeding');
    }

    // 1. Seed Flash Support Bot User
    let supportBot = await User.findOne({ username: 'flash_support' });
    if (!supportBot) {
      supportBot = await User.create({
        username: 'flash_support',
        name: 'Flash Support',
        email: 'support@flashchat.internal',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=FlashSupport&backgroundColor=f97316',
        bio: '⚡ Official Flash Chat Help Desk & Customer Support.',
        role: 'support',
        isVerified: true,
        isOnboarded: true
      });
      logger.info('Created Flash Support bot user');
    }

    // 2. Seed 2 Support Agents
    const agents = [
      {
        username: 'agent_alex',
        name: 'Alex Rivera (Support Specialist)',
        email: 'support1@flashchat.internal',
        role: 'support',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexSupport',
        bio: 'Flash Chat Tier-2 Technical Support Engineer.',
        isVerified: true,
        isOnboarded: true
      },
      {
        username: 'agent_sarah',
        name: 'Sarah Chen (Customer Care Lead)',
        email: 'support2@flashchat.internal',
        role: 'support',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahSupport',
        bio: 'Flash Chat Customer Care & Community Lead.',
        isVerified: true,
        isOnboarded: true
      }
    ];

    for (const agent of agents) {
      const existing = await User.findOne({
        $or: [{ email: agent.email }, { username: agent.username }]
      });
      if (!existing) {
        await User.create(agent);
        logger.info(`Created support agent: ${agent.name}`);
      }
    }

    // 3. Seed 8 FAQ Items
    const faqs = [
      {
        category: 'account',
        question: 'How do I change my phone number or email address?',
        answer: 'You can update your contact information under **Profile > Settings > Account Security**. A 6-digit OTP verification code will be sent to your new destination to confirm ownership.',
        keywords: ['phone', 'email', 'number', 'change', 'update', 'account'],
        order: 1
      },
      {
        category: 'pocket',
        question: 'How does Pocket Vault zero-knowledge encryption work?',
        answer: 'Pocket Vault uses client-side AES-256-GCM encryption with PBKDF2 key derivation. Your master PIN is never sent to our servers. Only you hold the decryption keys.',
        keywords: ['pocket', 'vault', 'encryption', 'pin', 'security', 'zero knowledge', 'private'],
        order: 2
      },
      {
        category: 'ai',
        question: 'What is Flash AI and how does it protect my privacy?',
        answer: 'Flash AI is your intelligent multimodal assistant in Flash Chat, powered by Google Gemini. It only accesses messages when explicitly summoned with @ai or inside the dedicated AI tab. Your encrypted Pocket notes are never shared without your explicit consent.',
        keywords: ['ai', 'flash ai', 'gemini', 'privacy', 'smart reply', 'summarize'],
        order: 3
      },
      {
        category: 'calls',
        question: 'Why is my video or audio call not connecting?',
        answer: 'Check that your microphone and camera permissions are allowed in your browser settings. Flash Chat uses peer-to-peer WebRTC with automated Coturn STUN/TURN fallback for firewall traversal.',
        keywords: ['call', 'video', 'audio', 'webrtc', 'microphone', 'camera', 'connection'],
        order: 4
      },
      {
        category: 'bug',
        question: 'How do I report a bug or unexpected behavior?',
        answer: 'Start a support ticket with the "Bug Report" category and include a brief description and screenshot. Our engineering team reviews automated diagnostics attached to the ticket.',
        keywords: ['bug', 'glitch', 'crash', 'issue', 'problem', 'error'],
        order: 5
      },
      {
        category: 'feature',
        question: 'Can I request a new feature for Flash Chat?',
        answer: 'Yes! Select the "Feature Request" category in your support ticket. Our product team curates community feature requests for upcoming sprint releases.',
        keywords: ['feature', 'request', 'idea', 'suggestion', 'roadmap'],
        order: 6
      },
      {
        category: 'billing',
        question: 'Are Flash Chat and Flash AI free to use?',
        answer: 'Yes! Flash Chat core messaging, encrypted calling, social sharing, and Pocket Vault are free. Flash AI features include a generous daily token allowance for all verified accounts.',
        keywords: ['billing', 'free', 'pricing', 'cost', 'subscription', 'plan'],
        order: 7
      },
      {
        category: 'security',
        question: 'How do I review and revoke active login sessions?',
        answer: 'Go to **Profile > Settings > Active Sessions** to view all devices currently logged into your account. You can revoke individual sessions or log out of all devices with one click.',
        keywords: ['session', 'device', 'logout', 'security', 'revoke', 'hack'],
        order: 8
      }
    ];

    for (const f of faqs) {
      await SupportFaq.findOneAndUpdate({ question: f.question }, f, { upsert: true, new: true });
    }
    logger.info('Seeded 8 FAQ articles');

    // 4. Seed 5 Canned Replies
    const canned = [
      {
        shortcut: '/greet',
        title: 'Customer Greeting',
        category: 'greeting',
        content: 'Hello! 👋 Thank you for reaching out to Flash Chat Support. My name is {agent_name} and I will be happy to assist you today.'
      },
      {
        shortcut: '/troubleshoot',
        title: 'Basic Troubleshooting Steps',
        category: 'troubleshooting',
        content: 'Could you please try refreshing the application or clearing your cache? If the problem persists, please let us know your browser version and device model.'
      },
      {
        shortcut: '/pocket',
        title: 'Pocket Vault PIN Recovery Notice',
        category: 'troubleshooting',
        content: 'Because Flash Chat Pocket Vault uses zero-knowledge encryption, our team cannot recover or reset forgotten PINs. You can reset your vault by entering your backup passphrase.'
      },
      {
        shortcut: '/escalate',
        title: 'Engineering Escalation',
        category: 'escalation',
        content: 'I have escalated this issue to our core engineering team for in-depth investigation. We will update you here as soon as we have a fix deployed.'
      },
      {
        shortcut: '/close',
        title: 'Resolution & Closing',
        category: 'closing',
        content: 'I am glad we could help resolve this for you! If you have any further questions, feel free to reopen this ticket or start a new chat. Have a wonderful day!'
      }
    ];

    for (const c of canned) {
      await SupportCannedReply.findOneAndUpdate({ shortcut: c.shortcut }, c, { upsert: true, new: true });
    }
    logger.info('Seeded 5 canned replies');

    logger.info('Support system seeding completed successfully.');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed seeding support data');
  }
};

module.exports = seedSupportData;

if (require.main === module) {
  seedSupportData().then(() => process.exit(0));
}
