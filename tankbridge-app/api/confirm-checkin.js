// This runs on Vercel as a serverless function at /api/confirm-checkin
// Called by the public (no-login) check-in confirmation page after the user
// clicks the actual "Confirm" button — never auto-fires just from opening a
// link, so email link-scanners can't accidentally trigger it.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { dealId, token, outcome } = req.body || {};
    if (!dealId || !token || !outcome) return res.status(400).json({ error: "Missing dealId, token, or outcome" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/report_deal_outcome_via_token`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_deal_id: dealId, p_token: token, p_outcome: outcome }),
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      return res.status(400).json({ error: errText || "Could not record your response. The link may be invalid." });
    }

    const result = await rpcRes.json();
    const row = result?.[0] || {};

    // Notify admin for real outcomes (skip routine "still in progress" pings).
    if (outcome !== "in_progress") {
      fetch(`${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/notify-deal-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, role: row.role, outcome }),
      }).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      role: row.role,
      sellerCompanyName: row.seller_company_name,
      buyerCompanyName: row.buyer_company_name,
    });
  } catch (e) {
    console.error("confirm-checkin error:", e);
    return res.status(500).json({ error: e.message });
  }
}
