const Contact = require('../models/Contact');
const ContactInvite = require('../models/ContactInvite');
const User = require('../models/User');
const Block = require('../models/Block');
const logger = require('../utils/logger');

// Strip HTML and dangerous script tags
const sanitizeText = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

class ContactService {
  /**
   * Find matching registered User for a phone or email, respecting privacy & blocks
   */
  async findMatchingUser(phone, email, ownerId) {
    try {
      let candidate = null;

      if (phone && phone.trim()) {
        candidate = await User.findOne({
          phoneNumber: phone.trim(),
          discoverableByPhone: { $ne: false },
          _id: { $ne: ownerId }
        }).select('_id name username avatar isOnline lastSeen isPrivate isVerified');
      }

      if (!candidate && email && email.trim()) {
        candidate = await User.findOne({
          email: email.toLowerCase().trim(),
          discoverableByEmail: { $ne: false },
          _id: { $ne: ownerId }
        }).select('_id name username avatar isOnline lastSeen isPrivate isVerified');
      }

      if (!candidate) return null;

      // Verify no active block in either direction
      const isBlocked = await Block.findOne({
        $or: [
          { blocker: ownerId, blocked: candidate._id },
          { blocker: candidate._id, blocked: ownerId }
        ]
      });

      if (isBlocked) return null;

      return candidate._id;
    } catch (err) {
      logger.error({ err: err.message }, 'Error in findMatchingUser');
      return null;
    }
  }

