const mongoose = require('mongoose');

const pocketFolderSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: 60
    },
    color: {
      type: String,
      default: '#F97316' // Flash Chat primary orange
    },
    icon: {
      type: String,
      default: 'folder',
      trim: true
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PocketFolder',
      default: null
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring no duplicate folder names per user within the same parent folder
pocketFolderSchema.index({ owner: 1, name: 1, parent: 1 }, { unique: true });
pocketFolderSchema.index({ owner: 1, order: 1 });

module.exports = mongoose.model('PocketFolder', pocketFolderSchema);
