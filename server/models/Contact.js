const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      trim: true,
      default: null
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    linkedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    isFavorite: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
contactSchema.index(
  { owner: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } }
  }
);

contactSchema.index(
  { owner: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string', $gt: '' } }
  }
);

contactSchema.index(
  { owner: 1, linkedUser: 1 },
  {
    unique: true,
    partialFilterExpression: { linkedUser: { $type: 'objectId' } }
  }
);

contactSchema.index({ owner: 1, name: 1 });
contactSchema.index({ owner: 1, isFavorite: -1, name: 1 });

module.exports = mongoose.model('Contact', contactSchema);
