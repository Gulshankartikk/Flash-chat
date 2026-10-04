const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const supportController = require('../controllers/supportController');

// Public or Semi-Public Help endpoints
router.get('/faq', supportController.getFaq);
router.get('/policy', supportController.getSupportPolicy);

// Protected Customer Support routes
router.use(protect);

router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getUserTickets);
router.get('/tickets/:id', supportController.getTicketDetail);
router.post('/tickets/:id/handoff', supportController.requestHumanHandoff);
router.post('/tickets/:id/human-handoff', supportController.requestHumanHandoff);
router.post('/tickets/:id/rate', supportController.rateTicket);
router.post('/tickets/:id/close', supportController.closeTicket);

module.exports = router;
