const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const supportController = require('../controllers/supportController');

// All admin/support agent routes require authentication and support/admin role
router.use(protect);
router.use(requireRole('support', 'admin'));

router.get('/tickets', supportController.getAdminTickets);
router.patch('/tickets/:id', supportController.updateAdminTicket);
router.post('/tickets/:id/reply', supportController.agentReply);

router.get('/canned', supportController.getCannedReplies);
router.post('/canned', supportController.createCannedReply);
router.delete('/canned/:id', supportController.deleteCannedReply);

module.exports = router;
