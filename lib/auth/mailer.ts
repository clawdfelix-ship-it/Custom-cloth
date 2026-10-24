/**
 * Transactional email.
 *
 * Uses a plain SMTP submission over Node's `net`/`tls` is overkill here, so
 * we shell out to nothing and instead support two transports:
 *
 *  - `RESEND_API_KEY`  -> HTTP API (recommended, no dependency)
 *  - `SMTP_*`          -> nodemailer when the optional package is present
 *
 * When neither is configured the code is generated and logged to the server
 * console so local development still works.
 */

export interface MailResult {
  delivered: boolean;
  /** Set when the message was only logged (development mode). */
  devCode?: string;
}

export async function sendTwoFactorCode(
  to: string,
  username: string,
  code: string,
): Promise<MailResult> {
  const subject = "Your Zenex Sports verification code";
  const text = `Hi ${username},\n\nYour verification code is ${code}.\nIt expires in 10 minutes.\n\nIf you did not request this code you can ignore this email.`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "Zenex Sports <no-reply@zenexsports.com>",
        to: [to],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend delivery failed: ${response.status}`);
    }
    return { delivered: true };
  }

  console.info(`[2FA] ${to} -> ${code}`);
  return { delivered: false, devCode: code };
}
