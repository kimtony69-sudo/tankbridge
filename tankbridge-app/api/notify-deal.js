// DEPRECATED: new-deal admin notifications are now sent directly by the
// frontend via /api/notify-accept right after a price is accepted, which is
// more reliable than depending on a correctly-configured Supabase Database
// Webhook. This endpoint is kept only so an existing webhook pointing here
// doesn't error — it intentionally does nothing.

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, deprecated: true });
}
