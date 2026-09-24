const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: "General",
    },
    description: {
      type: String,
      default: "",
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

teamSchema.index({ organization: 1, name: 1 }, { unique: true });
teamSchema.index({ organization: 1, members: 1 });

module.exports =
  mongoose.models.Team ||
  mongoose.model("Team", teamSchema);
