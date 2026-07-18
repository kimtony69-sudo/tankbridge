// This runs on Vercel as a Cron Job at /api/weekly-checkin (see vercel.json).
// For every matched, engaged deal, it checks whether it's been 7+ days since
// each party's last check-in and, if so, emails them asking for a progress
// update — with one-click links (no login required) to report back.

const SITE_URL = "https://tankbridge.co.za";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

async function sb(path, serviceKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return res.json();
}

async function sendCheckinEmail({ to, companyName, counterpartyName, deal, role, token }) {
  const base = `${SITE_URL}/?checkin=1&deal=${deal.id}&token=${token}&role=${role}`;
  const subject = `How's your deal with ${counterpartyName} going? — ${deal.product}`;
  const html = `
    <h2>Quick check-in on your Tankbridge deal</h2>
    <p>Hi ${companyName},</p>
    <p>It's been a week since you and ${counterpartyName} connected on Tankbridge for the deal below. How's it going?</p>
    <p><strong>Product:</strong> ${deal.product}</p>
    <p><strong>Volume:</strong> ${Number(deal.volume).toLocaleString()} litres</p>
    <p><strong>Price:</strong> R ${Number(deal.unit_price).toFixed(2)} / litre</p>
    <p><strong>Terms:</strong> ${fmtTerms(deal.terms)}</p>
    <p style="margin-top:20px;">
      <a href="${base}&outcome=completed" style="background:#e39a2d;color:#101b28;padding:10px 18px;text-decoration:none;font-weight:bold;margin-right:10px;">Deal completed</a>
      <a href="${base}&outcome=in_progress" style="background:#101b28;color:#ece8de;padding:10px 18px;text-decoration:none;font-weight:bold;margin-right:10px;">Still in progress</a>
      <a href="${base}&outcome=fell_through" style="background:#a63b32;color:#ece8de;padding:10px 18px;text-decoration:none;font-weight:bold;">Deal fell through</a>
    </p>
    <p style="font-size:12px;color:#888;margin-top:20px;">No login needed — these links take you straight to a confirmation page.</p>
  `;

  await fetch("https://api.resend.com/emails", {
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
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const deals = await sb(
      `deals?status=eq.matched&engaged_at=not.is.null&select=*`,
      serviceKey, supabaseUrl
    );

    let sent = 0;
    const now = Date.now();

    for (const deal of deals) {
      const [sellerRows, buyerRows] = await Promise.all([
        sb(`companies?id=eq.${deal.seller_company_id}&select=company_name,email,imfpa_signed`, serviceKey, supabaseUrl),
        sb(`companies?id=eq.${deal.buyer_company_id}&select=company_name,email`, serviceKey, supabaseUrl),
      ]);
      const seller = sellerRows?.[0];
      const buyer = buyerRows?.[0];
      if (!seller || !buyer) continue;

      // Seller side
      if (!deal.seller_reported_status) {
        const baseline = deal.seller_last_checkin_at ? new Date(deal.seller_last_checkin_at).getTime() : new Date(deal.engaged_at).getTime();
        if (now - baseline >= SEVEN_DAYS_MS) {
          await sendCheckinEmail({ to: seller.email, companyName: seller.company_name, counterpartyName: buyer.company_name, deal, role: "seller", token: deal.seller_checkin_token });
          await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${deal.id}`, {
            method: "PATCH",
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ seller_last_checkin_at: new Date().toISOString() }),
          });
          sent++;
        }
      }

      // Buyer side
      if (!deal.buyer_reported_status) {
        const baseline = deal.buyer_last_checkin_at ? new Date(deal.buyer_last_checkin_at).getTime() : new Date(deal.engaged_at).getTime();
        if (now - baseline >= SEVEN_DAYS_MS) {
          await sendCheckinEmail({ to: buyer.email, companyName: buyer.company_name, counterpartyName: seller.company_name, deal, role: "buyer", token: deal.buyer_checkin_token });
          await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${deal.id}`, {
            method: "PATCH",
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ buyer_last_checkin_at: new Date().toISOString() }),
          });
          sent++;
        }
      }
    }

    return res.status(200).json({ ok: true, dealsChecked: deals.length, emailsSent: sent });
  } catch (e) {
    console.error("weekly-checkin error:", e);
    return res.status(500).json({ error: e.message });
  }
}
