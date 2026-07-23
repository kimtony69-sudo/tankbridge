// This runs on Vercel as a serverless function at /api/send-referral-email
// Consolidates referral-related emails into one endpoint (Vercel Hobby plan
// caps serverless functions at 12).
//
// POST body: { type, referralId, reason? }
//
// - "invite": referred buyer/seller registration invite (after admin approval)
// - "confirm": seller price/commission confirmation (no login required)
// - "co_broker_claim": upstream broker/mandate relationship confirmation
// - "admin_new_referral": tells admin a new referral needs review
// - "rejected": tells the submitting broker/mandate their referral was rejected (with reason)

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

async function sbPatch(path, body, serviceKey, supabaseUrl) {
  await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, referralId, reason } = req.body || {};
  if (!referralId) return res.status(400).json({ error: "Missing referralId" });
  if (!["invite", "confirm", "co_broker_claim", "admin_new_referral", "rejected"].includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const referral = (await sbFetch(`referrals?id=eq.${referralId}&select=*`, serviceKey, supabaseUrl))?.[0];
    if (!referral) return res.status(404).json({ error: "Referral not found" });

    const broker = (await sbFetch(`companies?id=eq.${referral.broker_company_id}&select=company_name,email`, serviceKey, supabaseUrl))?.[0];
    const terms = Array.isArray(referral.terms) ? referral.terms.join(" / ") : referral.terms;

    if (type === "admin_new_referral") {
      const label = referral.is_co_broker_referral ? "hand-off (mandate)" : "direct";
      await sendResendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `New referral submitted — ${referral.referred_company_name || "(mandate handoff)"} (${referral.referred_type})`,
        html: `
          <h2>New referral needs review</h2>
          <p><strong>${broker?.company_name || "A broker"}</strong> submitted a ${label} referral for a <strong>${referral.referred_type}</strong>:</p>
          <p><strong>Company (as best known):</strong> ${referral.referred_company_name || "-"}</p>
          <p><strong>Product:</strong> ${referral.product}</p>
          <p><strong>Volume:</strong> ${Number(referral.volume).toLocaleString()} litres</p>
          <p><strong>Price:</strong> R ${Number(referral.unit_price).toFixed(2)} / litre</p>
          <p><strong>Terms:</strong> ${terms}</p>
          <p><strong>Location:</strong> ${referral.location}</p>
          <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard to review</a></p>
        `,
      });
      return res.status(200).json({ ok: true });
    }

    if (type === "rejected") {
      if (!broker?.email || broker.email === "-") return res.status(200).json({ ok: true, skipped: true });
      await sendResendEmail({
        to: broker.email,
        subject: `Your referral wasn't approved — ${referral.referred_company_name || referral.referred_type}`,
        html: `
          <h2>Your referral was not approved</h2>
          <p>Hi ${broker.company_name},</p>
          <p>Your referral for <strong>${referral.referred_company_name || `a ${referral.referred_type}`}</strong> (${referral.product}, ${Number(referral.volume).toLocaleString()} litres) was reviewed by Tankbridge admin and was not approved.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
          <p>No details were shared with the referred party at this stage. Feel free to submit a corrected referral from your Dashboard, or contact admin with any questions.</p>
        `,
      });
      return res.status(200).json({ ok: true });
    }

    if (type === "invite") {
      if (referral.status !== "approved") return res.status(400).json({ error: "Referral is not approved yet." });
      if (!referral.referred_email) return res.status(400).json({ error: "No email on file for the referred company — ask the broker for it first." });

      const inviteUrl = `https://tankbridge.co.za/?invite=${referral.invite_token}`;
      const roleLabel = referral.referred_type === "seller" ? "seller" : "buyer";

      await sendResendEmail({
        to: referral.referred_email,
        subject: `You've been recommended for Tankbridge — South Africa's verified diesel marketplace`,
        html: `
          <h2>${broker?.company_name || "A trading partner"} thinks you'd be a good fit for Tankbridge</h2>
          <p><strong>${broker?.company_name || "A broker"}</strong> has recommended <strong>${referral.referred_company_name}</strong> to join Tankbridge as a ${roleLabel}, based on the deal below.</p>
          <div style="background:#f6f4ec;padding:14px 16px;margin:16px 0;">
            <p style="margin:0 0 6px;font-weight:bold;">What Tankbridge is:</p>
            <p style="margin:0;font-size:14px;">A verified B2B marketplace for bulk diesel — every counterparty is CIPC/DMRE-checked, identities stay anonymous until both sides agree on price, and it's completely free to register.</p>
          </div>
          <p><strong>The deal on the table:</strong></p>
          <p>${referral.product} · ${Number(referral.volume).toLocaleString()} litres · R ${Number(referral.unit_price).toFixed(2)}/litre · ${referral.location}</p>
          <p>Setting up your account takes a couple of minutes — choose your own password, confirm your details, and you're live on the Market Board.</p>
          <p style="margin-top:20px;">
            <a href="${inviteUrl}" style="background:#e39a2d;color:#101b28;padding:12px 20px;text-decoration:none;font-weight:bold;">Yes, set up my account</a>
          </p>
          <p style="font-size:12px;color:#888;margin-top:20px;">No cost, no obligation — you're only ever matched with verified counterparties, and nothing is shared until you're ready. If this isn't relevant to you, feel free to ignore this email.</p>
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

      try {
        await sendResendEmail({
          to: referral.referred_email,
          subject: `Your listing is ready to go live on Tankbridge — just confirm`,
          html: `
            <h2>You're one click away from a verified listing</h2>
            <p><strong>${broker?.company_name || "A broker"}</strong> has set up a listing for <strong>${referral.referred_company_name}</strong> on Tankbridge — South Africa's verified B2B marketplace for bulk diesel. Every buyer on the platform is CIPC/DMRE-checked before they ever see your listing, and your identity stays anonymous until a real buyer commits.</p>
            <div style="background:#f6f4ec;padding:14px 16px;margin:16px 0;">
              <p style="margin:0 0 6px;font-weight:bold;">Your listing:</p>
              <p style="margin:2px 0;"><strong>Product:</strong> ${referral.product}</p>
              <p style="margin:2px 0;"><strong>Volume:</strong> ${Number(referral.volume).toLocaleString()} litres</p>
              <p style="margin:2px 0;"><strong>Asking price:</strong> R ${Number(referral.unit_price).toFixed(2)} / litre</p>
              <p style="margin:2px 0;"><strong>Terms:</strong> ${terms}</p>
              <p style="margin:2px 0;"><strong>Location:</strong> ${referral.location}</p>
              <p style="margin:2px 0;"><strong>Commission:</strong> R ${Number(referral.proposed_commission_rate || 0.10).toFixed(2)} / litre</p>
            </div>
            <p>If this all looks right, one click puts you live on the Market Board — free to list, no obligation, and you're only ever contacted once a real, verified buyer accepts.</p>
            <p style="margin-top:20px;">
              <a href="${base}&decision=approve" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;margin-right:10px;">Yes, list it</a>
              <a href="${base}&decision=reject" style="background:#a63b32;color:#ece8de;padding:11px 18px;text-decoration:none;font-weight:bold;">Something's not right</a>
            </p>
            <p style="font-size:12px;color:#888;margin-top:20px;">No login needed — these links take you straight to a confirmation page.</p>
          `,
        });
        await sbPatch(`referrals?id=eq.${referralId}`, { seller_confirm_email_status: "sent", seller_confirm_email_sent_at: new Date().toISOString(), seller_confirm_email_error: null }, serviceKey, supabaseUrl);
      } catch (emailErr) {
        await sbPatch(`referrals?id=eq.${referralId}`, { seller_confirm_email_status: "failed", seller_confirm_email_sent_at: new Date().toISOString(), seller_confirm_email_error: emailErr.message }, serviceKey, supabaseUrl);
        return res.status(500).json({ error: "Failed to send confirmation email", detail: emailErr.message });
      }
    }

    if (type === "co_broker_claim") {
      if (!referral.is_co_broker_referral) return res.status(400).json({ error: "This is only used for co-broker handoff referrals." });
      if (!referral.co_broker_upstream_email) return res.status(400).json({ error: "No upstream broker email on file." });

      const claimUrl = `https://tankbridge.co.za/?co_broker_claim=1&token=${referral.co_broker_confirm_token}`;
      const splitPct = Math.round(Number(referral.co_broker_split_pct) * 100);

      try {
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
        await sbPatch(`referrals?id=eq.${referralId}`, { co_broker_email_status: "sent", co_broker_email_sent_at: new Date().toISOString(), co_broker_email_error: null }, serviceKey, supabaseUrl);
      } catch (emailErr) {
        await sbPatch(`referrals?id=eq.${referralId}`, { co_broker_email_status: "failed", co_broker_email_sent_at: new Date().toISOString(), co_broker_email_error: emailErr.message }, serviceKey, supabaseUrl);
        return res.status(500).json({ error: "Failed to send confirmation email", detail: emailErr.message });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-referral-email error:", e);
    return res.status(500).json({ error: e.message });
  }
}
