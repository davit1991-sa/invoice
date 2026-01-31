import * as nodemailer from 'nodemailer';

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export class EmailService {
  private transporter = this.createTransporter();

  private createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

    // If SMTP not configured, fallback to a "mock" transporter that logs.
    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async send(params: SendEmailParams) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

    if (!this.transporter) {
      // Mock mode
      console.log('[EmailService] SMTP not configured. Would send:', {
        to: params.to,
        subject: params.subject,
        text: params.text,
        attachments: params.attachments?.map((a) => ({ filename: a.filename, size: a.content.length })),
      });
      return { mock: true };
    }

    const info = await this.transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/octet-stream',
      })),
    });

    return { messageId: info.messageId };
  }
}
