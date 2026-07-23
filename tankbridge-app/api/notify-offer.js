// This runs on Vercel as a serverless function at /api/notify-offer
// Called directly by the frontend whenever an offer negotiation moves —
// a seller submits their first offer, or either side counters or accepts.
// Emails whichever party needs to respond next — the actual account holder,
// or their negotiator (mandate/broker) if that side is still an unregistered
// placeholder being represented by a delegate. On acceptance, an unregistered
// party is told to complete their own registration (mirroring notify-accept.js)
// rather than just "open your dashboard".

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

async function sb(path, serviceKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { offerId, event } = req.body || {};
    if (!offerId || !event) return res.status(400).json({ error: "Missing offerId or event" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const offer = (await sb(`offers?id=eq.${offerId}&select=*,listings(product,volume,terms,location)`, serviceKey, supabaseUrl))?.[0];
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    const [buyerRows, sellerRows] = await Promise.all([
      sb(`companies?id=eq.${offer.buyer_company_id}&select=company_name,email,user_id`, serviceKey, supabaseUrl),
      sb(`companies?id=eq.${offer.seller_company_id}&select=company_name,email,user_id`, serviceKey, supabaseUrl),
    ]);
    const buyer = buyerRows?.[0];
    const seller = sellerRows?.[0];
    if (!buyer || !seller) return res.status(404).json({ error: "Company not found" });

    const [buyerNegRows, sellerNegRows] = await Promise.all([
      offer.buyer_negotiator_id ? sb(`companies?id=eq.${offer.buyer_negotiator_id}&select=company_name,email`, serviceKey, supabaseUrl) : [],
      offer.seller_negotiator_id ? sb(`companies?id=eq.${offer.seller_negotiator_id}&select=company_name,email`, serviceKey, supabaseUrl) : [],
    ]);
    const buyerNegotiator = buyerNegRows?.[0] || null;
    const sellerNegotiator = sellerNegRows?.[0] || null;

    const l = offer.listings || {};
    const terms = Array.isArray(l.terms) ? l.terms.join(" / ") : l.terms;
    const summary = `
      <p><strong>Product:</strong> ${l.product}</p>
      <p><strong>Volume:</strong> ${Number(l.volume).toLocaleString()} litres</p>
      <p><strong>Terms:</strong> ${terms}</p>
      <p><strong>Location:</strong> ${l.location}</p>
      <p><strong>Price on the table:</strong> R ${Number(offer.current_price).toFixed(2)} / litre</p>
      ${offer.current_commission_rate != null ? `<p><strong>Commission on the table:</strong> R ${Number(offer.current_commission_rate).toFixed(2)} / litre</p>` : ""}
    `;

    // Who actually gets emailed for a given side: the negotiator if one is
    // representing that side, otherwise the registered account holder.
    const buyerContact = buyerNegotiator || buyer;
    const sellerContact = sellerNegotiator || seller;

    if (event === "accepted") {
      const subject = `Deal made — offer accepted at R ${Number(offer.current_price).toFixed(2)}/litre`;
      const emails = [];

      // Buyer side
      if (!buyer.user_id) {
        const ref = (await sb(`referrals?company_id=eq.${offer.buyer_company_id}&select=invite_token`, serviceKey, supabaseUrl))?.[0];
        const registerUrl = ref ? `https://tankbridge.co.za/?invite=${ref.invite_token}` : "https://tankbridge.co.za/";
        if (buyer.email && buyer.email !== "-") {
          emails.push(sendResendEmail({
            to: buyer.email, subject,
            html: `<h2>Your negotiation became a deal</h2><p>A price has been agreed on your behalf.</p>${summary}
              <p>To proceed, please complete your own registration (choose your password, sign the NCNDA). The seller's contact details release once this is done.</p>
              <p style="margin-top:16px;"><a href="${registerUrl}" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Complete registration</a></p>`,
          }));
        }
        if (buyerNegotiator) {
          emails.push(sendResendEmail({
            to: buyerNegotiator.email, subject,
            html: `<h2>Your negotiation became a deal</h2><p>${buyerNegotiator.company_name}, the price you negotiated on the buyer's behalf has been accepted.</p>${summary}
              <p>The buyer has been asked to complete their own registration before contact details release. You'll see your commission once the deal completes.</p>`,
          }));
        }
      } else {
        emails.push(sendResendEmail({
          to: buyer.email, subject,
          html: `<h2>Your negotiation just became a deal</h2><p>${buyer.company_name}, the offer on this listing has been accepted.</p>${summary}<p><a href="https://tankbridge.co.za/?view=dashboard">Open your Dashboard</a> for contact details.</p>`,
        }));
      }

      // Seller side
      if (!seller.user_id) {
        const ref = (await sb(`referrals?company_id=eq.${offer.seller_company_id}&select=invite_token`, serviceKey, supabaseUrl))?.[0];
        const registerUrl = ref ? `https://tankbridge.co.za/?invite=${ref.invite_token}` : "https://tankbridge.co.za/";
        if (seller.email && seller.email !== "-") {
          emails.push(sendResendEmail({
            to: seller.email, subject,
            html: `<h2>Your negotiation became a deal</h2><p>A price has been agreed on your behalf.</p>${summary}
              <p>To proceed, please complete your own registration (choose your password, sign the NCNDA and IMFPA). The buyer's contact details release once this is done.</p>
              <p style="margin-top:16px;"><a href="${registerUrl}" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Complete registration &amp; sign IMFPA</a></p>`,
          }));
        }
        if (sellerNegotiator) {
          emails.push(sendResendEmail({
            to: sellerNegotiator.email, subject,
            html: `<h2>Your negotiation became a deal</h2><p>${sellerNegotiator.company_name}, the price you negotiated on the seller's behalf has been accepted.</p>${summary}
              <p>The seller has been asked to complete their own registration and IMFPA before contact details release. You'll see your commission once the deal completes.</p>`,
          }));
        }
      } else {
        emails.push(sendResendEmail({
          to: seller.email, subject,
          html: `<h2>Your negotiation just became a deal</h2><p>${seller.company_name}, the offer on this listing has been accepted.</p>${summary}<p><a href="https://tankbridge.co.za/?view=dashboard">Open your Dashboard</a> for contact details.</p>`,
        }));
      }

      await Promise.all(emails);
      return res.status(200).json({ ok: true });
    }

    // "new_offer" or "counter" — email whichever side's turn it now is,
    // routing to their negotiator if one is representing them.
    let recipient, subject, html;
    if (offer.current_turn === "buyer") {
      recipient = buyerContact;
      const forNegotiator = !!buyerNegotiator;
      subject = event === "new_offer" ? `A seller submitted an offer on ${forNegotiator ? "your buyer's" : "your"} listing — please respond` : `Counter-offer received — please respond`;
      html = `
        <h2>${event === "new_offer" ? "A seller has made an offer" : "You've received a counter-offer"}</h2>
        <p>${recipient.company_name}, please review and respond${forNegotiator ? " on the buyer's behalf" : ""}.</p>
        ${summary}
        <p style="margin-top:16px;"><a href="https://tankbridge.co.za/?view=dashboard" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Accept or counter in your Dashboard</a></p>
      `;
    } else {
      recipient = sellerContact;
      const forNegotiator = !!sellerNegotiator;
      subject = `Counter-offer received — please respond`;
      html = `
        <h2>The buyer has countered${forNegotiator ? " your seller's" : " your"} offer</h2>
        <p>${recipient.company_name}, please review and respond${forNegotiator ? " on the seller's behalf" : ""}.</p>
        ${summary}
        <p style="margin-top:16px;"><a href="https://tankbridge.co.za/?view=dashboard" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Accept or counter in your Dashboard</a></p>
      `;
    }

    if (recipient.email && recipient.email !== "-") {
      await sendResendEmail({ to: recipient.email, subject, html });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-offer error:", e);
    return res.status(500).json({ error: e.message });
  }
}
