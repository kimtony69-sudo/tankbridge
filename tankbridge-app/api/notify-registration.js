// This runs on Vercel as a serverless function at /api/notify-registration
// Supabase's Database Webhook calls this URL whenever a new row is inserted
// into public.companies (i.e. someone registers as a buyer, seller, or broker).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.WEBHOOK_SECRET) {
    const provided = req.headers["x-webhook-secret"];
    if (provided !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const company = req.body?.record;
    if (!company) return res.status(400).json({ error: "No company record in payload" });

    const typeLabel = { buyer: "buyer", seller: "seller", broker: "broker" }[company.type] || company.type;

    const subject = `New ${typeLabel} registration — ${company.company_name}`;
    const html = `
      <h2>New ${typeLabel} registration on Tankbridge</h2>
      <p>${company.company_name} has applied to register as a ${typeLabel}. Please review.</p>
      <p><strong>CIPC:</strong> ${company.cipc || "-"}</p>
      <p><strong>DMRE:</strong> ${company.dmre_license || "-"}</p>
      <p><strong>Contact:</strong> ${company.contact_name || "-"} — ${company.phone || "-"} — ${company.email || "-"}</p>
      <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard to approve or reject</a></p>
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
    console.error("notify-registration error:", e);
    return res.status(500).json({ error: e.message });
  }
}