  /**
   * Create a new contact
   */
  async createContact(ownerId, data) {
    const name = sanitizeText(data.name);
    const phone = data.phone ? data.phone.trim() : null;
    const email = data.email ? data.email.toLowerCase().trim() : null;
    const note = sanitizeText(data.note);
    const avatar = data.avatar || '';
    const isFavorite = !!data.isFavorite;

    if (!name) {
      const err = new Error('Contact name is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!phone && !email) {
      const err = new Error('At least one of phone number or email is required.');
      err.statusCode = 400;
      throw err;
    }

    // Maximum limit check
    const totalCount = await Contact.countDocuments({ owner: ownerId });
    if (totalCount >= 2000) {
      const err = new Error('Maximum limit of 2,000 contacts reached.');
      err.statusCode = 400;
      throw err;
    }

    // Duplicate check for this owner
    if (phone) {
      const existingPhone = await Contact.findOne({ owner: ownerId, phone });
      if (existingPhone) {
        const err = new Error(`A contact with phone number "${phone}" already exists (${existingPhone.name}).`);
        err.statusCode = 409;
        err.existingContactId = existingPhone._id;
        throw err;
      }
    }

    if (email) {
      const existingEmail = await Contact.findOne({ owner: ownerId, email });
      if (existingEmail) {
        const err = new Error(`A contact with email "${email}" already exists (${existingEmail.name}).`);
        err.statusCode = 409;
        err.existingContactId = existingEmail._id;
        throw err;
      }
    }

    const linkedUserId = await this.findMatchingUser(phone, email, ownerId);

    const contact = await Contact.create({
      owner: ownerId,
      name,
      phone,
      email,
      note,
      avatar,
      isFavorite,
      linkedUser: linkedUserId
    });

    return Contact.findById(contact._id)
      .populate('linkedUser', '_id name username avatar isOnline lastSeen isPrivate isVerified')
      .lean();
  }

  /**
   * Update an existing contact
   */
  async updateContact(ownerId, contactId, updates) {
    const contact = await Contact.findOne({ _id: contactId, owner: ownerId });
    if (!contact) {
      const err = new Error('Contact not found.');
      err.statusCode = 404;
      throw err;
    }

    if (updates.name !== undefined) {
      contact.name = sanitizeText(updates.name) || contact.name;
    }
    if (updates.note !== undefined) {
      contact.note = sanitizeText(updates.note);
    }
    if (updates.avatar !== undefined) {
      contact.avatar = updates.avatar;
    }
    if (updates.isFavorite !== undefined) {
      contact.isFavorite = !!updates.isFavorite;
    }

    let phoneOrEmailChanged = false;

    if (updates.phone !== undefined) {
      const newPhone = updates.phone ? updates.phone.trim() : null;
      if (newPhone !== contact.phone) {
        if (newPhone) {
          const duplicate = await Contact.findOne({ owner: ownerId, phone: newPhone, _id: { $ne: contactId } });
          if (duplicate) {
            const err = new Error(`A contact with phone "${newPhone}" already exists (${duplicate.name}).`);
            err.statusCode = 409;
            throw err;
          }
        }
        contact.phone = newPhone;
        phoneOrEmailChanged = true;
      }
    }

    if (updates.email !== undefined) {
      const newEmail = updates.email ? updates.email.toLowerCase().trim() : null;
      if (newEmail !== contact.email) {
        if (newEmail) {
          const duplicate = await Contact.findOne({ owner: ownerId, email: newEmail, _id: { $ne: contactId } });
          if (duplicate) {
            const err = new Error(`A contact with email "${newEmail}" already exists (${duplicate.name}).`);
            err.statusCode = 409;
            throw err;
          }
        }
        contact.email = newEmail;
        phoneOrEmailChanged = true;
      }
    }

    if (!contact.phone && !contact.email) {
      const err = new Error('Contact must retain at least one of phone number or email.');
      err.statusCode = 400;
      throw err;
    }

    if (phoneOrEmailChanged) {
      contact.linkedUser = await this.findMatchingUser(contact.phone, contact.email, ownerId);
    }

    await contact.save();

    return Contact.findById(contact._id)
      .populate('linkedUser', '_id name username avatar isOnline lastSeen isPrivate isVerified')
      .lean();
  }

  /**
   * Delete contact (Owner only)
   */
  async deleteContact(ownerId, contactId) {
    const deleted = await Contact.findOneAndDelete({ _id: contactId, owner: ownerId });
    if (!deleted) {
      const err = new Error('Contact not found.');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: 'Contact deleted successfully.' };
  }

  /**
   * Get contact by ID (Owner only)
   */
  async getContactById(ownerId, contactId) {
    const contact = await Contact.findOne({ _id: contactId, owner: ownerId })
      .populate('linkedUser', '_id name username avatar isOnline lastSeen isPrivate isVerified')
      .lean();
    if (!contact) {
      const err = new Error('Contact not found.');
      err.statusCode = 404;
      throw err;
    }
    return contact;
  }

  /**
   * List contacts with search, filter, pagination and optional A-Z letter grouping
   */
  async getContacts(ownerId, { q, favorites, page = 1, limit = 100, groupByLetter = false }) {
    const query = { owner: ownerId };

    if (favorites === 'true' || favorites === true) {
      query.isFavorite = true;
    }

    if (q && q.trim()) {
      const escaped = escapeRegex(q.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(200, parseInt(limit, 10));
    const take = Math.min(200, parseInt(limit, 10));

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ isFavorite: -1, name: 1 })
        .skip(skip)
        .limit(take)
        .populate('linkedUser', '_id name username avatar isOnline lastSeen isPrivate isVerified')
        .lean(),
      Contact.countDocuments(query)
    ]);

    if (groupByLetter === 'true' || groupByLetter === true) {
      const grouped = {};
      for (const item of contacts) {
        const firstLetter = (item.name[0] || '#').toUpperCase();
        const key = /^[A-Z]$/.test(firstLetter) ? firstLetter : '#';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      }
      return {
        contacts,
        grouped,
        total,
        page: parseInt(page, 10),
        limit: take
      };
    }

