// This runs on Vercel as a serverless function at /api/send-referral-invite
// Called by the frontend right after admin approves a broker referral (or
// clicks "Resend invite"). Emails the referred company directly, inviting
// them to complete their own registration on Tankbridge.

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
    if (referral.status !== "approved") return res.status(400).json({ error: "Referral is not approved yet." });
    if (!referral.referred_email) return res.status(400).json({ error: "No email on file for the referred company — ask the broker for it first." });

    const brokerRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${referral.broker_company_id}&select=company_name`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const broker = (await brokerRes.json())?.[0];

    const inviteUrl = `https://tankbridge.co.za/?invite=${referral.invite_token}`;
    const roleLabel = referral.referred_type === "seller" ? "seller" : "buyer";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: referral.referred_email,
        subject: `${broker?.company_name || "A broker"} wants to register you on Tankbridge`,
        html: `
          <h2>You've been introduced to Tankbridge</h2>
          <p><strong>${broker?.company_name || "A broker"}</strong> has introduced <strong>${referral.referred_company_name}</strong> to Tankbridge as a ${roleLabel}, for:</p>
          <p>${referral.product} · ${Number(referral.volume).toLocaleString()} litres · R ${Number(referral.unit_price).toFixed(2)}/litre · ${referral.location}</p>
          <p>If you'd like to register, click below to complete your own account (choose your own password, review the details, and go live once submitted):</p>
          <p style="margin-top:20px;">
            <a href="${inviteUrl}" style="background:#e39a2d;color:#101b28;padding:12px 20px;text-decoration:none;font-weight:bold;">Complete registration</a>
          </p>
          <p style="font-size:12px;color:#888;margin-top:20px;">If you weren't expecting this, you can safely ignore this email.</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email", detail: errText });
    }

    await fetch(`${supabaseUrl}/rest/v1/referrals?id=eq.${referralId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ invite_status: "sent", invite_sent_at: new Date().toISOString() }),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-referral-invite error:", e);
    return res.status(500).json({ error: e.message });
  }
}
