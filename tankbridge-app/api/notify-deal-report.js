// This runs on Vercel as a serverless function at /api/notify-deal-report
// Called directly by the frontend right after a buyer or seller self-reports
// a deal outcome (via the "Report: Deal completed / fell through" buttons,
// or via a weekly check-in email link). This does not depend on Supabase
// Database Webhooks being configured correctly, so it's reliable.

function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { dealId, role, outcome } = req.body || {};
    if (!dealId || !role || !outcome) return res.status(400).json({ error: "Missing dealId, role, or outcome" });
    if (outcome === "in_progress") return res.status(200).json({ ok: true, skipped: true }); // no email needed for a routine "still going" ping

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const dealRes = await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const dealRows = await dealRes.json();
    const deal = dealRows?.[0];
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const [sellerRes, buyerRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.seller_company_id}&select=company_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.buyer_company_id}&select=company_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
    ]);
    const sellerName = (await sellerRes.json())?.[0]?.company_name || "Unknown seller";
    const buyerName = (await buyerRes.json())?.[0]?.company_name || "Unknown buyer";

    const reporterName = role === "seller" ? sellerName : buyerName;
    const outcomeLabel = outcome === "completed" ? "Deal completed" : "Deal fell through";

    const subject = `${role === "seller" ? "Seller" : "Buyer"} reported: ${outcomeLabel} — ${deal.product}`;
    const html = `
      <h2>${reporterName} (${role}) reported an outcome</h2>
      <p><strong>Report:</strong> ${outcomeLabel}</p>
      <p><strong>Product:</strong> ${deal.product}</p>
      <p><strong>Volume:</strong> ${Number(deal.volume).toLocaleString()} litres</p>
      <p><strong>Price:</strong> R ${Number(deal.unit_price).toFixed(2)} / litre</p>
      <p><strong>Terms:</strong> ${fmtTerms(deal.terms)}</p>
      <p><strong>Location:</strong> ${deal.location}</p>
      <p><strong>Seller:</strong> ${sellerName}</p>
      <p><strong>Buyer:</strong> ${buyerName}</p>
      <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard</a></p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL,
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email", detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-deal-report error:", e);
    return res.status(500).json({ error: e.message });
  }
}
