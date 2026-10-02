const express = require('express');
const router = express.Router();

const pocketController = require('../controllers/pocketController');
const authMiddleware = require('../middleware/authMiddleware');
const { attachPocketAuth } = require('../middleware/pocketPinMiddleware');
const { pocketPinLimiter, pocketExportLimiter } = require('../middleware/rateLimiter');

// All Pocket routes require authenticated session & attach optional X-Pocket-Token state
router.use(authMiddleware);
router.use(attachPocketAuth);

// --- Items CRUD & Bulk Operations ---
router.post('/items', pocketController.createItem);
router.get('/items', pocketController.getItems);
router.get('/items/:id', pocketController.getItemById);
router.patch('/items/:id', pocketController.updateItem);
router.delete('/items/:id', pocketController.softDeleteItem);
router.post('/items/bulk', pocketController.bulkAction);

// --- Trash & Permanent Deletion ---
router.get('/trash', pocketController.getTrash);
router.post('/items/:id/restore', pocketController.restoreTrashItem);
router.delete('/items/:id/permanent', pocketController.permanentDeleteItem);

// --- Folders CRUD & Reorder ---
router.get('/folders', pocketController.getFolders);
router.post('/folders', pocketController.createFolder);
router.patch('/folders/:id', pocketController.updateFolder);
router.delete('/folders/:id', pocketController.deleteFolder);
router.post('/folders/reorder', pocketController.reorderFolders);

// --- Tags ---
router.get('/tags', pocketController.getTags);
router.post('/tags/rename', pocketController.renameTag);

// --- Cross-linking: Save From Anywhere ---
router.post('/save', pocketController.saveFromAnywhere);
router.post('/save-starred', pocketController.saveStarredMessages);

// --- Link Preview (SSRF Protected) ---
router.get('/preview', pocketController.getLinkPreview);
router.post('/preview', pocketController.getLinkPreview);

// --- Storage Metrics ---
router.get('/storage', pocketController.getStorage);

// --- Export Vault Data ---
router.post('/export', pocketExportLimiter, pocketController.startExport);
router.get('/export/:jobId', pocketController.getExportStatus);
router.get('/export/:jobId/download', pocketController.downloadExport);

// --- PIN Lock & Brute-force Protected Verification ---
router.post('/pin', pocketController.setPin);
router.post('/pin/verify', pocketPinLimiter, pocketController.verifyPin);
router.delete('/pin', pocketController.removePin);

// --- Search ---
router.get('/search', pocketController.searchItems);

module.exports = router;
