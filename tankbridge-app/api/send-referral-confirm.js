// This runs on Vercel as a serverless function at /api/send-referral-confirm
// Called by the frontend right after admin verifies a broker's SELLER
// referral. Emails the seller directly with the price + proposed commission
// so they can approve or reject it — with no login required — before the
// listing ever goes live on the Market Board.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { referralId } = req.body || {};
    if (!referralId) return res.status(400).json({ error: "Missing referralId" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const refRes = await fetch(`${supabaseUrl}/rest/v1/referrals?id=eq.${referralId}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const referral = (await refRes.json())?.[0];
    if (!referral) return res.status(404).json({ error: "Referral not found" });
    if (referral.referred_type !== "seller") return res.status(400).json({ error: "This is only used for seller referrals." });
    if (!referral.referred_email) return res.status(400).json({ error: "No email on file for the referred company — ask the broker for it first." });

    const brokerRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${referral.broker_company_id}&select=company_name`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const broker = (await brokerRes.json())?.[0];

    const base = `https://tankbridge.co.za/?referral_confirm=1&token=${referral.seller_confirm_token}`;
    const terms = Array.isArray(referral.terms) ? referral.terms.join(" / ") : referral.terms;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: referral.referred_email,
        subject: `${broker?.company_name || "A broker"} wants to list this for you — please confirm`,
        html: `
          <h2>Please confirm your listing details</h2>
          <p><strong>${broker?.company_name || "A broker"}</strong> has proposed listing <strong>${referral.referred_company_name}</strong> as a seller on Tankbridge, with these terms:</p>
          <p><strong>Product:</strong> ${referral.product}</p>
          <p><strong>Volume:</strong> ${Number(referral.volume).toLocaleString()} litres</p>
          <p><strong>Asking price:</strong> R ${Number(referral.unit_price).toFixed(2)} / litre</p>
          <p><strong>Terms:</strong> ${terms}</p>
          <p><strong>Location:</strong> ${referral.location}</p>
          <p><strong>Proposed commission:</strong> R ${Number(referral.proposed_commission_rate || 0.10).toFixed(2)} / litre</p>
          <p>Please confirm these are correct — your listing only goes live on the Market Board once you approve.</p>
          <p style="margin-top:20px;">
            <a href="${base}&decision=approve" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;margin-right:10px;">Approve &amp; list it</a>
            <a href="${base}&decision=reject" style="background:#a63b32;color:#ece8de;padding:11px 18px;text-decoration:none;font-weight:bold;">This isn't right</a>
          </p>
          <p style="font-size:12px;color:#888;margin-top:20px;">No login needed — these links take you straight to a confirmation page.</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email", detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-referral-confirm error:", e);
    return res.status(500).json({ error: e.message });
  }
}
