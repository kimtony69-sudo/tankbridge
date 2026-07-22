// This runs on Vercel as a serverless function at /api/send-co-broker-claim
// Called by the frontend right after admin approves a broker's "handoff"
// referral (where the submitting broker doesn't have a direct relationship
// with the buyer/seller). Emails the upstream broker who does, asking them
// to confirm and take over the registration with real details.

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
    if (!referral.is_co_broker_referral) return res.status(400).json({ error: "This is only used for co-broker handoff referrals." });
    if (!referral.co_broker_upstream_email) return res.status(400).json({ error: "No upstream broker email on file." });

    const brokerRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${referral.broker_company_id}&select=company_name`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const broker = (await brokerRes.json())?.[0];

    const claimUrl = `https://tankbridge.co.za/?co_broker_claim=1&token=${referral.co_broker_confirm_token}`;
    const terms = Array.isArray(referral.terms) ? referral.terms.join(" / ") : referral.terms;
    const splitPct = Math.round(Number(referral.co_broker_split_pct) * 100);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: referral.co_broker_upstream_email,
        subject: `${broker?.company_name || "A broker"} wants to register this ${referral.referred_type}'s listing — do you know them?`,
        html: `
          <h2>Do you know this ${referral.referred_type}?</h2>
          <p><strong>${broker?.company_name || "A broker"}</strong> is trying to register the listing below with Tankbridge, for a ${referral.referred_type} matching:</p>
          <p><strong>Company (as best known):</strong> ${referral.referred_company_name || "-"}</p>
          <p><strong>Product:</strong> ${referral.product}</p>
          <p><strong>Volume:</strong> ${Number(referral.volume).toLocaleString()} litres</p>
          <p><strong>Price:</strong> R ${Number(referral.unit_price).toFixed(2)} / litre</p>
          <p><strong>Terms:</strong> ${terms}</p>
          <p><strong>Location:</strong> ${referral.location}</p>
          ${referral.referred_type === "seller" && referral.proposed_commission_rate ? `<p><strong>Commission:</strong> R ${Number(referral.proposed_commission_rate).toFixed(2)} / litre</p>` : ""}
          <p>If you confirm, you'll register this ${referral.referred_type} yourself with the real details, and you'll share the 30% Tankbridge broker commission: <strong>${100 - splitPct}% to you, ${splitPct}% to ${broker?.company_name || "the introducing broker"}</strong>.</p>
          <p style="margin-top:20px;">
            <a href="${claimUrl}" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">I know them — let's proceed</a>
          </p>
          <p style="font-size:12px;color:#888;margin-top:16px;">You'll need a free Tankbridge broker account to complete this (register or log in first, then reopen this link). If you don't recognise this company, you can decline from the same link.</p>
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
    console.error("send-co-broker-claim error:", e);
    return res.status(500).json({ error: e.message });
  }
}
