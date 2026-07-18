// This runs on Vercel as a serverless function at /api/notify-company-status
// Called directly by the frontend right after admin approves or rejects a
// buyer/seller/broker registration. Emails the applicant with the outcome.

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
    const { companyId, status } = req.body || {};
    if (!companyId || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Missing companyId or invalid status" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const coRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}&select=company_name,email,type`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const company = (await coRes.json())?.[0];
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (!company.email || company.email === "-") return res.status(200).json({ ok: true, skipped: true }); // no real email on file

    const subject = status === "approved"
      ? `Your Tankbridge registration has been approved`
      : `Your Tankbridge registration application`;

    const html = status === "approved"
      ? `
        <h2>Registration approved</h2>
        <p>Hi ${company.company_name},</p>
        <p>Your registration as a ${company.type} on Tankbridge has been approved. You're now live on the Market Board.</p>
        <p><a href="https://tankbridge.co.za/#dashboard">Open your Dashboard</a></p>
      `
      : `
        <h2>Registration update</h2>
        <p>Hi ${company.company_name},</p>
        <p>Thank you for applying to register on Tankbridge. Upon review, non-compliance was found with your application and it has not been approved at this time.</p>
        <p>If you would like to register, please contact Tankbridge admin.</p>
      `;

    const ok = await sendResendEmail({ to: company.email, subject, html });
    if (!ok) return res.status(500).json({ error: "Failed to send email" });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify-company-status error:", e);
    return res.status(500).json({ error: e.message });
  }
}
