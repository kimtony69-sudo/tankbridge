import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Truck, ShieldCheck, Clock, CheckCircle2, XCircle, FileSignature,
  ChevronRight, LogIn, Search, Plus, MapPin, Building2,
  BadgeCheck, AlertTriangle, ArrowLeft, Mail, Phone, Lock, LogOut, Menu, X, Handshake
} from "lucide-react";
import { supabase } from "./supabaseClient";


const PRODUCTS = ["Diesel 50ppm", "Diesel 10ppm (ULSD)", "Illuminating Paraffin", "Petrol ULP93", "Petrol ULP95"];
const LOCATIONS = ["Durban", "Lesedi", "Secunda", "Sasolburg", "Johannesburg", "Cape Town", "Richards Bay", "Other"];
const OWNERSHIP_LABELS = {
  title_holder: "Title Holder · POP",
  mandate_holder: "Mandate / Allocation Holder",
  direct_funds: "Own Funds · POF",
  funder_involved: "Funder Involved",
};

const BOL_LABELS_SELLER = {
  not_offered: "Not offering BOL terms",
  open: "Open to BOL terms for first load",
  case_by_case: "BOL terms — case-by-case, ask",
};
const BOL_LABELS_BUYER = {
  not_offered: "Not requesting BOL terms",
  open: "Requesting BOL terms for first load",
  case_by_case: "Open to discuss BOL terms",
};
const BOL_MARKET_BADGE = {
  not_offered: null,
  open: "BOL: Open",
  case_by_case: "BOL: Case-by-case",
};

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
  password: "", confirmPassword: "", ownershipCapacity: "",
  product: PRODUCTS[0], tradeVolume: "", tradeLocation: LOCATIONS[0], tradeLocationOther: "", tradePrice: "", tradeTerms: [],
  // broker-only: the first referral they submit as part of registering
  referredType: "seller", referredCompanyName: "", referredCipc: "", referredDmreLicense: "", referredEmail: "", proposedCommissionRate: "0.10",
  hasDirectRelationship: true, upstreamBrokerName: "", upstreamBrokerEmail: "", coBrokerSplitPct: "0.50",
  skipFirstReferral: false,
};
const EMPTY_LISTING = { product: PRODUCTS[0], volume: "", unitPrice: "", terms: [], location: "", availability: "", notes: "", procedures: {}, bolTerms: "not_offered", priceMode: "fixed" };
const EMPTY_REFERRAL = {
  referredType: "seller", referredCompanyName: "", referredCipc: "", referredDmreLicense: "",
  referredContactName: "", referredPhone: "", referredEmail: "",
  product: PRODUCTS[0], volume: "", unitPrice: "", location: LOCATIONS[0], locationOther: "", terms: [], notes: "",
  proposedCommissionRate: "0.10",
  hasDirectRelationship: true, upstreamBrokerName: "", upstreamBrokerEmail: "", coBrokerSplitPct: "0.50",
};

