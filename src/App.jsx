// ─────────────────────────────────────────────────────────────────────────────
// MyGlue Label System — Niimbot B1 Direct Print Edition
// Synk Inc. / MyGlue Industries
// src/App.jsx — paste this entire file into GitHub
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// These read from Vercel Environment Variables — set them in Vercel dashboard
const SHEET_ID   = import.meta.env.VITE_SHEET_ID;
const API_KEY    = import.meta.env.VITE_API_KEY;
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS;

// ─── NIIMBOT B1 SPECS ────────────────────────────────────────────────────────
const LABEL_W = 384;
const LABEL_H = 240;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");
function todayStr() {
  const d = new Date();
  return `${pad2(d.getDate())}${pad2(d.getMonth()+1)}${String(d.getFullYear()).slice(2)}`;
}
function fmtDate(d = new Date()) {
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtTs() { return new Date().toLocaleString("en-IN"); }

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const DEMO_SKUS = [
  { id:"SKU001", name:"Adhesive Tape",       variant:"Transparent", mrp:"450.00", desc1:"40mtr", desc2:"48mm",  barcode:"8906100900101", active:true },
  { id:"SKU002", name:"Adhesive Tape",       variant:"Brown",       mrp:"420.00", desc1:"40mtr", desc2:"48mm",  barcode:"8906100900102", active:true },
  { id:"SKU003", name:"Industrial Adhesive", variant:"",            mrp:"150.00", desc1:"100ml", desc2:"",      barcode:"8906100900103", active:true },
  { id:"SKU004", name:"Epoxy Resin",         variant:"2-Part",      mrp:"220.00", desc1:"250g",  desc2:"",      barcode:"8906100900104", active:true },
  { id:"SKU005", name:"Foam Fix",            variant:"",            mrp:"95.00",  desc1:"200g",  desc2:"",      barcode:"8906100900105", active:true },
];
const DEMO_EMPS = [
  { id:"E001", name:"Ravi Kumar",   pin:"1234", active:true },
  { id:"E002", name:"Sunil Sharma", pin:"5678", active:true },
];
let DEMO_LOGS     = [];
let DEMO_COUNTERS = {};

// ─────────────────────────────────────────────────────────────────────────────
// LABEL CANVAS RENDERER — 384×240 B&W for Niimbot B1
// Matches your sticker layout: black header | specs row | logo+barcode | MRP panel
// Black pixel area kept under 45% to avoid B1 print refusal bug
// ─────────────────────────────────────────────────────────────────────────────
function renderLabel(sku, batchNo, mfgDate) {
  const cv  = document.createElement("canvas");
  cv.width  = LABEL_W;
  cv.height = LABEL_H;
  const c   = cv.getContext("2d");
  const divX = Math.floor(LABEL_W * 0.72); // left/right panel split at 72%

  // White background
  c.fillStyle = "#fff";
  c.fillRect(0, 0, LABEL_W, LABEL_H);

  // ── LEFT PANEL ─────────────────────────────────────────────────
  // Zone A — black header (product name + variant)
  c.fillStyle = "#000";
  c.fillRect(0, 0, divX, 34);

  c.fillStyle = "#fff";
  c.font = "bold 13px Arial";
  c.textAlign = "left";
  const nameWords = sku.name.toUpperCase().split(" ");
  let nameLine = "", ny = 14, nlh = 13;
  for (const w of nameWords) {
    const test = nameLine ? `${nameLine} ${w}` : w;
    if (c.measureText(test).width > divX - 16 && nameLine) {
      c.fillText(nameLine, 8, ny); ny += nlh; nameLine = w;
    } else { nameLine = test; }
  }
  c.fillText(nameLine, 8, ny);

  if (sku.variant && sku.variant.trim() !== "") {
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.font = "10px Arial";
    c.fillText(sku.variant, 8, 29);
  }

  // Zone B — specs row (desc1, desc2, batch, date)
  c.fillStyle = "#fff";
  c.fillRect(0, 34, divX, 22);
  c.fillStyle = "#ccc";
  c.fillRect(0, 55, divX, 1);

  c.fillStyle = "#000";
  c.font = "bold 9px Arial";
  c.textAlign = "left";
  let specX = 8;
  if (sku.desc1) {
    c.fillText(sku.desc1, specX, 48);
    specX += c.measureText(sku.desc1).width + 8;
    if (sku.desc2 && sku.desc2.trim() !== "") {
      c.fillStyle = "#aaa";
      c.fillRect(specX, 38, 1, 14);
      specX += 6;
      c.fillStyle = "#000";
      c.fillText(sku.desc2, specX, 48);
      specX += c.measureText(sku.desc2).width + 8;
    }
  }
  // Batch + date right-aligned in specs row
  c.fillStyle = "#666";
  c.font = "7px Arial";
  c.textAlign = "right";
  c.fillText("Batch: " + batchNo, divX - 6, 43);
  c.fillText("Mfg: " + mfgDate, divX - 6, 53);

  // Zone C — white bottom strip: logo text + barcode
  c.fillStyle = "#fff";
  c.fillRect(0, 56, divX, LABEL_H - 56);

  // Logo text (bubble style simulation — bold with outline)
  c.font = "bold 14px Arial";
  c.textAlign = "left";
  c.strokeStyle = "#fff";
  c.lineWidth = 3;
  c.strokeText("MY'GLUE\u00AE", 8, 84);
  c.fillStyle = "#000";
  c.fillText("MY'GLUE\u00AE", 8, 84);

  c.fillStyle = "#555";
  c.font = "bold 7px Arial";
  c.fillText("100% Genuine", 8, 95);

  // Barcode bars
  if (sku.barcode) {
    const bars = [2,1,3,1,2,2,1,3,1,2,1,1,3,2,1,2,3,1,1,2,1,3,2,1,3,1,2];
    let bx = 8;
    const barY = 100, barH = 22;
    bars.forEach((w, i) => {
      if (i % 2 === 0) {
        c.fillStyle = "#000";
        c.fillRect(bx, barY, w * 1.4, barH);
      }
      bx += w * 1.4;
    });
    c.fillStyle = "#000";
    c.font = "6px monospace";
    c.textAlign = "left";
    c.fillText(sku.barcode, 8, barY + barH + 7);
  }

  // ── VERTICAL DIVIDER ───────────────────────────────────────────
  c.fillStyle = "#000";
  c.fillRect(divX, 0, 2, LABEL_H);

  // ── RIGHT PANEL — MRP ──────────────────────────────────────────
  // Diagonal hatch background (replaces yellow)
  c.fillStyle = "#fff";
  c.fillRect(divX + 2, 0, LABEL_W - divX - 2, LABEL_H);
  c.strokeStyle = "#e8e8e8";
  c.lineWidth = 1;
  for (let hx = divX; hx < LABEL_W + LABEL_H; hx += 8) {
    c.beginPath();
    c.moveTo(hx, 0);
    c.lineTo(hx - LABEL_H, LABEL_H);
    c.stroke();
  }

  // MRP box
  const mrpX = divX + 4;
  const mrpW = LABEL_W - divX - 8;
  const mrpBoxY = 14;
  const mrpBoxH = LABEL_H - 40;
  c.fillStyle = "#fff";
  c.fillRect(mrpX, mrpBoxY, mrpW, mrpBoxH);
  c.strokeStyle = "#000";
  c.lineWidth = 1.5;
  c.strokeRect(mrpX, mrpBoxY, mrpW, mrpBoxH);

  // MRP label
  c.fillStyle = "#888";
  c.font = "7px Arial";
  c.textAlign = "center";
  c.fillText("MRP", mrpX + mrpW / 2, mrpBoxY + 12);
  c.fillText("(Incl. taxes)", mrpX + mrpW / 2, mrpBoxY + 21);

  // ₹ symbol
  c.fillStyle = "#000";
  c.font = "bold 14px Arial";
  c.textAlign = "left";
  c.fillText("\u20B9", mrpX + 4, mrpBoxY + 50);

  // Price number — large
  const mrp = sku.mrp || "0.00";
  const priceFontSize = mrp.length > 5 ? 20 : mrp.length > 4 ? 24 : 28;
  c.font = `bold ${priceFontSize}px Arial`;
  c.textAlign = "center";
  c.fillText(mrp, mrpX + mrpW / 2 + 4, mrpBoxY + 60);

  // Outer border
  c.strokeStyle = "#000";
  c.lineWidth = 1.5;
  c.strokeRect(1, 1, LABEL_W - 2, LABEL_H - 2);

  return cv;
}

// ─────────────────────────────────────────────────────────────────────────────
// NIIMBOT B1 BLUETOOTH ENGINE
// ─────────────────────────────────────────────────────────────────────────────
let libLoaded = false, libLoading = false;
const libQ = [];

function loadLib(cb) {
  if (libLoaded) { cb(null); return; }
  libQ.push(cb);
  if (libLoading) return;
  libLoading = true;
  const s = document.createElement("script");
  s.src = "https://unpkg.com/@mmote/niimbluelib@0.8.2/dist/umd/niimbluelib.min.js";
  s.onload  = () => { libLoaded = true; libQ.forEach(f => f(null)); };
  s.onerror = () => { libQ.forEach(f => f(new Error("Failed to load print library."))); };
  document.head.appendChild(s);
}

let bleClient = null;

async function connectPrinter(onStatus) {
  await new Promise((res, rej) => loadLib(e => e ? rej(e) : res()));
  if (!navigator.bluetooth) throw new Error("Web Bluetooth not available. Open in Chrome on Android.");
  const lib = window.niimbluelib;
  if (!lib) throw new Error("Print library not loaded.");
  if (bleClient && bleClient.isConnected()) { onStatus("Printer already connected \u2713"); return bleClient; }
  onStatus("Searching for B1 printer\u2026");
  const client = new lib.NiimbotBluetoothClient();
  await client.connect();
  onStatus("Negotiating with printer\u2026");
  await client.initialNegotiate();
  bleClient = client;
  onStatus("Printer ready \u2713");
  return client;
}

async function doPrint(sku, batchNo, mfgDate, quantity, onStatus) {
  const lib    = window.niimbluelib;
  onStatus("Rendering label\u2026");
  const canvas  = renderLabel(sku, batchNo, mfgDate);
  const ctx     = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, LABEL_W, LABEL_H);
  onStatus("Encoding for B1\u2026");
  const encoder = new lib.ImageEncoder(imgData, lib.PrintDirection.Left);
  const rows    = encoder.encode();
  onStatus(`Sending ${quantity} label(s) to printer\u2026`);
  const task = new lib.PrintTask(bleClient, {
    labelType: 1, labelCount: quantity, density: 3,
    printRows: rows, width: LABEL_W, height: LABEL_H,
    printTaskVersion: lib.PrintTaskVersion.B1,
  });
  await task.print();
  onStatus(`\u2713 ${quantity} label${quantity > 1 ? "s" : ""} sent to printer`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SHEETS
// ─────────────────────────────────────────────────────────────────────────────
async function sheetsPost(payload) {
  try { await fetch(SCRIPT_URL, { method:"POST", body: JSON.stringify(payload) }); }
  catch(e) { console.warn("Sheet write failed:", e); }
}

async function sheetsGet(range) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
    const res = await fetch(url);
    const d   = await res.json();
    return d.values || [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL PREVIEW — React component matching canvas output
// ─────────────────────────────────────────────────────────────────────────────
function LabelPreview({ sku, batchNo, qty, mfgDate }) {
  const W = 300;
  const hasDesc2   = (sku?.desc2 || "").trim() !== "";
  const hasVariant = (sku?.variant || "").trim() !== "";
  const mrpLen     = (sku?.mrp || "").length;
  const mrpSize    = mrpLen > 5 ? 20 : mrpLen > 4 ? 24 : 28;
  const bars       = [2,1,3,1,2,2,1,3,1,2,1,1,3,2,1,2,3,1,1,2,1,3,2,1,3,1,2];

  return (
    <div style={{
      width: W, background:"#fff", border:"2px solid #000",
      borderRadius:3, overflow:"hidden", boxShadow:"3px 3px 0 #000",
      fontFamily:"Arial,Helvetica,sans-serif", position:"relative", flexShrink:0,
    }}>
      <div style={{ display:"flex", alignItems:"stretch" }}>

        {/* LEFT PANEL */}
        <div style={{ flex:"0 0 72%", borderRight:"2px solid #000", display:"flex", flexDirection:"column" }}>

          {/* Zone A — black header */}
          <div style={{ background:"#000", padding:"5px 8px 4px" }}>
            <div style={{ color:"#fff", fontSize:11, fontWeight:900, lineHeight:1.2, textTransform:"uppercase" }}>
              {sku?.name || "Product Name"}
            </div>
            {hasVariant && <div style={{ color:"rgba(255,255,255,0.65)", fontSize:9, marginTop:1 }}>{sku.variant}</div>}
          </div>

          {/* Zone B — specs row */}
          <div style={{ background:"#fff", borderBottom:"1px solid #ccc", padding:"3px 8px", display:"flex", alignItems:"center", gap:0 }}>
            {sku?.desc1 && (
              <div style={{ fontSize:8, fontWeight:700, color:"#000", paddingRight: hasDesc2 ? 6:0, borderRight: hasDesc2?"1px solid #aaa":"none" }}>
                {sku.desc1}
              </div>
            )}
            {hasDesc2 && (
              <div style={{ fontSize:8, fontWeight:700, color:"#000", paddingLeft:6, paddingRight:6, borderRight:"1px solid #aaa" }}>
                {sku.desc2}
              </div>
            )}
            <div style={{ marginLeft:"auto", textAlign:"right" }}>
              <div style={{ fontSize:6, color:"#666" }}>Batch: {batchNo || "AUTO"}</div>
              <div style={{ fontSize:6, color:"#666" }}>Mfg: {mfgDate || fmtDate()}</div>
            </div>
          </div>

          {/* Zone C — logo + barcode */}
          <div style={{ background:"#fff", padding:"5px 8px", display:"flex", alignItems:"center", justifyContent:"space-between", flex:1 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:"#000", letterSpacing:-0.5, lineHeight:1 }}>MY'GLUE&reg;</div>
              <div style={{ fontSize:6, fontWeight:700, color:"#555", marginTop:2 }}>100% Genuine</div>
              {sku?.barcode && <div style={{ fontSize:6, fontFamily:"monospace", color:"#333", marginTop:4 }}>{sku.barcode}</div>}
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", height:22, gap:0 }}>
              {bars.map((w,i)=>(
                <div key={i} style={{ width:w*1.2, height: i%4===0?22:17, background: i%2===0?"#000":"#fff", flexShrink:0 }}/>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — MRP */}
        <div style={{
          flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", padding:"6px 3px",
          background:`repeating-linear-gradient(-45deg,#fff 0px,#fff 4px,#ececec 4px,#ececec 6px)`,
        }}>
          <div style={{ background:"#fff", border:"1.5px solid #000", borderRadius:2, padding:"4px 3px", textAlign:"center", width:"100%" }}>
            <div style={{ fontSize:7, color:"#888", textTransform:"uppercase", letterSpacing:0.3 }}>MRP</div>
            <div style={{ fontSize:7, color:"#888", marginBottom:2 }}>(Incl. taxes)</div>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", lineHeight:1 }}>
              <span style={{ fontSize:12, fontWeight:900, marginTop:2, marginRight:1 }}>\u20B9</span>
              <span style={{ fontSize:mrpSize, fontWeight:900, letterSpacing:-1, fontFamily:"Arial Black,Arial,sans-serif" }}>
                {sku?.mrp || "0.00"}
              </span>
            </div>
          </div>
          {qty > 1 && (
            <div style={{ marginTop:4, background:"#000", color:"#fff", fontSize:8, fontWeight:900, padding:"1px 5px", borderRadius:2 }}>
              x{qty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  app:   { background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e8e8f0" },
  card:  { background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:12, padding:20, marginBottom:16 },
  input: { width:"100%", background:"#0f0f1a", border:"1px solid #3a3a5a", borderRadius:8, padding:"10px 14px", color:"#e8e8f0", fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  lbl:   { fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4, display:"block" },
  btn:   (bg="#f5c842", fg="#1a1a2e", x={}) => ({ background:bg, color:fg, border:"none", borderRadius:8, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", ...x }),
  tag:   a => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:a?"#1a3a1a":"#3a1a1a", color:a?"#4ade80":"#f87171" }),
  bar:   { background:"#1a1a2e", borderBottom:"1px solid #2a2a4a", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,    setScreen]    = useState("login");
  const [user,      setUser]      = useState(null);
  const [adminTab,  setAdminTab]  = useState("skus");
  const [skus,      setSkus]      = useState(DEMO_SKUS);
  const [emps,      setEmps]      = useState(DEMO_EMPS);
  const [logs,      setLogs]      = useState(DEMO_LOGS);
  const [counters,  setCounters]  = useState(DEMO_COUNTERS);
  const [lName,     setLName]     = useState("");
  const [lPin,      setLPin]      = useState("");
  const [lErr,      setLErr]      = useState("");
  const [aPass,     setAPass]     = useState("");
  const [showAdm,   setShowAdm]   = useState(false);
  const [query,     setQuery]     = useState("");
  const [selSku,    setSelSku]    = useState(null);
  const [qty,       setQty]       = useState(1);
  const [mfgDate,   setMfgDate]   = useState(fmtDate());
  const [batch,     setBatch]     = useState(null);
  const [done,      setDone]      = useState(false);
  const [status,    setStatus]    = useState("");
  const [printing,  setPrinting]  = useState(false);
  const [connected, setConnected] = useState(false);
  const [newSku,    setNewSku]    = useState({ id:"", name:"", variant:"", mrp:"", desc1:"", desc2:"", barcode:"" });
  const [csvTxt,    setCsvTxt]    = useState("");
  const [showCsv,   setShowCsv]   = useState(false);
  const [skuQ,      setSkuQ]      = useState("");
  const [newEmp,    setNewEmp]    = useState({ name:"", pin:"" });
  const [logQ,      setLogQ]      = useState("");

  function doEmpLogin() {
    setLErr("");
    const e = emps.find(e => e.name.toLowerCase() === lName.toLowerCase() && e.pin === lPin && e.active);
    if (!e) { setLErr("Name or PIN incorrect, or account deactivated."); return; }
    setUser(e); setScreen("employee"); setLName(""); setLPin("");
  }
  function doAdminLogin() {
    if (aPass === ADMIN_PASS) { setUser({ name:"Admin" }); setScreen("admin"); setAPass(""); setShowAdm(false); }
    else setLErr("Wrong admin password.");
  }
  function nextBatch(skuId) {
    const cnt = (counters[skuId] || 0) + 1;
    setCounters(p => ({ ...p, [skuId]: cnt }));
    DEMO_COUNTERS[skuId] = cnt;
    return `${todayStr()}-${String(cnt).padStart(3, "0")}`;
  }
  async function handleConnect() {
    setStatus("Connecting\u2026");
    try { await connectPrinter(setStatus); setConnected(true); }
    catch(e) { setStatus(`Error: ${e.message}`); }
  }
  async function handlePrint() {
    if (!selSku || qty < 1) return;
    const batchNo = nextBatch(selSku.id);
    setBatch(batchNo); setPrinting(true); setStatus("Starting\u2026");
    try {
      await doPrint(selSku, batchNo, mfgDate, qty, setStatus);
      const entry = { timestamp:fmtTs(), employee:user.name, skuId:selSku.id, skuName:selSku.name, batchNo, quantity:qty, mfgDate };
      const nl = [entry, ...logs];
      setLogs(nl); DEMO_LOGS = nl;
      sheetsPost({ action:"log_print", ...entry });
      setDone(true);
    } catch(e) { setStatus(`Error: ${e.message}`); }
    finally { setPrinting(false); }
  }
  function reset() {
    setSelSku(null); setQty(1); setBatch(null); setDone(false);
    setStatus(""); setQuery(""); setMfgDate(fmtDate()); setConnected(false);
  }
  function addSku() {
    if (!newSku.id || !newSku.name || !newSku.mrp || !newSku.desc1) return;
    const mrp = newSku.mrp.replace("\u20B9","").trim();
    const s = { ...newSku, mrp, active:true };
    setSkus(p => [...p, s]);
    sheetsPost({ action:"add_sku", ...s });
    setNewSku({ id:"", name:"", variant:"", mrp:"", desc1:"", desc2:"", barcode:"" });
  }
  function importCsv() {
    const rows = csvTxt.trim().split("\n").slice(1).map(l => {
      const [id, name, variant="", desc1, desc2="", mrp, barcode="", active="YES"] = l.split(",").map(x => x.trim());
      return { id, name, variant, mrp: mrp?.replace("\u20B9","").trim() || "0", desc1, desc2, barcode, active: active.toUpperCase() !== "NO" };
    }).filter(s => s.id && s.name);
    setSkus(p => [...p, ...rows]);
    setCsvTxt(""); setShowCsv(false);
  }
  function toggleSku(id) { setSkus(p => p.map(s => s.id === id ? { ...s, active:!s.active } : s)); }
  function addEmp() {
    if (!newEmp.name || newEmp.pin.length !== 4) return;
    const id = `E${String(emps.length+1).padStart(3,"0")}`;
    const e = { ...newEmp, id, active:true };
    setEmps(p => [...p, e]);
    sheetsPost({ action:"add_employee", ...e });
    setNewEmp({ name:"", pin:"" });
  }
  function toggleEmp(id) {
    const emp = emps.find(e => e.id === id);
    setEmps(p => p.map(e => e.id === id ? { ...e, active:!e.active } : e));
    sheetsPost({ action:"toggle_employee", empId:id, active:!emp.active });
  }

  const filtSkus = skus.filter(s => s.active && (s.name+s.variant).toLowerCase().includes(query.toLowerCase()));
  const admSkus  = skus.filter(s => (s.name+s.id).toLowerCase().includes(skuQ.toLowerCase()));
  const filtLogs = logs.filter(l => [l.skuName,l.employee,l.batchNo].some(v => v?.toLowerCase().includes(logQ.toLowerCase())));

  // ══ LOGIN ════════════════════════════════════════════════════════════════
  if (screen === "login") return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:11, letterSpacing:5, color:"#f5c842", textTransform:"uppercase", marginBottom:8 }}>Synk Inc.</div>
          <div style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:-1 }}>MY'GLUE&reg;</div>
          <div style={{ fontSize:13, color:"#555", marginTop:4 }}>Label Management System</div>
        </div>
        {!showAdm ? (
          <div style={S.card}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16, color:"#f5c842" }}>Employee Login</div>
            <div style={{ marginBottom:12 }}>
              <label style={S.lbl}>Full Name</label>
              <input style={S.input} placeholder="Enter your name" value={lName} onChange={e => setLName(e.target.value)} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={S.lbl}>4-Digit PIN</label>
              <input style={S.input} type="password" placeholder="&#9679;&#9679;&#9679;&#9679;" maxLength={4}
                value={lPin} onChange={e => setLPin(e.target.value)} onKeyDown={e => e.key==="Enter" && doEmpLogin()} />
            </div>
            {lErr && <div style={{ color:"#f87171", fontSize:13, marginBottom:12 }}>{lErr}</div>}
            <button style={{ ...S.btn(), width:"100%" }} onClick={doEmpLogin}>Login &rarr;</button>
            <div style={{ textAlign:"center", marginTop:16 }}>
              <span style={{ fontSize:12, color:"#444", cursor:"pointer" }} onClick={() => { setShowAdm(true); setLErr(""); }}>Admin Access</span>
            </div>
          </div>
        ) : (
          <div style={S.card}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16, color:"#f5c842" }}>Admin Login</div>
            <div style={{ marginBottom:16 }}>
              <label style={S.lbl}>Admin Password</label>
              <input style={S.input} type="password" placeholder="Password" value={aPass}
                onChange={e => setAPass(e.target.value)} onKeyDown={e => e.key==="Enter" && doAdminLogin()} />
            </div>
            {lErr && <div style={{ color:"#f87171", fontSize:13, marginBottom:12 }}>{lErr}</div>}
            <button style={{ ...S.btn(), width:"100%" }} onClick={doAdminLogin}>Enter Admin &rarr;</button>
            <div style={{ textAlign:"center", marginTop:12 }}>
              <span style={{ fontSize:12, color:"#444", cursor:"pointer" }} onClick={() => { setShowAdm(false); setLErr(""); }}>&larr; Back</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ══ EMPLOYEE ═════════════════════════════════════════════════════════════
  if (screen === "employee") return (
    <div style={{ ...S.app, paddingBottom:40 }}>
      <div style={S.bar}>
        <div>
          <div style={{ fontSize:11, color:"#f5c842", letterSpacing:2, fontWeight:700 }}>MY'GLUE&reg;</div>
          <div style={{ fontSize:12, color:"#888" }}>Hi, {user.name}</div>
        </div>
        <button style={S.btn("#2a2a4a","#aaa",{ padding:"6px 14px", fontSize:12 })}
          onClick={() => { setScreen("login"); reset(); }}>Logout</button>
      </div>
      <div style={{ padding:"20px 20px 0" }}>

        {!connected && !done && (
          <div style={{ ...S.card, border:"1px solid #f5c842" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f5c842", marginBottom:8 }}>&#128225; Connect Printer</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:14, lineHeight:1.7 }}>
              1. Switch on your Niimbot B1<br/>
              2. Tap Connect — Chrome shows Bluetooth picker<br/>
              3. Select your B1
            </div>
            <button style={{ ...S.btn(), width:"100%", padding:14, fontSize:15 }} onClick={handleConnect}>
              Connect to Niimbot B1
            </button>
            {status && <div style={{ marginTop:10, fontSize:13, color: status.startsWith("Error") ? "#f87171":"#4ade80" }}>{status}</div>}
          </div>
        )}

        {connected && !done && (<>
          <div style={{ ...S.card, background:"#1a2a1a", border:"1px solid #2a4a2a", padding:"10px 16px", marginBottom:16 }}>
            <span style={{ fontSize:12, color:"#4ade80" }}>&#10003; Printer connected &mdash; Niimbot B1 ready</span>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={S.lbl}>Search Product</label>
            <input style={S.input} placeholder="Type product name&hellip;" value={query}
              onChange={e => { setQuery(e.target.value); setSelSku(null); }} />
          </div>
          {query && !selSku && (
            <div style={{ ...S.card, padding:8, maxHeight:240, overflowY:"auto" }}>
              {filtSkus.length === 0 && <div style={{ padding:12, color:"#555", fontSize:13 }}>No products found</div>}
              {filtSkus.map(s => (
                <div key={s.id} onClick={() => { setSelSku(s); setQuery(`${s.name}${s.variant ? " \u2013 "+s.variant:""}`); }}
                  style={{ padding:"10px 12px", borderRadius:8, cursor:"pointer", borderBottom:"1px solid #2a2a4a" }}
                  onMouseEnter={e => e.currentTarget.style.background="#2a2a4a"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.name}{s.variant && <span style={{ color:"#888" }}> &mdash; {s.variant}</span>}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>&curren;{s.mrp} &middot; {s.desc1}{s.desc2 ? " &middot; "+s.desc2:""} &middot; {s.id}</div>
                </div>
              ))}
            </div>
          )}
          {selSku && (<>
            <div style={{ ...S.card, background:"#1a2a1a", border:"1px solid #2a4a2a" }}>
              <div style={{ fontSize:11, color:"#4ade80", marginBottom:3 }}>SELECTED</div>
              <div style={{ fontSize:15, fontWeight:700 }}>{selSku.name}{selSku.variant && <span style={{ color:"#888", fontWeight:400 }}> &mdash; {selSku.variant}</span>}</div>
              <div style={{ fontSize:12, color:"#555", marginTop:3 }}>{selSku.mrp} &middot; {selSku.desc1}{selSku.desc2 ? " &middot; "+selSku.desc2:""}</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.lbl}>Mfg. Date</label>
              <input style={S.input} value={mfgDate} onChange={e => setMfgDate(e.target.value)} />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={S.lbl}>Quantity to Print</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <button style={S.btn("#2a2a4a","#fff",{ padding:"8px 20px", fontSize:22 })} onClick={() => setQty(q => Math.max(1,q-1))}>&#8722;</button>
                <input style={{ ...S.input, textAlign:"center", fontSize:26, fontWeight:900, width:90 }}
                  type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value)||1))} />
                <button style={S.btn("#2a2a4a","#fff",{ padding:"8px 20px", fontSize:22 })} onClick={() => setQty(q => q+1)}>&#43;</button>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:20, overflowX:"auto" }}>
              <LabelPreview sku={selSku} batchNo="AUTO" qty={qty} mfgDate={mfgDate} />
            </div>
            <button style={S.btn(printing?"#2a2a4a":"#f5c842", printing?"#555":"#1a1a2e", { width:"100%", padding:16, fontSize:16 })}
              onClick={handlePrint} disabled={printing}>
              {printing ? "Printing\u2026" : `&#128424; Print ${qty} Label${qty>1?"s":""}`}
            </button>
            {status && <div style={{ marginTop:12, fontSize:13, textAlign:"center", color: status.startsWith("Error")?"#f87171":"#4ade80" }}>{status}</div>}
          </>)}
        </>)}

        {done && (<>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:44, marginBottom:8 }}>&#9989;</div>
            <div style={{ fontSize:24, fontWeight:900, color:"#f5c842" }}>{batch}</div>
            <div style={{ fontSize:13, color:"#4ade80", marginTop:4 }}>{qty} label{qty>1?"s":""} printed</div>
          </div>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20, overflowX:"auto" }}>
            <LabelPreview sku={selSku} batchNo={batch} qty={qty} mfgDate={mfgDate} />
          </div>
          <button style={{ ...S.btn(), width:"100%", padding:14, fontSize:15 }} onClick={reset}>Print Another Label</button>
        </>)}
      </div>
    </div>
  );

  // ══ ADMIN ════════════════════════════════════════════════════════════════
  if (screen === "admin") return (
    <div style={{ ...S.app, paddingBottom:40 }}>
      <div style={S.bar}>
        <div>
          <div style={{ fontSize:11, color:"#f5c842", letterSpacing:2, fontWeight:700 }}>MY'GLUE&reg; ADMIN</div>
          <div style={{ fontSize:12, color:"#888" }}>Label Management System</div>
        </div>
        <button style={S.btn("#2a2a4a","#aaa",{ padding:"6px 14px", fontSize:12 })} onClick={() => setScreen("login")}>Logout</button>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #2a2a4a", background:"#1a1a2e" }}>
        {[["skus","Products"],["employees","Employees"],["logs","Print Logs"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setAdminTab(id)} style={{
            flex:1, padding:"12px 0", background:"none", border:"none",
            color: adminTab===id?"#f5c842":"#555", fontWeight: adminTab===id?700:400,
            fontSize:13, cursor:"pointer", fontFamily:"inherit",
            borderBottom: adminTab===id?"2px solid #f5c842":"2px solid transparent",
          }}>{lbl}</button>
        ))}
      </div>
      <div style={{ padding:20 }}>

        {adminTab === "skus" && (<>
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            <input style={{ ...S.input, flex:1 }} placeholder="Search products&hellip;" value={skuQ} onChange={e => setSkuQ(e.target.value)} />
            <button style={S.btn("#2a2a4a","#f5c842",{ whiteSpace:"nowrap" })} onClick={() => setShowCsv(!showCsv)}>CSV Import</button>
          </div>
          {showCsv && (
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f5c842", marginBottom:8 }}>Bulk CSV Import</div>
              <div style={{ fontSize:12, color:"#555", marginBottom:8 }}>
                Format: SKU_ID, Name, Variant, MRP, Desc1, Desc2, Barcode &mdash; first row is header and will be skipped
              </div>
              <div style={{ ...S.card, background:"#0f0f1a", padding:10, marginBottom:8, fontSize:11, color:"#444", fontFamily:"monospace" }}>
                SKU_ID,Name,Variant,MRP,Desc1,Desc2,Barcode<br/>
                SKU001,Adhesive Tape,Transparent,450.00,40mtr,48mm,8906100900101
              </div>
              <textarea style={{ ...S.input, minHeight:100, resize:"vertical", marginBottom:10 }}
                placeholder="Paste CSV here&hellip;" value={csvTxt} onChange={e => setCsvTxt(e.target.value)} />
              <div style={{ display:"flex", gap:10 }}>
                <button style={S.btn()} onClick={importCsv}>Import</button>
                <button style={S.btn("#2a2a4a","#aaa")} onClick={() => setShowCsv(false)}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f5c842", marginBottom:12 }}>Add New Product</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={S.lbl}>SKU ID</label><input style={S.input} placeholder="SKU006" value={newSku.id} onChange={e => setNewSku(p=>({...p,id:e.target.value}))} /></div>
              <div><label style={S.lbl}>MRP</label><input style={S.input} placeholder="450.00" value={newSku.mrp} onChange={e => setNewSku(p=>({...p,mrp:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:10 }}><label style={S.lbl}>Product Name</label><input style={S.input} placeholder="Adhesive Tape" value={newSku.name} onChange={e => setNewSku(p=>({...p,name:e.target.value}))} /></div>
            <div style={{ marginBottom:10 }}><label style={S.lbl}>Variant (optional)</label><input style={S.input} placeholder="Transparent" value={newSku.variant} onChange={e => setNewSku(p=>({...p,variant:e.target.value}))} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={S.lbl}>Size / Desc 1</label><input style={S.input} placeholder="40mtr" value={newSku.desc1} onChange={e => setNewSku(p=>({...p,desc1:e.target.value}))} /></div>
              <div><label style={S.lbl}>Size / Desc 2 (optional)</label><input style={S.input} placeholder="48mm" value={newSku.desc2} onChange={e => setNewSku(p=>({...p,desc2:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:12 }}><label style={S.lbl}>Barcode (EAN-13)</label><input style={S.input} placeholder="8906100900101" value={newSku.barcode} onChange={e => setNewSku(p=>({...p,barcode:e.target.value}))} /></div>
            <button style={S.btn()} onClick={addSku}>Add Product</button>
          </div>
          <div style={{ fontSize:11, color:"#444", marginBottom:10 }}>{admSkus.length} products &middot; {skus.filter(s=>s.active).length} active</div>
          {admSkus.map(s => (
            <div key={s.id} style={{ ...S.card, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{s.name}{s.variant && <span style={{ color:"#888", fontWeight:400 }}> &mdash; {s.variant}</span>}</div>
                <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{s.id} &middot; {s.mrp} &middot; {s.desc1}{s.desc2?" &middot; "+s.desc2:""}</div>
                <div style={{ marginTop:4 }}>
                  <span style={S.tag(s.active)}>{s.active?"Active":"Inactive"}</span>
                  {counters[s.id] && <span style={{ fontSize:11, color:"#333", marginLeft:8 }}>{counters[s.id]} batches</span>}
                </div>
              </div>
              <button onClick={() => toggleSku(s.id)} style={S.btn(s.active?"#3a1a1a":"#1a3a1a",s.active?"#f87171":"#4ade80",{ padding:"6px 12px", fontSize:12 })}>
                {s.active?"Deactivate":"Activate"}
              </button>
            </div>
          ))}
        </>)}

        {adminTab === "employees" && (<>
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f5c842", marginBottom:12 }}>Add Employee</div>
            <div style={{ marginBottom:10 }}><label style={S.lbl}>Full Name</label><input style={S.input} placeholder="Employee name" value={newEmp.name} onChange={e => setNewEmp(p=>({...p,name:e.target.value}))} /></div>
            <div style={{ marginBottom:12 }}><label style={S.lbl}>4-Digit PIN</label><input style={S.input} type="number" placeholder="1234" value={newEmp.pin} onChange={e => setNewEmp(p=>({...p,pin:e.target.value.slice(0,4)}))} /></div>
            <button style={S.btn()} onClick={addEmp}>Add Employee</button>
          </div>
          {emps.map(e => (
            <div key={e.id} style={{ ...S.card, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{e.name}</div>
                <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{e.id} &middot; PIN: {e.pin}</div>
                <div style={{ marginTop:4 }}><span style={S.tag(e.active)}>{e.active?"Active":"Revoked"}</span></div>
              </div>
              <button onClick={() => toggleEmp(e.id)} style={S.btn(e.active?"#3a1a1a":"#1a3a1a",e.active?"#f87171":"#4ade80",{ padding:"6px 12px", fontSize:12 })}>
                {e.active?"Revoke":"Restore"}
              </button>
            </div>
          ))}
        </>)}

        {adminTab === "logs" && (<>
          <div style={{ marginBottom:14 }}>
            <input style={S.input} placeholder="Filter by employee, product, or batch no&hellip;" value={logQ} onChange={e => setLogQ(e.target.value)} />
          </div>
          <div style={{ fontSize:11, color:"#444", marginBottom:12 }}>{filtLogs.length} entries</div>
          {filtLogs.length === 0 && (
            <div style={{ ...S.card, textAlign:"center", color:"#333", padding:40, fontSize:13 }}>
              No print logs yet. They will appear here after employees print labels.
            </div>
          )}
          {filtLogs.map((l,i) => (
            <div key={i} style={{ ...S.card, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f5c842" }}>{l.batchNo}</div>
                <div style={{ fontSize:11, color:"#333" }}>{l.timestamp}</div>
              </div>
              <div style={{ fontSize:13 }}>{l.skuName}</div>
              <div style={{ fontSize:11, color:"#555", marginTop:4 }}>
                {l.employee} &middot; {l.quantity} label{l.quantity>1?"s":""} &middot; Mfg: {l.mfgDate}
              </div>
            </div>
          ))}
        </>)}

      </div>
    </div>
  );
}
