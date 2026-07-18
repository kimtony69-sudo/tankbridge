// This runs on Vercel as a serverless function at /api/notify-accept
// Called directly by the frontend right after a buyer or seller successfully
// accepts a price + procedure on the Market Board (accept_listing_price
// succeeds). Emails the listing owner ("someone agreed to your price and
// procedure") and a copy to admin. Does not depend on Supabase Database
// Webhooks, so it's reliable regardless of webhook configuration.

function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

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
  }
  return res.ok;
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

    const dealRes = await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const deal = (await dealRes.json())?.[0];
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const [sellerRes, buyerRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.seller_company_id}&select=company_name,email`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.buyer_company_id}&select=company_name,email`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
    ]);
    const seller = (await sellerRes.json())?.[0];
    const buyer = (await buyerRes.json())?.[0];
    if (!seller || !buyer) return res.status(404).json({ error: "Company not found" });

    // deal.kind reflects which side originally posted the listing:
    // 'sell' → seller posted it, buyer is the one who just accepted.
    // 'buy'  → buyer posted it, seller is the one who just accepted.
    const isSellListing = deal.kind !== "buy";
    const acceptor = isSellListing ? buyer : seller;
    const acceptorRole = isSellListing ? "Buyer" : "Seller";
    const listingOwner = isSellListing ? seller : buyer;

    const dealSummary = `
      <p><strong>Product:</strong> ${deal.product}</p>
      <p><strong>Volume:</strong> ${Number(deal.volume).toLocaleString()} litres</p>
      <p><strong>Price:</strong> R ${Number(deal.unit_price).toFixed(2)} / litre</p>
      <p><strong>Terms:</strong> ${fmtTerms(deal.terms)}</p>
      <p><strong>Location:</strong> ${deal.location}</p>
      <p><strong>Seller:</strong> ${seller.company_name}</p>
      <p><strong>Buyer:</strong> ${buyer.company_name}</p>
    `;

    const subject = `${acceptor.company_name} has agreed to your price and procedure — ${deal.product}`;
    const ownerHtml = `
      <h2>${acceptorRole} agreed to your price and procedure</h2>
      <p>${acceptor.company_name} (${acceptorRole.toLowerCase()}) has accepted your listing's price and reviewed your procedure on Tankbridge.</p>
      ${dealSummary}
      <p><a href="https://tankbridge.co.za/#dashboard">Open your Dashboard</a></p>
    `;
    const adminHtml = `
      <h2>[Admin copy] ${acceptorRole} agreed to price and procedure</h2>
      <p>${acceptor.company_name} (${acceptorRole.toLowerCase()}) has accepted ${listingOwner.company_name}'s listing.</p>
      ${dealSummary}
      <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard</a></p>
    `;

    await Promise.all([
      sendResendEmail({ to: listingOwner.email, subject, html: ownerHtml }),
      sendResendEmail({ to: process.env.ADMIN_EMAIL, subject: `[Admin copy] ${subject}`, html: adminHtml }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-accept error:", e);
    return res.status(500).json({ error: e.message });
  }
}
