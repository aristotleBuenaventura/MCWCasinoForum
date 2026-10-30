export async function sendMail(input: { to: string; subject: string; text: string }) {
  const webhook = process.env.MAIL_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return;
    } catch (err) {
      console.error("Mail webhook failed", err);
    }
  }
  console.info(`[mail] to=${input.to} subject=${input.subject}\n${input.text}`);
}

export function publicAppUrl() {
  return (process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
}
