// This runs on Vercel as a serverless function at /api/notify-reactivation-request
// Called directly by the frontend when a withdrawn company clicks "Request
// reactivation" on their Dashboard. Emails admin so they can review and use
// the existing "Reactivate account instead" action in the Admin panel.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { companyId } = req.body || {};
    if (!companyId) return res.status(400).json({ error: "Missing companyId" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const coRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}&select=company_name,email,type,account_status,deactivation_reason`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const company = (await coRes.json())?.[0];
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.account_status !== "withdrawn") return res.status(400).json({ error: "This company is not currently withdrawn." });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Tankbridge <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL,
        subject: `Reactivation requested — ${company.company_name}`,
        html: `
          <h2>A withdrawn account wants to be reactivated</h2>
          <p><strong>Company:</strong> ${company.company_name} (${company.type})</p>
          <p><strong>Contact email:</strong> ${company.email}</p>
          <p><strong>Original withdrawal reason:</strong> ${company.deactivation_reason || "-"}</p>
          <p>Review and use "Reactivate account instead" in the Admin panel if appropriate.</p>
          <p><a href="https://tankbridge.co.za/#admin">Open the Admin dashboard</a></p>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email", detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-reactivation-request error:", e);
    return res.status(500).json({ error: e.message });
  }
}