    return {
      contacts,
      total,
      page: parseInt(page, 10),
      limit: take
    };
  }

  /**
   * Bulk import contacts (max 200 per batch)
   */
  async bulkImport(ownerId, rawContacts = []) {
    if (!Array.isArray(rawContacts)) {
      const err = new Error('Contacts payload must be an array.');
      err.statusCode = 400;
      throw err;
    }

    const batch = rawContacts.slice(0, 200);
    const imported = [];
    const failed = [];

    const currentCount = await Contact.countDocuments({ owner: ownerId });
    let remainingCapacity = Math.max(0, 2000 - currentCount);

    for (let i = 0; i < batch.length; i++) {
      const rowNum = i + 1;
      const row = batch[i];

      if (remainingCapacity <= 0) {
        failed.push({
          row: rowNum,
          name: row.name || 'Unknown',
          error: 'Maximum capacity of 2,000 contacts reached.'
        });
        continue;
      }

      try {
        const contact = await this.createContact(ownerId, row);
        imported.push(contact);
        remainingCapacity--;
      } catch (err) {
        failed.push({
          row: rowNum,
          name: row.name || 'Unknown',
          error: err.message
        });
      }
    }

    return {
      totalReceived: rawContacts.length,
      processed: batch.length,
      importedCount: imported.length,
      failedCount: failed.length,
      imported,
      failed
    };
  }

  /**
   * Send invite to an unregistered contact with rate limiting (10/day) & 7-day cooldown
   */
  async inviteContact(ownerId, contactId) {
    const contact = await Contact.findOne({ _id: contactId, owner: ownerId });
    if (!contact) {
      const err = new Error('Contact not found.');
      err.statusCode = 404;
      throw err;
    }

    if (contact.linkedUser) {
      const err = new Error('Contact is already registered on Flash Chat.');
      err.statusCode = 400;
      throw err;
    }

    const identifier = contact.phone || contact.email;
    if (!identifier) {
      const err = new Error('Contact has no valid phone or email to send invitation.');
      err.statusCode = 400;
      throw err;
    }

    // Rate Limit: 10 invites per user per 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentInvitesCount = await ContactInvite.countDocuments({
      sender: ownerId,
      invitedAt: { $gte: dayAgo }
    });

    if (recentInvitesCount >= 10) {
      const err = new Error('Daily invitation limit reached (maximum 10 invites per day).');
      err.statusCode = 429;
      throw err;
    }

    // Cooldown: Never invite same identifier twice in 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existingInvite = await ContactInvite.findOne({
      sender: ownerId,
      identifier: identifier.toLowerCase().trim(),
      invitedAt: { $gte: weekAgo }
    });

    if (existingInvite) {
      const err = new Error('An invitation was already sent to this recipient within the last 7 days.');
      err.statusCode = 429;
      throw err;
    }

    // Record invitation
    await ContactInvite.create({
      sender: ownerId,
      identifier: identifier.toLowerCase().trim(),
      type: contact.phone ? 'phone' : 'email'
    });

    logger.info({ ownerId, identifier }, 'Flash Chat invitation dispatched successfully');

    return {
      success: true,
      message: `Invitation successfully sent to ${contact.name}.`,
      identifier
    };
  }

  /**
   * Link contacts of other owners when a new user registers
   */
  async linkContactsForNewUser(newUser) {
    try {
      const queries = [];
      if (newUser.phoneNumber && newUser.discoverableByPhone !== false) {
        queries.push({ phone: newUser.phoneNumber });
      }
      if (newUser.email && newUser.discoverableByEmail !== false) {
        queries.push({ email: newUser.email.toLowerCase() });
      }

      if (queries.length === 0) return;

      const matchingContacts = await Contact.find({
        $or: queries,
        owner: { $ne: newUser._id },
        linkedUser: null
      });

      for (const contact of matchingContacts) {
        // Verify no active block
        const isBlocked = await Block.findOne({
          $or: [
            { blocker: contact.owner, blocked: newUser._id },
            { blocker: newUser._id, blocked: contact.owner }
          ]
        });

        if (!isBlocked) {
          contact.linkedUser = newUser._id;
          await contact.save();
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed linking contacts for new user');
    }
  }

  /**
   * Get map of linked userId -> custom saved contact name for an owner
   */
  async getSavedContactNamesMap(ownerId) {
    if (!ownerId) return {};
    const contacts = await Contact.find({
      owner: ownerId,
      linkedUser: { $ne: null }
    }).select('name linkedUser').lean();

    const map = {};
    for (const c of contacts) {
      if (c.linkedUser) {
        map[String(c.linkedUser)] = c.name;
      }
    }
    return map;
  }
}

module.exports = new ContactService();
