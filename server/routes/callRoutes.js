const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Get ICE servers configuration (STUN/TURN)
router.get('/ice-config', callController.getIceConfig);

// Call history endpoints
router.get('/', callController.getCallHistory);
router.get('/:id', callController.getCallById);
router.delete('/:id', callController.deleteCallHistoryItem);

module.exports = router;
