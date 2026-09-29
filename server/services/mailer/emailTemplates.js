/**
 * Clean responsive HTML email templates with plain-text fallbacks
 */

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  line-height: 1.6;
  background-color: #f8fafc;
  padding: 40px 20px;
`;

const cardStyles = `
  max-width: 560px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  border: 1px solid #e2e8f0;
`;

const headerStyles = `
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  padding: 32px 30px;
  text-align: center;
  color: #ffffff;
`;

const bodyStyles = `
  padding: 32px 30px;
`;

const footerStyles = `
  background: #f1f5f9;
  padding: 20px 30px;
  text-align: center;
  font-size: 12px;
  color: #64748b;
  border-top: 1px solid #e2e8f0;
`;

const btnStyles = `
  display: inline-block;
  background: #4f46e5;
  color: #ffffff !important;
  font-weight: 600;
  padding: 12px 28px;
  border-radius: 8px;
  text-decoration: none;
  margin-top: 20px;
`;

function wrapTemplate(title, contentHtml) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; ${baseStyles}">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <div style="${cardStyles}">
              <div style="${headerStyles}">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">⚡ Flash Chat</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Instant, Secure & Modern Communication</p>
              </div>
              <div style="${bodyStyles}">
                ${contentHtml}
              </div>
              <div style="${footerStyles}">
                <p style="margin: 0 0 8px 0;">This email was sent securely by Flash Chat.</p>
                <p style="margin: 0;">If you did not initiate this request, please secure your account immediately.</p>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

module.exports = {
  // 1. Welcome Email
  welcomeEmail: ({ name, clientUrl }) => ({
    subject: '⚡ Welcome to Flash Chat!',
    text: `Hello ${name}!\n\nWelcome to Flash Chat — the lightning-fast, real-time messaging app.\n\nStart chatting: ${clientUrl}\n\nHappy chatting,\nThe Flash Chat Team`,
    html: wrapTemplate(
      'Welcome to Flash Chat',
      `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Welcome aboard, ${name}! 🎉</h2>
      <p style="color: #475569; font-size: 15px;">We are thrilled to have you here. Flash Chat delivers blazing fast, real-time conversations, file sharing, group channels, and instant presence updates.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${clientUrl}" style="${btnStyles}">Launch Flash Chat</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Need help? Just reply to this email anytime.</p>
      `
    )
  }),

  // 2. Login Alert Email
  loginAlertEmail: ({ name, time, ip, device }) => ({
    subject: 'Security Alert: New sign-in to Flash Chat',
    text: `Hi ${name},\n\nA new sign-in was detected on your Flash Chat account.\nTime: ${time}\nIP Address: ${ip}\nDevice/Browser: ${device}\n\nIf this was not you, please reset your password immediately.`,
    html: wrapTemplate(
      'New Sign-in Alert',
      `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">New Login Detected 🛡️</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name}, we detected a new login to your Flash Chat account with the following details:</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>🕒 Time:</strong> ${time}</p>
        <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>🌐 IP Address:</strong> ${ip}</p>
        <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>💻 Device/Browser:</strong> ${device}</p>
      </div>
      <p style="color: #dc2626; font-size: 14px; font-weight: 600;">If this was not you, please reset your password immediately to safeguard your account.</p>
      `
    )
  }),

  // 3. Email Verification / OTP
  otpVerificationEmail: ({ name, otp }) => ({
    subject: `⚡ ${otp} is your Flash Chat verification code`,
    text: `Hi ${name},\n\nYour Flash Chat verification OTP is: ${otp}\n\nThis code expires in 10 minutes. Never share this code with anyone.`,
    html: wrapTemplate(
      'Verification Code',
      `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Verify Your Email Address</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name}, please use the one-time verification code below to complete your registration or verification:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; background: #eef2ff; padding: 14px 28px; border-radius: 12px; border: 1px dashed #6366f1;">
          ${otp}
        </span>
      </div>
      <p style="color: #64748b; font-size: 13px; text-align: center;">This code will expire in 10 minutes. For your security, do not share this code with anyone.</p>
      `
    )
  }),

  // 4. Password Reset
  passwordResetEmail: ({ name, resetUrl }) => ({
    subject: 'Flash Chat: Password Reset Request',
    text: `Hi ${name},\n\nYou requested a password reset for your Flash Chat account.\n\nReset your password here: ${resetUrl}\n\nThis link is valid for 1 hour. If you didn't request this, ignore this email.`,
    html: wrapTemplate(
      'Reset Your Password',
      `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Password Reset Request 🔑</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name}, we received a request to reset your password. Click the button below to choose a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="${btnStyles}">Reset My Password</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      `
    )
  }),

  // 5. Offline Messages Digest
  offlineDigestEmail: ({ name, senderName, count, clientUrl }) => ({
    subject: `⚡ You have ${count} unread message${count > 1 ? 's' : ''} on Flash Chat`,
    text: `Hi ${name},\n\nYou have ${count} new unread message${count > 1 ? 's' : ''} from ${senderName} on Flash Chat.\n\nCatch up now: ${clientUrl}`,
    html: wrapTemplate(
      'Unread Messages Digest',
      `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">You've Got Messages! 💬</h2>
      <p style="color: #475569; font-size: 15px;">Hi ${name}, while you were away, you received <strong>${count} unread message${count > 1 ? 's' : ''}</strong> from <strong>${senderName}</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${clientUrl}" style="${btnStyles}">Open Flash Chat</a>
      </div>
      `
    )
  })
};
