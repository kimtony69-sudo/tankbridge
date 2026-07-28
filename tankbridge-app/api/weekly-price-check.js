// This runs on Vercel as a Cron Job at /api/weekly-price-check (see vercel.json).
// Every Monday at 10:00 SAST, emails whoever can actually act on each active
// listing's price: the company itself once they're registered and can log
// in, or — while they're still an unregistered placeholder being represented
// by a Mandate — their authorised Mandate instead. Never both; whichever one
// can currently log in and edit the price is the one who gets asked.

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
    const listings = await sb(`listings?status=eq.active&select=*,companies(company_name,email,user_id,type,authorized_negotiator_id)`, serviceKey, supabaseUrl);

    const byCompany = {};
    for (const l of listings) {
      if (!l.companies) continue;
      const key = l.company_id;
      if (!byCompany[key]) byCompany[key] = { company: l.companies, listings: [] };
      byCompany[key].listings.push(l);
    }

    // Look up the authorised Mandate for any still-unregistered company.
    const negotiatorIds = [...new Set(Object.values(byCompany)
      .filter(v => !v.company.user_id && v.company.authorized_negotiator_id)
      .map(v => v.company.authorized_negotiator_id))];
    const negotiators = {};
    for (const id of negotiatorIds) {
      const rows = await sb(`companies?id=eq.${id}&select=id,company_name,email`, serviceKey, supabaseUrl);
      if (rows?.[0]?.email && rows[0].email !== "-") negotiators[id] = rows[0];
    }

    let sent = 0;
    for (const key of Object.keys(byCompany)) {
      const { company, listings: myListings } = byCompany[key];

      // Registered company → they get the check-in themselves.
      // Not yet registered → their authorised Mandate gets it instead (they
      // can't log in to update anything themselves yet). No Mandate and not
      // registered → nobody can act on this listing, so skip it.
      const isRegistered = !!company.user_id;
      const negotiator = !isRegistered && company.authorized_negotiator_id ? negotiators[company.authorized_negotiator_id] : null;
      const recipient = isRegistered ? (company.email && company.email !== "-" ? { email: company.email, company_name: company.company_name } : null)
                                      : (negotiator ? { email: negotiator.email, company_name: negotiator.company_name } : null);
      if (!recipient) continue;

      const rows = myListings.map(l => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.product}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${Number(l.volume).toLocaleString()} \u2113</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">R ${Number(l.unit_price).toFixed(2)}/\u2113</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${fmtTerms(l.terms)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.location}</td>
        </tr>
      `).join("");
      const table = `
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
      `;

      const subject = `Weekly price check — is your Tankbridge listing still accurate?`;
      const intro = negotiator
        ? `<p>Hi ${recipient.company_name},</p><p>As ${company.company_name}'s authorised Mandate, here's their weekly check-in. Please confirm the ${company.type === "seller" ? "asking" : "bid"} price below is still correct — a stale price can lose a match or waste a counterparty's time.</p>`
        : `<p>Hi ${recipient.company_name},</p><p>Market prices move fast. Please confirm your ${company.type === "seller" ? "asking" : "bid"} price below is still correct — a stale price can lose you a match or waste a counterparty's time.</p>`;

      const ok = await sendResendEmail({
        to: recipient.email, subject,
        html: `
          <h2>Quick weekly price check</h2>
          ${intro}
          ${table}
          <p style="margin-top:20px;">
            <a href="https://tankbridge.co.za/?view=dashboard" style="background:#e39a2d;color:#101b28;padding:11px 18px;text-decoration:none;font-weight:bold;">Log in to confirm or update</a>
          </p>
          <p style="font-size:12px;color:#888;margin-top:20px;">No changes needed? You can ignore this — we'll check in again next Monday.</p>
        `,
      });
      if (ok) sent++;
    }

    return res.status(200).json({ ok: true, companiesChecked: Object.keys(byCompany).length, emailsSent: sent });
  } catch (e) {
    console.error("weekly-price-check error:", e);
    return res.status(500).json({ error: e.message });
  }
}