function toggleTerm(list, term) {
  return list.includes(term) ? list.filter(t => t !== term) : [...list, term];
}
function FileInput({ onChange, multiple, disabled, style }) {
  const inputRef = useRef(null);
  const [label, setLabel] = useState("No file chosen");

  function handleChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) setLabel("No file chosen");
    else if (files.length === 1) setLabel(files[0].name);
    else setLabel(`${files.length} files selected`);
    onChange(e);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", ...style }}>
      <button type="button" className="gnt-btn gnt-btn-ghost gnt-btn-sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Choose file{multiple ? "(s)" : ""}
      </button>
      <span style={{ fontSize: 12.5, color: "var(--steel-soft)" }}>{label}</span>
      <input ref={inputRef} type="file" multiple={multiple} disabled={disabled} onChange={handleChange} style={{ display: "none" }} />
    </div>
  );
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

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
.gnt-brand-mark { width:40px; height:40px; border:2px solid var(--amber); display:flex; align-items:center; justify-content:center; transform:rotate(45deg); flex-shrink:0; }
.gnt-brand-mark svg { transform:rotate(-45deg); }
.gnt-brand-text { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:26px; letter-spacing:0.05em; line-height:1; }
.gnt-brand-sub { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--amber); letter-spacing:0.14em; text-transform:uppercase; }
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
.gnt-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
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
  .gnt-grid4{grid-template-columns:1fr;}
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
      const success = data && data.length > 0;
      setGated(!success);
      setInfo(success ? data[0] : null);
    }
    setChecked(true);
    setLoading(false);
  }

  async function report(outcome, reason) {
    setReporting(true);
    const { data, error } = await supabase.rpc("report_deal_outcome", { p_deal_id: deal.id, p_outcome: outcome, p_reason: reason || null });
    setReporting(false);
    if (!error) {
      fetch("/api/notify-deal-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, role: isSellerViewing ? "seller" : "buyer", outcome, reason }),
      }).catch(() => {}); // best-effort — don't block the UI if the email fails
      if (data?.status === "completed") {
        fetch("/api/notify-broker-commission", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: deal.id }),
        }).catch(() => {});
      }
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
          {deal.bol_requested && <div style={{ fontSize: 12, color: "var(--steel-soft)", marginTop: 2 }}>BOL terms requested for first load{deal.bol_note ? ` — "${deal.bol_note}"` : ""}</div>}
        </div>
        <div className="mono" style={{ fontWeight: 600 }}>{fmtMoney(deal.unit_price)}/ℓ</div>
      </div>
      {!checked ? (
        <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginTop: 8 }} onClick={reveal} disabled={loading}>
          {loading ? "Checking…" : "View contact details"}
        </button>
      ) : gated ? (
        <div className="gnt-alert-banner"><Lock size={16} /> {isSellerViewing ? "Buyer identity hidden until you sign the IMFPA above." : "Seller hasn't completed their registration and IMFPA sign-off yet — check back soon."}</div>
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

  const referralConfirmParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("referral_confirm") === "1" && p.get("token")) {
        return { token: p.get("token"), decision: p.get("decision") || "" };
      }
    } catch { /* ignore */ }
    return null;
  })();

  const coBrokerClaimParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("co_broker_claim") === "1" && p.get("token")) {
        return { token: p.get("token") };
      }
    } catch { /* ignore */ }
    return null;
  })();

  const requestedView = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const v = p.get("view");
      return ["dashboard", "market", "admin"].includes(v) ? v : null;
    } catch { return null; }
  })();

  const [view, setView] = useState(checkinParams ? "checkin" : inviteToken ? "invite" : referralConfirmParams ? "referral_confirm" : coBrokerClaimParams ? "co_broker_claim" : requestedView || "landing");
  const [coBrokerClaimData, setCoBrokerClaimData] = useState(null);
  const [coBrokerClaimLoading, setCoBrokerClaimLoading] = useState(true);
  const [coBrokerClaimError, setCoBrokerClaimError] = useState("");
  const [coBrokerClaimResult, setCoBrokerClaimResult] = useState(null);
  const [showCoBrokerDeclineForm, setShowCoBrokerDeclineForm] = useState(false);
  const [coBrokerDeclineReason, setCoBrokerDeclineReason] = useState("");
  const [coBrokerClaimForm, setCoBrokerClaimForm] = useState({
    companyName: "", cipc: "", email: "", contactName: "", phone: "",
    product: "", volume: "", unitPrice: "", location: "", terms: [], notes: "", commissionRate: "0.10",
  });
  const [coBrokerClaimSubmitting, setCoBrokerClaimSubmitting] = useState(false);
  const [coBrokerClaimLicenseFile, setCoBrokerClaimLicenseFile] = useState(null);
  const [referralConfirmData, setReferralConfirmData] = useState(null);
  const [referralConfirmLoading, setReferralConfirmLoading] = useState(true);
  const [referralConfirmResult, setReferralConfirmResult] = useState(null);
  const [referralConfirmError, setReferralConfirmError] = useState("");
  const [referralRejectReason, setReferralRejectReason] = useState("");
  const [showReferralRejectForm, setShowReferralRejectForm] = useState(referralConfirmParams?.decision === "reject");
  const [inviteReferral, setInviteReferral] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteStep, setInviteStep] = useState("intro"); // intro -> account -> confirm-email -> ncnda -> done
  const [inviteForm, setInviteForm] = useState({ password: "", confirmPassword: "", contactName: "", phone: "", email: "", cipc: "", dmreLicense: "" });
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
  const [adminBrokerCommissions, setAdminBrokerCommissions] = useState([]);
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
  const [myBrokerCommissions, setMyBrokerCommissions] = useState([]);
  const [referralForm, setReferralForm] = useState(EMPTY_REFERRAL);
  const [referralError, setReferralError] = useState("");
  const [referralAgree, setReferralAgree] = useState(false);
  const [referralName, setReferralName] = useState("");
  const [referralConfirmOpen, setReferralConfirmOpen] = useState(false);
  const [referralLicenseFile, setReferralLicenseFile] = useState(null);
  const [regReferralLicenseFile, setRegReferralLicenseFile] = useState(null);
  const [regWholesaleLicenseFile, setRegWholesaleLicenseFile] = useState(null);

  const [regType, setRegType] = useState("seller");
  const [regStep, setRegStep] = useState("form"); // form -> confirm-email (only if email confirmation required) -> ncnda -> done
  const [regForm, setRegForm] = useState(EMPTY_REG);
  const [ncndaAgree, setNcndaAgree] = useState(false);
  const [ncndaName, setNcndaName] = useState("");
  const [ncndaScrolledEnd, setNcndaScrolledEnd] = useState(false);
  const [useCustomNcnda, setUseCustomNcnda] = useState(false);
  const [regCisKycFile, setRegCisKycFile] = useState(null);
  const [customNcndaFile, setCustomNcndaFile] = useState(null);
  const [customNcndaSubmitting, setCustomNcndaSubmitting] = useState(false);
  const [regError, setRegError] = useState("");

  const [listingForm, setListingForm] = useState(EMPTY_LISTING);
  const [listingError, setListingError] = useState("");
  const [editingListing, setEditingListing] = useState(null);
  const [editingBrokerListingId, setEditingBrokerListingId] = useState(null);
  const [brokerListingForm, setBrokerListingForm] = useState(null);
  const [brokerListingError, setBrokerListingError] = useState("");
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
  const [myDocuments, setMyDocuments] = useState([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState("");
  const [refForm, setRefForm] = useState({ ref1Company: "", ref1Contact: "", ref2Company: "", ref2Contact: "" });
  const [refSaving, setRefSaving] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [accountActionReason, setAccountActionReason] = useState("");
  const [accountActionError, setAccountActionError] = useState("");
  const [accountActionBusy, setAccountActionBusy] = useState(false);
  const [reactivationRequested, setReactivationRequested] = useState(false);
  const [reactivationBusy, setReactivationBusy] = useState(false);
  const [resubmitForm, setResubmitForm] = useState({ companyName: "", cipc: "", dmreLicense: "", address: "" });
  const [resubmitError, setResubmitError] = useState("");
  const [resubmitSaving, setResubmitSaving] = useState(false);
  const [imfpaAgree, setImfpaAgree] = useState(false);
  const [imfpaName, setImfpaName] = useState("");
  const [imfpaCommissionRate, setImfpaCommissionRate] = useState("0.10");

  const [marketFilter, setMarketFilter] = useState({ kind: "all", product: "all", terms: "all" });
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [offerTarget, setOfferTarget] = useState(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerError, setOfferError] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [myOffers, setMyOffers] = useState([]);
  const [offerCounterInputs, setOfferCounterInputs] = useState({});
  const [offerCommissionInputs, setOfferCommissionInputs] = useState({});
  const [offerActionBusy, setOfferActionBusy] = useState(null);
  const [acceptStep, setAcceptStep] = useState(1);
  const [acceptError, setAcceptError] = useState("");
  const [revealedInfo, setRevealedInfo] = useState(null);
  const [customNcndaUrl, setCustomNcndaUrl] = useState(null);
  const [customNcndaLoading, setCustomNcndaLoading] = useState(false);
  const [customNcndaAgree, setCustomNcndaAgree] = useState(false);
  const [customNcndaAckName, setCustomNcndaAckName] = useState("");
  const [bolRequested, setBolRequested] = useState(false);
  const [bolNote, setBolNote] = useState("");

  const [adminTab, setAdminTab] = useState("pending");
  const [detailCompany, setDetailCompany] = useState(null);
  const [detailDocuments, setDetailDocuments] = useState([]);
  const [showAdminEditCompany, setShowAdminEditCompany] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ companyName: "", cipc: "", dmreLicense: "", address: "" });
  const [adminEditSaving, setAdminEditSaving] = useState(false);

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

  // ---------- SELLER PRICE/COMMISSION CONFIRMATION (public, no login) ----------
  useEffect(() => {
    if (!referralConfirmParams) { setReferralConfirmLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc("get_referral_confirm_by_token", { p_token: referralConfirmParams.token });
      if (error || !data || data.length === 0) { setReferralConfirmError("This link is invalid or has expired."); setReferralConfirmLoading(false); return; }
      setReferralConfirmData(data[0]);
      setReferralConfirmLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitReferralConfirm(approved, reason) {
    const { data, error } = await supabase.rpc("confirm_referral_via_token", {
      p_token: referralConfirmParams.token, p_approved: approved, p_reason: reason || null,
    });
    if (error) { setReferralConfirmError(error.message); return; }
    setReferralConfirmResult({ approved, referral: data });
  }

  // ---------- CO-BROKER HANDOFF CLAIM (broker login required) ----------
  useEffect(() => {
    if (!coBrokerClaimParams) { setCoBrokerClaimLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc("get_co_broker_claim_by_token", { p_token: coBrokerClaimParams.token });
      if (error || !data || data.length === 0) { setCoBrokerClaimError("This link is invalid or has expired."); setCoBrokerClaimLoading(false); return; }
      setCoBrokerClaimData(data[0]);
      setCoBrokerClaimForm(f => ({
        ...f,
        companyName: data[0].referred_company_name || "",
        product: data[0].product || "",
        volume: String(data[0].volume || ""),
        unitPrice: String(data[0].unit_price || ""),
        location: data[0].location || "",
        terms: data[0].terms || [],
        commissionRate: data[0].proposed_commission_rate ? String(data[0].proposed_commission_rate) : "0.10",
      }));
      setCoBrokerClaimLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCoBrokerDecline() {
    const { error } = await supabase.rpc("decline_co_broker_claim", { p_token: coBrokerClaimParams.token, p_reason: coBrokerDeclineReason || null });
    if (error) { setCoBrokerClaimError(error.message); return; }
    setCoBrokerClaimResult({ declined: true });
  }

  async function submitCoBrokerClaim(e) {
    e.preventDefault();
    if (!session || myCompany?.type !== "broker") { setCoBrokerClaimError("Please log in with your Tankbridge broker account first, then reopen this link."); return; }
    const f = coBrokerClaimForm;
    if (!f.companyName || !f.email || !f.volume || !f.unitPrice || !f.location || !f.terms || f.terms.length === 0) {
      setCoBrokerClaimError("Please complete all required fields."); return;
    }
    if (coBrokerClaimData.referred_type === "buyer" && !f.cipc) { setCoBrokerClaimError("Please enter the buyer's CIPC number."); return; }
    if (coBrokerClaimData.referred_type === "seller" && !coBrokerClaimLicenseFile) { setCoBrokerClaimError("Please upload a copy of the seller's Wholesale License."); return; }
    setCoBrokerClaimSubmitting(true);
    setCoBrokerClaimError("");
    const { data, error } = await supabase.rpc("claim_co_broker_referral", {
      p_token: coBrokerClaimParams.token,
      p_company_name: f.companyName,
      p_cipc: coBrokerClaimData.referred_type === "buyer" ? f.cipc : null,
      p_email: f.email,
      p_contact_name: f.contactName || null,
      p_phone: f.phone || null,
      p_product: f.product,
      p_volume: Number(f.volume),
      p_unit_price: Number(f.unitPrice),
      p_location: f.location,
      p_terms: f.terms,
      p_notes: f.notes || null,
      p_commission_rate: coBrokerClaimData.referred_type === "seller" ? Number(f.commissionRate) : null,
    });
    if (error) { setCoBrokerClaimSubmitting(false); setCoBrokerClaimError(error.message); return; }
    if (coBrokerClaimData.referred_type === "seller" && coBrokerClaimLicenseFile) {
      const path = `${session.user.id}/referral_wholesale_license/${data.id}-${coBrokerClaimLicenseFile.name}`;
      const { error: upErr } = await supabase.storage.from("company-docs").upload(path, coBrokerClaimLicenseFile);
      if (!upErr) await supabase.from("referrals").update({ wholesale_license_path: path }).eq("id", data.id);
    }
    setCoBrokerClaimSubmitting(false);
    setCoBrokerClaimResult({ claimed: true });
    await loadMyReferrals();
  }

  function updateInviteField(field, value) { setInviteForm(f => ({ ...f, [field]: value })); }

  async function submitInviteAccount(e) {
    e.preventDefault();
    if (!inviteForm.contactName || !inviteForm.phone || !inviteForm.email) { setInviteError("Please complete contact person, phone and email."); return; }
    if (!/^\S+@\S+\.\S+$/.test(inviteForm.email)) { setInviteError("Please enter a valid email address."); return; }
    if (inviteReferral?.referred_type === "seller" && (!inviteForm.cipc || !inviteForm.dmreLicense)) {
      setInviteError("Please enter your CIPC registration number and DMRE wholesale license number."); return;
    }
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
      p_cipc: inviteReferral?.referred_type === "seller" ? inviteForm.cipc : null,
      p_dmre_license: inviteReferral?.referred_type === "seller" ? inviteForm.dmreLicense : null,
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

  const loadMyDocuments = useCallback(async () => {
    if (!myCompany) return;
    const { data } = await supabase.from("company_documents").select("*").eq("company_id", myCompany.id).order("uploaded_at", { ascending: false });
    setMyDocuments(data || []);
  }, [myCompany]);

  const loadMyBrokerCommissions = useCallback(async () => {
    if (!myCompany || myCompany.type !== "broker") return;
    const { data } = await supabase.from("deal_broker_commissions").select("*, deals(product, volume, unit_price, created_at)")
      .eq("broker_company_id", myCompany.id).order("created_at", { ascending: false });
    setMyBrokerCommissions(data || []);
  }, [myCompany]);

  const loadMyOffers = useCallback(async () => {
    if (!myCompany) return;
    const { data: represented } = await supabase.from("companies").select("id")
      .eq("referred_by_broker_id", myCompany.id).is("user_id", null);
    const ids = [myCompany.id, ...(represented || []).map(c => c.id)];
    const orClause = ids.map(id => `buyer_company_id.eq.${id},seller_company_id.eq.${id}`).join(",");
    const { data } = await supabase.from("offers").select("*, listings(product, volume, location, terms, procedures)")
      .or(orClause)
      .order("updated_at", { ascending: false });
    setMyOffers(data || []);
  }, [myCompany]);

  useEffect(() => {
    loadMyListings(); loadMyDeals(); loadMyReferrals(); loadMyDocuments(); loadMyBrokerCommissions(); loadMyOffers();
    if (myCompany) setRefForm({
      ref1Company: myCompany.trade_ref_1_company || "", ref1Contact: myCompany.trade_ref_1_contact || "",
      ref2Company: myCompany.trade_ref_2_company || "", ref2Contact: myCompany.trade_ref_2_contact || "",
    });
  }, [loadMyListings, loadMyDeals, loadMyReferrals, loadMyDocuments, loadMyBrokerCommissions, loadMyOffers, myCompany]);

  // ---------- ADMIN DATA ----------
  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const [{ data: cos }, { data: deals }, { data: listings }, { data: referrals }, { data: bl }, { data: bc }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
      supabase.from("deal_broker_commissions").select("*").order("created_at", { ascending: false }),
    ]);
    setAdminCompanies(cos || []);
    setAdminDeals(deals || []);
    setAdminListings(listings || []);
    setAdminReferrals(referrals || []);
    setAdminBlacklist(bl || []);
    setAdminBrokerCommissions(bc || []);
  }, [isAdmin]);
  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  // ---------- REGISTRATION ----------
  function updateReg(field, value) { setRegForm(f => ({ ...f, [field]: value })); }

  function validateRegForm() {
    if (regType === "broker") {
      if (!regForm.companyName || !regForm.contactName || !regForm.phone || !regForm.email) {
        return "Please complete company name, contact person, phone and email.";
      }
    } else if (regType === "buyer" && (!regForm.companyName || !regForm.cipc || !regForm.address || !regForm.contactName || !regForm.phone || !regForm.email)) {
      return "Please complete all fields (CIPC number is required).";
    } else if (regType === "seller" && (!regForm.companyName || !regForm.cipc || !regForm.dmreLicense || !regForm.address || !regForm.contactName || !regForm.phone || !regForm.email)) {
      return "Please complete all fields (CIPC and DMRE license numbers are required).";
    } else if (regType === "seller" && !regWholesaleLicenseFile) {
      return "Please upload a copy of your Wholesale License.";
    }
    if (!/^\S+@\S+\.\S+$/.test(regForm.email)) return "Please enter a valid email address.";

    if (!session) {
      if (!regForm.password || regForm.password.length < 6) return "Please choose a password of at least 6 characters.";
      if (regForm.password !== regForm.confirmPassword) return "Passwords do not match.";
    }

    if (regType === "broker") {
      if (regForm.skipFirstReferral) return "";
      if (!regForm.hasDirectRelationship) {
        if (!regForm.referredCompanyName) return "Please enter the company's name (best known).";
        if (!regForm.tradeVolume || !regForm.tradePrice) return "Please enter the volume and price for this referral.";
        if (Number(regForm.tradeVolume) < 40000) return "Minimum tradable volume is 40,000 litres.";
        if (regForm.tradeLocation === "Other" && !regForm.tradeLocationOther.trim()) return "Please enter a location.";
        if (!regForm.tradeTerms || regForm.tradeTerms.length === 0) return "Select at least one trading term.";
        if (!regForm.upstreamBrokerName || !regForm.upstreamBrokerEmail || !/^\S+@\S+\.\S+$/.test(regForm.upstreamBrokerEmail)) {
          return "Please enter the upstream broker/mandate's name and a valid email.";
        }
        const split = Number(regForm.coBrokerSplitPct);
        if (isNaN(split) || split <= 0 || split >= 1) return "Split must be a share between 0 and 1 (e.g. 0.50 for 50%).";
        return "";
      }
      if (!regForm.referredCompanyName) return "Please enter the referred company's name.";
      if (regForm.referredType === "buyer" && !regForm.referredCipc) return "Please enter the buyer's CIPC registration number.";
      if (!regForm.referredEmail || !/^\S+@\S+\.\S+$/.test(regForm.referredEmail)) return "A valid email for the referred company is required — Tankbridge will invite them to register directly.";
      if (regForm.referredType === "seller" && !regReferralLicenseFile) return "Please upload a copy of the seller's Wholesale License.";
      if (regForm.referredType === "seller") {
        const rate = Number(regForm.proposedCommissionRate);
        if (isNaN(rate) || rate < 0.10 || rate > 0.99) return "Commission agreed with the seller must be between R0.10 and R0.99 per litre.";
      }
      if (!regForm.tradeVolume || !regForm.tradePrice) return "Please enter the volume and price for this referral.";
      if (Number(regForm.tradeVolume) < 40000) return "Minimum tradable volume is 40,000 litres.";
      if (regForm.tradeLocation === "Other" && !regForm.tradeLocationOther.trim()) return "Please enter a location.";
      if (!regForm.tradeTerms || regForm.tradeTerms.length === 0) return "Select at least one trading term.";
      return "";
    }

    if (!regForm.ownershipCapacity) return regType === "seller" ? "Please indicate whether you're the Title Holder or a Mandate/Allocation holder." : "Please indicate whether you're funding this directly or via a Funder.";
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

  async function createInitialListingOrReferral(companyId) {
    const resolvedLocation = regForm.tradeLocation === "Other" ? regForm.tradeLocationOther.trim() : regForm.tradeLocation;
    if (regType !== "broker") {
      const { error: listingError } = await supabase.from("listings").insert({
        company_id: companyId,
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
    if (regType === "broker" && regForm.skipFirstReferral) {
      return; // No referral submitted at signup — they'll add one later from their Dashboard.
    }
    if (regType === "broker" && !regForm.hasDirectRelationship) {
      const { error: refError } = await supabase.from("referrals").insert({
        broker_company_id: companyId,
        referred_type: regForm.referredType,
        referred_company_name: regForm.referredCompanyName,
        product: regForm.product,
        volume: Number(regForm.tradeVolume),
        unit_price: Number(regForm.tradePrice),
        location: resolvedLocation,
        terms: regForm.tradeTerms,
        is_co_broker_referral: true,
        co_broker_upstream_name: regForm.upstreamBrokerName,
        co_broker_upstream_email: regForm.upstreamBrokerEmail,
        co_broker_split_pct: Number(regForm.coBrokerSplitPct),
        agreement_accepted: true,
        agreement_accepted_by: ncndaName,
        agreement_accepted_at: new Date().toISOString(),
      });
      if (refError) console.error("co-broker referral insert error", refError);
      return;
    }
    if (regType === "broker") {
      const { data: refData, error: refError } = await supabase.from("referrals").insert({
        broker_company_id: companyId,
        referred_type: regForm.referredType,
        referred_company_name: regForm.referredCompanyName,
        referred_cipc: regForm.referredType === "buyer" ? regForm.referredCipc : null,
        referred_dmre_license: null,
        referred_email: regForm.referredEmail,
        proposed_commission_rate: regForm.referredType === "seller" ? Number(regForm.proposedCommissionRate) : null,
        product: regForm.product,
        volume: Number(regForm.tradeVolume),
        unit_price: Number(regForm.tradePrice),
        location: resolvedLocation,
        terms: regForm.tradeTerms,
        agreement_accepted: true,
        agreement_accepted_by: ncndaName,
        agreement_accepted_at: new Date().toISOString(),
      }).select().single();
      if (refError) console.error("referral insert error", refError);
      if (!refError && regForm.referredType === "seller" && regReferralLicenseFile) {
        const path = `${session.user.id}/referral_wholesale_license/${refData.id}-${regReferralLicenseFile.name}`;
        const { error: upErr } = await supabase.storage.from("company-docs").upload(path, regReferralLicenseFile);
        if (!upErr) await supabase.from("referrals").update({ wholesale_license_path: path }).eq("id", refData.id);
        else console.error("license upload error", upErr);
      }
    }
  }

  async function uploadRegCisKyc(companyId) {
    if (!regCisKycFile) return;
    const path = `${session.user.id}/cis_kyc/${Date.now()}-${regCisKycFile.name}`;
    const { error: upErr } = await supabase.storage.from("company-docs").upload(path, regCisKycFile);
    if (!upErr) {
      await supabase.from("company_documents").insert({ company_id: companyId, doc_type: "cis_kyc", file_path: path, file_name: regCisKycFile.name });
    } else {
      console.error("CIS/KYC upload error", upErr);
    }
  }

  async function uploadRegWholesaleLicense(companyId) {
    if (!regWholesaleLicenseFile) return;
    const path = `${session.user.id}/wholesale_license/${Date.now()}-${regWholesaleLicenseFile.name}`;
    const { error: upErr } = await supabase.storage.from("company-docs").upload(path, regWholesaleLicenseFile);
    if (!upErr) {
      await supabase.from("company_documents").insert({ company_id: companyId, doc_type: "wholesale_license", file_path: path, file_name: regWholesaleLicenseFile.name });
    } else {
      console.error("Wholesale license upload error", upErr);
    }
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
      cipc: regType === "broker" ? null : (regForm.cipc || null),
      dmre_license: regType === "seller" ? (regForm.dmreLicense || null) : null,
      ownership_capacity: regType === "broker" ? null : regForm.ownershipCapacity,
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
    await createInitialListingOrReferral(data.id);
    if (regType !== "broker") await uploadRegCisKyc(data.id);
    if (regType === "seller") await uploadRegWholesaleLicense(data.id);

    setMyCompany(data);
    setRegStep("done");
    showToast("Registration submitted — Tankbridge admin has been notified.");
  }

  async function submitCustomNcndaRegistration(e) {
    e.preventDefault();
    if (!customNcndaFile) { setRegError("Please upload your signed NCNDA document."); return; }
    if (!session) { setRegError("You need to be logged in."); return; }
    setRegError("");
    setCustomNcndaSubmitting(true);
    const resolvedLocation = regForm.tradeLocation === "Other" ? regForm.tradeLocationOther.trim() : regForm.tradeLocation;
    const { data, error } = await supabase.from("companies").insert({
      user_id: session.user.id,
      type: regType,
      company_name: regForm.companyName,
      cipc: regType === "broker" ? null : (regForm.cipc || null),
      dmre_license: regType === "seller" ? (regForm.dmreLicense || null) : null,
      ownership_capacity: regType === "broker" ? null : regForm.ownershipCapacity,
      address: regForm.address || null,
      contact_name: regForm.contactName,
      phone: regForm.phone,
      email: regForm.email,
      trade_volume: regType === "broker" ? null : Number(regForm.tradeVolume),
      trade_price: regType === "broker" ? null : Number(regForm.tradePrice),
      trade_location: regType === "broker" ? null : resolvedLocation,
      trade_terms: regType === "broker" ? null : regForm.tradeTerms,
      ncnda_signed: false,
      ncnda_source: "custom",
      custom_ncnda_status: "pending",
    }).select().single();
    if (error) { setCustomNcndaSubmitting(false); setRegError(error.message); return; }

    const path = `${session.user.id}/custom_ncnda/${Date.now()}-${customNcndaFile.name}`;
    const { error: upErr } = await supabase.storage.from("company-docs").upload(path, customNcndaFile);
    if (upErr) { setCustomNcndaSubmitting(false); setRegError(`Company registered, but the file failed to upload: ${upErr.message}. You can upload it again from your Dashboard.`); setMyCompany(data); setRegStep("done"); return; }
    await supabase.from("company_documents").insert({ company_id: data.id, doc_type: "custom_ncnda", file_path: path, file_name: customNcndaFile.name });

    await createInitialListingOrReferral(data.id);
    if (regType !== "broker") await uploadRegCisKyc(data.id);
    if (regType === "seller") await uploadRegWholesaleLicense(data.id);

    setCustomNcndaSubmitting(false);
    setMyCompany(data);
    setRegStep("done");
    showToast("Custom NCNDA submitted — admin will review it before your registration proceeds.");
  }

  function resetRegFlow() { setRegStep("form"); setRegForm(EMPTY_REG); setRegType("seller"); setRegError(""); setNcndaAgree(false); setNcndaScrolledEnd(false); setUseCustomNcnda(false); setCustomNcndaFile(null); goto("register"); }

  // ---------- LISTINGS (dashboard) ----------
  function updateListingField(field, value) { setListingForm(f => ({ ...f, [field]: value })); }
  function updateListingProcedure(term, value) { setListingForm(f => ({ ...f, procedures: { ...f.procedures, [term]: value } })); }

  async function submitListing(e) {
    e.preventDefault();
    const vol = Number(listingForm.volume);
    const isSellerOfferBuy = myCompany.type === "buyer" && listingForm.priceMode === "seller_offer";
    if (!listingForm.product || !listingForm.volume || (!isSellerOfferBuy && !listingForm.unitPrice) || !listingForm.location || !listingForm.availability) {
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
      unit_price: isSellerOfferBuy ? null : Number(listingForm.unitPrice),
      price_mode: isSellerOfferBuy ? "seller_offer" : "fixed",
      terms: listingForm.terms,
      location: listingForm.location,
      availability: listingForm.availability,
      notes: listingForm.notes,
      procedures: listingForm.procedures,
      bol_terms: listingForm.bolTerms,
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
      bol_terms: editingListing.bol_terms || "not_offered",
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

  async function uploadCompanyDoc(files, docType) {
    if (!files || files.length === 0 || !myCompany) return;
    setDocUploading(true);
    setDocError("");
    for (const file of files) {
      const path = `${session.user.id}/${docType}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("company-docs").upload(path, file);
      if (upErr) { setDocError(upErr.message); continue; }
      await supabase.from("company_documents").insert({ company_id: myCompany.id, doc_type: docType, file_path: path, file_name: file.name });
    }
    setDocUploading(false);
    await loadMyDocuments();
    showToast("Document(s) uploaded — admin will review them.");
  }

  async function deleteCompanyDoc(doc) {
    await supabase.storage.from("company-docs").remove([doc.file_path]);
    await supabase.from("company_documents").delete().eq("id", doc.id);
    await loadMyDocuments();
  }

  async function submitTradeReferences(e) {
    e.preventDefault();
    setRefSaving(true);
    const { error } = await supabase.from("companies").update({
      trade_ref_1_company: refForm.ref1Company || null,
      trade_ref_1_contact: refForm.ref1Contact || null,
      trade_ref_2_company: refForm.ref2Company || null,
      trade_ref_2_contact: refForm.ref2Contact || null,
    }).eq("user_id", session.user.id);
    setRefSaving(false);
    if (error) { showToast(error.message, "err"); return; }
    const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
    setMyCompany(co);
    showToast("Trade references saved — admin will review them.");
  }

  async function submitPauseListings() {
    setAccountActionBusy(true);
    setAccountActionError("");
    const { data, error } = await supabase.rpc("pause_my_listings", { p_reason: accountActionReason || null });
    setAccountActionBusy(false);
    if (error) { setAccountActionError(error.message); return; }
    setMyCompany(data);
    setShowPauseForm(false);
    setAccountActionReason("");
    await loadMarketBoard();
    showToast("Your listings are paused — you can resume any time from here.");
  }

  async function submitResumeListings() {
    const { data, error } = await supabase.rpc("resume_my_listings");
    if (error) { showToast(error.message, "err"); return; }
    setMyCompany(data);
    await loadMarketBoard();
    showToast("Welcome back — your listings are active again.");
  }

  async function submitWithdrawal() {
    if (!accountActionReason.trim()) { setAccountActionError("Please tell us why you're withdrawing."); return; }
    setAccountActionBusy(true);
    setAccountActionError("");
    const { data, error } = await supabase.rpc("request_account_withdrawal", { p_reason: accountActionReason });
    setAccountActionBusy(false);
    if (error) { setAccountActionError(error.message); return; }
    setMyCompany(data);
    setShowWithdrawForm(false);
    setAccountActionReason("");
    await loadMarketBoard();
    showToast("Withdrawal requested — Tankbridge admin will process this shortly. Your data is kept on file, not deleted.");
  }

  async function submitReactivationRequest() {
    setReactivationBusy(true);
    const res = await fetch("/api/notify-reactivation-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: myCompany.id }),
    }).catch(() => null);
    setReactivationBusy(false);
    if (res && res.ok) { setReactivationRequested(true); showToast("Reactivation requested — admin has been notified."); }
    else showToast("Could not send the request — please try again.", "err");
  }

  function startResubmit(company) {
    setResubmitForm({ companyName: company.company_name || "", cipc: company.cipc || "", dmreLicense: company.dmre_license || "", address: company.address || "" });
    setResubmitError("");
    setShowResubmit(true);
  }

  async function submitResubmit(e, company) {
    e.preventDefault();
    if (!resubmitForm.companyName) { setResubmitError("Company name is required."); return; }
    if (company.type === "seller" && !resubmitForm.dmreLicense) { setResubmitError("DMRE wholesale license is required for sellers."); return; }
    setResubmitSaving(true);
    const { error } = await supabase.rpc("resubmit_registration", {
      p_company_name: resubmitForm.companyName,
      p_cipc: resubmitForm.cipc,
      p_dmre_license: resubmitForm.dmreLicense,
      p_address: resubmitForm.address,
    });
    setResubmitSaving(false);
    if (error) { setResubmitError(error.message); return; }
    const { data: co } = await supabase.from("companies").select("*").eq("user_id", session.user.id).maybeSingle();
    setMyCompany(co);
    setShowResubmit(false);
    showToast("Resubmitted — admin will review your updated details.");
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
    if (!f.hasDirectRelationship) {
      if (!f.referredCompanyName || !f.volume || !f.unitPrice || !f.location || !f.terms || f.terms.length === 0) {
        setReferralError("Please complete all required fields."); return;
      }
      if (!f.upstreamBrokerName || !f.upstreamBrokerEmail || !/^\S+@\S+\.\S+$/.test(f.upstreamBrokerEmail)) {
        setReferralError("Please enter the upstream broker's name and a valid email."); return;
      }
      const split = Number(f.coBrokerSplitPct);
      if (isNaN(split) || split <= 0 || split >= 1) { setReferralError("Split must be a share between 0 and 1 (e.g. 0.50 for 50%)."); return; }
      if (Number(f.volume) < 40000) { setReferralError("Minimum tradable volume is 40,000 litres."); return; }
      if (!referralAgree || referralName.trim().length < 3) { setReferralError("Please accept the Referral Agreement and enter your full name."); return; }
      setReferralError("");
      setReferralConfirmOpen(true);
      return;
    }
    if (!f.referredCompanyName || !f.volume || !f.unitPrice || !f.location || !f.terms || f.terms.length === 0) {
      setReferralError("Please complete all required fields."); return;
    }
    if (f.referredType === "buyer" && !f.referredCipc) {
      setReferralError("Please enter the buyer's CIPC registration number."); return;
    }
    if (!f.referredEmail || !/^\S+@\S+\.\S+$/.test(f.referredEmail)) {
      setReferralError("A valid email for the referred company is required — Tankbridge will invite them to register directly."); return;
    }
    if (f.referredType === "seller" && !referralLicenseFile) {
      setReferralError("Please upload a copy of the seller's Wholesale License."); return;
    }
    if (f.referredType === "seller") {
      const rate = Number(f.proposedCommissionRate);
      if (isNaN(rate) || rate < 0.10 || rate > 0.99) { setReferralError("Commission agreed with the seller must be between R0.10 and R0.99 per litre."); return; }
    }
    if (Number(f.volume) < 40000) { setReferralError("Minimum tradable volume is 40,000 litres."); return; }
    if (!referralAgree || referralName.trim().length < 3) { setReferralError("Please accept the Referral Agreement and enter your full name."); return; }
    setReferralError("");
    setReferralConfirmOpen(true);
  }

  async function confirmSubmitReferral() {
    const f = referralForm;
    const resolvedLocation = f.location === "Other" ? f.locationOther.trim() : f.location;

    if (!f.hasDirectRelationship) {
      const { error } = await supabase.from("referrals").insert({
        broker_company_id: myCompany.id,
        referred_type: f.referredType,
        referred_company_name: f.referredCompanyName,
        product: f.product,
        volume: Number(f.volume),
        unit_price: Number(f.unitPrice),
        location: resolvedLocation,
        terms: f.terms,
        notes: f.notes,
        is_co_broker_referral: true,
        co_broker_upstream_name: f.upstreamBrokerName,
        co_broker_upstream_email: f.upstreamBrokerEmail,
        co_broker_split_pct: Number(f.coBrokerSplitPct),
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
      showToast("Handoff request submitted — admin will verify, then contact the upstream broker to confirm.");
      return;
    }

    const { data, error } = await supabase.from("referrals").insert({
      broker_company_id: myCompany.id,
      referred_type: f.referredType,
      referred_company_name: f.referredCompanyName,
      referred_cipc: f.referredType === "buyer" ? f.referredCipc : null,
      referred_dmre_license: null,
      referred_contact_name: f.referredContactName || null,
      referred_phone: f.referredPhone || null,
      referred_email: f.referredEmail || null,
      proposed_commission_rate: f.referredType === "seller" ? Number(f.proposedCommissionRate) : null,
      product: f.product,
      volume: Number(f.volume),
      unit_price: Number(f.unitPrice),
      location: resolvedLocation,
      terms: f.terms,
      notes: f.notes,
      agreement_accepted: true,
      agreement_accepted_by: referralName,
      agreement_accepted_at: new Date().toISOString(),
    }).select().single();
    if (error) { setReferralConfirmOpen(false); setReferralError(error.message); return; }

    if (f.referredType === "seller" && referralLicenseFile) {
      const path = `${session.user.id}/referral_wholesale_license/${data.id}-${referralLicenseFile.name}`;
      const { error: upErr } = await supabase.storage.from("company-docs").upload(path, referralLicenseFile);
      if (!upErr) {
        await supabase.from("referrals").update({ wholesale_license_path: path }).eq("id", data.id);
      } else {
        showToast(`Referral submitted, but the license upload failed: ${upErr.message}. Admin will follow up.`, "err");
      }
    }

    setReferralConfirmOpen(false);
    setReferralForm(EMPTY_REFERRAL);
    setReferralLicenseFile(null);
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

  function openSubmitOffer(listing) {
    setOfferTarget(listing);
    setOfferPrice("");
    setOfferError("");
  }

  async function submitSellerOffer() {
    const price = Number(offerPrice);
    if (!price || price <= 0) { setOfferError("Please enter a valid price."); return; }
    setOfferSubmitting(true);
    setOfferError("");
    const { data, error } = await supabase.rpc("submit_seller_offer", { p_listing_id: offerTarget.id, p_price: price });
    setOfferSubmitting(false);
    if (error) { setOfferError(error.message); return; }
    setOfferTarget(null);
    fetch("/api/notify-offer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: data.id, event: "new_offer" }),
    }).catch(() => {});
    await loadMyOffers();
    showToast("Offer submitted — the buyer has been emailed and can accept or counter.");
  }

  function renderMyNegotiations() {
    const open = myOffers.filter(o => o.status === "open");
    if (open.length === 0) return null;
    return (
      <>
        <h3 style={{ fontSize: 20, margin: "28px 0 10px" }}>My negotiations</h3>
        {open.map(o => {
          const isBuyerSide = myCompany.id === o.buyer_company_id || myCompany.id === o.buyer_negotiator_id;
          const isDelegate = myCompany.id !== o.buyer_company_id && myCompany.id !== o.seller_company_id;
          const myTurn = (isBuyerSide && o.current_turn === "buyer") || (!isBuyerSide && o.current_turn === "seller");
          const myRound = isBuyerSide ? o.buyer_round : o.seller_round;
          const counterKey = o.id;
          return (
            <div key={o.id} className="gnt-card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span className="gnt-badge pending">{myTurn ? "Your turn" : "Waiting on other party"}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{o.listings?.product} · {Number(o.listings?.volume || 0).toLocaleString()} ℓ · {fmtTerms(o.listings?.terms)} · {o.listings?.location}</div>
                  <div style={{ fontSize: 12, color: "var(--steel-soft)", marginTop: 2 }}>{isDelegate ? `Negotiating on behalf of the ${isBuyerSide ? "buyer" : "seller"}` : `You are the ${isBuyerSide ? "buyer" : "seller"}`} · rounds used: {myRound}/2</div>
                </div>
                <div className="mono" style={{ fontWeight: 600 }}>{fmtMoney(o.current_price)}/ℓ</div>
              </div>
              {o.current_commission_rate != null && (
                <div style={{ fontSize: 12, color: "var(--steel-soft)", marginTop: 6 }}>Commission on the table: <strong className="mono">{fmtMoney(o.current_commission_rate)}/ℓ</strong></div>
              )}
              {myTurn && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="gnt-btn gnt-btn-amber gnt-btn-sm" disabled={offerActionBusy === o.id + "accept"} onClick={() => respondToOffer(o.id, "accept")}>
                      {offerActionBusy === o.id + "accept" ? "Accepting…" : "Accept"}
                    </button>
                    {myRound < 2 && (
                      <>
                        <input type="number" min="0" step="0.01" placeholder="Counter price" style={{ width: 120 }} value={offerCounterInputs[counterKey] || ""} onChange={e => setOfferCounterInputs(m => ({ ...m, [counterKey]: e.target.value }))} />
                        <input type="number" min="0" step="0.01" placeholder="Commission (optional)" style={{ width: 150 }} value={offerCommissionInputs[counterKey] || ""} onChange={e => setOfferCommissionInputs(m => ({ ...m, [counterKey]: e.target.value }))} />
                        <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" disabled={offerActionBusy === o.id + "counter"} onClick={() => respondToOffer(o.id, "counter", offerCounterInputs[counterKey], offerCommissionInputs[counterKey])}>
                          {offerActionBusy === o.id + "counter" ? "Sending…" : "Counter"}
                        </button>
                      </>
                    )}
                    <button className="gnt-btn gnt-btn-danger gnt-btn-sm" disabled={offerActionBusy === o.id + "decline"} onClick={() => respondToOffer(o.id, "decline")}>
                      {offerActionBusy === o.id + "decline" ? "Declining…" : "Decline"}
                    </button>
                  </div>
                  {isDelegate && offerCommissionInputs[counterKey] && Number(offerCommissionInputs[counterKey]) > 0 && (() => {
                    const rate = Number(offerCommissionInputs[counterKey]);
                    const vol = Number(o.listings?.volume || 0);
                    const total = rate * vol;
                    const otherActive = isBuyerSide ? !!o.seller_negotiator_id : !!o.buyer_negotiator_id;
                    const bothActiveShare = total * 0.30;
                    const soloHighShare = total * 0.60;
                    const soloLowShare = total * 0.50;
                    return (
                      <p className="hint" style={{ marginTop: 8 }}>
                        Estimated split on this commission (platform always takes 40% first): {
                          otherActive
                            ? <>you and the other party's representative split the rest evenly — roughly <strong>{fmtMoney(bothActiveShare)}/ℓ each</strong>.</>
                            : <>your estimated share is roughly <strong>{fmtMoney(soloLowShare)}/ℓ to {fmtMoney(soloHighShare)}/ℓ</strong>, depending on whether the other side has its own referring broker.</>
                        }
                      </p>
                    );
                  })()}
                  {myRound >= 2 && <p className="hint" style={{ marginTop: 6 }}>You've used both your counter-offers — accept or decline to close this out.</p>}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  async function respondToOffer(offerId, action, priceValue, commissionValue) {
    setOfferActionBusy(offerId + action);
    const { data, error } = await supabase.rpc("respond_to_offer", {
      p_offer_id: offerId, p_action: action,
      p_price: priceValue ? Number(priceValue) : null,
      p_commission_rate: commissionValue ? Number(commissionValue) : null,
    });
    setOfferActionBusy(null);
    if (error) { showToast(error.message, "err"); return; }
    if (action !== "decline") {
      fetch("/api/notify-offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: data.id, event: action === "accept" ? "accepted" : "counter" }),
      }).catch(() => {});
    }
    await loadMyOffers();
    await loadMyDeals();
    await loadMarketBoard();
    showToast(
      action === "accept" ? "Offer accepted — deal recorded, check My Dashboard for contact details."
      : action === "decline" ? "Negotiation declined."
      : "Counter-offer sent — the other party has been emailed."
    );
  }

  function openAccept(listing) {
    setAcceptTarget(listing);
    setAcceptStep(1);
    setAcceptError("");
    setCustomNcndaUrl(null);
    setCustomNcndaAgree(false);
    setCustomNcndaAckName("");
    setBolRequested(false);
    setBolNote("");
    if (listing.ncnda_source === "custom") {
      setCustomNcndaLoading(true);
      (async () => {
        const { data: path } = await supabase.rpc("get_custom_ncnda_path", { p_company_id: listing.company_id });
        if (path) {
          const { data: signed } = await supabase.storage.from("company-docs").createSignedUrl(path, 600);
          setCustomNcndaUrl(signed?.signedUrl || null);
        }
        setCustomNcndaLoading(false);
      })();
    }
  }

  async function submitAccept() {
    if (!session) { setAcceptError("You need to be logged in."); return; }
    if (acceptTarget.ncnda_source === "custom" && (!customNcndaAgree || customNcndaAckName.trim().length < 3)) {
      setAcceptError("Please review the listing owner's custom NCNDA, tick agree, and enter your full name.");
      return;
    }
    const { data: deal, error } = await supabase.rpc("accept_listing_price", {
      p_listing_id: acceptTarget.id,
      p_custom_ncnda_ack_by: acceptTarget.ncnda_source === "custom" ? customNcndaAckName : null,
      p_bol_requested: myCompany?.type === "buyer" ? bolRequested : false,
      p_bol_note: myCompany?.type === "buyer" && bolRequested ? bolNote : null,
    });
    if (error) { setAcceptError(error.message); return; }
    const isSellListing = acceptTarget.kind !== "buy";
    let reveal;
    if (isSellListing) {
      const { data } = await supabase.rpc("get_deal_seller_contact", { p_deal_id: deal.id });
      const gated = !data || data.length === 0;
      reveal = { gated, reason: gated ? "seller_pending" : null, info: (data && data[0]) || null };
    } else {
      const { data } = await supabase.rpc("get_deal_buyer_contact", { p_deal_id: deal.id });
      const gated = !data || data.length === 0;
      reveal = { gated, reason: gated ? (myCompany?.imfpa_signed ? "buyer_pending" : "imfpa_pending") : null, info: (data && data[0]) || null };
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
  async function processWithdrawal(companyId, approve) {
    const { error } = await supabase.rpc("process_withdrawal", { p_company_id: companyId, p_approve: approve });
    if (error) { showToast(error.message, "err"); return; }
    setDetailCompany(c => c && ({ ...c, account_status: approve ? "withdrawn" : "active" }));
    await loadAdminData();
    showToast(approve ? "Account marked as withdrawn." : "Account reactivated.");
  }

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

  async function loadDetailDocuments(companyId) {
    const { data } = await supabase.from("company_documents").select("*").eq("company_id", companyId).order("uploaded_at", { ascending: false });
    setDetailDocuments(data || []);
  }

  async function reviewCustomNcnda(company, approved) {
    const { error } = await supabase.rpc("approve_custom_ncnda", { p_company_id: company.id, p_approved: approved });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    setDetailCompany(c => c && ({
      ...c,
      custom_ncnda_status: approved ? "approved" : "rejected",
      ncnda_signed: approved ? true : c.ncnda_signed,
      ncnda_signed_by: approved ? "Custom NCNDA (uploaded by company, approved by admin)" : c.ncnda_signed_by,
    }));
    showToast(approved ? "Custom NCNDA approved — company can now be approved." : "Custom NCNDA rejected.");
  }

  async function viewCompanyDoc(doc) {
    const { data, error } = await supabase.storage.from("company-docs").createSignedUrl(doc.file_path, 300);
    if (error) { showToast(error.message, "err"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function togglePastPerformanceVerified(company) {
    const { error } = await supabase.rpc("set_past_performance_verified", { p_company_id: company.id, p_verified: !company.past_performance_verified });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    setDetailCompany(c => c && ({ ...c, past_performance_verified: !company.past_performance_verified }));
    showToast(`Past Performance badge ${!company.past_performance_verified ? "granted" : "revoked"}.`);
  }

  async function toggleMandateVerified(company) {
    const { error } = await supabase.rpc("set_mandate_verified", { p_company_id: company.id, p_verified: !company.mandate_verified });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    setDetailCompany(c => c && ({ ...c, mandate_verified: !company.mandate_verified }));
    showToast(`Mandate Verified badge ${!company.mandate_verified ? "granted" : "revoked"}.`);
  }

  async function toggleProductVerified(company) {
    const { error } = await supabase.rpc("set_product_verified", { p_company_id: company.id, p_verified: !company.product_verified });
    if (error) { showToast(error.message, "err"); return; }
    await loadAdminData();
    setDetailCompany(c => c && ({ ...c, product_verified: !company.product_verified }));
    showToast(`Product Verified badge ${!company.product_verified ? "granted" : "revoked"}.`);
  }

  function startAdminEditCompany(company) {
    setAdminEditForm({ companyName: company.company_name || "", cipc: company.cipc || "", dmreLicense: company.dmre_license || "", address: company.address || "" });
    setShowAdminEditCompany(true);
  }

  async function submitAdminEditCompany(e, company) {
    e.preventDefault();
    setAdminEditSaving(true);
    const { error } = await supabase.from("companies").update({
      company_name: adminEditForm.companyName,
      cipc: adminEditForm.cipc || null,
      dmre_license: company.type === "seller" ? (adminEditForm.dmreLicense || null) : null,
      address: adminEditForm.address || null,
    }).eq("id", company.id);
    setAdminEditSaving(false);
    if (error) { showToast(error.message, "err"); return; }
    setDetailCompany(c => c && ({ ...c, company_name: adminEditForm.companyName, cipc: adminEditForm.cipc, dmre_license: adminEditForm.dmreLicense, address: adminEditForm.address }));
    setShowAdminEditCompany(false);
    await loadAdminData();
    showToast("Company details updated.");
  }

  function updateCommissionInput(dealId, value) { setCommissionEdits(f => ({ ...f, [dealId]: value })); }

  async function saveCommission(dealId) {
    const amount = Number(commissionEdits[dealId]);
    if (!amount || amount <= 0) { showToast("Please enter a valid commission amount.", "err"); return; }
    const { error } = await supabase.rpc("set_platform_commission", { p_deal_id: dealId, p_amount: amount });
    if (error) { showToast(error.message, "err"); return; }
    fetch("/api/notify-broker-commission", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId }),
    }).catch(() => {});
    await loadAdminData();
    showToast("Platform commission saved — linked broker commission(s) recalculated and brokers notified.");
  }

  async function setDealStatus(dealId, newStatus) {
    const { error } = await supabase.rpc("set_deal_status", { p_deal_id: dealId, p_new_status: newStatus });
    if (error) { showToast(error.message, "err"); return; }
    if (newStatus === "completed") {
      fetch("/api/notify-broker-commission", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId }),
      }).catch(() => {});
    }
    await loadAdminData();
    await loadMarketBoard();
    showToast(
      newStatus === "completed" ? "Deal marked completed — listing removed from the Market Board and any referring broker(s) notified."
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
    if (status === "approved" && referral.is_co_broker_referral) {
      const res = await fetch("/api/send-referral-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "co_broker_claim", referralId: referral.id }),
      }).catch(() => null);
      showToast(res && res.ok
        ? `Verified — the upstream broker has been emailed to confirm the relationship.`
        : `Verified, but the confirmation email failed to send. Use "Resend confirmation" below.`, res && res.ok ? "ok" : "err");
    } else if (status === "approved" && referral.referred_type === "seller") {
      const res = await fetch("/api/send-referral-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "confirm", referralId: referral.id }),
      }).catch(() => null);
      showToast(res && res.ok
        ? `Verified — ${referral.referred_company_name} has been emailed to confirm price and commission before the listing goes live.`
        : `Verified, but the confirmation email failed to send. Use "Resend confirmation" below.`, res && res.ok ? "ok" : "err");
    } else if (status === "approved") {
      showToast(`Verified — ${referral.referred_company_name}'s listing is now live on the Market Board. They'll be asked to complete registration once a real counterparty accepts it.`);
    } else {
      showToast("Referral rejected.");
    }
    await loadAdminData();
    await loadMarketBoard();
  }

  async function resendCoBrokerClaim(referral) {
    const res = await fetch("/api/send-referral-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "co_broker_claim", referralId: referral.id }),
    }).catch(() => null);
    if (res && res.ok) { showToast("Confirmation email resent."); await loadAdminData(); }
    else { showToast("Failed to send confirmation email.", "err"); }
  }

  async function resendReferralInvite(referral) {
    const res = await fetch("/api/send-referral-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "invite", referralId: referral.id }),
    }).catch(() => null);
    if (res && res.ok) { showToast("Invite email resent."); await loadAdminData(); }
    else { showToast("Failed to send invite email.", "err"); }
  }

  async function resendReferralConfirm(referral) {
    const res = await fetch("/api/send-referral-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "confirm", referralId: referral.id }),
    }).catch(() => null);
    if (res && res.ok) { showToast("Confirmation email resent."); await loadAdminData(); }
    else { showToast("Failed to send confirmation email.", "err"); }
  }

  async function viewReferralLicense(referral) {
    const { data, error } = await supabase.storage.from("company-docs").createSignedUrl(referral.wholesale_license_path, 300);
    if (error) { showToast(error.message, "err"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function startEditBrokerListing(referral) {
    const { data, error } = await supabase.from("listings").select("*").eq("id", referral.listing_id).maybeSingle();
    if (error || !data) { showToast("Could not load this listing.", "err"); return; }
    setBrokerListingForm({
      volume: String(data.volume), unitPrice: String(data.unit_price), location: data.location,
      terms: data.terms || [], bolTerms: data.bol_terms || "not_offered",
    });
    setEditingBrokerListingId(referral.listing_id);
    setBrokerListingError("");
  }

  async function saveBrokerListingEdit() {
    const f = brokerListingForm;
    if (!f.volume || !f.unitPrice || !f.location || !f.terms || f.terms.length === 0) {
      setBrokerListingError("Please complete all fields and select at least one term."); return;
    }
    if (Number(f.volume) < 40000) { setBrokerListingError("Minimum tradable volume is 40,000 litres."); return; }
    const { error } = await supabase.from("listings").update({
      volume: Number(f.volume), unit_price: Number(f.unitPrice), location: f.location,
      terms: f.terms, bol_terms: f.bolTerms,
    }).eq("id", editingBrokerListingId);
    if (error) { setBrokerListingError(error.message); return; }
    setEditingBrokerListingId(null);
    setBrokerListingForm(null);
    await loadMyReferrals();
    await loadMarketBoard();
    showToast("Listing updated.");
  }

  async function cancelBrokerListing(referral) {
    const { error } = await supabase.from("listings").delete().eq("id", referral.listing_id);
    if (error) { showToast(error.message, "err"); return; }
    await loadMyReferrals();
    await loadMarketBoard();
    showToast("Listing cancelled and removed from the Market Board.");
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
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#e39a2d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="17" x2="22" y2="17" />
                <path d="M2 10 Q12 2 22 10" />
                <line x1="6" y1="17" x2="6" y2="20" />
                <line x1="18" y1="17" x2="18" y2="20" />
                <line x1="6" y1="17" x2="6" y2="6" />
                <line x1="18" y1="17" x2="18" y2="6" />
              </svg>
            </div>
            <div>
              <div className="gnt-brand-text">TANKBRIDGE</div>
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

      {/* ===================== SELLER PRICE/COMMISSION CONFIRMATION (public) ===================== */}
      {view === "referral_confirm" && (
        <div className="gnt-main" style={{ paddingTop: 40, maxWidth: 560, margin: "0 auto" }}>
          {referralConfirmLoading ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading…</p>
          ) : referralConfirmError && !referralConfirmData ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <AlertTriangle size={32} style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Link not found</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>{referralConfirmError}</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : referralConfirmResult ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              {referralConfirmResult.approved ? (
                <>
                  <CheckCircle2 size={40} color="#3f6b52" style={{ margin: "0 auto 14px" }} />
                  <h2 style={{ fontSize: 24, marginBottom: 8 }}>Confirmed — you're live</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>Your listing is now on the Tankbridge Market Board at the terms shown. We'll email you if a buyer accepts, at which point you'll complete your own registration and sign the IMFPA.</p>
                </>
              ) : (
                <>
                  <XCircle size={40} color="#a63b32" style={{ margin: "0 auto 14px" }} />
                  <h2 style={{ fontSize: 24, marginBottom: 8 }}>Thanks for letting us know</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>This won't be listed. Tankbridge admin and the referring broker have been notified.</p>
                </>
              )}
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : referralConfirmData?.seller_confirm_status !== "pending" ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <AlertTriangle size={32} style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Already responded to</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>This confirmation link has already been used.</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : (
            <div className="gnt-card" style={{ padding: "32px 28px" }}>
              <h2 style={{ fontSize: 24, marginBottom: 6 }}>Please confirm your listing</h2>
              <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 18 }}><strong>{referralConfirmData.broker_company_name}</strong> proposed listing <strong>{referralConfirmData.referred_company_name}</strong> with the details below. No login needed to respond.</p>
              <div className="gnt-detail-grid" style={{ marginTop: 0, marginBottom: 18 }}>
                <div><div className="dt">Product</div><div className="dd">{referralConfirmData.product}</div></div>
                <div><div className="dt">Volume</div><div className="dd">{Number(referralConfirmData.volume).toLocaleString()} ℓ</div></div>
                <div><div className="dt">Asking price</div><div className="dd">{fmtMoney(referralConfirmData.unit_price)}/ℓ</div></div>
                <div><div className="dt">Terms</div><div className="dd">{fmtTerms(referralConfirmData.terms)}</div></div>
                <div><div className="dt">Location</div><div className="dd">{referralConfirmData.location}</div></div>
                <div><div className="dt">Proposed commission</div><div className="dd">{fmtMoney(referralConfirmData.proposed_commission_rate || 0.10)}/ℓ</div></div>
              </div>
              {referralConfirmError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {referralConfirmError}</div>}
              {!showReferralRejectForm ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="gnt-btn gnt-btn-amber" onClick={() => submitReferralConfirm(true)}>Approve &amp; list it</button>
                  <button className="gnt-btn gnt-btn-danger" onClick={() => setShowReferralRejectForm(true)}>This isn't right</button>
                </div>
              ) : (
                <div>
                  <div className="gnt-field"><label>What's wrong? (optional)</label><textarea rows={2} value={referralRejectReason} onChange={e => setReferralRejectReason(e.target.value)} placeholder="e.g. Wrong price, already sold, not my product…" /></div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="gnt-btn gnt-btn-danger" onClick={() => submitReferralConfirm(false, referralRejectReason)}>Confirm rejection</button>
                    <button className="gnt-btn gnt-btn-ghost" onClick={() => setShowReferralRejectForm(false)}>Back</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== CO-BROKER HANDOFF CLAIM (broker login required) ===================== */}
      {view === "co_broker_claim" && (
        <div className="gnt-main" style={{ paddingTop: 40, maxWidth: 620, margin: "0 auto" }}>
          {coBrokerClaimLoading ? (
            <p style={{ color: "var(--steel-soft)" }}>Loading…</p>
          ) : coBrokerClaimError && !coBrokerClaimData ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <AlertTriangle size={32} style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Link not found</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>{coBrokerClaimError}</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : coBrokerClaimResult ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              {coBrokerClaimResult.claimed ? (
                <>
                  <CheckCircle2 size={40} color="#3f6b52" style={{ margin: "0 auto 14px" }} />
                  <h2 style={{ fontSize: 24, marginBottom: 8 }}>Submitted for verification</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>Tankbridge admin will verify your details, same as any referral. Check "My referrals" on your Dashboard for progress.</p>
                  <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("dashboard")}>Go to my Dashboard</button>
                </>
              ) : (
                <>
                  <XCircle size={40} color="#a63b32" style={{ margin: "0 auto 14px" }} />
                  <h2 style={{ fontSize: 24, marginBottom: 8 }}>Thanks for letting us know</h2>
                  <p style={{ color: "var(--steel)", fontSize: 14 }}>The introducing broker has been notified that this wasn't a match.</p>
                  <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
                </>
              )}
            </div>
          ) : coBrokerClaimData?.co_broker_status !== "pending" ? (
            <div className="gnt-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <AlertTriangle size={32} style={{ margin: "0 auto 14px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Already responded to</h2>
              <p style={{ color: "var(--steel)", fontSize: 14 }}>This link has already been used.</p>
              <button className="gnt-btn gnt-btn-ink" style={{ marginTop: 16 }} onClick={() => goto("landing")}>Back to Tankbridge</button>
            </div>
          ) : !session || myCompany?.type !== "broker" ? (
            <div className="gnt-card" style={{ padding: "32px 28px" }}>
              <h2 style={{ fontSize: 22, marginBottom: 10 }}>Log in with your broker account</h2>
              <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}><strong>{coBrokerClaimData.originating_broker_name}</strong> says you have a direct relationship with a {coBrokerClaimData.referred_type}. To confirm and register them, please log in with your Tankbridge broker account (or register one if you don't have one yet), then reopen this same link.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="gnt-btn gnt-btn-amber" onClick={() => goto("landing")}>Log in / Register</button>
                <button className="gnt-btn gnt-btn-ghost" onClick={() => setShowCoBrokerDeclineForm(true)}>I don't know this company</button>
              </div>
              {showCoBrokerDeclineForm && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <div className="gnt-field"><label>Reason (optional)</label><textarea rows={2} value={coBrokerDeclineReason} onChange={e => setCoBrokerDeclineReason(e.target.value)} /></div>
                  <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={submitCoBrokerDecline}>Confirm decline</button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submitCoBrokerClaim} className="gnt-card" style={{ padding: "32px 28px" }}>
              <h2 style={{ fontSize: 22, marginBottom: 6 }}>Confirm and register this {coBrokerClaimData.referred_type}</h2>
              <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}><strong>{coBrokerClaimData.originating_broker_name}</strong> introduced this — please correct any details below with what you actually know, since you're vouching for it. You'll split the 30% commission {Math.round((1 - coBrokerClaimData.co_broker_split_pct) * 100)}% you / {Math.round(coBrokerClaimData.co_broker_split_pct * 100)}% {coBrokerClaimData.originating_broker_name}.</p>
              {coBrokerClaimError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {coBrokerClaimError}</div>}
              <div className="gnt-field"><label>Company name</label><input value={coBrokerClaimForm.companyName} onChange={e => setCoBrokerClaimForm(f => ({ ...f, companyName: e.target.value }))} /></div>
              {coBrokerClaimData.referred_type === "buyer" ? (
                <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={coBrokerClaimForm.cipc} onChange={e => setCoBrokerClaimForm(f => ({ ...f, cipc: e.target.value }))} /></div>
              ) : (
                <div className="gnt-field">
                  <label>Copy of Wholesale License</label>
                  <FileInput onChange={e => setCoBrokerClaimLicenseFile(e.target.files?.[0] || null)} />
                </div>
              )}
              <div className="gnt-field"><label>Their email (required — Tankbridge invites them to register)</label><input type="email" value={coBrokerClaimForm.email} onChange={e => setCoBrokerClaimForm(f => ({ ...f, email: e.target.value }))} /></div>
              {coBrokerClaimData.referred_type === "seller" && (
                <div className="gnt-field"><label>Commission agreed with seller (R / litre)</label><input type="number" min="0.10" max="0.99" step="0.01" value={coBrokerClaimForm.commissionRate} onChange={e => setCoBrokerClaimForm(f => ({ ...f, commissionRate: e.target.value }))} /></div>
              )}
              <div className="gnt-grid2">
                <div className="gnt-field"><label>Contact person (optional)</label><input value={coBrokerClaimForm.contactName} onChange={e => setCoBrokerClaimForm(f => ({ ...f, contactName: e.target.value }))} /></div>
                <div className="gnt-field"><label>Phone (optional)</label><input value={coBrokerClaimForm.phone} onChange={e => setCoBrokerClaimForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="gnt-grid2">
                <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" value={coBrokerClaimForm.volume} onChange={e => setCoBrokerClaimForm(f => ({ ...f, volume: e.target.value }))} /></div>
                <div className="gnt-field"><label>Price (R / litre)</label><input type="number" step="0.01" value={coBrokerClaimForm.unitPrice} onChange={e => setCoBrokerClaimForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
              </div>
              <div className="gnt-field"><label>Location</label><input value={coBrokerClaimForm.location} onChange={e => setCoBrokerClaimForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div className="gnt-field"><label>Terms</label><TermsCheckboxGroup value={coBrokerClaimForm.terms} onChange={v => setCoBrokerClaimForm(f => ({ ...f, terms: v }))} /></div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className="gnt-btn gnt-btn-amber" type="submit" disabled={coBrokerClaimSubmitting}>{coBrokerClaimSubmitting ? "Submitting…" : "Confirm & submit for verification"}</button>
                <button className="gnt-btn gnt-btn-ghost" type="button" onClick={() => setShowCoBrokerDeclineForm(true)}>I don't know this company</button>
              </div>
              {showCoBrokerDeclineForm && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <div className="gnt-field"><label>Reason (optional)</label><textarea rows={2} value={coBrokerDeclineReason} onChange={e => setCoBrokerDeclineReason(e.target.value)} /></div>
                  <button className="gnt-btn gnt-btn-danger gnt-btn-sm" type="button" onClick={submitCoBrokerDecline}>Confirm decline</button>
                </div>
              )}
            </form>
          )}
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
              {inviteReferral?.referred_type === "seller" && (
                <div className="gnt-alert-banner" style={{ textAlign: "left", marginTop: 16 }}>
                  <AlertTriangle size={16} /> One more step — if a buyer has already shown interest, their contact details only release once you sign the IMFPA on your Dashboard. Please do that next.
                </div>
              )}
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
                {inviteReferral?.referred_type === "seller" && (
                  <div className="gnt-grid2">
                    <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={inviteForm.cipc} onChange={e => updateInviteField("cipc", e.target.value)} placeholder="2019/123456/07" /></div>
                    <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={inviteForm.dmreLicense} onChange={e => updateInviteField("dmreLicense", e.target.value)} placeholder="W/2024/0000" /></div>
                  </div>
                )}
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
                <p className="lead">South Africa's bulk diesel market runs on ghost volumes, unverified allocations and unregulated brokers. Tankbridge is the compliance layer — CIPC- and DMRE-verified counterparties trading 40,000ℓ+ lots under COC, COD, ITT or TTO terms, with transparent pricing and fixed, disclosed commission. Proof of Product and Proof of Funds stay exactly where they belong: between you and your counterparty.</p>
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
              <p>Once approved, buyers and sellers list and browse each other's offers directly — every deal routed through Tankbridge.</p>
            </div>
          </div>

          <section className="gnt-section">
            <div className="gnt-section-head">
              <h2>Why Tankbridge</h2>
              <p>A trust layer for South Africa's bulk fuel market — not another layer of brokers.</p>
            </div>
            <div className="gnt-grid4">
              <div className="gnt-card">
                <ShieldCheck size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Pre-vetted, compliant</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>Every participant is CIPC- and DMRE-screened before a single litre is listed or bid on — a compliance check, not a substitute for your own commercial due diligence. Proven trade history earns a Verified badge, so trusted counterparties stand out.</p>
              </div>
              <div className="gnt-card">
                <BadgeCheck size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Own it or represent it — clearly labelled</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>Every seller declares Title Holder or Mandate/Allocation status; every buyer declares direct funds or a financier. Proof of Product and Proof of Funds stay between the two parties — Tankbridge makes sure everyone starts from the same page. We verify who's who — you verify what's real.</p>
              </div>
              <div className="gnt-card">
                <FileSignature size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Transparent, fixed commission</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>You set your own price — Tankbridge never marks it up or adds a hidden margin. The commission rate is fixed and disclosed to every party before a deal is accepted, whether or not you build it into your quote.</p>
              </div>
              <div className="gnt-card">
                <Lock size={22} color="#3f6b52" />
                <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>Built-in accountability</h3>
                <p style={{ fontSize: 13.5, color: "var(--steel)" }}>A 24-month non-circumvention clause with real financial penalties, plus a public blacklist for non-payment or bad faith — so introductions don't just evaporate.</p>
              </div>
            </div>
          </section>

          <section style={{ background: "var(--ink)", margin: "0 -20px", padding: "36px 20px" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <h2 style={{ fontSize: 22, marginBottom: 16, color: "var(--paper)" }}>For brokers — introduce once, get paid every time it closes</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span className="mono" style={{ color: "var(--amber)", fontSize: 12.5 }}>01</span>
                  <span style={{ fontSize: 14, color: "var(--paper)" }}>Introduce a buyer or seller once — Tankbridge verifies them and invites them to register.</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span className="mono" style={{ color: "var(--amber)", fontSize: 12.5 }}>02</span>
                  <span style={{ fontSize: 14, color: "var(--paper)" }}>Your referral is timestamped and logged before either side ever sees a name.</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span className="mono" style={{ color: "var(--amber)", fontSize: 12.5 }}>03</span>
                  <span style={{ fontSize: 14, color: "var(--paper)" }}>30% of a small, disclosed per-litre commission — not a cut of the deal value — and only ever payable if the deal actually completes. No completed deal, no commission for anyone, platform included.</span>
                </div>
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
            <h3 style={{ fontSize: 30, marginBottom: 8, color: "var(--ink)" }}>Black Listed Companies</h3>
            <p style={{ fontSize: 13.5, color: "var(--steel-soft)", marginBottom: 14 }}>Companies published here have breached their obligations to Tankbridge or a counterparty — non-payment of commission, fraudulent listings, circumvention, or other serious breaches — with the reason stated.</p>
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
              {regType !== "broker" && (
                <p className="hint" style={{ marginBottom: 20 }}>Already registered as a {regType === "seller" ? "buyer" : "seller"}? Trading both ways is fine — just register again here with a different email for your {regType} activity (e.g. add a "+{regType}" tag to your usual email address).</p>
              )}
              {regError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {regError}</div>}
              <form onSubmit={submitRegForm}>
                <div className="gnt-field"><label>{regType === "broker" ? "Agency / company name" : "Company name"}</label><input value={regForm.companyName} onChange={e => updateReg("companyName", e.target.value)} placeholder="e.g. Highveld Fuel Traders (Pty) Ltd" /></div>
                {regType === "buyer" && (
                  <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={regForm.cipc} onChange={e => updateReg("cipc", e.target.value)} placeholder="2019/123456/07" /></div>
                )}
                {regType === "seller" && (
                  <>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={regForm.cipc} onChange={e => updateReg("cipc", e.target.value)} placeholder="2019/123456/07" /></div>
                      <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={regForm.dmreLicense} onChange={e => updateReg("dmreLicense", e.target.value)} placeholder="W/2024/0000" /></div>
                    </div>
                    <div className="gnt-field">
                      <label>Copy of Wholesale License (required)</label>
                      <FileInput onChange={e => setRegWholesaleLicenseFile(e.target.files?.[0] || null)} />
                      <div className="hint">Admin verifies this matches the license number you entered above before approving.</div>
                    </div>
                  </>
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
                    <div className="gnt-type-toggle" style={{ marginBottom: 12 }}>
                      <button type="button" className={!regForm.skipFirstReferral ? "active" : ""} onClick={() => updateReg("skipFirstReferral", false)}>Submit a referral now</button>
                      <button type="button" className={regForm.skipFirstReferral ? "active" : ""} onClick={() => updateReg("skipFirstReferral", true)}>Skip — I'll add referrals later</button>
                    </div>
                    {regForm.skipFirstReferral ? (
                      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>No problem — finish setting up your account below, then use "Add a referral" from your Dashboard whenever you're ready.</p>
                    ) : (
                      <>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>You can add more buyer/seller referrals from your Dashboard later — this is just your first one.</p>
                    {regForm.referredType === "seller" ? (
                      <p style={{ fontSize: 12, color: "var(--steel-soft)", marginBottom: 12 }}><strong>Referring a seller:</strong> you'll need their Wholesale License copy and an asking price (commission included) already agreed with them. They'll get an email to confirm before anything goes live.</p>
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--steel-soft)", marginBottom: 12 }}><strong>Referring a buyer:</strong> you'll need their CIPC number and requirement details. No price disclosure needed if they'd rather review seller offers than name a bid.</p>
                    )}
                    <div className="gnt-type-toggle">
                      <button type="button" className={regForm.referredType === "seller" ? "active" : ""} onClick={() => updateReg("referredType", "seller")}>Referring a Seller</button>
                      <button type="button" className={regForm.referredType === "buyer" ? "active" : ""} onClick={() => updateReg("referredType", "buyer")}>Referring a Buyer</button>
                    </div>
                    <div className="gnt-type-toggle" style={{ marginBottom: 18 }}>
                      <button type="button" className={regForm.hasDirectRelationship ? "active" : ""} onClick={() => updateReg("hasDirectRelationship", true)}>I know them directly</button>
                      <button type="button" className={!regForm.hasDirectRelationship ? "active" : ""} onClick={() => updateReg("hasDirectRelationship", false)}>I don't — hand off to who does</button>
                    </div>
                    {!regForm.hasDirectRelationship && (
                      <div className="gnt-card" style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 12 }}>Tankbridge will contact the broker/mandate below to confirm they actually have this relationship and complete the real registration. You're credited a share of the commission once they do — no company email/CIPC needed from you here.</p>
                        <div className="gnt-grid2">
                          <div className="gnt-field"><label>Upstream broker/mandate's name</label><input value={regForm.upstreamBrokerName} onChange={e => updateReg("upstreamBrokerName", e.target.value)} /></div>
                          <div className="gnt-field"><label>Upstream broker/mandate's email</label><input type="email" value={regForm.upstreamBrokerEmail} onChange={e => updateReg("upstreamBrokerEmail", e.target.value)} placeholder="them@brokerco.co.za" /></div>
                        </div>
                        <div className="gnt-field"><label>Your share of the 30% broker commission (0–1, e.g. 0.50 = 50%)</label><input type="number" min="0.01" max="0.99" step="0.05" value={regForm.coBrokerSplitPct} onChange={e => updateReg("coBrokerSplitPct", e.target.value)} /></div>
                      </div>
                    )}
                    <div className="gnt-field"><label>{regForm.referredType === "seller" ? "Seller" : "Buyer"} company name{!regForm.hasDirectRelationship && " (best known)"}</label><input value={regForm.referredCompanyName} onChange={e => updateReg("referredCompanyName", e.target.value)} placeholder="Company you're introducing" /></div>
                    {regForm.hasDirectRelationship && (regForm.referredType === "buyer" ? (
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={regForm.referredCipc} onChange={e => updateReg("referredCipc", e.target.value)} placeholder="2019/123456/07" /></div>
                    ) : (
                      <div className="gnt-field">
                        <label>Copy of Wholesale License</label>
                        <FileInput onChange={e => setRegReferralLicenseFile(e.target.files?.[0] || null)} />
                        <div className="hint">Admin will review this and confirm the CIPC and DMRE license numbers before approving.</div>
                      </div>
                    ))}
                    {regForm.hasDirectRelationship && (
                      <div className="gnt-field"><label>Their email (required — Tankbridge invites them to register)</label><input type="email" value={regForm.referredEmail} onChange={e => updateReg("referredEmail", e.target.value)} placeholder="them@company.co.za" /></div>
                    )}
                    {regForm.hasDirectRelationship && regForm.referredType === "seller" && (
                      <div className="gnt-field"><label>Commission agreed with seller (R / litre)</label><input type="number" min="0.10" max="0.99" step="0.01" value={regForm.proposedCommissionRate} onChange={e => updateReg("proposedCommissionRate", e.target.value)} />
                        <div className="hint">This should already be agreed with the seller directly — it's included in the confirmation email they approve before the listing goes live.</div>
                      </div>
                    )}
                    <div className="gnt-field"><label>Product</label>
                      <select value={regForm.product} onChange={e => updateReg("product", e.target.value)}>
                        {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={regForm.tradeVolume} onChange={e => updateReg("tradeVolume", e.target.value)} placeholder="40000" /></div>
                      <div className="gnt-field"><label>{regForm.referredType === "seller" ? "Asking price — commission included (R / litre)" : "Price (R / litre)"}</label><input type="number" min="0" step="0.01" value={regForm.tradePrice} onChange={e => updateReg("tradePrice", e.target.value)} placeholder="21.45" /></div>
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
                  </>
                ) : (
                  <>
                    <div className="gnt-field">
                      <label>{regType === "seller" ? "Are you the Title Holder, or do you hold a Mandate/Allocation?" : "Are you funding this directly, or is a Funder involved?"}</label>
                      <select value={regForm.ownershipCapacity} onChange={e => updateReg("ownershipCapacity", e.target.value)}>
                        <option value="">Select…</option>
                        {regType === "seller" ? (
                          <>
                            <option value="title_holder">I am the Title Holder with Proof of Product</option>
                            <option value="mandate_holder">I hold a Mandate / Allocation from the Title Holder</option>
                          </>
                        ) : (
                          <>
                            <option value="direct_funds">I have own funds with POF</option>
                            <option value="funder_involved">A Funder / financier is involved</option>
                          </>
                        )}
                      </select>
                      {regForm.ownershipCapacity === "mandate_holder" && (
                        <div className="hint">This is shown as a label on the Market Board (no names). You'll be able to upload proof of your mandate privately to admin from your Dashboard — it's never shown to buyers.</div>
                      )}
                    </div>
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
              <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 14 }}>Required for buyers, sellers and brokers before admin approval. Please scroll to the end to enable agreement.</p>

              <div className="gnt-type-toggle" style={{ marginBottom: 18, maxWidth: 480 }}>
                <button className={!useCustomNcnda ? "active" : ""} type="button" onClick={() => setUseCustomNcnda(false)}>Use Tankbridge's NCNDA</button>
                <button className={useCustomNcnda ? "active" : ""} type="button" onClick={() => setUseCustomNcnda(true)}>Use my own NCNDA form</button>
              </div>

              {useCustomNcnda ? (
                <form onSubmit={submitCustomNcndaRegistration}>
                  <div className="gnt-card" style={{ marginBottom: 18 }}>
                    <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 14 }}>Upload your own company's NCNDA, already signed on your side. Tankbridge admin will review it — your registration will proceed to full approval once it's accepted. If it's rejected, you can resubmit or switch to Tankbridge's standard NCNDA instead.</p>
                    {regError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {regError}</div>}
                    <div className="gnt-field">
                      <label>Signed NCNDA document</label>
                      <FileInput onChange={e => setCustomNcndaFile(e.target.files?.[0] || null)} />
                    </div>
                    {regType !== "broker" && (
                      <div className="gnt-field">
                        <label>CIS / KYC document (optional)</label>
                        <FileInput onChange={e => setRegCisKycFile(e.target.files?.[0] || null)} />
                        <div className="hint">Speeds up admin review — you can also add this later from your Dashboard.</div>
                      </div>
                    )}
                  </div>
                  <button className="gnt-btn gnt-btn-amber" type="submit" style={{ width: "100%", justifyContent: "center" }} disabled={customNcndaSubmitting}>
                    {customNcndaSubmitting ? "Submitting…" : "Submit custom NCNDA for review"} <FileSignature size={16} />
                  </button>
                </form>
              ) : (
                <>
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
                    <p>If Tankbridge concludes a deal involving a party referred by Broker (including the referral submitted with this registration) within 24 months of the referred party's registration, commission is calculated as follows, once admin has linked the deal and recorded the fee. No commission is payable on deals that do not complete.</p>
                    <p><strong>Simple Introduction</strong> (Broker introduces the party, but doesn't negotiate price or commission on their behalf): Broker receives 30% of Tankbridge's brokerage fee on the matched deal.</p>
                    <p><strong>Mandate</strong> (Broker actively negotiates price and commission on the referred party's behalf via the Market Board): Tankbridge keeps at most 40% of the negotiated commission — Broker gets the rest. If the other side also has its own active mandate, Broker splits that evenly with them. If not, but the other side still has a separate broker who introduced them, that broker gets a small 10% share and Broker keeps the rest.</p>
                    <p>For a referred seller, the Wholesale License copy submitted is used by admin to verify CIPC and DMRE; for a referred buyer, the CIPC number submitted is confirmed accurate to the best of Broker's knowledge.</p>
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
                {regType !== "broker" && (
                  <div className="gnt-field">
                    <label>CIS / KYC document (optional)</label>
                    <FileInput onChange={e => setRegCisKycFile(e.target.files?.[0] || null)} />
                    <div className="hint">A Corporate Information Sheet or KYC pack speeds up admin review — you can also add this later from your Dashboard.</div>
                  </div>
                )}
                <button className="gnt-btn gnt-btn-amber" type="submit" style={{ width: "100%", justifyContent: "center" }}>Accept &amp; submit registration <FileSignature size={16} /></button>
              </form>
              </>
              )}
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
                {myCompany.status === "rejected" && !showResubmit && (
                  <div className="gnt-alert-banner" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <span><XCircle size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />This registration was not approved. Contact Tankbridge admin, or fix and resubmit your details below.</span>
                    <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => startResubmit(myCompany)}>Fix &amp; resubmit</button>
                  </div>
                )}
                {myCompany.status === "rejected" && showResubmit && (
                  <form onSubmit={e => submitResubmit(e, myCompany)} style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    {resubmitError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {resubmitError}</div>}
                    <div className="gnt-field"><label>Company name</label><input value={resubmitForm.companyName} onChange={e => setResubmitForm(f => ({ ...f, companyName: e.target.value }))} /></div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={resubmitForm.cipc} onChange={e => setResubmitForm(f => ({ ...f, cipc: e.target.value }))} /></div>
                      {myCompany.type === "seller" && (
                        <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={resubmitForm.dmreLicense} onChange={e => setResubmitForm(f => ({ ...f, dmreLicense: e.target.value }))} /></div>
                      )}
                    </div>
                    <div className="gnt-field"><label>Address</label><textarea rows={2} value={resubmitForm.address} onChange={e => setResubmitForm(f => ({ ...f, address: e.target.value }))} /></div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit" disabled={resubmitSaving}>{resubmitSaving ? "Submitting…" : "Resubmit for review"}</button>
                      <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" type="button" onClick={() => setShowResubmit(false)}>Cancel</button>
                    </div>
                  </form>
                )}

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
                <div className="gnt-card" style={{ marginBottom: 26 }}>
                  <h3 style={{ fontSize: 18, marginBottom: 6 }}>Account status</h3>

                  {myCompany.account_status === "withdrawn" ? (
                    <>
                      <div className="gnt-alert-banner" style={{ marginBottom: 12 }}><Lock size={16} /> Your account has been withdrawn and your listings are no longer visible.</div>
                      {reactivationRequested ? (
                        <p style={{ fontSize: 13, color: "var(--verified)" }}>Reactivation requested — Tankbridge admin has been notified and will follow up by email.</p>
                      ) : (
                        <button className="gnt-btn gnt-btn-amber gnt-btn-sm" disabled={reactivationBusy} onClick={submitReactivationRequest}>
                          {reactivationBusy ? "Sending…" : "Request reactivation"}
                        </button>
                      )}
                    </>
                  ) : myCompany.account_status === "withdrawal_requested" ? (
                    <div className="gnt-alert-banner"><AlertTriangle size={16} /> Withdrawal requested on {fmtDate(myCompany.deactivation_requested_at)} — pending admin review. Your listings are hidden in the meantime.</div>
                  ) : myCompany.account_status === "listings_paused" ? (
                    <>
                      <div className="gnt-alert-banner" style={{ marginBottom: 12 }}><AlertTriangle size={16} /> Your listings are paused and hidden from the Market Board{myCompany.deactivation_reason ? ` — "${myCompany.deactivation_reason}"` : ""}.</div>
                      <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={submitResumeListings}>Resume my listings</button>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>Taking a break, or leaving Tankbridge? Your data is always kept on file — never deleted — in case it's needed for an active dispute.</p>
                      {!showPauseForm && !showWithdrawForm && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => { setShowPauseForm(true); setAccountActionError(""); }}>Pause my listings</button>
                          <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => { setShowWithdrawForm(true); setAccountActionError(""); }}>Request full withdrawal</button>
                        </div>
                      )}
                      {accountActionError && <div className="gnt-alert-banner" style={{ marginTop: 12 }}><AlertTriangle size={16} /> {accountActionError}</div>}
                      {showPauseForm && (
                        <div style={{ marginTop: 12 }}>
                          <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>Hides your listings from the Market Board. Your account stays fully intact — resume any time.</p>
                          <div className="gnt-field"><label>Reason (optional)</label><textarea rows={2} value={accountActionReason} onChange={e => setAccountActionReason(e.target.value)} /></div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button className="gnt-btn gnt-btn-amber gnt-btn-sm" disabled={accountActionBusy} onClick={submitPauseListings}>{accountActionBusy ? "Saving…" : "Confirm pause"}</button>
                            <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => { setShowPauseForm(false); setAccountActionReason(""); }}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {showWithdrawForm && (
                        <div style={{ marginTop: 12 }}>
                          <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>Blocked if you have a deal currently in progress — please report its outcome first. Requires a reason, and goes to Tankbridge admin for final processing.</p>
                          <div className="gnt-field"><label>Reason (required)</label><textarea rows={2} value={accountActionReason} onChange={e => setAccountActionReason(e.target.value)} /></div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button className="gnt-btn gnt-btn-danger gnt-btn-sm" disabled={accountActionBusy} onClick={submitWithdrawal}>{accountActionBusy ? "Submitting…" : "Confirm withdrawal request"}</button>
                            <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => { setShowWithdrawForm(false); setAccountActionReason(""); }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {myCompany.status === "approved" && myCompany.type !== "broker" && (
                <div className="gnt-card" style={{ marginBottom: 26 }}>
                  <h3 style={{ fontSize: 18, marginBottom: 6 }}>Trust badges</h3>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 14 }}>Verified badges get more Market Board engagement and faster Accepts — build yours once, benefit on every future listing.</p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    <span className="gnt-badge approved">Verified — CIPC + DMRE</span>
                    {myCompany.past_performance_verified
                      ? <span className="gnt-badge approved">Verified · Past Performance Checked</span>
                      : <span className="gnt-badge pending">Past Performance not yet verified</span>}
                    {myCompany.type === "seller" && myCompany.ownership_capacity === "mandate_holder" && (
                      myCompany.mandate_verified
                        ? <span className="gnt-badge approved">Mandate Verified</span>
                        : <span className="gnt-badge pending">Mandate not yet verified</span>
                    )}
                    {myCompany.type === "seller" && myCompany.ownership_capacity === "title_holder" && (
                      myCompany.product_verified
                        ? <span className="gnt-badge approved">Product Verified</span>
                        : <span className="gnt-badge pending">Product not yet verified</span>
                    )}
                  </div>

                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Trade references (2 recommended)</h4>
                  <form onSubmit={submitTradeReferences} style={{ marginBottom: 20 }}>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Reference 1 — company</label><input value={refForm.ref1Company} onChange={e => setRefForm(f => ({ ...f, ref1Company: e.target.value }))} /></div>
                      <div className="gnt-field"><label>Reference 1 — contact</label><input value={refForm.ref1Contact} onChange={e => setRefForm(f => ({ ...f, ref1Contact: e.target.value }))} placeholder="Name, phone or email" /></div>
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Reference 2 — company</label><input value={refForm.ref2Company} onChange={e => setRefForm(f => ({ ...f, ref2Company: e.target.value }))} /></div>
                      <div className="gnt-field"><label>Reference 2 — contact</label><input value={refForm.ref2Contact} onChange={e => setRefForm(f => ({ ...f, ref2Contact: e.target.value }))} placeholder="Name, phone or email" /></div>
                    </div>
                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" type="submit" disabled={refSaving}>{refSaving ? "Saving…" : "Save references"}</button>
                  </form>

                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Past performance documents</h4>
                  {docError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {docError}</div>}
                  <FileInput multiple disabled={docUploading} onChange={e => uploadCompanyDoc(Array.from(e.target.files), "past_performance")} style={{ marginBottom: 10 }} />
                  {myDocuments.filter(d => d.doc_type === "past_performance").map(d => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                      <span>{d.file_name}</span>
                      <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => deleteCompanyDoc(d)}>Remove</button>
                    </div>
                  ))}

                  <h4 style={{ fontSize: 14, margin: "20px 0 8px" }}>CIS / KYC document (optional)</h4>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 10 }}>A Corporate Information Sheet or KYC pack speeds up admin review — private, admin only.</p>
                  <FileInput multiple disabled={docUploading} onChange={e => uploadCompanyDoc(Array.from(e.target.files), "cis_kyc")} style={{ marginBottom: 10 }} />
                  {myDocuments.filter(d => d.doc_type === "cis_kyc").map(d => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                      <span>{d.file_name}</span>
                      <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => deleteCompanyDoc(d)}>Remove</button>
                    </div>
                  ))}

                  {myCompany.type === "seller" && (
                    <>
                      <h4 style={{ fontSize: 14, margin: "20px 0 8px" }}>Wholesale License copy</h4>
                      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 10 }}>Lets admin verify the CIPC/DMRE numbers on your profile. Private, admin only.</p>
                      <FileInput multiple disabled={docUploading} onChange={e => uploadCompanyDoc(Array.from(e.target.files), "wholesale_license")} style={{ marginBottom: 10 }} />
                      {myDocuments.filter(d => d.doc_type === "wholesale_license").map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span>{d.file_name}</span>
                          <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => deleteCompanyDoc(d)}>Remove</button>
                        </div>
                      ))}
                    </>
                  )}

                  {myCompany.type === "seller" && myCompany.ownership_capacity === "mandate_holder" && (
                    <>
                      <h4 style={{ fontSize: 14, margin: "20px 0 8px" }}>Mandate / Allocation proof (private — admin only, never shown to buyers)</h4>
                      <FileInput multiple disabled={docUploading} onChange={e => uploadCompanyDoc(Array.from(e.target.files), "mandate_proof")} style={{ marginBottom: 10 }} />
                      {myDocuments.filter(d => d.doc_type === "mandate_proof").map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span>{d.file_name}</span>
                          <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => deleteCompanyDoc(d)}>Remove</button>
                        </div>
                      ))}
                    </>
                  )}

                  {myCompany.type === "seller" && myCompany.ownership_capacity === "title_holder" && (
                    <>
                      <h4 style={{ fontSize: 14, margin: "20px 0 8px" }}>Tank report / Proof of Product (private — admin only, never shown to buyers)</h4>
                      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 10 }}>The clearest evidence is a Vopak (or equivalent terminal) tank report issued in your own company's name.</p>
                      <FileInput multiple disabled={docUploading} onChange={e => uploadCompanyDoc(Array.from(e.target.files), "tank_report")} style={{ marginBottom: 10 }} />
                      {myDocuments.filter(d => d.doc_type === "tank_report").map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span>{d.file_name}</span>
                          <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => deleteCompanyDoc(d)}>Remove</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {myCompany.status === "approved" && myCompany.type !== "broker" && myCompany.account_status === "active" && (
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
                    {myCompany.type === "buyer" && (
                      <div className="gnt-field">
                        <label>Pricing</label>
                        <div className="gnt-type-toggle">
                          <button type="button" className={listingForm.priceMode === "fixed" ? "active" : ""} onClick={() => updateListingField("priceMode", "fixed")}>Set my bid price</button>
                          <button type="button" className={listingForm.priceMode === "seller_offer" ? "active" : ""} onClick={() => updateListingField("priceMode", "seller_offer")}>Request seller offers</button>
                        </div>
                        {listingForm.priceMode === "seller_offer" && (
                          <div className="hint">No price shown on the Market Board. Sellers submit their own offer; you can accept or counter (up to 2 rounds each) before it either matches or falls through.</div>
                        )}
                      </div>
                    )}
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Volume (litres, min. 40,000)</label><input type="number" min="40000" step="1000" value={listingForm.volume} onChange={e => updateListingField("volume", e.target.value)} placeholder="40000" /></div>
                      {!(myCompany.type === "buyer" && listingForm.priceMode === "seller_offer") && (
                        <div className="gnt-field"><label>{myCompany.type === "seller" ? "Asking price (R / litre)" : "Bid price (R / litre)"}</label><input type="number" min="0" step="0.01" value={listingForm.unitPrice} onChange={e => updateListingField("unitPrice", e.target.value)} placeholder="21.45" /></div>
                      )}
                    </div>
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Location</label><input value={listingForm.location} onChange={e => updateListingField("location", e.target.value)} placeholder="e.g. Durban, Lesedi, Secunda" /></div>
                      <div className="gnt-field"><label>Availability</label><input value={listingForm.availability} onChange={e => updateListingField("availability", e.target.value)} placeholder="e.g. Immediate / 48 hrs" /></div>
                    </div>
                    <div className="gnt-field"><label>Notes (optional)</label><textarea rows={2} value={listingForm.notes} onChange={e => updateListingField("notes", e.target.value)} /></div>
                    <div className="gnt-field">
                      <label>BOL terms for first load (optional)</label>
                      <select value={listingForm.bolTerms} onChange={e => updateListingField("bolTerms", e.target.value)}>
                        {Object.entries(myCompany.type === "seller" ? BOL_LABELS_SELLER : BOL_LABELS_BUYER).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <div className="hint">Relevant mainly for COC — whether payment can happen after loading (via Bill of Lading) rather than before, for a first-time counterparty. Shown on the Market Board; final terms are still agreed directly between the parties.</div>
                    </div>
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
                        <div className="gnt-field">
                          <label>BOL terms for first load (optional)</label>
                          <select value={editingListing.bol_terms || "not_offered"} onChange={e => updateEditField("bol_terms", e.target.value)}>
                            {Object.entries(myCompany.type === "seller" ? BOL_LABELS_SELLER : BOL_LABELS_BUYER).map(([v, label]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
                        </div>
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

                  {renderMyNegotiations()}

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

              {(myCompany.status === "approved" || myCompany.status === "pending") && (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 4 }}>{myCompany.type === "broker" ? "Add a referral" : "Refer another company"}</h3>
                  {myCompany.status === "pending" && (
                    <div className="gnt-alert-banner" style={{ marginBottom: 12 }}><AlertTriangle size={16} /> Your own registration is still awaiting approval — you can still submit referrals in the meantime, they're reviewed independently.</div>
                  )}
                  <div className="gnt-card" style={{ marginBottom: 16, fontSize: 12.5, color: "var(--steel-soft)" }}>
                    <strong style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>What Tankbridge does</strong>
                    Tankbridge is a verified B2B marketplace for bulk diesel. CIPC/DMRE-checked buyers and sellers trade directly, anonymously until both sides agree — Tankbridge never buys, sells, or holds funds itself, just verifies and connects.
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 8 }}>Register a buyer or seller you represent — submit as many as you like, for either side. Admin verifies CIPC (and DMRE for sellers) before it goes live on the Market Board. Commission is 30% of Tankbridge's brokerage fee on any matched deal, payable once admin links your referral to that deal.</p>
                  {referralForm.referredType === "seller" ? (
                    <p style={{ fontSize: 12, color: "var(--steel-soft)", marginBottom: 14 }}><strong>Referring a seller:</strong> you'll need their Wholesale License copy and an asking price (commission included) already agreed with them. They'll get an email to confirm before anything goes live, and complete their own quick registration once a real buyer shows interest.</p>
                  ) : (
                    <p style={{ fontSize: 12, color: "var(--steel-soft)", marginBottom: 14 }}><strong>Referring a buyer:</strong> you'll need their CIPC number, budget, and requirement details. Their listing goes live once admin approves — no price disclosure needed if they'd rather review seller offers instead of naming a bid.</p>
                  )}
                  {referralError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {referralError}</div>}
                  <form onSubmit={submitReferral} className="gnt-card" style={{ marginBottom: 30 }}>
                    <div className="gnt-type-toggle">
                      <button type="button" className={referralForm.referredType === "seller" ? "active" : ""} onClick={() => updateReferralField("referredType", "seller")}>Referring a Seller</button>
                      <button type="button" className={referralForm.referredType === "buyer" ? "active" : ""} onClick={() => updateReferralField("referredType", "buyer")}>Referring a Buyer</button>
                    </div>
                    <div className="gnt-type-toggle" style={{ marginBottom: 18 }}>
                      <button type="button" className={referralForm.hasDirectRelationship ? "active" : ""} onClick={() => updateReferralField("hasDirectRelationship", true)}>I know them directly</button>
                      <button type="button" className={!referralForm.hasDirectRelationship ? "active" : ""} onClick={() => updateReferralField("hasDirectRelationship", false)}>I don't — hand off to who does</button>
                    </div>
                    {!referralForm.hasDirectRelationship && (
                      <div className="gnt-card" style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 12 }}>Tankbridge will contact the broker below to confirm they actually have this relationship and complete the real registration. You're credited a share of the commission once they do — no company name/CIPC/email needed from you here.</p>
                        <div className="gnt-grid2">
                          <div className="gnt-field"><label>Upstream broker's name</label><input value={referralForm.upstreamBrokerName} onChange={e => updateReferralField("upstreamBrokerName", e.target.value)} /></div>
                          <div className="gnt-field"><label>Upstream broker's email</label><input type="email" value={referralForm.upstreamBrokerEmail} onChange={e => updateReferralField("upstreamBrokerEmail", e.target.value)} placeholder="them@brokerco.co.za" /></div>
                        </div>
                        <div className="gnt-field"><label>Your share of the 30% broker commission (0–1, e.g. 0.50 = 50%)</label><input type="number" min="0.01" max="0.99" step="0.05" value={referralForm.coBrokerSplitPct} onChange={e => updateReferralField("coBrokerSplitPct", e.target.value)} /></div>
                      </div>
                    )}
                    <div className="gnt-field"><label>{referralForm.referredType === "seller" ? "Seller" : "Buyer"} company name{!referralForm.hasDirectRelationship && " (best known)"}</label><input value={referralForm.referredCompanyName} onChange={e => updateReferralField("referredCompanyName", e.target.value)} placeholder="Company you're introducing" /></div>
                    {referralForm.hasDirectRelationship && (referralForm.referredType === "buyer" ? (
                      <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={referralForm.referredCipc} onChange={e => updateReferralField("referredCipc", e.target.value)} placeholder="2019/123456/07" /></div>
                    ) : (
                      <div className="gnt-field">
                        <label>Copy of Wholesale License</label>
                        <FileInput onChange={e => setReferralLicenseFile(e.target.files?.[0] || null)} />
                        <div className="hint">Admin will review this and confirm the CIPC and DMRE license numbers before approving.</div>
                      </div>
                    ))}
                    {referralForm.hasDirectRelationship && referralForm.referredType === "seller" && (
                      <div className="gnt-field"><label>Commission agreed with seller (R / litre)</label><input type="number" min="0.10" max="0.99" step="0.01" value={referralForm.proposedCommissionRate} onChange={e => updateReferralField("proposedCommissionRate", e.target.value)} />
                        <div className="hint">This should already be agreed with the seller directly — it's included in the confirmation email they approve before the listing goes live.</div>
                      </div>
                    )}
                    {referralForm.hasDirectRelationship && (
                      <p style={{ fontSize: 12.5, color: "var(--steel-soft)", margin: "-4px 0 8px" }}>Once admin approves, Tankbridge emails this company an invite to register their own account — they set their own password and go live once they complete it.</p>
                    )}
                    {referralForm.hasDirectRelationship && (
                    <div className="gnt-grid2">
                      <div className="gnt-field"><label>Contact person (optional)</label><input value={referralForm.referredContactName} onChange={e => updateReferralField("referredContactName", e.target.value)} /></div>
                      <div className="gnt-field"><label>Phone (optional)</label><input value={referralForm.referredPhone} onChange={e => updateReferralField("referredPhone", e.target.value)} placeholder="+27 8x xxx xxxx" /></div>
                    </div>
                    )}
                    {referralForm.hasDirectRelationship && (
                    <div className="gnt-field"><label>Email (required — invite is sent here)</label><input type="email" value={referralForm.referredEmail} onChange={e => updateReferralField("referredEmail", e.target.value)} placeholder="them@company.co.za" /></div>
                    )}

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
                      <div className="gnt-field"><label>{referralForm.referredType === "seller" ? "Asking price — commission included (R / litre)" : "Price (R / litre)"}</label><input type="number" min="0" step="0.01" value={referralForm.unitPrice} onChange={e => updateReferralField("unitPrice", e.target.value)} /></div>
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
                      <p>By submitting this referral, {myCompany.company_name} ("Introducer") confirms it is introducing the above party to Tankbridge in good faith. For a seller, the Wholesale License copy provided is used by admin to verify the CIPC and DMRE details; for a buyer, the CIPC number provided is confirmed accurate to the best of Introducer's knowledge.</p>
                      <p>If Tankbridge concludes a deal involving this referral within 24 months of the referred party's registration, commission is calculated as follows, once admin has linked the deal and recorded the fee. No commission is payable on deals that do not complete.</p>
                      <p><strong>Simple Introduction</strong> (you introduce the party, but don't negotiate price or commission on their behalf): you receive 30% of Tankbridge's brokerage fee on the matched deal.</p>
                      <p><strong>Mandate</strong> (you actively negotiate price and commission on the referred party's behalf via the Market Board): Tankbridge keeps at most 40% of the negotiated commission — you get the rest. If the other side also has its own active mandate, you split that evenly. If not, but the other side still has a separate broker who introduced them, that broker gets a small 10% share and you keep the rest.</p>
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
                          {r.status === "approved" && r.is_co_broker_referral && (
                            <div style={{ fontSize: 11.5, color: "var(--steel-soft)", marginTop: 4 }}>
                              {r.co_broker_status === "claimed" ? `Claimed by ${r.co_broker_upstream_name} — you'll be credited ${Math.round(r.co_broker_split_pct * 100)}% of the commission`
                                : r.co_broker_status === "declined" ? `${r.co_broker_upstream_name} said they don't know this company`
                                : `Awaiting ${r.co_broker_upstream_name} to confirm this relationship`}
                            </div>
                          )}
                          {r.status === "approved" && !r.is_co_broker_referral && (
                            <div style={{ fontSize: 11.5, color: "var(--steel-soft)", marginTop: 4 }}>
                              {r.invite_status === "accepted"
                                ? "Registration completed — trading directly now"
                                : "Live on the Market Board — they'll be asked to confirm and complete registration once a real counterparty accepts"}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="gnt-badge pending">{r.commission_status}</div>
                          {r.commission_amount != null && <div style={{ marginTop: 6, fontWeight: 600 }}>{fmtMoney(r.commission_amount)}</div>}
                        </div>
                      </div>
                      {r.status === "approved" && r.invite_status !== "accepted" && r.listing_id && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                          {editingBrokerListingId === r.listing_id ? (
                            <div>
                              {brokerListingError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {brokerListingError}</div>}
                              <div className="gnt-grid2">
                                <div className="gnt-field"><label>Volume (litres)</label><input type="number" min="40000" value={brokerListingForm.volume} onChange={e => setBrokerListingForm(f => ({ ...f, volume: e.target.value }))} /></div>
                                <div className="gnt-field"><label>Price (R/litre)</label><input type="number" step="0.01" value={brokerListingForm.unitPrice} onChange={e => setBrokerListingForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
                              </div>
                              <div className="gnt-field"><label>Location</label><input value={brokerListingForm.location} onChange={e => setBrokerListingForm(f => ({ ...f, location: e.target.value }))} /></div>
                              <div className="gnt-field"><label>Terms</label>
                                <TermsCheckboxGroup value={brokerListingForm.terms} onChange={v => setBrokerListingForm(f => ({ ...f, terms: v }))} />
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={saveBrokerListingEdit}>Save</button>
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => { setEditingBrokerListingId(null); setBrokerListingForm(null); }}>Cancel edit</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => startEditBrokerListing(r)}>Edit listing</button>
                              <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => { if (window.confirm("Cancel and remove this listing from the Market Board?")) cancelBrokerListing(r); }}>Cancel listing</button>
                            </div>
                          )}
                          <p className="hint" style={{ marginTop: 6 }}>You can manage this listing until {r.referred_company_name} completes their own registration — after that, it's under their control.</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {renderMyNegotiations()}

                  <h3 style={{ fontSize: 20, margin: "28px 0 10px" }}>My commissions</h3>
                  <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 12 }}>Automatically tracked for any deal completed by a company you referred, within 24 months of their registration — no manual linking needed.</p>
                  {myBrokerCommissions.length === 0 && <div className="gnt-empty">No commissions tracked yet.</div>}
                  {myBrokerCommissions.map(c => (
                    <div key={c.id} className="gnt-card" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span className={`gnt-badge ${c.commission_status === "paid" ? "approved" : c.commission_status === "payable" ? "selling" : "pending"}`}>{c.commission_status}</span>
                          <div style={{ fontSize: 13, marginTop: 4 }}>{c.deals?.product} · {Number(c.deals?.volume || 0).toLocaleString()} ℓ · {c.role === "seller_side" ? "Seller-side" : "Buyer-side"} referral · {fmtDate(c.created_at)}</div>
                        </div>
                        <div style={{ fontWeight: 600 }}>{c.commission_amount != null ? fmtMoney(c.commission_amount) : "—"}</div>
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
                      {l.ownership_capacity && <span className="gnt-badge pending" style={{ marginBottom: 8, marginLeft: 6 }}>{OWNERSHIP_LABELS[l.ownership_capacity]}</span>}
                      {l.mandate_verified && <span className="gnt-badge approved" style={{ marginBottom: 8, marginLeft: 6 }}>Mandate Verified</span>}
                      {l.product_verified && <span className="gnt-badge approved" style={{ marginBottom: 8, marginLeft: 6 }}>Product Verified</span>}
                      {l.past_performance_verified && <span className="gnt-badge approved" style={{ marginBottom: 8, marginLeft: 6 }}>Past Performance Checked</span>}
                      {BOL_MARKET_BADGE[l.bol_terms] && <span className="gnt-badge pending" style={{ marginBottom: 8, marginLeft: 6 }}>{BOL_MARKET_BADGE[l.bol_terms]}</span>}
                      <div className="gnt-listing-product">{l.product}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {l.price_mode === "seller_offer" ? (
                        <div className="gnt-listing-price">Offer<small>seller proposes price</small></div>
                      ) : (
                        <div className="gnt-listing-price">{fmtMoney(l.unit_price)}<small>{isSell ? "asking / litre" : "bid / litre"}</small></div>
                      )}
                      {l.price_mode === "seller_offer" ? (
                        <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => openSubmitOffer(l)}>Submit offer <ChevronRight size={13} /></button>
                      ) : (
                        <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => openAccept(l)}>Accept price <ChevronRight size={13} /></button>
                      )}
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
                        <td><strong>{c.company_name}</strong>{c.account_status && c.account_status !== "active" && <span className="gnt-badge rejected" style={{ marginLeft: 6, fontSize: 10 }}>{c.account_status.replace(/_/g, " ")}</span>}<br /><span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>{c.email}</span></td>
                        <td style={{ textTransform: "capitalize" }}>{c.type}</td>
                        <td className="mono">{c.cipc}</td>
                        <td className="mono">{c.dmre_license}</td>
                        <td>{c.ncnda_signed ? <span style={{ color: "var(--verified)" }}>Signed</span> : <span style={{ color: "var(--alert)" }}>Missing</span>}</td>
                        <td>{fmtDate(c.created_at)}</td>
                        <td><button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => { setDetailCompany(c); loadDetailDocuments(c.id); }}>View</button></td>
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
                    <thead><tr><th>Product</th><th>Seller</th><th>Buyer</th><th>Status</th><th>Self-reported</th><th>Platform commission (R)</th><th>Broker commissions</th><th>Date</th></tr></thead>
                    <tbody>
                      {adminDeals.filter(d => showCancelledDeals || d.status !== "cancelled").map(d => (
                        <tr key={d.id}>
                          <td>{d.product}<br /><span style={{ fontSize: 11.5, color: "var(--steel-soft)" }}>{Number(d.volume).toLocaleString()} ℓ @ {fmtMoney(d.unit_price)} · {fmtTerms(d.terms)} · {d.location}</span>{d.bol_requested && <div style={{ fontSize: 11, color: "var(--alert)", marginTop: 3 }}>BOL requested{d.bol_note ? `: "${d.bol_note}"` : ""}</div>}</td>
                          <td>{adminCompanies.find(c => c.id === d.seller_company_id)?.company_name}</td>
                          <td>{adminCompanies.find(c => c.id === d.buyer_company_id)?.company_name}</td>
                          <td>
                            <span className={`gnt-badge ${d.status === "completed" ? "approved" : d.status === "cancelled" ? "rejected" : "pending"}`}>{d.status}</span>
                            {d.status_change_note && <div style={{ fontSize: 11, color: "var(--steel-soft)", marginTop: 4 }}>{d.status_change_note}</div>}
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
                          <td style={{ fontSize: 11.5 }}>
                            {adminBrokerCommissions.filter(bc => bc.deal_id === d.id).length === 0 ? (
                              <span style={{ color: "var(--steel-soft)" }}>—</span>
                            ) : (
                              adminBrokerCommissions.filter(bc => bc.deal_id === d.id).map(bc => (
                                <div key={bc.id} style={{ marginBottom: 4 }}>
                                  {adminCompanies.find(c => c.id === bc.broker_company_id)?.company_name || "Broker"} ({bc.role === "seller_side" ? "seller-side" : "buyer-side"}) —{" "}
                                  <strong>{bc.commission_amount != null ? fmtMoney(bc.commission_amount) : "pending"}</strong>
                                  <span className={`gnt-badge ${bc.commission_status === "paid" ? "approved" : bc.commission_status === "payable" ? "selling" : "pending"}`} style={{ marginLeft: 6 }}>{bc.commission_status}</span>
                                </div>
                              ))
                            )}
                          </td>
                          <td>{fmtDate(d.created_at)}</td>
                        </tr>
                      ))}
                      {adminDeals.filter(d => showCancelledDeals || d.status !== "cancelled").length === 0 && <tr><td colSpan={8}><div className="gnt-empty">No matched deals yet.</div></td></tr>}
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
                        <td style={{ fontSize: 11.5 }}>
                          {r.referred_type === "buyer" ? (
                            <span className="mono" style={{ color: "var(--steel-soft)" }}>CIPC {r.referred_cipc}</span>
                          ) : (
                            <div style={{ width: 160 }}>
                              {r.wholesale_license_path ? (
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => viewReferralLicense(r)}>View license copy</button>
                              ) : (
                                <span style={{ color: "var(--alert)" }}>No license uploaded</span>
                              )}
                              <p style={{ fontSize: 10, color: "var(--steel-soft)", marginTop: 4 }}>Seller enters their own CIPC/DMRE numbers when they complete registration.</p>
                            </div>
                          )}
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
                          ) : r.is_co_broker_referral ? (
                            <>
                              <span className={`gnt-badge ${r.co_broker_status === "claimed" ? "approved" : r.co_broker_status === "declined" ? "rejected" : "pending"}`}>
                                {r.co_broker_status === "claimed" ? "Claimed by upstream broker" : r.co_broker_status === "declined" ? "Upstream broker declined" : "Awaiting upstream broker"}
                              </span>
                              <p style={{ fontSize: 10.5, color: "var(--steel-soft)", margin: "4px 0" }}>{r.co_broker_upstream_name} ({r.co_broker_upstream_email})</p>
                              {r.co_broker_status === "declined" && r.co_broker_decline_reason && (
                                <p style={{ fontSize: 10.5, color: "var(--alert)", margin: "4px 0" }}>Reason: {r.co_broker_decline_reason}</p>
                              )}
                              {r.co_broker_status === "pending" && (
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => resendCoBrokerClaim(r)}>Resend confirmation email</button>
                              )}
                            </>
                          ) : r.referred_type === "seller" && r.seller_confirm_status !== "approved" ? (
                            <>
                              <span className={`gnt-badge ${r.seller_confirm_status === "rejected" ? "rejected" : "pending"}`}>
                                {r.seller_confirm_status === "rejected" ? "Seller rejected these terms" : "Awaiting seller confirmation"}
                              </span>
                              {r.seller_confirm_status === "rejected" && r.seller_confirm_reason && (
                                <p style={{ fontSize: 10.5, color: "var(--alert)", margin: "4px 0" }}>Reason: {r.seller_confirm_reason}</p>
                              )}
                              <p style={{ fontSize: 10.5, color: "var(--steel-soft)", margin: "4px 0" }}>Not on the Market Board yet — seller must approve the price and commission first.</p>
                              {r.seller_confirm_status !== "rejected" && (
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => resendReferralConfirm(r)}>Resend confirmation email</button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className={`gnt-badge ${r.invite_status === "accepted" ? "approved" : "pending"}`}>
                                {r.invite_status === "accepted" ? "Registration completed" : "Live — awaiting counterparty"}
                              </span>
                              <p style={{ fontSize: 10.5, color: "var(--steel-soft)", margin: "4px 0" }}>Listing is already on the Market Board. They'll be emailed to complete registration once a real counterparty accepts.</p>
                              {r.invite_status !== "accepted" && (
                                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => resendReferralInvite(r)}>Send registration link now</button>
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
        <div className="gnt-modal-backdrop" onClick={() => { setDetailCompany(null); setShowAdminEditCompany(false); }}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h3 style={{ fontSize: 24 }}>{detailCompany.company_name}</h3><p style={{ fontSize: 12.5, color: "var(--steel-soft)", textTransform: "uppercase" }}>{detailCompany.type}</p></div>
              <div style={{ textAlign: "right" }}>
                <span className={`gnt-badge ${detailCompany.status}`}>{detailCompany.status}</span>
                {detailCompany.account_status && detailCompany.account_status !== "active" && (
                  <div style={{ marginTop: 6 }}>
                    <span className="gnt-badge rejected">{detailCompany.account_status.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>
            </div>
            {detailCompany.account_status && detailCompany.account_status !== "active" && (
              <div className="gnt-alert-banner" style={{ marginTop: 12 }}>
                <AlertTriangle size={16} />
                <div>
                  <strong style={{ display: "block" }}>{detailCompany.account_status === "withdrawal_requested" ? "Withdrawal requested" : detailCompany.account_status === "withdrawn" ? "Withdrawn" : "Listings paused"} on {fmtDate(detailCompany.deactivation_requested_at)}</strong>
                  {detailCompany.deactivation_reason && <span>Reason: {detailCompany.deactivation_reason}</span>}
                  {detailCompany.withdrawal_flagged && <span style={{ display: "block", color: "var(--alert)", fontWeight: 600, marginTop: 4 }}>⚠ Flagged: broker-referred company with recent deal activity — worth a closer look before processing.</span>}
                </div>
              </div>
            )}
            {detailCompany.account_status === "withdrawal_requested" && (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => processWithdrawal(detailCompany.id, true)}>Approve withdrawal</button>
                <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => processWithdrawal(detailCompany.id, false)}>Reactivate account instead</button>
              </div>
            )}
            {detailCompany.account_status === "withdrawn" && (
              <div style={{ marginTop: 12 }}>
                <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => processWithdrawal(detailCompany.id, false)}>Reactivate account</button>
              </div>
            )}
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
                {detailCompany.ncnda_source === "custom" && (
                  <div style={{ marginTop: 6 }}>
                    <span className={`gnt-badge ${detailCompany.custom_ncnda_status === "approved" ? "approved" : detailCompany.custom_ncnda_status === "rejected" ? "rejected" : "pending"}`}>
                      Custom NCNDA — {detailCompany.custom_ncnda_status}
                    </span>
                    {detailDocuments.filter(d => d.doc_type === "custom_ncnda").map(d => (
                      <button key={d.id} className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginLeft: 8 }} onClick={() => viewCompanyDoc(d)}>View document</button>
                    ))}
                    {detailCompany.custom_ncnda_status === "pending" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button className="gnt-btn gnt-btn-amber gnt-btn-sm" onClick={() => reviewCustomNcnda(detailCompany, true)}>Approve custom NCNDA</button>
                        <button className="gnt-btn gnt-btn-danger gnt-btn-sm" onClick={() => reviewCustomNcnda(detailCompany, false)}>Reject</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {detailCompany.type === "seller" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="dt">IMFPA</div>
                  <div className="dd" style={{ fontFamily: "Inter" }}>{detailCompany.imfpa_signed ? `Signed by ${detailCompany.imfpa_signed_by}` : "Not yet signed"}</div>
                </div>
              )}
              {detailCompany.ownership_capacity && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="dt">Ownership / capacity</div>
                  <div className="dd" style={{ fontFamily: "Inter" }}>{OWNERSHIP_LABELS[detailCompany.ownership_capacity] || detailCompany.ownership_capacity}</div>
                </div>
              )}
              {(detailCompany.trade_ref_1_company || detailCompany.trade_ref_2_company) && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="dt">Trade references</div>
                  <div className="dd" style={{ fontFamily: "Inter" }}>
                    {detailCompany.trade_ref_1_company && <div>{detailCompany.trade_ref_1_company} — {detailCompany.trade_ref_1_contact}</div>}
                    {detailCompany.trade_ref_2_company && <div>{detailCompany.trade_ref_2_company} — {detailCompany.trade_ref_2_contact}</div>}
                  </div>
                </div>
              )}
            </div>

            {detailDocuments.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="dt" style={{ marginBottom: 6 }}>Uploaded documents</div>
                {detailDocuments.map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                    <span>{d.file_name} <span style={{ color: "var(--steel-soft)", fontSize: 11 }}>({d.doc_type === "mandate_proof" ? "Mandate proof" : d.doc_type === "tank_report" ? "Tank report / POP" : d.doc_type === "cis_kyc" ? "CIS / KYC" : d.doc_type === "wholesale_license" ? "Wholesale license copy" : "Past performance"})</span></span>
                    <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => viewCompanyDoc(d)}>View</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className={`gnt-btn gnt-btn-sm ${detailCompany.past_performance_verified ? "gnt-btn-ghost" : "gnt-btn-amber"}`} onClick={() => togglePastPerformanceVerified(detailCompany)}>
                {detailCompany.past_performance_verified ? "Revoke Past Performance badge" : "Grant Past Performance badge"}
              </button>
              {detailCompany.type === "seller" && detailCompany.ownership_capacity === "mandate_holder" && (
                <button className={`gnt-btn gnt-btn-sm ${detailCompany.mandate_verified ? "gnt-btn-ghost" : "gnt-btn-amber"}`} onClick={() => toggleMandateVerified(detailCompany)}>
                  {detailCompany.mandate_verified ? "Revoke Mandate Verified badge" : "Grant Mandate Verified badge"}
                </button>
              )}
              {detailCompany.type === "seller" && detailCompany.ownership_capacity === "title_holder" && (
                <button className={`gnt-btn gnt-btn-sm ${detailCompany.product_verified ? "gnt-btn-ghost" : "gnt-btn-amber"}`} onClick={() => toggleProductVerified(detailCompany)}>
                  {detailCompany.product_verified ? "Revoke Product Verified badge" : "Grant Product Verified badge"}
                </button>
              )}
              <button className="gnt-btn gnt-btn-ghost gnt-btn-sm" onClick={() => showAdminEditCompany ? setShowAdminEditCompany(false) : startAdminEditCompany(detailCompany)}>
                {showAdminEditCompany ? "Cancel edit" : "Edit company name / CIPC / DMRE / address"}
              </button>
            </div>

            {showAdminEditCompany && (
              <form onSubmit={e => submitAdminEditCompany(e, detailCompany)} style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <div className="gnt-field"><label>Company name</label><input value={adminEditForm.companyName} onChange={e => setAdminEditForm(f => ({ ...f, companyName: e.target.value }))} /></div>
                <div className="gnt-grid2">
                  <div className="gnt-field"><label>CIPC registration number</label><input className="mono" value={adminEditForm.cipc} onChange={e => setAdminEditForm(f => ({ ...f, cipc: e.target.value }))} /></div>
                  {detailCompany.type === "seller" && (
                    <div className="gnt-field"><label>DMRE wholesale license no.</label><input className="mono" value={adminEditForm.dmreLicense} onChange={e => setAdminEditForm(f => ({ ...f, dmreLicense: e.target.value }))} /></div>
                  )}
                </div>
                <div className="gnt-field"><label>Address</label><textarea rows={2} value={adminEditForm.address} onChange={e => setAdminEditForm(f => ({ ...f, address: e.target.value }))} /></div>
                <button className="gnt-btn gnt-btn-amber gnt-btn-sm" type="submit" disabled={adminEditSaving}>{adminEditSaving ? "Saving…" : "Save"}</button>
              </form>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {detailCompany.status !== "approved" && (
                <button className="gnt-btn gnt-btn-amber" disabled={!detailCompany.ncnda_signed} onClick={() => setCompanyStatus(detailCompany, "approved")}>
                  <BadgeCheck size={15} /> Approve
                </button>
              )}
              {detailCompany.status !== "rejected" && (
                <button className="gnt-btn gnt-btn-danger" onClick={() => setCompanyStatus(detailCompany, "rejected")}><XCircle size={15} /> Reject</button>
              )}
              <button className="gnt-btn gnt-btn-ghost" onClick={() => { setDetailCompany(null); setShowAdminEditCompany(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit seller offer modal */}
      {offerTarget && (
        <div className="gnt-modal-backdrop" onClick={() => setOfferTarget(null)}>
          <div className="gnt-modal" onClick={e => e.stopPropagation()}>
            {!session ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Sign in to submit an offer</h3>
                <p style={{ fontSize: 13, color: "var(--steel)", marginBottom: 16 }}>Log in with your seller account to submit an offer — you'll land on your Dashboard. New here? Register as a seller instead.</p>
                <LoginGate
                  onLoggedIn={() => { setOfferTarget(null); goto("dashboard"); }}
                  onRegisterClick={() => { setOfferTarget(null); resetRegFlow(); }}
                />
              </>
            ) : myCompany?.type !== "seller" ? (
              <>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Sellers only</h3>
                <p style={{ fontSize: 13, color: "var(--steel)", marginBottom: 16 }}>Only an approved seller account can submit an offer on this listing. {myCompany ? "Your account is registered as a " + myCompany.type + "." : ""}</p>
                <button className="gnt-btn gnt-btn-ghost" onClick={() => setOfferTarget(null)}>Close</button>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 20, marginBottom: 6 }}>Submit your offer</h3>
                <p style={{ fontSize: 13, color: "var(--steel-soft)", marginBottom: 14 }}>{offerTarget.product} · {Number(offerTarget.volume).toLocaleString()} ℓ · {fmtTerms(offerTarget.terms)} · {offerTarget.location}</p>
                {offerTarget.procedures && Object.keys(offerTarget.procedures).length > 0 && (
                  <div className="gnt-card" style={{ marginBottom: 14, fontSize: 12.5 }}>
                    <strong style={{ display: "block", marginBottom: 6 }}>Buyer's procedure</strong>
                    {Object.entries(offerTarget.procedures).map(([term, proc]) => (
                      <p key={term} style={{ margin: "4px 0" }}><strong>{term}:</strong> {proc}</p>
                    ))}
                  </div>
                )}
                {offerError && <div className="gnt-alert-banner"><AlertTriangle size={16} /> {offerError}</div>}
                <div className="gnt-field"><label>Your offer (R / litre)</label><input type="number" min="0" step="0.01" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} placeholder="21.45" /></div>
                <p className="hint" style={{ marginBottom: 12 }}>The buyer can accept or counter (up to 2 rounds each). If not accepted after that, the negotiation falls through.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="gnt-btn gnt-btn-amber" disabled={offerSubmitting} onClick={submitSellerOffer}>{offerSubmitting ? "Submitting…" : "Submit offer"}</button>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setOfferTarget(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(() => { return null; })() /* keep old block below removed */}

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
                {acceptTarget.ncnda_source === "custom" && (
                  <div className="gnt-card" style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, marginBottom: 6 }}>This listing owner uses their own NCNDA</h4>
                    <p style={{ fontSize: 12.5, color: "var(--steel-soft)", marginBottom: 10 }}>You'll need to review and agree to it before accepting this price — it governs this specific counterparty relationship.</p>
                    {customNcndaLoading ? (
                      <p style={{ fontSize: 13 }}>Loading document…</p>
                    ) : customNcndaUrl ? (
                      <a href={customNcndaUrl} target="_blank" rel="noreferrer" className="gnt-btn gnt-btn-ghost gnt-btn-sm" style={{ marginBottom: 12, display: "inline-flex" }}>View their NCNDA <ChevronRight size={13} /></a>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--alert)" }}>Could not load their NCNDA document. Please try again or contact admin.</p>
                    )}
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={customNcndaAgree} onChange={e => setCustomNcndaAgree(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>I have read and agree to be bound by the listing owner's NCNDA above.</span>
                    </label>
                    <div className="gnt-field"><label>Type your full legal name to sign</label><input value={customNcndaAckName} onChange={e => setCustomNcndaAckName(e.target.value)} placeholder="Full name of signatory" /></div>
                  </div>
                )}
                {myCompany?.type === "buyer" && (
                  <div className="gnt-card" style={{ marginBottom: 16 }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={bolRequested} onChange={e => setBolRequested(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>Request BOL terms for the first load (payment after loading rather than before) — optional, non-binding. The seller may accept or decline directly with you.</span>
                    </label>
                    {bolRequested && (
                      <div className="gnt-field" style={{ marginTop: 10 }}>
                        <label>Note to seller (optional)</label>
                        <textarea rows={2} value={bolNote} onChange={e => setBolNote(e.target.value)} placeholder="e.g. First time trading together — happy to provide references." />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="gnt-btn gnt-btn-amber"
                    disabled={acceptTarget.ncnda_source === "custom" && (!customNcndaAgree || customNcndaAckName.trim().length < 3)}
                    onClick={() => setAcceptStep(2)}
                  >Accept procedure <ChevronRight size={15} /></button>
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
              revealedInfo.reason === "seller_pending" ? (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 10 }}><Lock size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Waiting for seller confirmation</h3>
                  <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}>Your acceptance has been recorded and the seller has been notified to complete their registration and sign the IMFPA. You'll be able to see their contact details here, and by email, as soon as they confirm.</p>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setRevealedInfo(null)}>Close</button>
                </>
              ) : revealedInfo.reason === "buyer_pending" ? (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 10 }}><Lock size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Waiting for buyer confirmation</h3>
                  <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}>Your acceptance has been recorded. This buyer was introduced by a broker and has been notified to complete their own registration. You'll be able to see their contact details here, and by email, once they confirm.</p>
                  <button className="gnt-btn gnt-btn-ghost" onClick={() => setRevealedInfo(null)}>Close</button>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 22, marginBottom: 10 }}><Lock size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Details pending IMFPA</h3>
                  <p style={{ fontSize: 13.5, color: "var(--steel)", marginBottom: 16 }}>Your deal has been recorded and Tankbridge admin has been notified. This buyer's contact details will be released once you sign the IMFPA on your Dashboard (and once the buyer has completed their own registration, if they were introduced by a broker).</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="gnt-btn gnt-btn-ink" onClick={() => { setRevealedInfo(null); goto("dashboard"); }}>Go sign IMFPA</button>
                    <button className="gnt-btn gnt-btn-ghost" onClick={() => setRevealedInfo(null)}>Close</button>
                  </div>
                </>
              )
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
          <span>TANKBRIDGE — Bulk Diesel Exchange</span>
          <span>{boardListings.length} live listings</span>
        </div>
      </div>
    </div>
  );
}
