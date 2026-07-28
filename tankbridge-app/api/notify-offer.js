// This runs on Vercel as a serverless function at /api/notify-offer
// Called directly by the frontend whenever an offer negotiation moves —
// a seller submits their first offer, or either side counters or accepts.
// Emails whichever party needs to respond next — the actual account holder,
// or their negotiator (mandate/broker) if that side is still an unregistered
// placeholder being represented by a delegate. On acceptance, an unregistered
// party is told to complete their own registration (mirroring notify-accept.js)
// rather than just "open your dashboard".
//
// Also handles { type: "new_listing_match", listingId }: fired right after a
// new listing is published, emailing companies (and their authorised Mandate)
// that currently have an active listing of the opposite kind for the same
// product — a real-time signal of interest, not a blast to every registrant.

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
    const { offerId, event, type, listingId } = req.body || {};

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ---------------- New matching listing on the Market Board ----------------
    // Fires right after a listing is published. Only emails companies that
    // currently show real interest (an active listing of the opposite kind,
    // same product) rather than every buyer/seller ever registered — plus
    // each matched company's authorised Mandate, if they have one.
    if (type === "new_listing_match") {
      if (!listingId) return res.status(400).json({ error: "Missing listingId" });

      const listing = (await sb(`listings?id=eq.${listingId}&select=*,companies(id,company_name)`, serviceKey, supabaseUrl))?.[0];
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const oppositeKind = listing.kind === "sell" ? "buy" : "sell";
      const matches = await sb(
        `listings?status=eq.active&kind=eq.${oppositeKind}&product=eq.${encodeURIComponent(listing.product)}&company_id=neq.${listing.company_id}&select=company_id,companies(id,company_name,email,user_id,type,authorized_negotiator_id)`,
        serviceKey, supabaseUrl
      );

      const seenCompanyIds = new Set();
      const recipients = []; // { email, company_name, forNegotiatorOf }
      for (const m of matches) {
        const co = m.companies;
        if (!co || seenCompanyIds.has(co.id)) continue;
        seenCompanyIds.add(co.id);

        if (co.user_id && co.email && co.email !== "-") {
          recipients.push({ email: co.email, company_name: co.company_name, forNegotiatorOf: null });
        }
        if (co.authorized_negotiator_id) {
          const negRows = await sb(`companies?id=eq.${co.authorized_negotiator_id}&select=company_name,email`, serviceKey, supabaseUrl);
          const neg = negRows?.[0];
          if (neg?.email && neg.email !== "-") {
            recipients.push({ email: neg.email, company_name: neg.company_name, forNegotiatorOf: co.company_name });
          }
        }
      }

      const kindLabel = listing.kind === "sell" ? "selling" : "looking to buy";
      const terms = Array.isArray(listing.terms) ? listing.terms.join(" / ") : listing.terms;
      const subject = `New match on the Market Board: ${listing.product}, ${Number(listing.volume).toLocaleString()}ℓ, ${listing.location}`;
      const summary = `
        <p><strong>${listing.kind === "sell" ? "Selling" : "Buyer requirement"}:</strong> ${listing.product}</p>
        <p><strong>Volume:</strong> ${Number(listing.volume).toLocaleString()} litres</p>
        <p><strong>Terms:</strong> ${terms}</p>
        <p><strong>Location:</strong> ${listing.location}</p>
        ${listing.unit_price ? `<p><strong>Price:</strong> R ${Number(listing.unit_price).toFixed(2)} / litre</p>` : ""}
      `;

      await Promise.all(recipients.map(r => sendResendEmail({
        to: r.email,
        subject,
        html: `
          <h2>New match on the Market Board</h2>
          <p>${r.company_name}, a company is now ${kindLabel} ${listing.product} that matches ${r.forNegotiatorOf ? `${r.forNegotiatorOf}'s` : "your"} interest.</p>
          ${summary}
          <p style="margin-top:16px;"><a href="https://tankbridge.co.za/?view=market" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">View on the Market Board</a></p>
        `,
      })));

      return res.status(200).json({ ok: true, matchedCompanies: seenCompanyIds.size, emailsSent: recipients.length });
    }

    if (type === "share_listing") {
      const { shareToEmail, sharedByCompanyName } = req.body || {};
      if (!listingId || !shareToEmail) return res.status(400).json({ error: "Missing listingId or shareToEmail" });

      const listing = (await sb(`listings?id=eq.${listingId}&select=*`, serviceKey, supabaseUrl))?.[0];
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const isSell = listing.kind !== "buy";
      const terms = Array.isArray(listing.terms) ? listing.terms.join(" / ") : listing.terms;
      const priceLine = listing.price_mode === "seller_offer"
        ? `<p><strong>Price:</strong> Submit your offer</p>`
        : `<p><strong>${isSell ? "Asking" : "Bid"}:</strong> R ${Number(listing.unit_price).toFixed(2)} / litre</p>`;

      await sendResendEmail({
        to: shareToEmail,
        subject: `${sharedByCompanyName || "Someone"} shared a Tankbridge listing with you`,
        html: `
          <h2>${sharedByCompanyName || "A Tankbridge user"} thought you'd want to see this</h2>
          <p><strong>${isSell ? "Selling" : "Buyer requirement"}:</strong> ${listing.product}</p>
          <p><strong>Volume:</strong> ${Number(listing.volume).toLocaleString()} litres</p>
          <p><strong>Terms:</strong> ${terms}</p>
          <p><strong>Location:</strong> ${listing.location}</p>
          ${priceLine}
          <p style="margin-top:16px;"><a href="https://tankbridge.co.za/?view=market" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">View on the Market Board</a></p>
        `,
      });

      return res.status(200).json({ ok: true });
    }

    if (!offerId || !event) return res.status(400).json({ error: "Missing offerId or event" });

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
