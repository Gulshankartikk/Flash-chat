const express = require("express");
const contactController = require("../controllers/contactController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply authMiddleware globally to all contact routes
router.use(authMiddleware);

router.post("/request", contactController.sendContactRequest);
router.get("/", contactController.getContacts);
router.get("/requests", contactController.getPendingRequests);
router.patch("/:contactId/accept", contactController.acceptContactRequest);
router.patch("/:contactId/reject", contactController.rejectContactRequest);
router.patch("/:contactId/block", contactController.blockContact);

module.exports = router;
