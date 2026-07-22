// This runs on Vercel as a serverless function at /api/send-referral-email
// Consolidates three referral-related emails into one endpoint (Vercel Hobby
// plan caps serverless functions at 12, so these were merged from separate
// files: send-referral-invite.js, send-referral-confirm.js, send-co-broker-claim.js).
//
// POST body: { type: "invite" | "confirm" | "co_broker_claim", referralId }
//
// - "invite": referred buyer/seller registration invite (after admin approval)
// - "confirm": seller price/commission confirmation (no login required)
// - "co_broker_claim": upstream broker/mandate relationship confirmation

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
  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error:", errText);
    throw new Error(errText);
  }
}

async function sbFetch(path, serviceKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, referralId } = req.body || {};
  if (!referralId) return res.status(400).json({ error: "Missing referralId" });
  if (!["invite", "confirm", "co_broker_claim"].includes(type)) {
    return res.status(400).json({ error: "Invalid type — must be invite, confirm, or co_broker_claim" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const referral = (await sbFetch(`referrals?id=eq.${referralId}&select=*`, serviceKey, supabaseUrl))?.[0];
    if (!referral) return res.status(404).json({ error: "Referral not found" });

    const broker = (await sbFetch(`companies?id=eq.${referral.broker_company_id}&select=company_name`, serviceKey, supabaseUrl))?.[0];
    const terms = Array.isArray(referral.terms) ? referral.terms.join(" / ") : referral.terms;

    if (type === "invite") {
      if (referral.status !== "approved") return res.status(400).json({ error: "Referral is not approved yet." });
      if (!referral.referred_email) return res.status(400).json({ error: "No email on file for the referred company — ask the broker for it first." });

      const inviteUrl = `https://tankbridge.co.za/?invite=${referral.invite_token}`;
      const roleLabel = referral.referred_type === "seller" ? "seller" : "buyer";

      await sendResendEmail({
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
      });

      await fetch(`${supabaseUrl}/rest/v1/referrals?id=eq.${referralId}`, {
        method: "PATCH",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ invite_status: "sent", invite_sent_at: new Date().toISOString() }),
      });
    }

    if (type === "confirm") {
      if (referral.referred_type !== "seller") return res.status(400).json({ error: "This is only used for seller referrals." });
      if (!referral.referred_email) return res.status(400).json({ error: "No email on file for the referred company — ask the broker for it first." });

      const base = `https://tankbridge.co.za/?referral_confirm=1&token=${referral.seller_confirm_token}`;

      await sendResendEmail({
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
      });
    }

    if (type === "co_broker_claim") {
      if (!referral.is_co_broker_referral) return res.status(400).json({ error: "This is only used for co-broker handoff referrals." });
      if (!referral.co_broker_upstream_email) return res.status(400).json({ error: "No upstream broker email on file." });

      const claimUrl = `https://tankbridge.co.za/?co_broker_claim=1&token=${referral.co_broker_confirm_token}`;
      const splitPct = Math.round(Number(referral.co_broker_split_pct) * 100);

      await sendResendEmail({
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
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-referral-email error:", e);
    return res.status(500).json({ error: e.message });
  }
}
