// Email transport seam. No provider is wired up yet, so for now we just log the
// message to the server console. Swap the body of these functions for a real
// provider (e.g. Resend, Postmark, SES) to start delivering mail — the call
// sites and signatures stay the same.
//
// TODO: wire an email provider so password-reset links reach users in production.

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  console.info(`[mail] Password reset for ${email} — link (dev only, not emailed yet): ${resetUrl}`)
}
