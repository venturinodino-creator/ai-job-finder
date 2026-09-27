import { Resend } from "resend";
import { getEnv } from "./env";

/** True when the server can actually send mail (RESEND_API_KEY is set). */
export function isEmailConfigured(): boolean {
  return Boolean(getEnv().RESEND_API_KEY);
}

/**
 * Sends a job application on the candidate's behalf. Resend can only send
 * from the app's verified domain, so the mail goes out from EMAIL_FROM with
 * the candidate's own address as reply-to — the recruiter's reply reaches
 * the candidate directly.
 */
export async function sendApplicationEmail(params: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error("Email sending is not configured on this server (RESEND_API_KEY).");
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    attachments: params.attachment ? [{ filename: params.attachment.filename, content: params.attachment.content }] : undefined,
  });
  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}
