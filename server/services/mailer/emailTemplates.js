/**
 * Flash Chat - Clean responsive HTML email templates with plain-text fallbacks
 * Styled strictly with Flash Chat Single Source of Truth Design Tokens:
 * cream: #FFF7ED, card: #FFFFFF, primary: #F97316, secondary: #EC4899,
 * accent: #F43F5E, ink: #1F2937, muted: #6B7280, line: #FED7AA.
 */

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1F2937;
  line-height: 1.6;
  background-color: #FFF7ED;
  padding: 40px 20px;
`;

const cardStyles = `
  max-width: 560px;
  margin: 0 auto;
  background: #FFFFFF;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.1), 0 8px 10px -6px rgba(249, 115, 22, 0.05);
  border: 1px solid #FED7AA;
`;

const headerStyles = `
  background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
  padding: 32px 30px;
  text-align: center;
  color: #FFFFFF;
`;

const bodyStyles = `
  padding: 32px 30px;
`;

const footerStyles = `
  background: #FFF7ED;
  padding: 20px 30px;
  text-align: center;
  font-size: 12px;
  color: #6B7280;
  border-top: 1px solid #FED7AA;
`;

const btnStyles = `
  display: inline-block;
  background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
  color: #FFFFFF !important;
  font-weight: 700;
  padding: 14px 30px;
  border-radius: 12px;
  text-decoration: none;
  margin-top: 20px;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);
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
                <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">⚡ Flash Chat</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.95; font-size: 14px; font-weight: 500;">Instant, Secure & Modern Communication</p>
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
      <h2 style="margin-top: 0; color: #1F2937; font-size: 20px; font-weight: 800;">Welcome aboard, ${name}! 🎉</h2>
      <p style="color: #6B7280; font-size: 15px; line-height: 1.6;">We are thrilled to have you here. Flash Chat delivers blazing fast, real-time conversations, voice/video calls, social reels, encrypted Pocket vault, and Flash AI assistant.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${clientUrl}" style="${btnStyles}">Launch Flash Chat</a>
      </div>
      <p style="color: #6B7280; font-size: 13px;">Need help? Just reply to this email anytime or visit the in-app Support desk.</p>
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
      <h2 style="margin-top: 0; color: #1F2937; font-size: 20px; font-weight: 800;">New Login Detected 🛡️</h2>
      <p style="color: #6B7280; font-size: 15px;">Hi ${name}, we detected a new login to your Flash Chat account with the following details:</p>
      <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <p style="margin: 6px 0; font-size: 14px; color: #1F2937;"><strong>🕒 Time:</strong> ${time}</p>
        <p style="margin: 6px 0; font-size: 14px; color: #1F2937;"><strong>🌐 IP Address:</strong> ${ip}</p>
        <p style="margin: 6px 0; font-size: 14px; color: #1F2937;"><strong>💻 Device/Browser:</strong> ${device}</p>
      </div>
      <p style="color: #F43F5E; font-size: 14px; font-weight: 600;">If this was not you, please reset your password immediately to safeguard your account.</p>
      `
    )
  }),

  // 3. Email Verification / OTP
  otpVerificationEmail: ({ name, otp }) => ({
    subject: `⚡ ${otp} is your Flash Chat verification code`,
    text: `Hi ${name},\n\nYour Flash Chat verification OTP is: ${otp}\n\nThis code expires in 5 minutes. Never share this code with anyone.`,
    html: wrapTemplate(
      'Verification Code',
      `
      <h2 style="margin-top: 0; color: #1F2937; font-size: 20px; font-weight: 800;">Verify Your Email Address</h2>
      <p style="color: #6B7280; font-size: 15px;">Hi ${name}, please use the one-time verification code below to complete your sign-in or verification:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #F97316; background: #FFF7ED; padding: 14px 28px; border-radius: 12px; border: 2px dashed #F97316; font-family: monospace;">
          ${otp}
        </span>
      </div>
      <p style="color: #6B7280; font-size: 13px; text-align: center;">This code will expire in 5 minutes. For your security, never share this code with anyone.</p>
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
      <h2 style="margin-top: 0; color: #1F2937; font-size: 20px; font-weight: 800;">Password Reset Request 🔑</h2>
      <p style="color: #6B7280; font-size: 15px;">Hi ${name}, we received a request to reset your password. Click the button below to choose a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="${btnStyles}">Reset My Password</a>
      </div>
      <p style="color: #6B7280; font-size: 13px;">This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
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
      <h2 style="margin-top: 0; color: #1F2937; font-size: 20px; font-weight: 800;">You've Got Messages! 💬</h2>
      <p style="color: #6B7280; font-size: 15px;">Hi ${name}, while you were away, you received <strong>${count} unread message${count > 1 ? 's' : ''}</strong> from <strong>${senderName}</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${clientUrl}" style="${btnStyles}">Open Flash Chat</a>
      </div>
      `
    )
  })
};
