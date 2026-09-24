const express = require("express");
const adminController = require("../../controllers/adminController");
const authMiddleware = require("../../middleware/authMiddleware");
const { requirePlatformAdmin } = require("../../middleware/rbacMiddleware");

const router = express.Router();

router.get("/stats", authMiddleware, requirePlatformAdmin, adminController.getPlatformStats);
router.get("/feature-flags", authMiddleware, adminController.getFeatureFlags);
router.put("/feature-flags", authMiddleware, requirePlatformAdmin, adminController.updateFeatureFlag);

module.exports = router;
