// This runs on Vercel as a serverless function at /api/notify-broker-commission
// Called directly by the frontend whenever a deal is marked completed (or its
// platform commission amount is set/updated) for a deal that involves a
// company originally referred by a broker. Emails each relevant broker:
// "the deal completed — here's your pending commission."

async function sendResendEmail({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
  return res.ok;
}

function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { dealId } = req.body || {};
    if (!dealId) return res.status(400).json({ error: "Missing dealId" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const [dealRes, commissionsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}&select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/deal_broker_commissions?deal_id=eq.${dealId}&select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
    ]);
    const deal = (await dealRes.json())?.[0];
    const commissions = await commissionsRes.json();
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    if (!commissions || commissions.length === 0) return res.status(200).json({ ok: true, skipped: true });

    let sent = 0;
    for (const c of commissions) {
      const brokerRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${c.broker_company_id}&select=company_name,email`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const broker = (await brokerRes.json())?.[0];
      if (!broker || !broker.email || broker.email === "-") continue;

      const amountLine = c.commission_amount != null
        ? `<p><strong>Your commission (30%):</strong> R ${Number(c.commission_amount).toFixed(2)} — payment status: ${c.commission_status}</p>`
        : `<p>Your 30% commission will be calculated once Tankbridge admin records the platform fee for this deal.</p>`;

      const ok = await sendResendEmail({
        to: broker.email,
        subject: `Deal completed — commission ${c.commission_amount != null ? "pending payment" : "to be calculated"}`,
        html: `
          <h2>A deal you referred has been completed</h2>
          <p><strong>Product:</strong> ${deal.product}</p>
          <p><strong>Volume:</strong> ${Number(deal.volume).toLocaleString()} litres</p>
          <p><strong>Terms:</strong> ${fmtTerms(deal.terms)}</p>
          <p><strong>Your role:</strong> ${c.role === "seller_side" ? "Seller-side referral" : "Buyer-side referral"}</p>
          ${amountLine}
          <p style="font-size:12px;color:#888;margin-top:16px;">Commission is calculated automatically for deals completed within 24 months of a referred company's registration. Payment is arranged directly with Tankbridge admin — this is not an automatic bank transfer.</p>
        `,
      });
      if (ok) sent++;
    }

    return res.status(200).json({ ok: true, emailsSent: sent });
  } catch (e) {
    console.error("notify-broker-commission error:", e);
    return res.status(500).json({ error: e.message });
  }
}
