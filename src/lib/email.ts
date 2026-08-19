import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM ?? "Blip <onboarding@resend.dev>";

export async function sendChangeEmail(opts: {
  to: string;
  watchUrl: string;
  watchDescription: string;
  summary: string;
}): Promise<void> {
  if (!resend) {
    console.warn("RESEND_API_KEY not set; skipping email send.");
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Blip: change detected on ${opts.watchUrl}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">You never miss a blip.</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #0a0a0a;">
          ${opts.summary}
        </p>
        <p style="font-size: 14px; color: #525252; margin-top: 16px;">
          Watching: ${opts.watchUrl}<br />
          <em>${opts.watchDescription}</em>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
