const nodemailer = require('nodemailer');
const config = require('../../config/env');
const logger = require('../../utils/logger');
const templates = require('./emailTemplates');

class MailerService {
  constructor() {
    this.transporter = null;
    this.authMode = 'none';
    this.isReady = false;
    this.queue = [];
    this.isProcessingQueue = false;

    this.initTransporter();
  }

  /**
   * Initialize Nodemailer transporter with connection pooling (pool: true)
   * Prefers Gmail OAuth2; falls back to App Password; or simulated mode if no credentials.
   */
  initTransporter() {
    const hasOAuth = Boolean(
      config.GMAIL_USER &&
      config.GOOGLE_CLIENT_ID &&
      config.GOOGLE_CLIENT_SECRET &&
      config.GMAIL_REFRESH_TOKEN
    );

    const hasAppPassword = Boolean(
      config.GMAIL_USER &&
      config.GMAIL_APP_PASSWORD
    );

    if (hasOAuth) {
      this.authMode = 'OAuth2';
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        auth: {
          type: 'OAuth2',
          user: config.GMAIL_USER,
          clientId: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET,
          refreshToken: config.GMAIL_REFRESH_TOKEN
        }
      });
    } else if (hasAppPassword) {
      this.authMode = 'AppPassword';
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        auth: {
          user: config.GMAIL_USER,
          pass: config.GMAIL_APP_PASSWORD
        }
      });
    } else {
      this.authMode = 'Simulated';
      logger.warn(
        '⚠️ No Gmail credentials configured. Mailer running in SIMULATED mode (emails logged to console).'
      );
    }
  }

  /**
   * Verify SMTP connection at server startup
   */
  async verifyConnection() {
    if (!this.transporter) {
      logger.info({ mode: this.authMode }, 'Mailer verification: In-memory simulation mode active.');
      this.isReady = true;
      return true;
    }

    try {
      await this.transporter.verify();
      this.isReady = true;
      logger.info(
        { mode: this.authMode, user: logger.maskEmail(config.GMAIL_USER) },
        '✅ Nodemailer SMTP Transporter verified successfully'
      );
      return true;
    } catch (error) {
      this.isReady = false;
      logger.error(
        { mode: this.authMode, error: error.message },
        '❌ Nodemailer verification failed. Check OAuth2 refresh token or App Password.'
      );
      return false;
    }
  }

  /**
   * Enqueue email for asynchronous non-blocking dispatch with retries
   * @param {Object} options - { to, subject, html, text, attempt }
   */
  sendAsync(options) {
    const job = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attempt: options.attempt || 1,
      maxAttempts: 3,
      enqueuedAt: Date.now()
    };

    logger.info(
      {
        event: 'queued',
        recipient: logger.maskEmail(job.to),
        subject: job.subject,
        attempt: job.attempt
      },
      'Email enqueued for asynchronous dispatch'
    );

    // Non-blocking execution via setImmediate
    setImmediate(() => {
      this.processEmailJob(job);
    });
  }

  /**
   * Process email sending with exponential backoff retry (up to 3 attempts)
   * @param {Object} job
   */
  async processEmailJob(job) {
    if (!this.transporter) {
      logger.info(
        {
          event: 'simulated_send',
          recipient: logger.maskEmail(job.to),
          subject: job.subject
        },
        '✉️ [SIMULATED EMAIL SENT] (Configure GMAIL_USER and GMAIL_APP_PASSWORD or OAuth to deliver actual email)'
      );
      return;
    }

    const mailOptions = {
      from: `"Flash Chat" <${config.GMAIL_USER || 'no-reply@flashchat.com'}>`,
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(
        {
          event: 'sent',
          recipient: logger.maskEmail(job.to),
          subject: job.subject,
          messageId: info.messageId,
          attempts: job.attempt
        },
        'Email successfully delivered'
      );
    } catch (error) {
      logger.error(
        {
          event: 'failed',
          recipient: logger.maskEmail(job.to),
          subject: job.subject,
          attempt: job.attempt,
          error: error.message
        },
        `Email delivery attempt ${job.attempt} failed`
      );

      if (job.attempt < job.maxAttempts) {
        job.attempt += 1;
        // Exponential backoff: 2s, 4s, etc.
        const delayMs = Math.pow(2, job.attempt) * 1000;
        logger.info(
          {
            event: 'retry_scheduled',
            recipient: logger.maskEmail(job.to),
            nextAttempt: job.attempt,
            delayMs
          },
          `Scheduling email retry in ${delayMs}ms`
        );

        setTimeout(() => {
          this.processEmailJob(job);
        }, delayMs);
      } else {
        logger.error(
          {
            event: 'exhausted',
            recipient: logger.maskEmail(job.to),
            subject: job.subject,
            totalAttempts: job.maxAttempts
          },
          'Email delivery permanently failed after maximum retries'
        );
      }
    }
  }

  // Specialized dispatchers

  sendWelcome(email, name) {
    const tpl = templates.welcomeEmail({ name, clientUrl: config.CLIENT_URL });
    this.sendAsync({ to: email, ...tpl });
  }

  sendLoginAlert(email, { name, time, ip, device }) {
    const tpl = templates.loginAlertEmail({ name, time, ip, device });
    this.sendAsync({ to: email, ...tpl });
  }

  sendOtp(email, name, otp) {
    const tpl = templates.otpVerificationEmail({ name, otp });
    this.sendAsync({ to: email, ...tpl });
  }

  sendPasswordReset(email, name, resetUrl) {
    const tpl = templates.passwordResetEmail({ name, resetUrl });
    this.sendAsync({ to: email, ...tpl });
  }

  sendOfflineDigest(email, { name, senderName, count }) {
    const tpl = templates.offlineDigestEmail({
      name,
      senderName,
      count,
      clientUrl: config.CLIENT_URL
    });
    this.sendAsync({ to: email, ...tpl });
  }

  /**
   * Graceful close of mailer pool on server shutdown
   */
  async close() {
    if (this.transporter && typeof this.transporter.close === 'function') {
      this.transporter.close();
      logger.info('Nodemailer connection pool closed.');
    }
  }
}

// Export singleton instance
const mailer = new MailerService();
module.exports = mailer;
