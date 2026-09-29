const mailer = require('../services/mailer/mailerService');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Dev-only test email endpoint
 * POST /api/mail/test
 */
const sendTestEmail = async (req, res, next) => {
  try {
    const targetEmail = req.body.email || req.user.email;
    const recipientName = req.user.name || 'Valued User';

    logger.info(
      { recipient: logger.maskEmail(targetEmail), triggeredBy: req.user._id },
      'Test email dispatch initiated'
    );

    mailer.sendAsync({
      to: targetEmail,
      subject: '⚡ Flash Chat: Diagnostic Test Email',
      text: `Hello ${recipientName}!\n\nThis is a diagnostic test email verifying that Nodemailer and your Gmail configuration are functioning properly in Flash Chat.\n\nTimestamp: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; background: #f8fafc; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0;">⚡ Flash Chat Diagnostic Email</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>This email confirms that your Nodemailer mailer service and Gmail SMTP settings are operating smoothly!</p>
          <div style="background: #eef2ff; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 13px;">
            Status: Operational<br/>
            Mailer Mode: ${mailer.authMode}<br/>
            Timestamp: ${new Date().toISOString()}
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: `Test email successfully enqueued for delivery to ${logger.maskEmail(targetEmail)}. Check server logs for delivery status.`,
      authMode: mailer.authMode
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendTestEmail
};
