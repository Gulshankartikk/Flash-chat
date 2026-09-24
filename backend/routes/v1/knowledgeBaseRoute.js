const express = require("express");
const knowledgeBaseController = require("../../controllers/knowledgeBaseController");
const authMiddleware = require("../../middleware/authMiddleware");
const { requireOrgMember, requirePermission } = require("../../middleware/rbacMiddleware");
const { PERMISSIONS } = require("../../constants/roles");

const router = express.Router();

router.get(
  "/documents",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.KB_QUERY),
  knowledgeBaseController.getDocuments
);

router.post(
  "/documents",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.KB_UPLOAD),
  knowledgeBaseController.uploadDocument
);

router.delete(
  "/documents/:docId",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.KB_DELETE),
  knowledgeBaseController.deleteDocument
);

router.post(
  "/query",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.KB_QUERY),
  knowledgeBaseController.testQuery
);

module.exports = router;
