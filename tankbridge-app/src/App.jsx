import React, { useState, useEffect, useCallback } from "react";
import {
  Truck, ShieldCheck, Clock, CheckCircle2, XCircle, FileSignature,
  ChevronRight, LogIn, Search, Plus, MapPin, Building2,
  BadgeCheck, AlertTriangle, ArrowLeft, Mail, Phone, Lock, LogOut, Menu, X
} from "lucide-react";
import { supabase } from "./supabaseClient";


const PRODUCTS = ["Diesel 50ppm", "Diesel 10ppm (ULSD)", "Illuminating Paraffin", "Petrol ULP93", "Petrol ULP95"];
const LOCATIONS = ["Durban", "Lesedi", "Secunda", "Sasolburg", "Johannesburg", "Cape Town", "Richards Bay", "Other"];
const TRADE_TERMS = ["COC", "COD", "ITT", "TTO"];
const BUYER_FELL_THROUGH_REASONS = [
  "Could not verify Proof of Product",
  "Seller changed the price unilaterally",
  "No product available",
  "Other",
];
const SELLER_FELL_THROUGH_REASONS = [
  "Issue with Proof of Funds",
  "Did not receive ICPO",
  "Did not receive uplift / loading schedule",
  "Other",
];

function fmtDate(ts) {
  if (!ts) return "-";
  try { return new Date(ts).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return ""; }
}
function fmtMoney(n) {
  const num = Number(n);
  if (isNaN(num)) return "-";
  return "R " + num.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTerms(t) {
  if (!t) return "-";
  return Array.isArray(t) ? t.join(" / ") : t;
}

const EMPTY_REG = {
  companyName: "", cipc: "", dmreLicense: "", address: "", contactName: "", phone: "", email: "",
  password: "", confirmPassword: "",
  product: PRODUCTS[0], tradeVolume: "", tradeLocation: LOCATIONS[0], tradeLocationOther: "", tradePrice: "", tradeTerms: [],
  // broker-only: the first referral they submit as part of registering
  referredType: "seller", referredCompanyName: "", referredCipc: "", referredDmreLicense: "", referredEmail: "",
};
const EMPTY_LISTING = { product: PRODUCTS[0], volume: "", unitPrice: "", terms: [], location: "", availability: "", notes: "", procedures: {} };
const EMPTY_REFERRAL = {
  referredType: "seller", referredCompanyName: "", referredCipc: "", referredDmreLicense: "",
  referredContactName: "", referredPhone: "", referredEmail: "",
  product: PRODUCTS[0], volume: "", unitPrice: "", location: LOCATIONS[0], locationOther: "", terms: [], notes: "",
};

function toggleTerm(list, term) {
  return list.includes(term) ? list.filter(t => t !== term) : [...list, term];
}
function TermsCheckboxGroup({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {TRADE_TERMS.map(t => (
        <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={value.includes(t)} onChange={() => onChange(toggleTerm(value, t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.gnt { font-family:'Inter',sans-serif; color:var(--ink); background:var(--paper); min-height:100vh; }
.gnt, .gnt * { box-sizing:border-box; }
.gnt {
  --ink:#101b28; --steel:#3c4a5c; --steel-soft:#6b7887;
  --paper:#ece8de; --paper-dark:#ddd7c7; --panel:#f6f4ec;
  --amber:#e39a2d; --amber-dark:#b87816;
  --verified:#3f6b52; --verified-bg:#e4ede6;
  --alert:#a63b32; --alert-bg:#f3e2df;
  --line:rgba(16,27,40,0.14);
}
.gnt h1,.gnt h2,.gnt h3,.gnt h4 { font-family:'Barlow Condensed',sans-serif; font-weight:700; letter-spacing:0.01em; margin:0; }
.gnt .mono { font-family:'IBM Plex Mono',monospace; }

.gnt-header { position:sticky; top:0; z-index:30; background:var(--ink); color:var(--paper); border-bottom:3px solid var(--amber); }
.gnt-header-inner { max-width:1180px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; position:relative; }
.gnt-brand { display:flex; align-items:center; gap:10px; cursor:pointer; }
.gnt-brand-mark { width:34px; height:34px; border-radius:9px; background:#1c2c40; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.gnt-brand-text { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:20px; letter-spacing:0; line-height:1; }
.gnt-brand-sub { font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:9.5px; color:var(--amber); letter-spacing:0.1em; text-transform:uppercase; }
.gnt-nav { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.gnt-nav button { background:none; border:none; color:var(--paper); opacity:0.75; font-size:14px; padding:8px 12px; cursor:pointer; font-weight:500; border-bottom:2px solid transparent; }
.gnt-nav button:hover { opacity:1; }
.gnt-nav button.active { opacity:1; border-bottom:2px solid var(--amber); }
.gnt-nav .admin-link { opacity:0.45; font-family:'IBM Plex Mono',monospace; font-size:11px; }
.gnt-mobile-toggle { display:none; background:none; border:1.5px solid rgba(236,232,222,0.4); color:var(--paper); padding:8px 10px; cursor:pointer; align-items:center; justify-content:center; }

.gnt-main { max-width:1180px; margin:0 auto; padding:0 20px 80px; }

/* HERO */
.gnt-hero { background:var(--ink); color:var(--paper); margin:0 -20px 0; padding:64px 20px 72px; position:relative; overflow:hidden; }
.gnt-hero-inner { max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1.15fr 0.85fr; gap:48px; align-items:center; }
.gnt-eyebrow { font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--amber); letter-spacing:0.16em; text-transform:uppercase; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
.gnt-eyebrow::before { content:''; width:22px; height:2px; background:var(--amber); display:inline-block; }
.gnt-hero h1 { font-size:56px; line-height:0.98; margin-bottom:18px; }
.gnt-hero h1 span { color:var(--amber); }
.gnt-hero p.lead { font-size:17px; color:var(--paper-dark); max-width:480px; line-height:1.55; margin-bottom:28px; }
.gnt-hero-ctas { display:flex; gap:12px; flex-wrap:wrap; }
.gnt-panel-manifest { background:var(--panel); color:var(--ink); border:1px solid rgba(255,255,255,0.1); padding:22px; position:relative; }
.gnt-manifest-row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px dashed var(--line); font-size:13.5px; }
.gnt-manifest-row:last-child { border-bottom:none; }
.gnt-manifest-row .k { color:var(--steel); }
.gnt-manifest-row .v { font-family:'IBM Plex Mono',monospace; font-weight:600; }
.gnt-manifest-head { font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--steel-soft); margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid var(--ink); }

/* BUTTONS */
.gnt-btn { font-family:'Inter',sans-serif; font-weight:600; font-size:14px; padding:12px 20px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:transform .12s ease; }
.gnt-btn:active { transform:translateY(1px); }
.gnt-btn-amber { background:var(--amber); color:var(--ink); }
.gnt-btn-amber:hover { background:var(--amber-dark); }
.gnt-btn-outline { background:transparent; color:var(--paper); border:1.5px solid rgba(236,232,222,0.4); }
.gnt-btn-outline:hover { border-color:var(--paper); }
.gnt-btn-ink { background:var(--ink); color:var(--paper); }
.gnt-btn-ink:hover { background:#1c2c40; }
.gnt-btn-ghost { background:transparent; color:var(--ink); border:1.5px solid var(--line); }
.gnt-btn-ghost:hover { border-color:var(--ink); }
.gnt-btn:disabled { opacity:0.4; cursor:not-allowed; }
.gnt-btn-sm { padding:8px 14px; font-size:12.5px; }
.gnt-btn-danger { background:var(--alert-bg); color:var(--alert); }

/* HOW IT WORKS */
.gnt-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin:0 -20px; background:var(--panel); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.gnt-step { padding:40px 32px; border-right:1px solid var(--line); position:relative; }
.gnt-step:last-child { border-right:none; }
.gnt-step-num { font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--amber-dark); letter-spacing:0.1em; }
.gnt-step h3 { font-size:24px; margin:10px 0 8px; }
.gnt-step p { font-size:14px; color:var(--steel); line-height:1.55; }

.gnt-section { padding:56px 0; }
.gnt-section-head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:12px; }
.gnt-section-head h2 { font-size:34px; }
.gnt-section-head p { color:var(--steel); font-size:14px; max-width:520px; }

/* CARDS */
.gnt-card { background:var(--panel); border:1px solid var(--line); padding:22px; position:relative; }
.gnt-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.gnt-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

/* FORMS */
.gnt-field { margin-bottom:16px; }
.gnt-field label { display:block; font-size:12.5px; font-weight:600; color:var(--steel); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em; }
.gnt-field input, .gnt-field select, .gnt-field textarea {
  width:100%; padding:11px 12px; border:1.5px solid var(--line); background:#fff; font-size:14.5px; font-family:'Inter',sans-serif; color:var(--ink);
}
.gnt-field input:focus, .gnt-field select:focus, .gnt-field textarea:focus { outline:2px solid var(--amber); outline-offset:1px; border-color:var(--amber); }
.gnt-field .hint { font-size:12px; color:var(--steel-soft); margin-top:5px; }
.gnt-type-toggle { display:flex; gap:0; border:1.5px solid var(--ink); margin-bottom:24px; width:fit-content; }
.gnt-type-toggle button { padding:10px 22px; background:#fff; border:none; font-weight:600; font-size:14px; cursor:pointer; color:var(--ink); }
.gnt-type-toggle button.active { background:var(--ink); color:var(--paper); }

/* BADGES */
.gnt-badge { display:inline-flex; align-items:center; gap:6px; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; padding:5px 10px; font-weight:500; }
.gnt-badge.pending { background:#f0e6d2; color:var(--amber-dark); }
.gnt-badge.approved { background:var(--verified-bg); color:var(--verified); }
.gnt-badge.rejected { background:var(--alert-bg); color:var(--alert); }
.gnt-badge.buying { background:#dde7f0; color:#2c5a82; }
.gnt-badge.selling { background:var(--verified-bg); color:var(--verified); }

/* STAMP */
/* stamp removed per request */

/* LISTING CARD */
.gnt-listing { background:#fff; border:1px solid var(--line); border-left:4px solid var(--ink); padding:20px; position:relative; }
.gnt-listing-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; margin-bottom:12px; }
.gnt-listing-product { font-size:22px; }
.gnt-listing-price { font-family:'IBM Plex Mono',monospace; font-size:20px; font-weight:600; color:var(--ink); text-align:right; }
.gnt-listing-price small { display:block; font-size:10.5px; color:var(--steel-soft); font-weight:400; text-transform:uppercase; letter-spacing:0.06em; }
.gnt-listing-meta { display:flex; flex-wrap:wrap; gap:14px; font-size:13px; color:var(--steel); margin-bottom:14px; }
.gnt-listing-meta span { display:flex; align-items:center; gap:5px; }
.gnt-terms-chip { font-family:'IBM Plex Mono',monospace; font-size:11px; padding:3px 8px; background:var(--paper-dark); }

.gnt-empty { padding:48px 20px; text-align:center; color:var(--steel-soft); border:1.5px dashed var(--line); }
.gnt-empty svg { margin-bottom:10px; opacity:0.5; }

.gnt-doc-box { background:#fff; border:1.5px solid var(--ink); padding:24px; max-height:340px; overflow-y:auto; font-size:13.5px; line-height:1.7; color:var(--steel); margin-bottom:18px; }
.gnt-doc-box h4 { font-size:15px; color:var(--ink); margin:14px 0 6px; }
.gnt-doc-box h4:first-child { margin-top:0; }
.gnt-sig-line { border-top:1px solid var(--ink); margin-top:6px; padding-top:6px; font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--steel-soft); }

.gnt-table { width:100%; border-collapse:collapse; font-size:13.5px; }
.gnt-table th { text-align:left; font-family:'IBM Plex Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--steel-soft); padding:8px 10px; border-bottom:2px solid var(--ink); }
.gnt-table td { padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
.gnt-table tr:hover td { background:rgba(0,0,0,0.02); }

.gnt-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 20px; margin:16px 0; }
.gnt-detail-grid .dt { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--steel-soft); margin-top:10px; }
.gnt-detail-grid .dd { font-family:'IBM Plex Mono',monospace; font-size:13.5px; margin-bottom:4px; }

.gnt-modal-backdrop { position:fixed; inset:0; background:rgba(16,27,40,0.6); display:flex; align-items:flex-start; justify-content:center; z-index:100; padding:40px 16px; overflow-y:auto; }
.gnt-modal { background:var(--panel); max-width:640px; width:100%; padding:28px; border-top:4px solid var(--amber); }

.gnt-footer { border-top:1px solid var(--line); margin-top:60px; padding:28px 0; font-size:12px; color:var(--steel-soft); display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; }

.gnt-alert-banner { display:flex; gap:10px; align-items:flex-start; background:var(--alert-bg); color:var(--alert); padding:12px 14px; font-size:13px; margin-bottom:18px; }
.gnt-info-banner { display:flex; gap:10px; align-items:flex-start; background:var(--verified-bg); color:var(--verified); padding:12px 14px; font-size:13px; margin-bottom:18px; }

@media (max-width:840px){
  .gnt-hero-inner{grid-template-columns:1fr;}
  .gnt-hero h1{font-size:38px;}
  .gnt-steps{grid-template-columns:1fr;}
  .gnt-step{border-right:none;border-bottom:1px solid var(--line);}
  .gnt-grid3{grid-template-columns:1fr;}
  .gnt-grid2{grid-template-columns:1fr;}
  .gnt-detail-grid{grid-template-columns:1fr;}
  .gnt-nav{
    display:none; position:absolute; top:100%; left:0; right:0; z-index:40;
    flex-direction:column; align-items:stretch; gap:0;
    background:var(--ink); border-top:1px solid rgba(236,232,222,0.15);
    padding:6px 20px 14px; box-shadow:0 12px 20px rgba(0,0,0,0.25);
  }
  .gnt-nav.mobile-open{ display:flex; }
  .gnt-nav button{ text-align:left; padding:12px 4px; border-bottom:1px solid rgba(236,232,222,0.1); }
  .gnt-mobile-toggle{ display:inline-flex; }
}
`;

function LoginGate({ onLoggedIn, onRegisterClick, hideRegisterLink }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (onLoggedIn) onLoggedIn();
  }

  async function sendMagicLink() {
    if (!email) { setErr("Enter your email above first."); return; }
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) { setErr(error.message); return; }
    setMagicSent(true);
  }

  if (magicSent) {
    return (
      <div className="gnt-card" style={{ textAlign: "center", padding: 28, maxWidth: 420 }}>
        <Mail size={26} style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 14 }}>We've sent a login link to {email}. Check your inbox and click the link — keep this tab open.</p>
      </div>
    );
  }

  return (
    <div className="gnt-card" style={{ maxWidth: 420 }}>
      <h3 style={{ fontSize: 18, marginBottom: 10 }}>Log in</h3>
      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 12 }}>Already registered? Enter your email and password.</p>
      {err && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {err}</div>}
      <form onSubmit={submitLogin}>
        <div className="gnt-field"><label>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.co.za" /></div>
        <div className="gnt-field"><label>Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div>
        <button className="gnt-btn gnt-btn-ink" type="submit" disabled={loading}><LogIn size={15} /> {loading ? "Logging in…" : "Log in"}</button>
      </form>
      <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginTop: 10 }} type="button" onClick={sendMagicLink}>Forgot your password? Email me a login link</button>
      {!hideRegisterLink && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>New company — not registered yet?</p>
          <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="button" onClick={onRegisterClick}>Register now</button>
        </div>
      )}
    </div>
  );
}


function DealCard({ deal, myCompany, onReported }) {
  const [info, setInfo] = useState(null);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReasonText, setOtherReasonText] = useState("");

  const isSellerViewing = myCompany.id === deal.seller_company_id;
  const myReportedStatus = isSellerViewing ? deal.seller_reported_status : deal.buyer_reported_status;
  const otherReportedStatus = isSellerViewing ? deal.buyer_reported_status : deal.seller_reported_status;
  const myFellThroughReason = isSellerViewing ? deal.seller_fell_through_reason : deal.buyer_fell_through_reason;
  const reasonOptions = isSellerViewing ? SELLER_FELL_THROUGH_REASONS : BUYER_FELL_THROUGH_REASONS;

  async function reveal() {
    setLoading(true);
    if (isSellerViewing) {
      const { data } = await supabase.rpc("get_deal_buyer_contact", { p_deal_id: deal.id });
      const success = data && data.length > 0;
      setGated(!success);
      setInfo(success ? data[0] : null);
      if (success) {
        fetch("/api/notify-buyer-info-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: deal.id }),
        }).catch(() => {}); // best-effort — sends once per deal, guarded server-side
      }
    } else {
      const { data } = await supabase.rpc("get_deal_seller_contact", { p_deal_id: deal.id });
      setGated(false);
      setInfo((data && data[0]) || null);
    }
    setChecked(true);
    setLoading(false);
  }

  async function report(outcome, reason) {
    setReporting(true);
    const { error } = await supabase.rpc("report_deal_outcome", { p_deal_id: deal.id, p_outcome: outcome, p_reason: reason || null });
    setReporting(false);
    if (!error) {
      fetch("/api/notify-deal-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, role: isSellerViewing ? "seller" : "buyer", outcome, reason }),
      }).catch(() => {}); // best-effort — don't block the UI if the email fails
      setShowReasonPicker(false);
      if (onReported) onReported();
    }
  }

  function submitFellThrough() {
    const reason = selectedReason === "Other" ? (otherReasonText.trim() || "Other") : selectedReason;
    if (!selectedReason) return;
    report("fell_through", reason);
  }

  return (
    <div className="gnt-card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span className={`gnt-badge ${deal.status === "completed" ? "approved" : deal.status === "cancelled" ? "rejected" : "pending"}`} style={{ marginBottom: 6 }}>{deal.status}</span>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{deal.product} · {Number(deal.volume).toLocaleString()} ℓ · {fmtTerms(deal.terms)} · {deal.location}</div>
        </div>
        <div className="mono" style={{ fontWeight: 600 }}>{fmtMoney(deal.unit_price)}/ℓ</div>
      </div>
      {!checked ? (
        <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginTop: 8 }} onClick={reveal} disabled={loading}>
          {loading ? "Checking…" : "View contact details"}
        </button>
      ) : gated ? (
        <div className="gnt-alert-banner"><Lock size={16} /> Buyer identity hidden until you sign the IMFPA above.</div>
      ) : info ? (
        <div className="gnt-info-banner"><CheckCircle2 size={16} /> {info.company_name} (CIPC {info.cipc || "—"}) — {info.contact_name}, {info.phone}, {info.email}</div>
      ) : (
        <div className="gnt-alert-banner"><AlertTriangle size={16} /> Could not load contact details.</div>
      )}

      {deal.status !== "completed" && deal.status !== "cancelled" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          {myReportedStatus ? (
            <p style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>
              You reported this deal as <strong>{myReportedStatus === "completed" ? "completed" : "fell through"}</strong>{myFellThroughReason ? ` (${myFellThroughReason})` : ""}.
              {otherReportedStatus ? " The other party has also reported an outcome — admin has been notified." : " Waiting on the other party / admin to confirm."}
            </p>
          ) : showReasonPicker ? (
            <>
              <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>What went wrong?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {reasonOptions.map(r => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name={`reason-${deal.id}`} checked={selectedReason === r} onChange={() => setSelectedReason(r)} />
                    {r}
                  </label>
                ))}
              </div>
              {selectedReason === "Other" && (
                <input style={{ marginBottom: 10 }} value={otherReasonText} onChange={e => setOtherReasonText(e.target.value)} placeholder="Briefly describe what happened" />
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="gnt-btn gnt-btn-danger gnt-btn-sm" disabled={!selectedReason || reporting} onClick={submitFellThrough}>Submit</button>
                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" type="button" onClick={() => setShowReasonPicker(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>Let Tankbridge know how this deal turned out — admin can't tell otherwise.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="gnt-btn gnt-btn-amber gnt-btn-sm" disabled={reporting} onClick={() => report("completed")}>Report: Deal completed</button>
                <button className="gnt-btn gnt-btn-danger gnt-btn-sm" disabled={reporting} onClick={() => setShowReasonPicker(true)}>Report: Deal fell through</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const checkinParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("checkin") === "1" && p.get("deal") && p.get("token")) {
        return { dealId: p.get("deal"), token: p.get("token"), role: p.get("role") || "", outcome: p.get("outcome") || "" };
      }
    } catch { /* ignore */ }
    return null;
  })();

  const inviteToken = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get("invite") || null;
    } catch { return null; }
  })();

  const [view, setView] = useState(checkinParams ? "checkin" : inviteToken ? "invite" : "landing");
  const [inviteReferral, setInviteReferral] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteStep, setInviteStep] = useState("intro"); // intro -> account -> confirm-email -> ncnda -> done
  const [inviteForm, setInviteForm] = useState({ password: "", confirmPassword: "", contactName: "", phone: "", email: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviteNcndaAgree, setInviteNcndaAgree] = useState(false);
  const [inviteNcndaName, setInviteNcndaName] = useState("");
  const [inviteNcndaScrolledEnd, setInviteNcndaScrolledEnd] = useState(false);
  const [checkinResult, setCheckinResult] = useState(null);
  const [checkinChoice, setCheckinChoice] = useState(checkinParams?.outcome || "");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myCompany, setMyCompany] = useState(null);
  const [companyChecked, setCompanyChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [boardListings, setBoardListings] = useState([]);
  const [publicBlacklist, setPublicBlacklist] = useState([]);
  const [adminBlacklist, setAdminBlacklist] = useState([]);
  const [blacklistForm, setBlacklistForm] = useState({ companyName: "", reason: "" });
  const [blacklistError, setBlacklistError] = useState("");
  const [myListings, setMyListings] = useState([]);
  const [myDeals, setMyDeals] = useState([]);
  const [adminCompanies, setAdminCompanies] = useState([]);
  const [adminDeals, setAdminDeals] = useState([]);
  const [adminListings, setAdminListings] = useState([]);
  const [adminReferrals, setAdminReferrals] = useState([]);
  const [linkDealFor, setLinkDealFor] = useState(null); // referral being linked to a deal
  const [linkDealChoice, setLinkDealChoice] = useState("");
  const [commissionEdits, setCommissionEdits] = useState({}); // dealId -> input value
  const [showCancelledDeals, setShowCancelledDeals] = useState(false);
  const [showInactiveListings, setShowInactiveListings] = useState(false);

  const [myReferrals, setMyReferrals] = useState([]);
  const [referralForm, setReferralForm] = useState(EMPTY_REFERRAL);
  const [referralError, setReferralError] = useState("");
  const [referralAgree, setReferralAgree] = useState(false);
  const [referralName, setReferralName] = useState("");
  const [referralConfirmOpen, setReferralConfirmOpen] = useState(false);

  const [regType, setRegType] = useState("seller");
  const [regStep, setRegStep] = useState("form"); // form -> confirm-email (only if email confirmation required) -> ncnda -> done
  const [regForm, setRegForm] = useState(EMPTY_REG);
  const [ncndaAgree, setNcndaAgree] = useState(false);
  const [ncndaName, setNcndaName] = useState("");
  const [ncndaScrolledEnd, setNcndaScrolledEnd] = useState(false);
  const [regError, setRegError] = useState("");

  const [listingForm, setListingForm] = useState(EMPTY_LISTING);
  const [listingError, setListingError] = useState("");
  const [editingListing, setEditingListing] = useState(null);
  const [editError, setEditError] = useState("");
  const [showImfpaForm, setShowImfpaForm] = useState(false);
  const [imfpaJustSigned, setImfpaJustSigned] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ contactName: "", phone: "", address: "" });
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [imfpaAgree, setImfpaAgree] = useState(false);
  const [imfpaName, setImfpaName] = useState("");
  const [imfpaCommissionRate, setImfpaCommissionRate] = useState("0.10");

  const [marketFilter, setMarketFilter] = useState({ kind: "all", product: "all", terms: "all" });
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [acceptStep, setAcceptStep] = useState(1);
  const [acceptError, setAcceptError] = useState("");
  const [revealedInfo, setRevealedInfo] = useState(null);

  const [adminTab, setAdminTab] = useState("pending");
  const [detailCompany, setDetailCompany] = useState(null);

  const showToast = (msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3500); };
  function goto(v) { setView(v); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }

  // ---------- AUTH ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (!session) { setMyCompany(null); setIsAdmin(false); setCompanyChecked(true); return; }
      setCompanyChecked(false);
      const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
      setMyCompany(co || null);
      setCompanyChecked(true);
      const { data: adminFlag } = await supabase.rpc("is_admin");
      setIsAdmin(!!adminFlag);
      if (regStep === "login" || regStep === "confirm-email") setRegStep("ncnda");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function signOut() { await supabase.auth.signOut(); goto("landing"); }

  // ---------- BROKER-INVITED REGISTRATION ----------
  useEffect(() => {
    if (!inviteToken) { setInviteLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc("get_referral_by_token", { p_token: inviteToken });
      if (error || !data || data.length === 0) { setInviteError("This invite link is invalid or has expired."); setInviteLoading(false); return; }
      const referral = data[0];
      setInviteReferral(referral);
      setInviteForm(f => ({ ...f, email: referral.referred_email || "" }));
      if (referral.invite_status === "accepted") { setInviteStep("done"); }
      setInviteLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  useEffect(() => {
    if (view === "invite" && session && (inviteStep === "account" || inviteStep === "confirm-email")) {
      setInviteStep("ncnda");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function updateInviteField(field, value) { setInviteForm(f => ({ ...f, [field]: value })); }

  async function submitInviteAccount(e) {
    e.preventDefault();
    if (!inviteForm.contactName || !inviteForm.phone || !inviteForm.email) { setInviteError("Please complete contact person, phone and email."); return; }
    if (!/^\S+@\S+\.\S+$/.test(inviteForm.email)) { setInviteError("Please enter a valid email address."); return; }
    if (!session) {
      if (!inviteForm.password || inviteForm.password.length < 6) { setInviteError("Please choose a password of at least 6 characters."); return; }
      if (inviteForm.password !== inviteForm.confirmPassword) { setInviteError("Passwords do not match."); return; }
    }
    setInviteError("");

    if (session) { setInviteStep("ncnda"); return; }

    const { data, error } = await supabase.auth.signUp({ email: inviteForm.email, password: inviteForm.password });
    if (error) { setInviteError(error.message); return; }
    setInviteStep(data.session ? "ncnda" : "confirm-email");
  }

  function handleInviteNcndaScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setInviteNcndaScrolledEnd(true);
  }

  async function submitInviteRegistration(e) {
    e.preventDefault();
    if (!inviteNcndaAgree || inviteNcndaName.trim().length < 3) { setInviteError("Please accept the NCNDA and enter your full name."); return; }
    if (!session) { setInviteError("Please confirm your email and log in first."); return; }
    setInviteError("");
    const { error } = await supabase.rpc("complete_referral_registration", {
      p_token: inviteToken,
      p_contact_name: inviteForm.contactName,
      p_phone: inviteForm.phone,
      p_email: inviteForm.email,
      p_ncnda_signed_by: inviteNcndaName,
    });
    if (error) { setInviteError(error.message); return; }
    const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
    setMyCompany(co);
    setInviteStep("done");
    showToast("Registration complete — you're live on the Market Board.");
  }

  async function submitCheckin(outcome) {
    if (!checkinParams) return;
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const res = await fetch("/api/confirm-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: checkinParams.dealId, token: checkinParams.token, outcome }),
      });
      const data = await res.json();
      if (!res.ok) { setCheckinError(data.error || "Something went wrong."); setCheckinSubmitting(false); return; }
      setCheckinResult(data);
    } catch (e) {
      setCheckinError("Could not reach the server. Please try again.");
    }
    setCheckinSubmitting(false);
  }

  // ---------- MARKET BOARD ----------
  const loadMarketBoard = useCallback(async () => {
    const { data } = await supabase.from("market_board").select("*").order("created_at", { ascending: false });
    setBoardListings(data || []);
  }, []);
  useEffect(() => { loadMarketBoard(); }, [loadMarketBoard]);
  // Also refresh every time the person actually lands on Home or Market Board,
  // so a listing removed elsewhere (e.g. admin confirming a fell-through deal)
  // never lingers on screen from a stale earlier fetch.
  useEffect(() => {
    if (view === "landing" || view === "market") loadMarketBoard();
  }, [view, loadMarketBoard]);

  // ---------- PUBLIC BLACKLIST (visible to everyone, even logged out) ----------
  const loadPublicBlacklist = useCallback(async () => {
    const { data } = await supabase.from("blacklist").select("*").order("created_at", { ascending: false });
    setPublicBlacklist(data || []);
  }, []);
  useEffect(() => { loadPublicBlacklist(); }, [loadPublicBlacklist]);

  // ---------- MY LISTINGS / DEALS ----------
  const loadMyListings = useCallback(async () => {
    if (!myCompany) return;
    const { data } = await supabase.from("listings").select("*").eq("company_id", myCompany.id).order("created_at", { ascending: false });
    setMyListings(data || []);
  }, [myCompany]);

  const loadMyDeals = useCallback(async () => {
    if (!myCompany) return;
    const { data } = await supabase.from("deals").select("*")
      .or(`seller_company_id.eq.${myCompany.id},buyer_company_id.eq.${myCompany.id}`)
      .order("created_at", { ascending: false });
    setMyDeals(data || []);
  }, [myCompany]);

  const loadMyReferrals = useCallback(async () => {
    if (!myCompany || myCompany.type !== "broker") return;
    const { data } = await supabase.from("referrals").select("*").eq("broker_company_id", myCompany.id).order("created_at", { ascending: false });
    setMyReferrals(data || []);
  }, [myCompany]);

  useEffect(() => { loadMyListings(); loadMyDeals(); loadMyReferrals(); }, [loadMyListings, loadMyDeals, loadMyReferrals]);

  // ---------- ADMIN DATA ----------
  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const [{ data: cos }, { data: deals }, { data: listings }, { data: referrals }, { data: bl }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    ]);
    setAdminCompanies(cos || []);
    setAdminDeals(deals || []);
    setAdminListings(listings || []);
    setAdminReferrals(referrals || []);
    setAdminBlacklist(bl || []);
  }, [isAdmin]);
  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  // ---------- REGISTRATION ----------
  function updateReg(field, value) { setRegForm(f => ({ ...f, [field]: value })); }

  function validateRegForm() {
    if (regType === "broker") {
      if (!regForm.companyName || !regForm.contactName || !regForm.phone || !regForm.email) {
        return "Please complete company name, contact person, phone and email.";
      }
    } else if (!regForm.companyName || !regForm.cipc || !regForm.address || !regForm.contactName || !regForm.phone || !regForm.email) {
      return "Please complete all fields (CIPC number is required).";
    }
    if (!/^\S+@\S+\.\S+$/.test(regForm.email)) return "Please enter a valid email address.";

    if (!session) {
      if (!regForm.password || regForm.password.length < 6) return "Please choose a password of at least 6 characters.";
      if (regForm.password !== regForm.confirmPassword) return "Passwords do not match.";
    }

    if (regType === "broker") {
      if (!regForm.referredCompanyName || !regForm.referredCipc) return "Please enter the referred company's name and CIPC number.";
      if (!regForm.referredEmail || !/^\S+@\S+\.\S+$/.test(regForm.referredEmail)) return "A valid email for the referred company is required — Tankbridge will invite them to register directly.";
      if (regForm.referredType === "seller" && !regForm.referredDmreLicense) return "DMRE wholesale license is required when referring a seller.";
      if (!regForm.tradeVolume || !regForm.tradePrice) return "Please enter the volume and price for this referral.";
      if (Number(regForm.tradeVolume) < 40000) return "Minimum tradable volume is 40,000 litres.";
      if (regForm.tradeLocation === "Other" && !regForm.tradeLocationOther.trim()) return "Please enter a location.";
      if (!regForm.tradeTerms || regForm.tradeTerms.length === 0) return "Select at least one trading term.";
      return "";
    }

    if (regType === "seller" && !regForm.dmreLicense) return "Please enter your DMRE wholesale license number.";
    if (!regForm.tradeVolume || !regForm.tradePrice) return "Please enter the volume and price you want to trade.";
    if (Number(regForm.tradeVolume) < 40000) return "Minimum tradable volume is 40,000 litres.";
    if (regForm.tradeLocation === "Other" && !regForm.tradeLocationOther.trim()) return "Please enter a location.";
    if (!regForm.tradeTerms || regForm.tradeTerms.length === 0) return "Select at least one trading term.";
    return "";
  }

  async function submitRegForm(e) {
    e.preventDefault();
    const err = validateRegForm();
    if (err) { setRegError(err); return; }
    setRegError("");
    setNcndaScrolledEnd(false);

    if (session) {
      // already logged in (e.g. came back mid-flow) — just continue
      setRegStep("ncnda");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: regForm.email,
      password: regForm.password,
    });
    if (error) { setRegError(error.message); return; }

    if (data.session) {
      setRegStep("ncnda");
    } else {
      // Supabase project has "Confirm email" turned on — user must click the
      // confirmation link before they have a session.
      setRegStep("confirm-email");
    }
  }

  function handleNcndaScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setNcndaScrolledEnd(true);
  }

  async function finalizeRegistration(e) {
    e.preventDefault();
    if (!ncndaAgree || ncndaName.trim().length < 3) { setRegError("Please accept the NCNDA and enter your full name."); return; }
    if (!session) { setRegError("You need to be logged in."); return; }
    const resolvedLocation = regForm.tradeLocation === "Other" ? regForm.tradeLocationOther.trim() : regForm.tradeLocation;
    const { data, error } = await supabase.from("companies").insert({
      user_id: session.user.id,
      type: regType,
      company_name: regForm.companyName,
      cipc: regForm.cipc || null,
      dmre_license: regType === "seller" ? regForm.dmreLicense : null,
      address: regForm.address || null,
      contact_name: regForm.contactName,
      phone: regForm.phone,
      email: regForm.email,
      trade_volume: regType === "broker" ? null : Number(regForm.tradeVolume),
      trade_price: regType === "broker" ? null : Number(regForm.tradePrice),
      trade_location: regType === "broker" ? null : resolvedLocation,
      trade_terms: regType === "broker" ? null : regForm.tradeTerms,
      ncnda_signed: true,
      ncnda_signed_by: ncndaName,
      ncnda_signed_at: new Date().toISOString(),
    }).select().single();
    if (error) { setRegError(error.message); return; }

    // Buyers/sellers get their signup volume/price/location auto-published as their first listing
    // (this listing flips to active automatically when admin approves the company)
    if (regType !== "broker") {
      const { error: listingError } = await supabase.from("listings").insert({
        company_id: data.id,
        kind: regType === "seller" ? "sell" : "buy",
        product: regForm.product,
        volume: Number(regForm.tradeVolume),
        unit_price: Number(regForm.tradePrice),
        terms: regForm.tradeTerms,
        location: resolvedLocation,
        availability: "Immediate",
        status: "pending",
      });
      if (listingError) console.error("initial listing insert error", listingError);
    }

    // Brokers submit their first referral (buyer or seller) as part of registration —
    // it goes to admin for CIPC/DMRE verification, same as any later referral from their Dashboard.
    if (regType === "broker") {
      const { error: refError } = await supabase.from("referrals").insert({
        broker_company_id: data.id,
        referred_type: regForm.referredType,
        referred_company_name: regForm.referredCompanyName,
        referred_cipc: regForm.referredCipc,
        referred_dmre_license: regForm.referredType === "seller" ? regForm.referredDmreLicense : null,
        referred_email: regForm.referredEmail,
        product: regForm.product,
        volume: Number(regForm.tradeVolume),
        unit_price: Number(regForm.tradePrice),
        location: resolvedLocation,
        terms: regForm.tradeTerms,
        agreement_accepted: true,
        agreement_accepted_by: ncndaName,
        agreement_accepted_at: new Date().toISOString(),
      });
      if (refError) console.error("referral insert error", refError);
    }

    setMyCompany(data);
    setRegStep("done");
    showToast("Registration submitted — Tankbridge admin has been notified.");
  }

  function resetRegFlow() { setRegStep("form"); setRegForm(EMPTY_REG); setRegType("seller"); setRegError(""); setNcndaAgree(false); setNcndaScrolledEnd(false); goto("register"); }

  // ---------- LISTINGS (dashboard) ----------
  function updateListingField(field, value) { setListingForm(f => ({ ...f, [field]: value })); }
  function updateListingProcedure(term, value) { setListingForm(f => ({ ...f, procedures: { ...f.procedures, [term]: value } })); }

  async function submitListing(e) {
    e.preventDefault();
    const vol = Number(listingForm.volume);
    if (!listingForm.product || !listingForm.volume || !listingForm.unitPrice || !listingForm.location || !listingForm.availability) {
      setListingError("Please complete all required fields."); return;
    }
    if (!listingForm.terms || listingForm.terms.length === 0) { setListingError("Select at least one trading term."); return; }
    if (vol < 40000) { setListingError("Minimum tradable volume is 40,000 litres."); return; }
    setListingError("");
    const { error } = await supabase.from("listings").insert({
      company_id: myCompany.id,
      kind: myCompany.type === "seller" ? "sell" : "buy",
      product: listingForm.product,
      volume: vol,
      unit_price: Number(listingForm.unitPrice),
      terms: listingForm.terms,
      location: listingForm.location,
      availability: listingForm.availability,
      notes: listingForm.notes,
      procedures: listingForm.procedures,
      status: "active", // this form is only reachable once the company is already approved
    });
    if (error) { setListingError(error.message); return; }
    setListingForm(EMPTY_LISTING);
    await loadMyListings();
    await loadMarketBoard();
    showToast("Listing published to the Market Board.");
  }

  function startEdit(listing) { setEditingListing({ ...listing, volume: String(listing.volume), unit_price: String(listing.unit_price) }); setEditError(""); }
  function updateEditField(field, value) { setEditingListing(f => ({ ...f, [field]: value })); }
  function updateEditProcedure(term, value) { setEditingListing(f => ({ ...f, procedures: { ...(f.procedures || {}), [term]: value } })); }
  function cancelEdit() { setEditingListing(null); setEditError(""); }

  async function saveEdit(e) {
    e.preventDefault();
    const vol = Number(editingListing.volume);
    if (!editingListing.product || !editingListing.volume || !editingListing.unit_price || !editingListing.location || !editingListing.availability) {
      setEditError("Please complete all required fields."); return;
    }
    if (!editingListing.terms || editingListing.terms.length === 0) { setEditError("Select at least one trading term."); return; }
    if (vol < 40000) { setEditError("Minimum tradable volume is 40,000 litres."); return; }
    const { error } = await supabase.from("listings").update({
      volume: vol,
      unit_price: Number(editingListing.unit_price),
      location: editingListing.location,
      terms: editingListing.terms,
      availability: editingListing.availability,
      notes: editingListing.notes,
      procedures: editingListing.procedures || {},
    }).eq("id", editingListing.id);
    if (error) { setEditError(error.message); return; }
    setEditingListing(null);
    await loadMyListings();
    await loadMarketBoard();
    showToast("Listing updated.");
  }

  async function deleteListing(id) {
    await supabase.from("listings").delete().eq("id", id);
    await loadMyListings();
    await loadMarketBoard();
  }

  // ---------- IMFPA (dashboard, sellers) ----------
  async function submitSetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 6) { setPasswordMsg({ text: "Password must be at least 6 characters.", err: true }); return; }
    if (newPassword !== confirmNewPassword) { setPasswordMsg({ text: "Passwords do not match.", err: true }); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) { setPasswordMsg({ text: error.message, err: true }); return; }
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordMsg({ text: "Password set — use it to log in next time.", err: false });
    setShowSetPassword(false);
  }

  function startEditProfile(company) {
    setProfileForm({ contactName: company.contact_name || "", phone: company.phone || "", address: company.address || "" });
    setProfileError("");
    setShowEditProfile(true);
  }

  async function submitEditProfile(e, company) {
    e.preventDefault();
    if (!profileForm.contactName || !profileForm.phone) { setProfileError("Contact person and phone are required."); return; }
    setProfileSaving(true);
    const { error } = await supabase.from("companies").update({
      contact_name: profileForm.contactName,
      phone: profileForm.phone,
      address: profileForm.address || null,
    }).eq("user_id", session.user.id);
    setProfileSaving(false);
    if (error) { setProfileError(error.message); return; }
    const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
    setMyCompany(co);
    setShowEditProfile(false);
    showToast("Company details updated.");
  }

  async function submitDashboardImfpa(e) {
    e.preventDefault();
    if (!imfpaAgree || imfpaName.trim().length < 3) { setListingError("Please accept the IMFPA and enter your full name."); return; }
    const rate = Number(imfpaCommissionRate);
    if (isNaN(rate) || rate < 0.10 || rate > 0.99) { setListingError("Commission must be between R0.10 and R0.99 per litre."); return; }
    setListingError("");
    const { error } = await supabase.rpc("sign_imfpa", { p_signed_by: imfpaName, p_commission_rate: rate });
    if (error) { setListingError(error.message); return; }
    const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
    setMyCompany(co);
    setShowImfpaForm(false);
    setImfpaAgree(false);
    setImfpaName("");
    setImfpaCommissionRate("0.10");
    setImfpaJustSigned(true);
    showToast(`IMFPA signed at R${rate.toFixed(2)}/litre — buyer contact details on matched deals are now released.`);
  }

  // ---------- REFERRALS (broker) ----------
  function updateReferralField(field, value) { setReferralForm(f => ({ ...f, [field]: value })); }

  function submitReferral(e) {
    e.preventDefault();
    const f = referralForm;
    if (!f.referredCompanyName || !f.referredCipc || !f.volume || !f.unitPrice || !f.location || !f.terms || f.terms.length === 0) {
      setReferralError("Please complete all required fields."); return;
    }
    if (!f.referredEmail || !/^\S+@\S+\.\S+$/.test(f.referredEmail)) {
      setReferralError("A valid email for the referred company is required — Tankbridge will invite them to register directly."); return;
    }
    if (f.referredType === "seller" && !f.referredDmreLicense) {
      setReferralError("DMRE wholesale license is required when referring a seller."); return;
    }
    if (Number(f.volume) < 40000) { setReferralError("Minimum tradable volume is 40,000 litres."); return; }
    if (!referralAgree || referralName.trim().length < 3) { setReferralError("Please accept the Referral Agreement and enter your full name."); return; }
    setReferralError("");
    setReferralConfirmOpen(true);
  }

  async function confirmSubmitReferral() {
    const f = referralForm;
    const resolvedLocation = f.location === "Other" ? f.locationOther.trim() : f.location;
    const { error } = await supabase.from("referrals").insert({
      broker_company_id: myCompany.id,
      referred_type: f.referredType,
      referred_company_name: f.referredCompanyName,
      referred_cipc: f.referredCipc,
      referred_dmre_license: f.referredType === "seller" ? f.referredDmreLicense : null,
      referred_contact_name: f.referredContactName || null,
      referred_phone: f.referredPhone || null,
      referred_email: f.referredEmail || null,
      product: f.product,
      volume: Number(f.volume),
      unit_price: Number(f.unitPrice),
      location: resolvedLocation,
      terms: f.terms,
      notes: f.notes,
      agreement_accepted: true,
      agreement_accepted_by: referralName,
      agreement_accepted_at: new Date().toISOString(),
    });
    setReferralConfirmOpen(false);
    if (error) { setReferralError(error.message); return; }
    setReferralForm(EMPTY_REFERRAL);
    setReferralAgree(false);
    setReferralName("");
    await loadMyReferrals();
    showToast("Referral submitted for admin verification — it will appear on the Market Board once approved.");
  }

  // ---------- MARKET / ACCEPT ----------
  const visibleListings = boardListings
    .filter(l => marketFilter.kind === "all" || l.kind === marketFilter.kind)
    .filter(l => marketFilter.product === "all" || l.product === marketFilter.product)
    .filter(l => marketFilter.terms === "all" || (Array.isArray(l.terms) ? l.terms.includes(marketFilter.terms) : l.terms === marketFilter.terms));

  function openAccept(listing) { setAcceptTarget(listing); setAcceptStep(1); setAcceptError(""); }

  async function submitAccept() {
    if (!session) { setAcceptError("You need to be logged in."); return; }
    const { data: deal, error } = await supabase.rpc("accept_listing_price", { p_listing_id: acceptTarget.id });
    if (error) { setAcceptError(error.message); return; }
    const isSellListing = acceptTarget.kind !== "buy";
    let reveal;
    if (isSellListing) {
      const { data } = await supabase.rpc("get_deal_seller_contact", { p_deal_id: deal.id });
      reveal = { gated: false, info: (data && data[0]) || null };
    } else {
      const { data } = await supabase.rpc("get_deal_buyer_contact", { p_deal_id: deal.id });
      reveal = { gated: !data || data.length === 0, info: (data && data[0]) || null };
    }
    fetch("/api/notify-accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: deal.id }),
    }).catch(() => {}); // best-effort — don't block the UI if the email fails
    setRevealedInfo(reveal);
    setAcceptTarget(null);
    await loadMyDeals();
    showToast("Deal recorded — the other party and Tankbridge admin have been notified by email.");
  }

  // ---------- ADMIN ----------
  async function setCompanyStatus(c, status) {
    const { error } = await supabase.rpc("approve_company", { p_company_id: c.id, p_new_status: status });
    if (error) { showToast(error.message, "err"); return; }
    fetch("/api/notify-company-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: c.id, status }),
    }).catch(() => {}); // best-effort — don't block the UI if the email fails
    setDetailCompany(null);
    await loadAdminData();
    showToast(`${c.company_name} was ${status === "approved" ? "approved" : "rejected"} — they've been notified by email.`);
  }

  function updateCommissionInput(dealId, value) { setCommissionEdits(f => ({ ...f, [dealId]: value })); }

  async function saveCommission(dealId) {
    const amount = Number(commissionEdits[dealId]);
    if (!amount || amount <= 0) { showToast("Please enter a valid commission amount.", "err"); return; }
    const { error } = await supabase.from("deals").update({ platform_commission_amount: amount }).eq("id", dealId);
    if (error) { showToast(error.message, "err"); return; }
    await supabase.rpc("recalculate_referral_commission", { p_deal_id: dealId });
    await loadAdminData();
    showToast("Platform commission saved — linked broker commission has been recalculated.");
  }

  async function setDealStatus(dealId, newStatus) {
    const { error } = await supabase.rpc("set_deal_status", { p_deal_id: dealId, p_new_status: newStatus });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    await loadMarketBoard();
    showToast(
      newStatus === "completed" ? "Deal marked completed — listing removed from the Market Board."
      : newStatus === "cancelled" ? "Deal cancelled — listing stays live for other buyers."
      : "Deal reverted to matched."
    );
  }

  async function confirmFellThrough(dealId) {
    const { error } = await supabase.rpc("confirm_fell_through", { p_deal_id: dealId });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    await loadMarketBoard();
    showToast("Confirmed — removed from the Market Board and from both dashboards.");
  }

  async function addBlacklistEntry(e) {
    e.preventDefault();
    if (!blacklistForm.companyName || !blacklistForm.reason) { setBlacklistError("Company name and reason are both required."); return; }
    setBlacklistError("");
    const { error } = await supabase.from("blacklist").insert({ company_name: blacklistForm.companyName, reason: blacklistForm.reason });
    if (error) { setBlacklistError(error.message); return; }
    setBlacklistForm({ companyName: "", reason: "" });
    await loadAdminData();
    await loadPublicBlacklist();
    showToast("Company added to the public blacklist.");
  }

  async function removeBlacklistEntry(id) {
    await supabase.from("blacklist").delete().eq("id", id);
    await loadAdminData();
    await loadPublicBlacklist();
  }

  async function linkReferralToDeal(referralId, dealId) {
    if (!dealId) { showToast("Please select a deal to link.", "err"); return; }
    const { error } = await supabase.rpc("link_referral_to_deal", { p_referral_id: referralId, p_deal_id: dealId });
    if (error) { showToast(error.message, "err"); return; }
    setLinkDealFor(null);
    setLinkDealChoice("");
    await loadAdminData();
    showToast("Referral linked to the deal — commission has been calculated.");
  }

  async function setReferralStatus(referral, status) {
    const { error } = await supabase.rpc("set_referral_status", { p_referral_id: referral.id, p_new_status: status });
    if (error) { showToast(error.message, "err"); return; }
    if (status === "approved") {
      const res = await fetch("/api/send-referral-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId: referral.id }),
      }).catch(() => null);
      const ok = res && res.ok;
      showToast(ok
        ? `Verified — invite email sent to ${referral.referred_company_name}.`
        : `Verified, but the invite email failed to send. Use "Resend invite" below.`, ok ? "ok" : "err");
    } else {
      showToast("Referral rejected.");
    }
    await loadAdminData();
  }

  async function resendReferralInvite(referral) {
    const res = await fetch("/api/send-referral-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralId: referral.id }),
    }).catch(() => null);
    if (res && res.ok) { showToast("Invite email resent."); await loadAdminData(); }
    else { showToast("Failed to send invite email.", "err"); }
  }

  const pendingCompanies = adminCompanies.filter(c => c.status === "pending");
  const approvedCompanies = adminCompanies.filter(c => c.status === "approved");
  const rejectedCompanies = adminCompanies.filter(c => c.status === "rejected");

  const latestOffer = boardListings[0] || null;

  return (
    <div className="gnt">
      <style>{STYLE}</style>

      <header className="gnt-header">
        <div className="gnt-header-inner">
          <div className="gnt-brand" onClick={() => goto("landing")}>
            <div className="gnt-brand-mark">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e39a2d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="12" rx="1" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="4" y1="20" x2="20" y2="20" />
                <line x1="12" y1="15" x2="12" y2="20" />
              </svg>
            </div>
            <div>
              <div className="gnt-brand-text">Tankbridge</div>
              <div className="gnt-brand-sub">Bulk Diesel Exchange · ZA</div>
            </div>
          </div>
          <nav className={`gnt-nav ${mobileMenuOpen ? "mobile-open" : ""}`}>
            <button className={view === "landing" ? "active" : ""} onClick={() => goto("landing")}>Home</button>
            <button className={view === "market" ? "active" : ""} onClick={() => goto("market")}>Market Board</button>
            <button className={view === "register" ? "active" : ""} onClick={resetRegFlow}>Register</button>
            <button className={view === "dashboard" ? "active" : ""} onClick={() => goto("dashboard")}>My Dashboard</button>
            <button className="admin-link" onClick={() => goto("admin")}>Admin</button>
            {session && <button className="admin-link" onClick={signOut}><LogOut size={12} style={{ verticalAlign: "middle" }} /> Sign out</button>}
          </nav>
          <button className="gnt-mobile-toggle" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu">
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {toast && (
        <div style={{ position: "fixed", top: 76, right: 20, zIndex: 200, background: toast.kind === "err" ? "#a63b32" : "#101b28", color: "#ece8de", padding: "12px 18px", fontSize: 13.5, maxWidth: 320, boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
          {toast.msg}
        </div>
      )}

      {/* ===================== BROKER-INVITED REGISTRATION (public) ===================== */}
      {view === "invite" && (
        <div className="gnt-main" style={{ paddingTop: 40, maxWidth: 640, margin: "0 auto" }}>
          {inviteLoading ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading invite…</p>
          ) : inviteError && !inviteReferral ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <AlertTriangle size={32} style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Invite not found</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>{inviteError}</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : inviteStep === "done" ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <CheckCircle2 size={40} color="#3f6b52" style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 26, marginBottom: 8 }}>You're registered</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>{inviteReferral?.referred_company_name} is now live on the Tankbridge Market Board.</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("dashboard")}>Go to my Dashboard</button>
            </div>
          ) : inviteStep === "intro" ? (
            <>
              <h2 style={{ fontSize: 28, marginBottom: 10 }}>You've been introduced to Tankbridge</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 20 }}><strong>{inviteReferral.broker_company_name}</strong> has introduced <strong>{inviteReferral.referred_company_name}</strong> to Tankbridge as a {inviteReferral.referred_type}. Admin has already reviewed these details. Complete your own registration below to go live.</p>
              <div className="gnt-card" style={{ marginBottom: 20 }}>
                <div className="gnt-detail-grid" style={{ marginTop: 0 }}>
                  <div><div className="dt">Company</div><div className="dd">{inviteReferral.referred_company_name}</div></div>
                  <div><div className="dt">CIPC No.</div><div className="dd">{inviteReferral.referred_cipc}</div></div>
                  {inviteReferral.referred_dmre_license && <div><div className="dt">DMRE License</div><div className="dd">{inviteReferral.referred_dmre_license}</div></div>}
                  <div><div className="dt">{inviteReferral.referred_type === "seller" ? "Selling" : "Buying"}</div><div className="dd">{Number(inviteReferral.volume).toLocaleString()} ℓ @ {fmtMoney(inviteReferral.unit_price)}/ℓ</div></div>
                  <div><div className="dt">Location / Terms</div><div className="dd">{inviteReferral.location} · {fmtTerms(inviteReferral.terms)}</div></div>
                </div>
                <p className="hint" style={{ marginTop: 10 }}>These details were verified by Tankbridge admin and can't be changed here — contact admin if anything needs correcting.</p>
              </div>
              <button className="gnt-btn gnt-btn-amber" onClick={() => setInviteStep("account")}>Continue to registration <ChevronRight size={16} /></button>
            </>
          ) : inviteStep === "account" ? (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 10 }}>Create your account</h2>
              {inviteError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {inviteError}</div>}
              <form onSubmit={submitInviteAccount}>
                <div className="gnt-grid2">
                  <div className="gnt-field"><label>Contact person</label><input value={inviteForm.contactName} onChange={e => updateInviteField("contactName", e.target.value)} /></div>
                  <div className="gnt-field"><label>Phone</label><input value={inviteForm.phone} onChange={e => updateInviteField("phone", e.target.value)} placeholder="+27 8x xxx xxxx" /></div>
                </div>
                <div className="gnt-field"><label>Email</label><input type="email" value={inviteForm.email} onChange={e => updateInviteField("email", e.target.value)} />
                  <div className="hint">This is also your login email.</div>
                </div>
                {!session && (
                  <div className="gnt-grid2">
                    <div className="gnt-field"><label>Choose a password</label><input type="password" value={inviteForm.password} onChange={e => updateInviteField("password", e.target.value)} placeholder="At least 6 characters" /></div>
                    <div className="gnt-field"><label>Confirm password</label><input type="password" value={inviteForm.confirmPassword} onChange={e => updateInviteField("confirmPassword", e.target.value)} placeholder="Re-enter password" /></div>
                  </div>
                )}
                <button className="gnt-btn gnt-btn-ink" type="submit" style={{ width: "100%", justifyContent: "center" }}>Continue <ChevronRight size={16} /></button>
              </form>
            </>
          ) : inviteStep === "confirm-email" ? (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 10 }}>Confirm your email</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 18 }}>We've sent a confirmation link to <strong>{inviteForm.email}</strong>. Click it, then log in below with the password you just chose to continue.</p>
              <LoginGate hideRegisterLink />
            </>
          ) : inviteStep === "ncnda" ? (
            <>
              <h2 style={{ fontSize: 30, marginBottom: 6 }}>NCNDA — Non-Circumvention, Non-Disclosure &amp; Fee Protection Agreement</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 18 }}>Required before you go live. Please scroll to the end to enable agreement.</p>
              <div className="gnt-doc-box" onScroll={handleInviteNcndaScroll} style={{ maxHeight: 320 }}>
                <h4>1. Parties and Purpose</h4>
                <p>This Non-Circumvention, Non-Disclosure, and Fee Protection Agreement (the "Agreement") is entered into by and between Tankbridge (acting as the "Intermediary" and trading platform), and the registered platform user — in this registration, <strong>{inviteReferral.referred_company_name}</strong> (the "Party").</p>
                <p>This Agreement governs all bulk diesel opportunities, counterparties, sources of supply, and transaction structures introduced, facilitated, or made visible via the Tankbridge platform.</p>

                <h4>2. Strict Non-Circumvention</h4>
                <p>The Party explicitly covenants and agrees that it shall not, directly or indirectly, contact, solicit, negotiate with, contract with, or conduct any business with any counterparty, supplier, buyer, refinery, or terminal introduced by Tankbridge, without the express prior written consent of Tankbridge.</p>
                <p>This restriction applies to: direct transactions, or indirect transactions through affiliates, subsidiaries, agents, nominees, or related third parties; and the entire duration of the Party's registration on the Tankbridge platform, and for a period of twenty-four (24) months following the termination of this Agreement or the deactivation of the Party's account, whichever is later.</p>

                <h4>3. Non-Disclosure &amp; Confidentiality</h4>
                <p>The Party shall maintain strict confidentiality regarding all proprietary information obtained through the platform. This includes, but is not limited to: counterparty identities, corporate structures, DMRE wholesale licence details, pricing mechanisms, available volumes, logistics arrangements, and financial terms (the "Confidential Information").</p>
                <p>Confidential Information shall not be disclosed to any third party, nor used for any competitive or commercial purpose outside of transactions directly executed on Tankbridge, without prior written authorization.</p>

                <h4>4. Heavy Penalties for Circumvention &amp; Fee Protection</h4>
                <p>In the event of any breach of Section 2 (Circumvention) or unauthorized bypass of the Tankbridge platform, the Party acknowledges that Tankbridge will suffer immediate and irreparable financial harm. Therefore, the Party agrees to the following liquidated damages and compensation structure:</p>
                <p><strong>Forfeiture of Full Commission</strong> — The breaching Party shall be immediately liable to pay Tankbridge the full, unmitigated intermediary fee/commission that would have been due on the unauthorized transaction.</p>
                <p><strong>Compounded Damaged Volumes</strong> — If the circumvented transaction involves ongoing or recurring supply, the breaching Party shall pay Tankbridge a liquidated damages fee equal to R0.10 per litre of the total volume contracted, delivered, or contemplated under the circumvented relationship for the entire 24-month period, regardless of whether Tankbridge was actively involved in the subsequent transactions.</p>
                <p><strong>Punitive/Liquidated Damages</strong> — The Party agrees to pay an immediate, non-refundable penalty fee of Five Million Rand (R5,000,000) per established breach as a reasonable pre-estimate of administrative and punitive damages, without prejudice to Tankbridge's right to seek higher actual damages in court.</p>
                <p><strong>Legal Fees</strong> — The breaching Party shall be liable for all legal costs incurred by Tankbridge in enforcing this Agreement, calculated on an attorney-and-own-client scale, including collection commission and tracing fees.</p>

                <h4>5. Governing Law and Jurisdiction</h4>
                <p>This Agreement, and any dispute arising out of or in connection with it, shall be governed by, and construed in accordance with, the laws of the Republic of South Africa. Both Parties consent to the non-exclusive jurisdiction of the High Court of South Africa.</p>

                <div className="gnt-sig-line">This document is a highly restrictive and legally binding agreement designed to protect proprietary platform relationships. Tankbridge strongly advises the Party to obtain independent legal counsel before agreeing to these terms. By checking "I have read all of it, and I agree" or registering on the platform, you acknowledge that you have read, understood, and agreed to be bound by the severe financial penalties outlined herein.</div>
              </div>
              {inviteError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {inviteError}</div>}
              <form onSubmit={submitInviteRegistration}>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 6, cursor: inviteNcndaScrolledEnd ? "pointer" : "not-allowed", opacity: inviteNcndaScrolledEnd ? 1 : 0.5 }}>
                  <input type="checkbox" checked={inviteNcndaAgree} disabled={!inviteNcndaScrolledEnd} onChange={e => setInviteNcndaAgree(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>I have read all of it, and I agree to the NCNDA above on behalf of {inviteReferral.referred_company_name}.</span>
                </label>
                {!inviteNcndaScrolledEnd && <div className="hint" style={{ marginBottom: 16 }}>Scroll the document above to the end to enable this checkbox.</div>}
                <div className="gnt-field" style={{ marginTop: 16 }}><label>Type your full legal name to sign</label><input value={inviteNcndaName} onChange={e => setInviteNcndaName(e.target.value)} placeholder="Full name of signatory" /></div>
                <button className="gnt-btn gnt-btn-amber" type="submit" style={{ width: "100%", justifyContent: "center" }}>Accept &amp; go live on the Market Board <FileSignature size={16} /></button>
              </form>
            </>
          ) : null}
        </div>
      )}

      {/* ===================== CHECK-IN (public, no login) ===================== */}
      {view === "checkin" && (
        <div className="gnt-main" style={{ paddingTop: 40, maxWidth: 520, margin: "0 auto" }}>
          {checkinResult ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <CheckCircle2 size={40} color="#3f6b52" style={{ margin: "0 auto 14px" }} />
              {checkinChoice === "completed" ? (
                <>
                  <h2 style={{ fontSize: 26, marginBottom: 10 }}>Congratulations on the completed deal!</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>Thanks for letting Tankbridge know.</p>
                  {checkinResult.role === "seller" && (
                    <div className="gnt-info-banner" style={{ textAlign: "left", marginTop: 18 }}>
                      <FileSignature size={16} /> As agreed in your IMFPA, please issue Tankbridge's brokerage commission invoice for this deal. Admin has been notified and will be in touch about payment details.
                    </div>
                  )}
                </>
              ) : checkinChoice === "fell_through" ? (
                <>
                  <h2 style={{ fontSize: 24, marginBottom: 10 }}>Thanks for letting us know</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>Sorry this one didn't go through. Tankbridge admin has been notified. You can browse the Market Board any time for other opportunities.</p>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 24, marginBottom: 10 }}>Thanks — noted as still in progress</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>We'll check in again in a week.</p>
                </>
              )}
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 20 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : (
            <div className="gnt-card" style={{ padding: "32px 28px" }}>
              <h2 style={{ fontSize: 24, marginBottom: 10 }}>How's your deal going?</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 20 }}>Let Tankbridge know the current status — no login needed.</p>
              {checkinError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {checkinError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="gnt-btn gnt-btn-amber" disabled={checkinSubmitting} onClick={() => { setCheckinChoice("completed"); submitCheckin("completed"); }}>Deal completed</button>
                <button className="gnt-btn gnt-btn-ink" disabled={checkinSubmitting} onClick={() => { setCheckinChoice("in_progress"); submitCheckin("in_progress"); }}>Still in progress</button>
                <button className="gnt-btn gnt-btn-danger" disabled={checkinSubmitting} onClick={() => { setCheckinChoice("fell_through"); submitCheckin("fell_through"); }}>Deal fell through</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== LANDING ===================== */}
      {view === "landing" && (
        <>
          <section className="gnt-hero">
            <div className="gnt-hero-inner">
              <div>
                <div className="gnt-eyebrow">Verified Bulk Fuel Trading</div>
                <h1>Zero friction.<br /><span>Verified before it's visible.</span></h1>
                <p className="lead">South Africa's bulk diesel market runs on ghost volumes, unverified allocations and unregulated brokers. Tankbridge is the trust layer — vetted, licensed counterparties trading 40,000ℓ+ lots under COC, COD, ITT or TTO terms, with transparent pricing and fixed, disclosed commission.</p>
                <div className="gnt-hero-ctas">
                  <button className="gnt-btn gnt-btn-amber" onClick={resetRegFlow}>Register your company <ChevronRight size={16} /></button>
                  <button className="gnt-btn gnt-btn-outline" onClick={() => goto("market")}>View Market Board</button>
                </div>
              </div>
              <div className="gnt-panel-manifest">
                <div className="gnt-manifest-head">Latest Offer</div>
                {latestOffer ? (
                  <>
                    <div className="gnt-manifest-row"><span className="k">Type</span><span className="v">{latestOffer.kind === "buy" ? "Buying" : "Selling"}</span></div>
                    <div className="gnt-manifest-row"><span className="k">Product</span><span className="v">{latestOffer.product}</span></div>
                    <div className="gnt-manifest-row"><span className="k">Volume</span><span className="v">{Number(latestOffer.volume).toLocaleString()} ℓ</span></div>
                    <div className="gnt-manifest-row"><span className="k">Price</span><span className="v">{fmtMoney(latestOffer.unit_price)}/ℓ</span></div>
                    <div className="gnt-manifest-row"><span className="k">Terms</span><span className="v">{fmtTerms(latestOffer.terms)}</span></div>
                    <div className="gnt-manifest-row"><span className="k">Location</span><span className="v">{latestOffer.location}</span></div>
                    <div className="gnt-manifest-row"><span className="k">Verification</span><span className="v" style={{ color: "#3f6b52" }}>CIPC + DMRE ✓</span></div>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--steel-soft)", margin: 0 }}>No live offers on the Market Board yet — check back soon.</p>
                )}
              </div>
            </div>
          </section>

          <div className="gnt-steps">
            <div className="gnt-step">
              <div className="gnt-step-num">01 — REGISTER</div>
              <h3>Submit your documents</h3>
              <p>Buyers and sellers register with CIPC number, DMRE wholesale license, company address and contact details.</p>
            </div>
            <div className="gnt-step">
              <div className="gnt-step-num">02 — VERIFY</div>
              <h3>Admin review &amp; NCNDA</h3>
              <p>Every registration is manually checked. Buyers and sellers sign an NCNDA with Tankbridge before approval.</p>
            </div>
            <div className="gnt-step">
              <div className="gnt-step-num">03 — TRADE</div>
              <h3>Go live on the Market Board</h3>
              <p>Once approved, sellers list supply and buyers browse and inquire — every deal routed through Tankbridge.</p>
            </div>
          </div>

          <section className="gnt-section">
            <div className="gnt-section-head">
              <h2>Why Tankbridge</h2>
              <p>A trust layer for South Africa's bulk fuel market — not another layer of brokers.</p>
            </div>
            <div className="gnt-grid3">
              <div className="gnt-card">
                <ShieldCheck size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Pre-vetted, compliant</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>Every participant is CIPC- and DMRE-screened before a single litre is listed or bid on.</p>
              </div>
              <div className="gnt-card">
                <BadgeCheck size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Capital &amp; volume verified</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>Sellers hold real, physical product; buyers hold real, executable capital.</p>
              </div>
              <div className="gnt-card">
                <FileSignature size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Transparent, fixed commission</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>Disclosed brokerage terms and transparent pricing strip out hidden margins.</p>
              </div>
            </div>
          </section>

          <section style={{ background: "var(--ink)", color: "var(--paper)", margin: "0 -20px", padding: "56px 20px", textAlign: "center" }}>
            <h2 style={{ fontSize: 30, marginBottom: 10 }}>Trade with certainty.</h2>
            <p style={{ color: "var(--paper-dark)", fontSize: 14.5, maxWidth: 460, margin: "0 auto 24px" }}>Bulk diesel — verified before it's visible.</p>
            <button className="gnt-btn gnt-btn-amber" onClick={resetRegFlow}>Register your company <ChevronRight size={16} /></button>
          </section>

          <section style={{ padding: "40px 0 8px" }}>
            <div className="gnt-alert-banner" style={{ alignItems: "flex-start", marginBottom: 16 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>Verification scope</strong>
                Tankbridge checks each participant's CIPC registration and DMRE wholesale license, and requires an NCNDA before approval. We do not confirm that a seller physically holds the product offered, or that a buyer has funds available. Proof of Product and Proof of Funds are matters buyers and sellers must confirm directly with each other.
              </div>
            </div>
            <div className="gnt-card" style={{ fontSize: 12.5, color: "var(--steel)", lineHeight: 1.6 }}>
              <strong style={{ display: "block", marginBottom: 6, color: "var(--ink)", fontSize: 14 }}>Limitation of liability &amp; disclaimer</strong>
              Tankbridge acts solely as an introducing intermediary and is not a party to any resulting sale, purchase, or delivery agreement. Tankbridge makes no representation or warranty as to quality, quantity, title, deliverability, or any counterparty's ability to perform. Any dispute is strictly between the buyer and seller involved. To the fullest extent permitted by South African law, Tankbridge's liability is limited to any brokerage fee actually received in respect of the transaction giving rise to the claim. Users should seek independent legal and commercial advice before entering into any transaction.
            </div>
          </section>

          <section style={{ padding: "8px 0 40px" }}>
            <h3 style={{ fontSize: 20, marginBottom: 6 }}>Non-payment blacklist</h3>
            <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>Companies that conclude a deal via Tankbridge and refuse to pay the agreed commission are published here with the reason.</p>
            {publicBlacklist.length === 0 ? (
              <div className="gnt-empty" style={{ padding: "24px 20px" }}>No companies currently blacklisted.</div>
            ) : (
              <table className="gnt-table">
                <thead><tr><th>Company</th><th>Reason</th><th>Date</th></tr></thead>
                <tbody>
                  {publicBlacklist.map(b => (
                    <tr key={b.id}>
                      <td>{b.company_name}</td>
                      <td>{b.reason}</td>
                      <td>{fmtDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* ===================== REGISTER ===================== */}
      {view === "register" && (
        <div className="gnt-main" style={{ paddingTop: 40, maxWidth: 640, margin: "0 auto" }}>
          {myCompany && (
            <div className="gnt-info-banner" style={{ marginBottom: 20 }}>
              <CheckCircle2 size={16} /> This account already has a company registered ({myCompany.company_name}). Go to your <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => goto("dashboard")} style={{ marginLeft: 8 }}>Dashboard</button>
            </div>
          )}

          {regStep === "form" && (
            <>
              <h2 style={{ fontSize: 32, marginBottom: 6 }}>Register your company</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 24 }}>Your registration goes to Tankbridge admin for manual approval before it appears anywhere on the platform.</p>
              <div className="gnt-type-toggle">
                <button className={regType === "seller" ? "active" : ""} onClick={() => setRegType("seller")} type="button">I am a Seller</button>
                <button className={regType === "buyer" ? "active" : ""} onClick={() => setRegType("buyer")} type="button">I am a Buyer</button>
                <button className={regType === "broker" ? "active" : ""} onClick={() => setRegType("broker")} type="button">Broker (Referral)</button>
              </div>
              {regError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {regError}</div>}
              <form onSubmit={submitRegForm}>
                <div className="gnt-field"><label>{regType === "broker" ? "Agency / company name" : "Company name"}</label><input value={regForm.companyName} onChange={e => updateReg("companyName", e.target.value)} placeholder="e.g. Highveld Fuel Traders (Pty) Ltd" /></div>
                {regType !== "broker" && (
                  <div className="gnt-grid2">
                    <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={regForm.cipc} onChange={e => updateReg("cipc", e.target.value)} placeholder="2019/123456/07" /></div>
                    {regType === "seller" && (
                      <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={regForm.dmreLicense} onChange={e => updateReg("dmreLicense", e.target.value)} placeholder="W/2024/0000" /></div>
                    )}
                  </div>
                )}
                {regType !== "broker" && (
                  <div className="gnt-field"><label>Company address</label><textarea rows={2} value={regForm.address} onChange={e => updateReg("address", e.target.value)} placeholder="Street, suburb, city, province" /></div>
                )}
                <div className="gnt-grid2">
                  <div className="gnt-field"><label>Contact person</label><input value={regForm.contactName} onChange={e => updateReg("contactName", e.target.value)} /></div>
                  <div className="gnt-field"><label>Phone</label><input value={regForm.phone} onChange={e => updateReg("phone", e.target.value)} placeholder="+27 8x xxx xxxx" /></div>
                </div>
                <div className="gnt-field"><label>Email</label><input type="email" value={regForm.email} onChange={e => updateReg("email", e.target.value)} placeholder="you@company.co.za" />
                  <div className="hint">This is also your login email.</div>
                </div>
                {!session && (
                  <div className="gnt-grid2">
                    <div className="gnt-field"><label>Choose a password</label><input type="password" value={regForm.password} onChange={e => updateReg("password", e.target.value)} placeholder="At least 6 characters" /></div>
                    <div className="gnt-field"><label>Confirm password</label><input type="password" value={regForm.confirmPassword} onChange={e => updateReg("confirmPassword", e.target.value)} placeholder="Re-enter password" /></div>
                  </div>
                )}

                {regType === "broker" ? (
                  <>
                    <h3 style={{ fontSize: 20, margin: "22px 0 4px" }}>Who are you introducing?</h3>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 12 }}>You can add more buyer/seller referrals from your Dashboard later — this is just your first one.</p>
                    <div className="gnt-type-toggle">
                      <button type="button" className={regForm.referredType === "seller" ? "active" : ""} onClick={() => updateReg("referredType", "seller")}>Referring a Seller</button>
                      <button type="button" className={regForm.referredType === "buyer" ? "active" : ""} onClick={() => updateReg("referredType", "buyer")}>Referring a Buyer</button>
                    </div>
                    <div className="gnt-field"><label>{regForm.referredType === "seller" ? "Seller" : "Buyer"} company name</label><input value={regForm.referredCompanyName} onChange={e => updateReg("referredCompanyName", e.target.value)} placeholder="Company you're introducing" /></div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={regForm.referredCipc} onChange={e => updateReg("referredCipc", e.target.value)} placeholder="2019/123456/07" /></div>
                      {regForm.referredType === "seller" && (
                        <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={regForm.referredDmreLicense} onChange={e => updateReg("referredDmreLicense", e.target.value)} placeholder="W/2024/0000" /></div>
                      )}
                    </div>
                    <div className="gnt-field"><label>Their email (required — Tankbridge invites them to register)</label><input type="email" value={regForm.referredEmail} onChange={e => updateReg("referredEmail", e.target.value)} placeholder="them@company.co.za" /></div>
                    <div className="gnt-field"><label>Product</label>
                      <select value={regForm.product} onChange={e => updateReg("product", e.target.value)}>
                        {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={regForm.tradeVolume} onChange={e => updateReg("tradeVolume", e.target.value)} placeholder="40000" /></div>
                      <div className="gnt-field"><label>Price (R / litre)</label><input type="number" min="0" step="0.01" value={regForm.tradePrice} onChange={e => updateReg("tradePrice", e.target.value)} placeholder="21.45" /></div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Location</label>
                        <select value={regForm.tradeLocation} onChange={e => updateReg("tradeLocation", e.target.value)}>
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                        {regForm.tradeLocation === "Other" && (
                          <input style={{ marginTop: 8 }} value={regForm.tradeLocationOther} onChange={e => updateReg("tradeLocationOther", e.target.value)} placeholder="Specify location" />
                        )}
                      </div>
                      <div className="gnt-field"><label>Terms (select all that apply)</label>
                        <TermsCheckboxGroup value={regForm.tradeTerms} onChange={v => updateReg("tradeTerms", v)} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: 20, margin: "22px 0 4px" }}>{regType === "seller" ? "What are you looking to sell?" : "What are you looking to buy?"}</h3>
                    <div className="gnt-field"><label>Product</label>
                      <select value={regForm.product} onChange={e => updateReg("product", e.target.value)}>
                        {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={regForm.tradeVolume} onChange={e => updateReg("tradeVolume", e.target.value)} placeholder="40000" /></div>
                      <div className="gnt-field"><label>Price (R / litre)</label><input type="number" min="0" step="0.01" value={regForm.tradePrice} onChange={e => updateReg("tradePrice", e.target.value)} placeholder="21.45" /></div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Location</label>
                        <select value={regForm.tradeLocation} onChange={e => updateReg("tradeLocation", e.target.value)}>
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                        {regForm.tradeLocation === "Other" && (
                          <input style={{ marginTop: 8 }} value={regForm.tradeLocationOther} onChange={e => updateReg("tradeLocationOther", e.target.value)} placeholder="Specify location" />
                        )}
                      </div>
                      <div className="gnt-field"><label>Terms (select all that apply)</label>
                        <TermsCheckboxGroup value={regForm.tradeTerms} onChange={v => updateReg("tradeTerms", v)} />
                      </div>
                    </div>
                  </>
                )}
                <button className="gnt-btn gnt-btn-ink" type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>Continue <ChevronRight size={16} /></button>
              </form>
            </>
          )}

          {regStep === "confirm-email" && (
            <>
              <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setRegStep("form")} style={{ marginBottom: 18 }}><ArrowLeft size={14} /> Back</button>
              <h2 style={{ fontSize: 28, marginBottom: 10 }}>Confirm your email</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 18 }}>We've sent a confirmation link to <strong>{regForm.email}</strong>. Click it, then log in below with the password you just chose to continue your registration.</p>
              <LoginGate hideRegisterLink />
            </>
          )}

          {regStep === "ncnda" && (
            <>
              <h2 style={{ fontSize: 30, marginBottom: 6 }}>NCNDA — Non-Circumvention, Non-Disclosure &amp; Fee Protection Agreement</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 18 }}>Required for buyers, sellers and brokers before admin approval. Please scroll to the end to enable agreement.</p>
              <div className="gnt-doc-box" onScroll={handleNcndaScroll} style={{ maxHeight: 320 }}>
                <h4>1. Parties and Purpose</h4>
                <p>This Non-Circumvention, Non-Disclosure, and Fee Protection Agreement (the "Agreement") is entered into by and between Tankbridge (acting as the "Intermediary" and trading platform), and the registered platform user, whether acting as a Buyer, Seller, or representative thereof — in this registration, <strong>{regForm.companyName || "the registering party"}</strong> (the "Party").</p>
                <p>This Agreement governs all bulk diesel opportunities, counterparties, sources of supply, and transaction structures introduced, facilitated, or made visible via the Tankbridge platform.</p>

                <h4>2. Strict Non-Circumvention</h4>
                <p>The Party explicitly covenants and agrees that it shall not, directly or indirectly, contact, solicit, negotiate with, contract with, or conduct any business with any counterparty, supplier, buyer, refinery, or terminal introduced by Tankbridge, without the express prior written consent of Tankbridge.</p>
                <p>This restriction applies to: direct transactions, or indirect transactions through affiliates, subsidiaries, agents, nominees, or related third parties; and the entire duration of the Party's registration on the Tankbridge platform, and for a period of twenty-four (24) months following the termination of this Agreement or the deactivation of the Party's account, whichever is later.</p>

                <h4>3. Non-Disclosure &amp; Confidentiality</h4>
                <p>The Party shall maintain strict confidentiality regarding all proprietary information obtained through the platform. This includes, but is not limited to: counterparty identities, corporate structures, DMRE wholesale licence details, pricing mechanisms, available volumes, logistics arrangements, and financial terms (the "Confidential Information").</p>
                <p>Confidential Information shall not be disclosed to any third party, nor used for any competitive or commercial purpose outside of transactions directly executed on Tankbridge, without prior written authorization.</p>

                <h4>4. Heavy Penalties for Circumvention &amp; Fee Protection</h4>
                <p>In the event of any breach of Section 2 (Circumvention) or unauthorized bypass of the Tankbridge platform, the Party acknowledges that Tankbridge will suffer immediate and irreparable financial harm. Therefore, the Party agrees to the following liquidated damages and compensation structure:</p>
                <p><strong>Forfeiture of Full Commission</strong> — The breaching Party shall be immediately liable to pay Tankbridge the full, unmitigated intermediary fee/commission that would have been due on the unauthorized transaction.</p>
                <p><strong>Compounded Damaged Volumes</strong> — If the circumvented transaction involves ongoing or recurring supply, the breaching Party shall pay Tankbridge a liquidated damages fee equal to R0.10 per litre of the total volume contracted, delivered, or contemplated under the circumvented relationship for the entire 24-month period, regardless of whether Tankbridge was actively involved in the subsequent transactions.</p>
                <p><strong>Punitive/Liquidated Damages</strong> — The Party agrees to pay an immediate, non-refundable penalty fee of Five Million Rand (R5,000,000) per established breach as a reasonable pre-estimate of administrative and punitive damages, without prejudice to Tankbridge's right to seek higher actual damages in court.</p>
                <p><strong>Legal Fees</strong> — The breaching Party shall be liable for all legal costs incurred by Tankbridge in enforcing this Agreement, calculated on an attorney-and-own-client scale, including collection commission and tracing fees.</p>

                <h4>5. Governing Law and Jurisdiction</h4>
                <p>This Agreement, and any dispute arising out of or in connection with it, shall be governed by, and construed in accordance with, the laws of the Republic of South Africa. Both Parties consent to the non-exclusive jurisdiction of the High Court of South Africa.</p>

                {regType === "broker" && (
                  <>
                    <h4>6. Referral commission</h4>
                    <p>If Tankbridge concludes a deal involving a party referred by Broker (including the referral submitted with this registration), Broker will be paid a commission equal to <strong>30% of the brokerage fee actually received by Tankbridge</strong> on that deal, once admin has linked the referral to the matched deal and recorded the fee. No commission is payable on deals that do not complete. Broker confirms the CIPC/DMRE details submitted for the referred party are accurate to the best of its knowledge.</p>
                  </>
                )}

                <div className="gnt-sig-line">This document is a highly restrictive and legally binding agreement designed to protect proprietary platform relationships. Tankbridge strongly advises the Party to obtain independent legal counsel before agreeing to these terms. By checking "I have read all of it, and I agree" or registering on the platform, you acknowledge that you have read, understood, and agreed to be bound by the severe financial penalties outlined herein.</div>
              </div>
              {regError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {regError}</div>}
              <form onSubmit={finalizeRegistration}>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 6, cursor: ncndaScrolledEnd ? "pointer" : "not-allowed", opacity: ncndaScrolledEnd ? 1 : 0.5 }}>
                  <input type="checkbox" checked={ncndaAgree} disabled={!ncndaScrolledEnd} onChange={e => setNcndaAgree(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>I have read all of it, and I agree to the {regType === "broker" ? "NCNDA and Referral commission terms" : "NCNDA"} above on behalf of the company named in this registration.</span>
                </label>
                {!ncndaScrolledEnd && <div className="hint" style={{ marginBottom: 16 }}>Scroll the document above to the end to enable this checkbox.</div>}
                <div className="gnt-field" style={{ marginTop: 16 }}><label>Type your full legal name to sign</label><input value={ncndaName} onChange={e => setNcndaName(e.target.value)} placeholder="Full name of signatory" /></div>
                <button className="gnt-btn gnt-btn-amber" type="submit" style={{ width: "100%", justifyContent: "center" }}>Accept &amp; submit registration <FileSignature size={16} /></button>
              </form>
            </>
          )}

          {regStep === "done" && (
            <div className="gnt-card" style={{ textAlign: "center", padding: "44px 28px" }}>
              <CheckCircle2 size={40} color="#3f6b52" style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 26, marginBottom: 8 }}>Registration received</h2>
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 18 }}>Tankbridge admin has been notified and will review your CIPC, DMRE and NCNDA details shortly.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
                <button className="gnt-btn gnt-btn-ink" onClick={() => goto("dashboard")}>Go to Dashboard</button>
                <button className="gnt-btn gnt-btn-ghost" onClick={() => goto("landing")}>Back to Home</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== DASHBOARD ===================== */}
      {view === "dashboard" && (
        <div className="gnt-main" style={{ paddingTop: 40 }}>
          <h2 style={{ fontSize: 32, marginBottom: 20 }}>My Dashboard</h2>

          {!authChecked ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading…</p>
          ) : !session ? (
            <LoginGate onRegisterClick={resetRegFlow} />
          ) : !companyChecked ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading your company…</p>
          ) : !myCompany ? (
            <div className="gnt-empty"><Building2 size={26} /><div>You haven't registered a company on this account yet.</div>
              <button className="gnt-btn gnt-btn-amber gnt-btn-sm" style={{ marginTop: 12 }} onClick={resetRegFlow}>Register now</button>
            </div>
          ) : (
            <>
              <div className="gnt-card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>Account security</h3>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>Signed up before password login was added? Set one here so you can log in faster next time.</p>
                  </div>
                  <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setShowSetPassword(s => !s)}>{showSetPassword ? "Cancel" : "Set / change password"}</button>
                </div>
                {passwordMsg && (
                  <div className={passwordMsg.err ? "gnt-alert-banner" : "gnt-info-banner"} style={{ marginTop: 14, marginBottom: 0 }}>
                    {passwordMsg.err ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {passwordMsg.text}
                  </div>
                )}
                {showSetPassword && (
                  <form onSubmit={submitSetPassword} style={{ marginTop: 14 }}>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" /></div>
                      <div className="gnt-field"><label>Confirm new password</label><input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter password" /></div>
                    </div>
                    <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit" disabled={passwordSaving}>{passwordSaving ? "Saving…" : "Save password"}</button>
                  </form>
                )}
              </div>

              <div className="gnt-card" style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 22 }}>{myCompany.company_name}</h3>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{myCompany.type}</p>
                  </div>
                  <span className={`gnt-badge ${myCompany.status}`}>
                    {myCompany.status === "pending" && <Clock size={12} />}
                    {myCompany.status === "approved" && <CheckCircle2 size={12} />}
                    {myCompany.status === "rejected" && <XCircle size={12} />}
                    {myCompany.status}
                  </span>
                </div>
                <div className="gnt-detail-grid">
                  <div><div className="dt">CIPC No.</div><div className="dd">{myCompany.cipc}</div></div>
                  {myCompany.type !== "broker" && (
                    <>
                      <div><div className="dt">DMRE License</div><div className="dd">{myCompany.dmre_license}</div></div>
                      <div><div className="dt">{myCompany.type === "seller" ? "Selling" : "Buying"}</div><div className="dd">{Number(myCompany.trade_volume).toLocaleString()} ℓ @ {fmtMoney(myCompany.trade_price)}/ℓ</div></div>
                      <div><div className="dt">Location / Terms</div><div className="dd">{myCompany.trade_location} · {fmtTerms(myCompany.trade_terms)}</div></div>
                    </>
                  )}
                  <div><div className="dt">NCNDA</div><div className="dd">{myCompany.ncnda_signed ? `Signed by ${myCompany.ncnda_signed_by}` : "Not signed"}</div></div>
                  {myCompany.type === "seller" && (
                    <div><div className="dt">IMFPA</div><div className="dd">{myCompany.imfpa_signed ? `Signed by ${myCompany.imfpa_signed_by}` : "Not yet signed"}</div></div>
                  )}
                </div>
                {myCompany.status === "pending" && <div className="gnt-info-banner"><Clock size={16} /> Awaiting admin review.</div>}
                {myCompany.status === "rejected" && <div className="gnt-alert-banner"><XCircle size={16} /> This registration was not approved. Contact Tankbridge admin.</div>}

                {!showEditProfile ? (
                  <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginTop: 14 }} onClick={() => startEditProfile(myCompany)}>Edit contact person / phone / address</button>
                ) : (
                  <form onSubmit={e => submitEditProfile(e, myCompany)} style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    {profileError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {profileError}</div>}
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Contact person</label><input value={profileForm.contactName} onChange={e => setProfileForm(f => ({ ...f, contactName: e.target.value }))} /></div>
                      <div className="gnt-field"><label>Phone</label><input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    </div>
                    <div className="gnt-field"><label>Address</label><textarea rows={2} value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} /></div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save"}</button>
                      <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" type="button" onClick={() => setShowEditProfile(false)}>Cancel</button>
                    </div>
                    <p className="hint" style={{ marginTop: 8 }}>Company name, CIPC, DMRE and email can't be changed here — contact admin if those need updating.</p>
                  </form>
                )}
              </div>

              {myCompany.status === "approved" && myCompany.type !== "broker" && (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 4 }}>{myCompany.type === "seller" ? "List supply" : "Post a buy requirement"}</h3>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>You can publish as many listings as you like — one per location, volume or price.</p>
                  {listingError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {listingError}</div>}
                  <form onSubmit={submitListing} className="gnt-card" style={{ marginBottom: 30 }}>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Product</label>
                        <select value={listingForm.product} onChange={e => updateListingField("product", e.target.value)}>
                          {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="gnt-field"><label>Terms (select all that apply)</label>
                        <TermsCheckboxGroup value={listingForm.terms} onChange={v => updateListingField("terms", v)} />
                      </div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={listingForm.volume} onChange={e => updateListingField("volume", e.target.value)} placeholder="40000" /></div>
                      <div className="gnt-field"><label>{myCompany.type === "seller" ? "Asking price (R / litre)" : "Bid price (R / litre)"}</label><input type="number" min="0" step="0.01" value={listingForm.unitPrice} onChange={e => updateListingField("unitPrice", e.target.value)} placeholder="21.45" /></div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Location</label><input value={listingForm.location} onChange={e => updateListingField("location", e.target.value)} placeholder="e.g. Durban, Lesedi, Secunda" /></div>
                      <div className="gnt-field"><label>Availability</label><input value={listingForm.availability} onChange={e => updateListingField("availability", e.target.value)} placeholder="e.g. Immediate / 48 hrs" /></div>
                    </div>
                    <div className="gnt-field"><label>Notes (optional)</label><textarea rows={2} value={listingForm.notes} onChange={e => updateListingField("notes", e.target.value)} /></div>
                    {listingForm.terms.length > 0 && (
                      <div className="gnt-field">
                        <label>{myCompany.type === "seller" ? "Seller Procedure" : "Buyer Procedure"} — per trading term</label>
                        <div className="hint" style={{ marginBottom: 8 }}>Shown to a counterparty before they accept your price — one procedure per selected term, since COC/COD/ITT/TTO can work differently.</div>
                        {listingForm.terms.map(term => (
                          <div key={term} style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 12, color: "var(--steel-soft)" }}>{term} procedure</label>
                            <textarea rows={3} value={listingForm.procedures[term] || ""} onChange={e => updateListingProcedure(term, e.target.value)} placeholder={`Step-by-step process to conclude this trade under ${term}.`} />
                          </div>
                        ))}
                      </div>
                    )}
                    <button className="gnt-btn gnt-btn-amber" type="submit"><Plus size={15} /> Publish to Market Board</button>
                  </form>

                  <h3 style={{ fontSize: 20, marginBottom: 10 }}>My listings</h3>
                  {myListings.length === 0 && <div className="gnt-empty">No listings yet.</div>}
                  {myListings.map(l => (
                    editingListing?.id === l.id ? (
                      <form key={l.id} onSubmit={saveEdit} className="gnt-card" style={{ marginBottom: 10 }}>
                        {editError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {editError}</div>}
                        <div className="gnt-grid2">
                          <div className="gnt-field"><label>Volume</label><input type="number" min="40000" step="1000" value={editingListing.volume} onChange={e => updateEditField("volume", e.target.value)} /></div>
                          <div className="gnt-field"><label>Price</label><input type="number" min="0" step="0.01" value={editingListing.unit_price} onChange={e => updateEditField("unit_price", e.target.value)} /></div>
                        </div>
                        <div className="gnt-field"><label>Location</label><input value={editingListing.location} onChange={e => updateEditField("location", e.target.value)} /></div>
                        <div className="gnt-field"><label>Terms (select all that apply)</label>
                          <TermsCheckboxGroup value={editingListing.terms || []} onChange={v => updateEditField("terms", v)} />
                        </div>
                        {(editingListing.terms || []).length > 0 && (
                          <div className="gnt-field">
                            <label>Procedure — per trading term</label>
                            {editingListing.terms.map(term => (
                              <div key={term} style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 12, color: "var(--steel-soft)" }}>{term} procedure</label>
                                <textarea rows={3} value={(editingListing.procedures || {})[term] || ""} onChange={e => updateEditProcedure(term, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                          <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit">Save</button>
                          <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" type="button" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      (() => {
                        const relatedDeal = myDeals.find(d => d.listing_id === l.id);
                        const isFellThrough = l.status === "inactive" && relatedDeal?.status === "cancelled";
                        const isSold = l.status === "inactive" && !isFellThrough;
                        return (
                          <div key={l.id} className="gnt-listing" style={{ marginBottom: 10 }}>
                            <div className="gnt-listing-top">
                              <div>
                                <div className="gnt-listing-product">
                                  {l.product}
                                  {isSold && <span className="gnt-badge approved" style={{ marginLeft: 8, verticalAlign: "middle" }}>Sold</span>}
                                  {isFellThrough && <span className="gnt-badge rejected" style={{ marginLeft: 8, verticalAlign: "middle" }}>Fell through</span>}
                                </div>
                                <div style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>{l.volume.toLocaleString()} ℓ · {fmtTerms(l.terms)}</div>
                              </div>
                              <div className="gnt-listing-price">{fmtMoney(l.unit_price)}<small>per litre</small></div>
                            </div>
                            <div className="gnt-listing-meta"><span><MapPin size={13} /> {l.location}</span><span><Clock size={13} /> {l.availability}</span></div>
                            {isSold ? (
                              <p style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>Admin marked a deal on this listing as completed, so it's no longer available on the Market Board — see it under My matched deals below.</p>
                            ) : isFellThrough ? (
                              <p style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>This deal fell through and was confirmed by admin, so the listing is no longer available on the Market Board.</p>
                            ) : (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => startEdit(l)}>Edit</button>
                                <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => deleteListing(l.id)}>Remove</button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )
                  ))}

                  <h3 style={{ fontSize: 20, margin: "28px 0 10px" }}>My matched deals</h3>
                  {myCompany.type === "seller" && imfpaJustSigned && myCompany.imfpa_signed && (
                    <div className="gnt-alert-banner" style={{ alignItems: "flex-start" }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong style={{ display: "block", marginBottom: 4 }}>Reminder: commission is required on completed deals</strong>
                        If a deal concluded through Tankbridge is not paid the agreed commission, Tankbridge will publish your company's name and the reason on the public Blacklist section of the Home page.
                        <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginLeft: 10 }} onClick={() => setImfpaJustSigned(false)}>Dismiss</button>
                      </div>
                    </div>
                  )}
                  {myDeals.filter(d => d.status !== "cancelled").length === 0 && <div className="gnt-empty">No matched deals yet.</div>}
                  {myDeals.filter(d => d.status !== "cancelled").map(d => (
                    <DealCard key={d.id} deal={d} myCompany={myCompany} onReported={loadMyDeals} />
                  ))}

                  {myCompany.type === "seller" && myDeals.filter(d => d.status !== "cancelled").length > 0 && !myCompany.imfpa_signed && (
                    <div style={{ marginTop: 14 }}>
                      {!showImfpaForm ? (
                        <div className="gnt-alert-banner" style={{ alignItems: "center", justifyContent: "space-between" }}>
                          <span><Lock size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />You have {myDeals.filter(d => d.status !== "cancelled").length} matched deal(s). Sign the IMFPA to release buyer contact details.</span>
                          <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => setShowImfpaForm(true)}>Sign IMFPA</button>
                        </div>
                      ) : (
                        <div className="gnt-card">
                          <h3 style={{ fontSize: 20, marginBottom: 10 }}>IMFPA — Irrevocable Master Fee Protection Agreement</h3>
                          <div className="gnt-field" style={{ maxWidth: 280 }}>
                            <label>Commission (R / litre)</label>
                            <input type="number" min="0.10" max="0.99" step="0.01" value={imfpaCommissionRate} onChange={e => setImfpaCommissionRate(e.target.value)} />
                            <div className="hint">Default R0.10/ℓ — you can set any rate between R0.10 and R0.99/ℓ.</div>
                          </div>
                          <div className="gnt-doc-box">
                            <h4>1. Parties and purpose</h4>
                            <p>This Irrevocable Master Fee Protection Agreement ("Agreement") is entered into between <strong>{myCompany.company_name}</strong> ("Seller") and Tankbridge, acting as intermediary/broker ("Intermediary"), in respect of all bulk diesel transactions matched via the Tankbridge Market Board.</p>

                            <h4>2. Commission</h4>
                            <p>Seller irrevocably agrees to pay Intermediary a brokerage commission of <strong>R{(Number(imfpaCommissionRate) || 0).toFixed(2)} per litre</strong> on the completed and paid volume of any transaction concluded with a buyer introduced via Tankbridge. This rate applies to all deals matched under this Agreement unless a different rate is confirmed in writing between Seller and Tankbridge admin prior to release of buyer contact details on a specific deal.</p>

                            <h4>3. Invoicing and payment terms</h4>
                            <p>Upon confirmation that a matched deal has been completed, Tankbridge will issue a commission invoice to Seller for the agreed rate multiplied by the completed volume. Seller agrees to settle this invoice within 7 days of issue. Amounts unpaid after this period accrue interest at 2% per month (or part thereof) until paid in full.</p>

                            <h4>4. Release of buyer details</h4>
                            <p>Upon signature of this Agreement, Tankbridge will release the contact details of matched buyers to Seller for the sole purpose of concluding the introduced transaction(s).</p>

                            <h4>5. Confidentiality</h4>
                            <p>Seller shall keep all buyer information received via Tankbridge confidential and shall not use it for any purpose other than concluding the introduced transaction, in line with the NCNDA signed at registration.</p>

                            <h4>6. Non-payment of commission</h4>
                            <p>If a deal concluded via Tankbridge is not paid the agreed commission, Tankbridge reserves the right, without further notice, to: (a) publish Seller's company name and the reason on the public Blacklist section of tankbridge.co.za; (b) recover the outstanding amount plus accrued interest; and (c) recover all legal costs incurred in enforcing this Agreement, calculated on an attorney-and-own-client scale. These remedies are in addition to, and do not limit, any other remedies available to Tankbridge under the NCNDA.</p>

                            <h4>7. No advance fees</h4>
                            <p>No upfront, advance, or "verification" fee is payable by Seller under this Agreement. Commission is due only on completed, paid deliveries, as invoiced under Section 3.</p>

                            <h4>8. Governing law and jurisdiction</h4>
                            <p>This Agreement is governed by the laws of the Republic of South Africa. Both parties consent to the non-exclusive jurisdiction of the High Court of South Africa.</p>

                            <div className="gnt-sig-line">This is a standard template provided for demonstration purposes. Tankbridge recommends independent legal review before commercial use.</div>
                          </div>
                          {listingError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {listingError}</div>}
                          <form onSubmit={submitDashboardImfpa}>
                            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 16, cursor: "pointer" }}>
                              <input type="checkbox" checked={imfpaAgree} onChange={e => setImfpaAgree(e.target.checked)} style={{ marginTop: 3 }} />
                              <span>I have read and agree to the IMFPA above on behalf of {myCompany.company_name}.</span>
                            </label>
                            <div className="gnt-field"><label>Type your full legal name to sign</label><input value={imfpaName} onChange={e => setImfpaName(e.target.value)} /></div>
                            <div style={{ display: "flex", gap: 10 }}>
                              <button className="gnt-btn gnt-btn-amber" type="submit">Sign &amp; release buyer details</button>
                              <button className="gnt-btn gnt-btn-ghost" type="button" onClick={() => { setShowImfpaForm(false); setImfpaCommissionRate("0.10"); }}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {myCompany.status === "approved" && myCompany.type === "broker" && (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 4 }}>Add a referral</h3>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>Register a buyer or seller you represent — submit as many as you like, for either side. Admin verifies CIPC (and DMRE for sellers) before it goes live on the Market Board. Commission is 30% of Tankbridge's brokerage fee on any matched deal, payable once admin links your referral to that deal.</p>
                  {referralError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {referralError}</div>}
                  <form onSubmit={submitReferral} className="gnt-card" style={{ marginBottom: 30 }}>
                    <div className="gnt-type-toggle">
                      <button type="button" className={referralForm.referredType === "seller" ? "active" : ""} onClick={() => updateReferralField("referredType", "seller")}>Referring a Seller</button>
                      <button type="button" className={referralForm.referredType === "buyer" ? "active" : ""} onClick={() => updateReferralField("referredType", "buyer")}>Referring a Buyer</button>
                    </div>
                    <div className="gnt-field"><label>{referralForm.referredType === "seller" ? "Seller" : "Buyer"} company name</label><input value={referralForm.referredCompanyName} onChange={e => updateReferralField("referredCompanyName", e.target.value)} placeholder="Company you're introducing" /></div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={referralForm.referredCipc} onChange={e => updateReferralField("referredCipc", e.target.value)} placeholder="2019/123456/07" /></div>
                      {referralForm.referredType === "seller" && (
                        <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={referralForm.referredDmreLicense} onChange={e => updateReferralField("referredDmreLicense", e.target.value)} placeholder="W/2024/0000" /></div>
                      )}
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)", margin: "-4px 0 8px" }}>Once admin approves, Tankbridge emails this company an invite to register their own account — they set their own password and go live once they complete it.</p>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Contact person (optional)</label><input value={referralForm.referredContactName} onChange={e => updateReferralField("referredContactName", e.target.value)} /></div>
                      <div className="gnt-field"><label>Phone (optional)</label><input value={referralForm.referredPhone} onChange={e => updateReferralField("referredPhone", e.target.value)} placeholder="+27 8x xxx xxxx" /></div>
                    </div>
                    <div className="gnt-field"><label>Email (required — invite is sent here)</label><input type="email" value={referralForm.referredEmail} onChange={e => updateReferralField("referredEmail", e.target.value)} placeholder="them@company.co.za" /></div>

                    <h4 style={{ fontSize: 16, margin: "16px 0 8px" }}>Trade details</h4>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Product</label>
                        <select value={referralForm.product} onChange={e => updateReferralField("product", e.target.value)}>
                          {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="gnt-field"><label>Terms (select all that apply)</label>
                        <TermsCheckboxGroup value={referralForm.terms} onChange={v => updateReferralField("terms", v)} />
                      </div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={referralForm.volume} onChange={e => updateReferralField("volume", e.target.value)} /></div>
                      <div className="gnt-field"><label>Price (R / litre)</label><input type="number" min="0" step="0.01" value={referralForm.unitPrice} onChange={e => updateReferralField("unitPrice", e.target.value)} /></div>
                    </div>
                    <div className="gnt-field"><label>Location</label>
                      <select value={referralForm.location} onChange={e => updateReferralField("location", e.target.value)}>
                        {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      {referralForm.location === "Other" && (
                        <input style={{ marginTop: 8 }} value={referralForm.locationOther} onChange={e => updateReferralField("locationOther", e.target.value)} placeholder="Specify location" />
                      )}
                    </div>
                    <div className="gnt-field"><label>Notes (optional)</label><textarea rows={2} value={referralForm.notes} onChange={e => updateReferralField("notes", e.target.value)} /></div>

                    <div className="gnt-doc-box" style={{ maxHeight: 200 }}>
                      <h4>Referral Agreement</h4>
                      <p>By submitting this referral, {myCompany.company_name} ("Broker") confirms it is introducing the above party to Tankbridge in good faith, and that the CIPC/DMRE details provided are accurate to the best of Broker's knowledge. If Tankbridge concludes a deal involving this referral, Broker will be paid a commission equal to <strong>30% of the brokerage fee actually received by Tankbridge</strong> on that deal, once admin has linked the referral to the matched deal and recorded the fee. No commission is payable on deals that do not complete.</p>
                    </div>
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 16, cursor: "pointer" }}>
                      <input type="checkbox" checked={referralAgree} onChange={e => setReferralAgree(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>I have read and agree to the Referral Agreement above on behalf of {myCompany.company_name}.</span>
                    </label>
                    <div className="gnt-field"><label>Type your full legal name to sign</label><input value={referralName} onChange={e => setReferralName(e.target.value)} /></div>
                    <button className="gnt-btn gnt-btn-amber" type="submit"><Plus size={15} /> Accept &amp; submit referral</button>
                  </form>

                  <h3 style={{ fontSize: 20, marginBottom: 10 }}>My referrals</h3>
                  {myReferrals.length === 0 && <div className="gnt-empty">No referrals submitted yet.</div>}
                  {myReferrals.map(r => (
                    <div key={r.id} className="gnt-card" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span className={`gnt-badge ${r.status}`}>{r.status}</span>
                          <div style={{ fontWeight: 600, marginTop: 6 }}>
                            <span className={`gnt-badge ${r.referred_type === "seller" ? "selling" : "buying"}`} style={{ marginRight: 6 }}>{r.referred_type}</span>
                            {r.referred_company_name}
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>{r.product} · {Number(r.volume).toLocaleString()} ℓ · {fmtMoney(r.unit_price)}/ℓ · {fmtTerms(r.terms)} · {r.location}</div>
                          {r.status === "approved" && (
                            <div style={{ fontSize: 11.5, color: "var(--steel-soft)", marginTop: 4 }}>
                              Invite: <strong>{r.invite_status.replace("_", " ")}</strong>
                              {r.invite_status === "sent" && " — waiting for them to complete registration"}
                              {r.invite_status === "accepted" && " — live on the Market Board"}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="gnt-badge pending">{r.commission_status}</div>
                          {r.commission_amount != null && <div style={{ marginTop: 6, fontWeight: 600 }}>{fmtMoney(r.commission_amount)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================== MARKET BOARD ===================== */}
      {view === "market" && (
        <div className="gnt-main" style={{ paddingTop: 40 }}>
          <div className="gnt-section-head">
            <div>
              <h2>Market Board</h2>
              <p>Verified counterparties only. Every entry below belongs to a CIPC- and DMRE-checked company.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={marketFilter.kind} onChange={e => setMarketFilter(f => ({ ...f, kind: e.target.value }))} style={{ padding: "9px 10px", border: "1.5px solid var(--line)" }}>
                <option value="all">Buying &amp; Selling</option>
                <option value="sell">Sell offers only</option>
                <option value="buy">Buy requests only</option>
              </select>
              <select value={marketFilter.product} onChange={e => setMarketFilter(f => ({ ...f, product: e.target.value }))} style={{ padding: "9px 10px", border: "1.5px solid var(--line)" }}>
                <option value="all">All products</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={marketFilter.terms} onChange={e => setMarketFilter(f => ({ ...f, terms: e.target.value }))} style={{ padding: "9px 10px", border: "1.5px solid var(--line)" }}>
                <option value="all">All terms</option>
                <option value="COC">COC only</option>
                <option value="COD">COD only</option>
                <option value="ITT">ITT only</option>
                <option value="TTO">TTO only</option>
              </select>
            </div>
          </div>

          {visibleListings.length === 0 && (
            <div className="gnt-empty"><Truck size={26} /><div>No listings match right now.</div></div>
          )}

          <div style={{ display: "grid", gap: 14 }}>
            {visibleListings.map(l => {
              const isSell = l.kind !== "buy";
              return (
                <div key={l.id} className="gnt-listing" style={{ borderLeftColor: isSell ? "var(--verified)" : "#2c5a82" }}>
                  <div className="gnt-listing-top">
                    <div>
                      <span className={`gnt-badge ${isSell ? "selling" : "buying"}`} style={{ marginBottom: 8 }}>{isSell ? "Selling" : "Buying"}</span>
                      <div className="gnt-listing-product">{l.product}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="gnt-listing-price">{fmtMoney(l.unit_price)}<small>{isSell ? "asking / litre" : "bid / litre"}</small></div>
                      <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => openAccept(l)}>Accept price <ChevronRight size={13} /></button>
                    </div>
                  </div>
                  <div className="gnt-listing-meta">
                    {(Array.isArray(l.terms) ? l.terms : [l.terms]).map(t => <span key={t} className="gnt-terms-chip">{t}</span>)}
                    <span><Truck size={13} /> {Number(l.volume).toLocaleString()} ℓ</span>
                    <span><MapPin size={13} /> {l.location}</span>
                    <span><Clock size={13} /> {l.availability}</span>
                  </div>
                  {l.notes && <p style={{ fontSize: 13, color: "var(--steel)" }}>{l.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== ADMIN ===================== */}
      {view === "admin" && (
        <div className="gnt-main" style={{ paddingTop: 40 }}>
          {!authChecked ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading…</p>
          ) : !session ? (
            <div style={{ maxWidth: 420, margin: "20px auto" }}><LoginGate hideRegisterLink /></div>
          ) : !isAdmin ? (
            <div className="gnt-card" style={{ textAlign: "center", maxWidth: 420, margin: "20px auto" }}>
              <Lock size={22} style={{ marginBottom: 8 }} />
              <p>You're signed in, but this account has no admin access.</p>
            </div>
          ) : (
            <>
              <div className="gnt-card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>Account security</h3>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>Set a password so you can log straight into Admin next time — no email link needed.</p>
                  </div>
                  <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setShowSetPassword(s => !s)}>{showSetPassword ? "Cancel" : "Set / change password"}</button>
                </div>
                {passwordMsg && (
                  <div className={passwordMsg.err ? "gnt-alert-banner" : "gnt-info-banner"} style={{ marginTop: 14, marginBottom: 0 }}>
                    {passwordMsg.err ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {passwordMsg.text}
                  </div>
                )}
                {showSetPassword && (
                  <form onSubmit={submitSetPassword} style={{ marginTop: 14 }}>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" /></div>
                      <div className="gnt-field"><label>Confirm new password</label><input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter password" /></div>
                    </div>
                    <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit" disabled={passwordSaving}>{passwordSaving ? "Saving…" : "Save password"}</button>
                  </form>
                )}
              </div>

              <div className="gnt-section-head">
                <h2>Admin</h2>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[["pending", `Pending (${pendingCompanies.length})`], ["approved", `Approved (${approvedCompanies.length})`], ["rejected", `Rejected (${rejectedCompanies.length})`], ["deals", `Deals (${adminDeals.length})`], ["listings", `Listings (${adminListings.length})`], ["referrals", `Referrals (${adminReferrals.length})`], ["blacklist", `Blacklist (${adminBlacklist.length})`]].map(([key, label]) => (
                    <button key={key} className={adminTab === key ? "gnt-btn gnt-btn-ink gnt-btn-sm" : "gnt-btn gnt-btn-ghost gnt-btn-sm"} onClick={() => setAdminTab(key)}>{label}</button>
                  ))}
                </div>
              </div>

              {(adminTab === "pending" || adminTab === "approved" || adminTab === "rejected") && (
                <table className="gnt-table">
                  <thead><tr><th>Company</th><th>Type</th><th>CIPC</th><th>DMRE</th><th>NCNDA</th><th>Registered</th><th></th></tr></thead>
                  <tbody>
                    {(adminTab === "pending" ? pendingCompanies : adminTab === "approved" ? approvedCompanies : rejectedCompanies).map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.company_name}</strong><br /><span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>{c.email}</span></td>
                        <td style={{ textTransform: "capitalize" }}>{c.type}</td>
                        <td className="mono">{c.cipc}</td>
                        <td className="mono">{c.dmre_license}</td>
                        <td>{c.ncnda_signed ? <span style={{ color: "var(--verified)" }}>Signed</span> : <span style={{ color: "var(--alert)" }}>Missing</span>}</td>
                        <td>{fmtDate(c.created_at)}</td>
                        <td><button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setDetailCompany(c)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {adminTab === "deals" && (
                <>
                  {adminDeals.some(d => d.status === "cancelled") && (
                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginBottom: 10 }} onClick={() => setShowCancelledDeals(s => !s)}>
                      {showCancelledDeals ? "Hide" : "Show"} {adminDeals.filter(d => d.status === "cancelled").length} cancelled deal(s)
                    </button>
                  )}
                  <table className="gnt-table">
                    <thead><tr><th>Product</th><th>Seller</th><th>Buyer</th><th>Status</th><th>Self-reported</th><th>Platform commission (R)</th><th>Date</th></tr></thead>
                    <tbody>
                      {adminDeals.filter(d => showCancelledDeals || d.status !== "cancelled").map(d => (
                        <tr key={d.id}>
                          <td>{d.product}<br /><span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>{Number(d.volume).toLocaleString()} ℓ @ {fmtMoney(d.unit_price)} · {fmtTerms(d.terms)} · {d.location}</span></td>
                          <td>{adminCompanies.find(c => c.id === d.seller_company_id)?.company_name}</td>
                          <td>{adminCompanies.find(c => c.id === d.buyer_company_id)?.company_name}</td>
                          <td>
                            <span className={`gnt-badge ${d.status === "completed" ? "approved" : d.status === "cancelled" ? "rejected" : "pending"}`}>{d.status}</span>
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              {d.status !== "completed" && <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => setDealStatus(d.id, "completed")}>Mark completed</button>}
                              {d.status !== "cancelled" && <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => setDealStatus(d.id, "cancelled")}>Cancel</button>}
                              {d.status !== "matched" && <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setDealStatus(d.id, "matched")}>Revert</button>}
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div>Seller: {d.seller_reported_status ? <strong>{d.seller_reported_status === "completed" ? "Completed" : "Fell through"}</strong> : <span style={{ color: "var(--steel-soft)" }}>—</span>}</div>
                            {d.seller_fell_through_reason && <div style={{ color: "var(--steel-soft)", fontSize: 11 }}>Reason: {d.seller_fell_through_reason}</div>}
                            <div style={{ marginTop: 4 }}>Buyer: {d.buyer_reported_status ? <strong>{d.buyer_reported_status === "completed" ? "Completed" : "Fell through"}</strong> : <span style={{ color: "var(--steel-soft)" }}>—</span>}</div>
                            {d.buyer_fell_through_reason && <div style={{ color: "var(--steel-soft)", fontSize: 11 }}>Reason: {d.buyer_fell_through_reason}</div>}
                            {d.status === "matched" && (d.seller_reported_status === "fell_through" || d.buyer_reported_status === "fell_through") && (
                              <button className="gnt-btn gnt-btn-danger gnt-btn-sm" style={{ marginTop: 8 }} onClick={() => confirmFellThrough(d.id)}>Confirm — remove listing</button>
                            )}
                          </td>
                          <td>
                            {(() => {
                              const sellerCo = adminCompanies.find(c => c.id === d.seller_company_id);
                              const suggested = sellerCo?.imfpa_commission_rate ? Number(sellerCo.imfpa_commission_rate) * Number(d.volume) : null;
                              return (
                                <>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <input type="number" min="0" step="0.01" style={{ width: 100, padding: "6px 8px", border: "1.5px solid var(--line)" }}
                                      value={commissionEdits[d.id] ?? (d.platform_commission_amount ?? "")}
                                      onChange={e => updateCommissionInput(d.id, e.target.value)} />
                                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => saveCommission(d.id)}>Save</button>
                                  </div>
                                  {suggested != null && !d.platform_commission_amount && (
                                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginTop: 6, fontSize: 11 }} onClick={() => updateCommissionInput(d.id, suggested.toFixed(2))}>
                                      Suggested: {fmtMoney(suggested)} (R{Number(sellerCo.imfpa_commission_rate).toFixed(2)}/ℓ × {Number(d.volume).toLocaleString()}ℓ)
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td>{fmtDate(d.created_at)}</td>
                        </tr>
                      ))}
                      {adminDeals.filter(d => showCancelledDeals || d.status !== "cancelled").length === 0 && <tr><td colSpan={7}><div className="gnt-empty">No matched deals yet.</div></td></tr>}
                    </tbody>
                  </table>
                </>
              )}

              {adminTab === "listings" && (
                <>
                  {adminListings.some(l => l.status !== "active") && (
                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginBottom: 10 }} onClick={() => setShowInactiveListings(s => !s)}>
                      {showInactiveListings ? "Hide" : "Show"} {adminListings.filter(l => l.status !== "active").length} inactive listing(s)
                    </button>
                  )}
                  <table className="gnt-table">
                    <thead><tr><th>Product</th><th>Kind</th><th>Volume</th><th>Price/ℓ</th><th>Terms</th><th>Location</th><th>Status</th></tr></thead>
                    <tbody>
                      {adminListings.filter(l => showInactiveListings || l.status === "active").map(l => (
                        <tr key={l.id}>
                          <td>{l.product}</td><td>{l.kind}</td><td>{Number(l.volume).toLocaleString()} ℓ</td>
                          <td>{fmtMoney(l.unit_price)}</td><td>{fmtTerms(l.terms)}</td><td>{l.location}</td>
                          <td><span className={`gnt-badge ${l.status === "active" ? "approved" : "rejected"}`}>{l.status}</span></td>
                        </tr>
                      ))}
                      {adminListings.filter(l => showInactiveListings || l.status === "active").length === 0 && <tr><td colSpan={7}><div className="gnt-empty">No listings yet.</div></td></tr>}
                    </tbody>
                  </table>
                </>
              )}

              {adminTab === "referrals" && (
                <table className="gnt-table">
                  <thead><tr><th>Broker</th><th>Referred party</th><th>CIPC / DMRE</th><th>Deal / Terms</th><th>Verification</th><th>Invite</th><th>Linked deal</th><th>Commission</th></tr></thead>
                  <tbody>
                    {adminReferrals.map(r => (
                      <tr key={r.id}>
                        <td>{adminCompanies.find(c => c.id === r.broker_company_id)?.company_name}</td>
                        <td>
                          <span className={`gnt-badge ${r.referred_type === "seller" ? "selling" : "buying"}`}>{r.referred_type}</span>
                          <div style={{ fontWeight: 600, marginTop: 4 }}>{r.referred_company_name}</div>
                          {(r.referred_contact_name || r.referred_phone || r.referred_email) && (
                            <div style={{ fontSize: 11, color: "var(--steel-soft)" }}>
                              {r.referred_contact_name}{r.referred_phone && ` · ${r.referred_phone}`}{r.referred_email && ` · ${r.referred_email}`}
                            </div>
                          )}
                        </td>
                        <td className="mono" style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>
                          CIPC {r.referred_cipc}{r.referred_dmre_license && <><br />DMRE {r.referred_dmre_license}</>}
                        </td>
                        <td>{r.product}<br /><span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>{Number(r.volume).toLocaleString()} ℓ @ {fmtMoney(r.unit_price)} · {fmtTerms(r.terms)} · {r.location}</span></td>
                        <td>
                          <span className={`gnt-badge ${r.status}`}>{r.status}</span>
                          {r.status === "pending" && (
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => setReferralStatus(r, "approved")}>Verify &amp; Approve</button>
                              <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => setReferralStatus(r, "rejected")}>Reject</button>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 11.5 }}>
                          {r.status !== "approved" ? (
                            <span style={{ color: "var(--steel-soft)" }}>—</span>
                          ) : (
                            <>
                              <span className={`gnt-badge ${r.invite_status === "accepted" ? "approved" : r.invite_status === "sent" ? "pending" : "rejected"}`}>{r.invite_status.replace("_", " ")}</span>
                              {r.invite_status !== "accepted" && (
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ display: "block", marginTop: 6 }} onClick={() => resendReferralInvite(r)}>
                                  {r.invite_status === "sent" ? "Resend invite" : "Send invite"}
                                </button>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {r.matched_deal_id ? (
                            <span className="mono" style={{ fontSize: 11.5 }}>{r.matched_deal_id.slice(0, 8)}…</span>
                          ) : r.invite_status !== "accepted" ? (
                            <span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>Awaiting invite acceptance</span>
                          ) : linkDealFor === r.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <select value={linkDealChoice} onChange={e => setLinkDealChoice(e.target.value)} style={{ padding: "6px 8px" }}>
                                <option value="">Select a deal…</option>
                                {adminDeals.map(d => <option key={d.id} value={d.id}>{d.product} — {Number(d.volume).toLocaleString()}ℓ ({fmtDate(d.created_at)})</option>)}
                              </select>
                              <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => linkReferralToDeal(r.id, linkDealChoice)}>Link</button>
                            </div>
                          ) : (
                            <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => setLinkDealFor(r.id)}>Link to deal</button>
                          )}
                        </td>
                        <td>
                          <div className={`gnt-badge ${r.commission_status === "paid" ? "approved" : r.commission_status === "payable" ? "selling" : "pending"}`}>{r.commission_status}</div>
                          {r.commission_amount != null && <div style={{ marginTop: 4, fontWeight: 600 }}>{fmtMoney(r.commission_amount)}</div>}
                        </td>
                      </tr>
                    ))}
                    {adminReferrals.length === 0 && <tr><td colSpan={8}><div className="gnt-empty">No referrals submitted yet.</div></td></tr>}
                  </tbody>
                </table>
              )}

              {adminTab === "blacklist" && (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>Companies listed here appear publicly on the Home page. Use this for confirmed non-payment of commission or other serious breaches only.</p>
                  {blacklistError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {blacklistError}</div>}
                  <form onSubmit={addBlacklistEntry} className="gnt-card" style={{ marginBottom: 20, maxWidth: 520 }}>
                    <div className="gnt-field"><label>Company name</label><input value={blacklistForm.companyName} onChange={e => setBlacklistForm(f => ({ ...f, companyName: e.target.value }))} /></div>
                    <div className="gnt-field"><label>Reason (shown publicly)</label><textarea rows={2} value={blacklistForm.reason} onChange={e => setBlacklistForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Failed to pay agreed brokerage commission on a completed deal." /></div>
                    <button className="gnt-btn gnt-btn-danger gnt-btn-sm" type="submit">Add to blacklist</button>
                  </form>

                  <table className="gnt-table">
                    <thead><tr><th>Company</th><th>Reason</th><th>Date</th><th></th></tr></thead>
                    <tbody>
                      {adminBlacklist.map(b => (
                        <tr key={b.id}>
                          <td>{b.company_name}</td>
                          <td style={{ maxWidth: 400 }}>{b.reason}</td>
                          <td>{fmtDate(b.created_at)}</td>
                          <td><button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => removeBlacklistEntry(b.id)}>Remove</button></td>
                        </tr>
                      ))}
                      {adminBlacklist.length === 0 && <tr><td colSpan={4}><div className="gnt-empty">No companies blacklisted.</div></td></tr>}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detailCompany && (
        <div className="gnt-modal-backdrop" onClick={() => setDetailCompany(null)}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h3 style={{ fontSize: 24 }}>{detailCompany.company_name}</h3><p style={{ fontSize: 12.5, color: "var(--steel-soft)", textTransform: "uppercase" }}>{detailCompany.type}</p></div>
              <span className={`gnt-badge ${detailCompany.status}`}>{detailCompany.status}</span>
            </div>
            <div className="gnt-detail-grid">
              <div><div className="dt">CIPC No.</div><div className="dd">{detailCompany.cipc}</div></div>
              <div><div className="dt">DMRE License</div><div className="dd">{detailCompany.dmre_license}</div></div>
              <div><div className="dt">Contact</div><div className="dd">{detailCompany.contact_name}</div></div>
              <div><div className="dt">Phone</div><div className="dd">{detailCompany.phone}</div></div>
              <div><div className="dt">Email</div><div className="dd">{detailCompany.email}</div></div>
              <div><div className="dt">Registered</div><div className="dd">{fmtDate(detailCompany.created_at)}</div></div>
              <div style={{ gridColumn: "1 / -1" }}><div className="dt">Address</div><div className="dd" style={{ fontFamily: "Inter" }}>{detailCompany.address}</div></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="dt">NCNDA</div>
                <div className="dd" style={{ fontFamily: "Inter" }}>{detailCompany.ncnda_signed ? `Signed by ${detailCompany.ncnda_signed_by} on ${fmtDate(detailCompany.ncnda_signed_at)}` : "Not yet signed — cannot approve"}</div>
              </div>
              {detailCompany.type === "seller" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="dt">IMFPA</div>
                  <div className="dd" style={{ fontFamily: "Inter" }}>{detailCompany.imfpa_signed ? `Signed by ${detailCompany.imfpa_signed_by}` : "Not yet signed"}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {detailCompany.status !== "approved" && (
                <button className="gnt-btn gnt-btn-amber" disabled={!detailCompany.ncnda_signed} onClick={() => setCompanyStatus(detailCompany, "approved")}>
                  <BadgeCheck size={15} /> Approve
                </button>
              )}
              {detailCompany.status !== "rejected" && (
                <button className="gnt-btn gnt-btn-danger" onClick={() => setCompanyStatus(detailCompany, "rejected")}><XCircle size={15} /> Reject</button>
              )}
              <button className="gnt-btn gnt-btn-ghost" onClick={() => setDetailCompany(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Accept price modal — step 1: procedure, step 2: confirm */}
      {acceptTarget && (
        <div className="gnt-modal-backdrop" onClick={() => setAcceptTarget(null)}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            {acceptStep === 1 ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 4 }}>{acceptTarget.kind === "buy" ? "Buyer" : "Seller"} Procedure</h3>
                <p style={{ fontSize: 13, color: "var(--steel)", marginBottom: 14 }}>
                  {acceptTarget.product} · {Number(acceptTarget.volume).toLocaleString()} ℓ · {fmtMoney(acceptTarget.unit_price)}/ℓ · {fmtTerms(acceptTarget.terms)} · {acceptTarget.location}
                </p>
                <div className="gnt-doc-box" style={{ maxHeight: 220 }}>
                  {acceptTarget.procedures && Object.values(acceptTarget.procedures).some(v => v && v.trim())
                    ? (Array.isArray(acceptTarget.terms) ? acceptTarget.terms : [acceptTarget.terms]).map(term => (
                        acceptTarget.procedures[term] && acceptTarget.procedures[term].trim() ? (
                          <div key={term} style={{ marginBottom: 14 }}>
                            <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--steel-soft)", marginBottom: 4 }}>{term}</h4>
                            <p style={{ whiteSpace: "pre-wrap" }}>{acceptTarget.procedures[term]}</p>
                          </div>
                        ) : null
                      ))
                    : <p style={{ color: "var(--steel-soft)" }}>No procedure has been provided for this listing yet.</p>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="gnt-btn gnt-btn-amber" onClick={() => setAcceptStep(2)}>Accept procedure <ChevronRight size={15} /></button>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setAcceptTarget(null)}>Cancel</button>
                </div>
              </>
            ) : !session ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Sign in to continue</h3>
                <p style={{ fontSize: 13, color: "var(--steel)", marginBottom: 16 }}>Log in to accept this price — you'll land on your Dashboard. New here? Register your company instead.</p>
                <LoginGate
                  onLoggedIn={() => { setAcceptTarget(null); goto("dashboard"); }}
                  onRegisterClick={() => { setAcceptTarget(null); resetRegFlow(); }}
                />
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 4 }}>Confirm</h3>
                <p style={{ fontSize: 13, color: "var(--steel)", marginBottom: 16 }}>
                  This will record a matched deal and notify Tankbridge admin.
                </p>
                {acceptError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {acceptError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="gnt-btn gnt-btn-amber" onClick={submitAccept}>Confirm &amp; notify Tankbridge</button>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setAcceptStep(1)}>Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Referral submit confirmation */}
      {referralConfirmOpen && (
        <div className="gnt-modal-backdrop" onClick={() => setReferralConfirmOpen(false)}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Confirm your referral</h3>
            <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}>
              Thank you for introducing this {referralForm.referredType}. {referralForm.referredCompanyName || "Their"} information will go to Tankbridge admin for review, and their contact person will be notified by email once approved.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="gnt-btn gnt-btn-amber" onClick={confirmSubmitReferral}>Confirm &amp; notify admin</button>
              <button className="gnt-btn gnt-btn-ghost" onClick={() => setReferralConfirmOpen(false)}>Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Revealed counterparty info popup */}
      {revealedInfo && (
        <div className="gnt-modal-backdrop" onClick={() => setRevealedInfo(null)}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            {revealedInfo.gated ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}><Lock size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Details pending IMFPA</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}>Your deal has been recorded and Tankbridge admin has been notified. This buyer's contact details will be released once you sign the IMFPA on your Dashboard.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="gnt-btn gnt-btn-ink" onClick={() => { setRevealedInfo(null); goto("dashboard"); }}>Go sign IMFPA</button>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setRevealedInfo(null)}>Close</button>
                </div>
              </>
            ) : revealedInfo.info ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 4 }}>{revealedInfo.info.company_name}</h3>
                <div className="gnt-detail-grid" style={{ marginTop: 0 }}>
                  <div><div className="dt">Contact</div><div className="dd">{revealedInfo.info.contact_name}</div></div>
                  <div><div className="dt">Phone</div><div className="dd">{revealedInfo.info.phone}</div></div>
                  <div><div className="dt">Email</div><div className="dd">{revealedInfo.info.email}</div></div>
                  <div><div className="dt">CIPC No.</div><div className="dd">{revealedInfo.info.cipc || "—"}</div></div>
                </div>
                <div className="gnt-info-banner" style={{ marginTop: 14 }}><CheckCircle2 size={16} /> Tankbridge admin has been notified of this deal.</div>
                <button className="gnt-btn gnt-btn-ghost" onClick={() => setRevealedInfo(null)}>Close</button>
              </>
            ) : (
              <p>Could not load details.</p>
            )}
          </div>
        </div>
      )}

      <div className="gnt-main">
        <div className="gnt-footer">
          <span>Tankbridge — Bulk Diesel Exchange</span>
          <span>{boardListings.length} live listings</span>
        </div>
      </div>
    </div>
  );
}
