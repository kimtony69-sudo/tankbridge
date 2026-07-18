// This runs on Vercel as a serverless function at /api/notify-buyer-info-request
// Called directly by the frontend the first time a seller (post-IMFPA) views
// a matched buyer's contact details. Notifies the buyer ("this seller agreed
// to your offer") and admin, but only once per deal (guarded by the
// buyer_info_revealed_at column so refreshing the page doesn't re-send).

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { dealId } = req.body || {};
    if (!dealId) return res.status(400).json({ error: "Missing dealId" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Only proceed (and only send once) if buyer_info_revealed_at is still null.
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}&buyer_info_revealed_at=is.null`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ buyer_info_revealed_at: new Date().toISOString() }),
    });
    const patched = await patchRes.json();
    if (!patched || patched.length === 0) {
      return res.status(200).json({ ok: true, skipped: true }); // already notified before
    }
    const deal = patched[0];

    const [sellerRes, buyerRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.seller_company_id}&select=company_name,contact_name,email`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.buyer_company_id}&select=company_name,contact_name,email`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
    ]);
    const seller = (await sellerRes.json())?.[0];
    const buyer = (await buyerRes.json())?.[0];
    if (!seller || !buyer) return res.status(404).json({ error: "Company not found" });

    const dealLine = `${deal.product} · ${Number(deal.volume).toLocaleString()} \u2113 · R ${Number(deal.unit_price).toFixed(2)}/\u2113 · ${deal.location}`;

    await Promise.all([
      sendResendEmail({
        to: buyer.email,
        subject: `${seller.company_name} has agreed to your buying offer`,
        html: `
          <h2>${seller.company_name} has agreed to your buying offer</h2>
          <p>${dealLine}</p>
          <p><strong>Seller company:</strong> ${seller.company_name}</p>
          <p><strong>Contact:</strong> ${seller.contact_name}</p>
          <p><strong>Email:</strong> ${seller.email}</p>
          <p><a href="https://tankbridge.co.za/#dashboard">Open your Dashboard</a></p>
        `,
      }),
      sendResendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `${seller.company_name} signed IMFPA and requested ${buyer.company_name}'s info`,
        html: `
          <h2>Seller requested buyer contact details</h2>
          <p>${seller.company_name} signed the IMFPA and viewed contact details for ${buyer.company_name}.</p>
          <p>${dealLine}</p>
          <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard</a></p>
        `,
      }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-buyer-info-request error:", e);
    return res.status(500).json({ error: e.message });
  }
}
