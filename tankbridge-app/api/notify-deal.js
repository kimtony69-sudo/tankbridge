// This runs on Vercel as a serverless function at /api/notify-deal
// Supabase's Database Webhook calls this URL whenever a new row is inserted
// into public.deals. It looks up the buyer/seller names and emails the admin
// via Resend.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional shared-secret check so random requests can't trigger emails.
  // Set WEBHOOK_SECRET in Vercel and add the same value as a custom header
  // ("x-webhook-secret") in the Supabase Database Webhook config.
  if (process.env.WEBHOOK_SECRET) {
    const provided = req.headers["x-webhook-secret"];
    if (provided !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const deal = req.body?.record;
    if (!deal) return res.status(400).json({ error: "No deal record in payload" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const [sellerRes, buyerRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.seller_company_id}&select=company_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${deal.buyer_company_id}&select=company_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }),
    ]);
    const sellerData = await sellerRes.json();
    const buyerData = await buyerRes.json();
    const sellerName = sellerData?.[0]?.company_name || "Unknown seller";
    const buyerName = buyerData?.[0]?.company_name || "Unknown buyer";

    const subject = `New matched deal — ${deal.product} (${Number(deal.volume).toLocaleString()} \u2113)`;
    const html = `
      <h2>New matched deal on Tankbridge</h2>
      <p><strong>Product:</strong> ${deal.product}</p>
      <p><strong>Volume:</strong> ${Number(deal.volume).toLocaleString()} litres</p>
      <p><strong>Price:</strong> R ${Number(deal.unit_price).toFixed(2)} / litre</p>
      <p><strong>Terms:</strong> ${deal.terms}</p>
      <p><strong>Location:</strong> ${deal.location}</p>
      <p><strong>Seller:</strong> ${sellerName}</p>
      <p><strong>Buyer:</strong> ${buyerName}</p>
      <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard</a></p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL,
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email", detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-deal error:", e);
    return res.status(500).json({ error: e.message });
  }
}
