const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const contactController = require('../controllers/contactController');

// All contact routes require authenticated session
router.use(protect);

router.get('/', contactController.getContacts);
router.post('/', contactController.createContact);
router.post('/bulk', contactController.bulkImportContacts);

router.get('/:id', contactController.getContactById);
router.patch('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

router.post('/:id/message', contactController.startChatWithContact);
router.post('/:id/invite', contactController.inviteContact);

module.exports = router;
