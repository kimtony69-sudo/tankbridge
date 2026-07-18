// This runs on Vercel as a serverless function at /api/notify-deal
// Supabase's Database Webhook calls this URL on INSERT (new matched deal)
// into public.deals. Self-report / weekly check-in notifications are handled
// directly by the frontend calling /api/notify-deal-report instead, so this
// function only reacts to brand-new deals.

function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.WEBHOOK_SECRET) {
    const provided = req.headers["x-webhook-secret"];
    if (provided !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
