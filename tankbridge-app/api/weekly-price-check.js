// This runs on Vercel as a Cron Job at /api/weekly-price-check (see vercel.json).
// Every Monday at 10:00 SAST, emails every company with active listings asking
// them to confirm their price is still correct, or update it if the market
// has moved — since a stale price can quietly kill deals either way.

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
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Only real, logged-in companies — broker-referral placeholder accounts
    // (no user_id) can't log in to update anything, so skip them.
    const listings = await sb(`listings?status=eq.active&select=*,companies(company_name,email,user_id,type)`, serviceKey, supabaseUrl);
    const withLogin = listings.filter(l => l.companies && l.companies.user_id && l.companies.email && l.companies.email !== "-");

    const byCompany = {};
    for (const l of withLogin) {
      const key = l.company_id;
      if (!byCompany[key]) byCompany[key] = { company: l.companies, listings: [] };
      byCompany[key].listings.push(l);
    }

    let sent = 0;
    for (const key of Object.keys(byCompany)) {
      const { company, listings: myListings } = byCompany[key];
      const rows = myListings.map(l => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.product}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${Number(l.volume).toLocaleString()} \u2113</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">R ${Number(l.unit_price).toFixed(2)}/\u2113</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${fmtTerms(l.terms)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.location}</td>
        </tr>
      `).join("");

      const subject = `Weekly price check — is your Tankbridge listing still accurate?`;
      const html = `
        <h2>Quick weekly price check</h2>
        <p>Hi ${company.company_name},</p>
        <p>Market prices move fast. Please confirm your ${company.type === "seller" ? "asking" : "bid"} price below is still correct — a stale price can lose you a match or waste a counterparty's time.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <thead>
            <tr style="text-align:left;background:#f6f4ec;">
              <th style="padding:6px 10px;">Product</th>
              <th style="padding:6px 10px;">Volume</th>
              <th style="padding:6px 10px;">Price</th>
              <th style="padding:6px 10px;">Terms</th>
              <th style="padding:6px 10px;">Location</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:20px;">
          <a href="https://tankbridge.co.za/?view=dashboard" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Log in to confirm or update</a>
        </p>
        <p style="font-size:12px;color:#888;margin-top:20px;">No changes needed? You can ignore this — we'll check in again next Monday.</p>
      `;

      const ok = await sendResendEmail({ to: company.email, subject, html });
      if (ok) sent++;
    }

    return res.status(200).json({ ok: true, companiesChecked: Object.keys(byCompany).length, emailsSent: sent });
  } catch (e) {
    console.error("weekly-price-check error:", e);
    return res.status(500).json({ error: e.message });
  }
}
