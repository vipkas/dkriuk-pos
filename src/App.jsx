import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { id: 1, name: "Ayam Ori (Bagian Besar)", price: 10000, category: "ayam" },
  { id: 2, name: "Ayam Ori (Bagian Kecil)", price: 8000, category: "ayam" },
  { id: 3, name: "Ayam Hot (Bagian Besar)", price: 10000, category: "ayam" },
  { id: 4, name: "Ayam Hot (Bagian Kecil)", price: 8000, category: "ayam" },
  { id: 5, name: "Sate", price: 5000, category: "ayam" },
  { id: 6, name: "Kulit", price: 7000, category: "ayam" },
  { id: 7, name: "Otak-otak / Kentang", price: 6000, category: "ayam" },
  { id: 8, name: "Nasi", price: 5000, category: "ayam" },
  { id: 11, name: "Saos Dkribho", price: 4500, category: "saos" },
  { id: 12, name: "Sambal Geprek", price: 5000, category: "saos" },
  { id: 13, name: "Sambal Bawang", price: 5000, category: "saos" },
  { id: 14, name: "Sambal Chili Oil", price: 5000, category: "saos" },
  { id: 15, name: "Saos Blackpapper", price: 4000, category: "saos" },
  { id: 16, name: "Saos Keju", price: 4000, category: "saos" },
  { id: 17, name: "Saos Pedas manis", price: 4000, category: "saos" },
  { id: 18, name: "Geprek Keju", price: 5500, category: "saos" },
];

const EMPLOYEES = ["Dika", "Fathur", "Virdo"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const USERS = {
  admin: { password: "admin123", role: "admin", name: "Admin" },
  dika: { password: "dika123", role: "pegawai", name: "Dika" },
  fathur: { password: "fathur123", role: "pegawai", name: "Fathur" },
  virdo: { password: "virdo123", role: "pegawai", name: "Virdo" },
};

const fmt = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("id-ID").format(n || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateLabel = (dateStr) => { const d = new Date(dateStr); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const hariLabel = (dateStr) => { const d = new Date(dateStr); return HARI[d.getDay()]; };

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
const storageGet = async (key) => {
  try { 
    const docRef = doc(db, "app_storage", key);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().value : null;
  } catch { 
    return null; 
  }
};
const storageSet = async (key, val) => {
  try { 
    await setDoc(doc(db, "app_storage", key), { value: val });
  } catch (e) { 
    console.error(e); 
  }
};

// ─── EMPTY DAILY REPORT ──────────────────────────────────────────────────────
const emptyReport = (dateStr) => ({
  date: dateStr,
  hari: hariLabel(dateStr),
  items: MENU_ITEMS.map(m => ({ id: m.id, name: m.name, price: m.price, category: m.category, masak1: 0, masak2: 0, terjual: 0, sisa: 0 })),
  pengeluaran: [{ nama: "", qty: 0, harga: 0 }, { nama: "", qty: 0, harga: 0 }, { nama: "", qty: 0, harga: 0 }],
  catatan: "",
});

const emptyAttendance = () => ({
  status: "hadir", // hadir / sakit / izin / libur
  tepatWaktu: false,
  uangMakan: 0,
  bgorengPack: 0,
  bgorengPesanan: 0,
  lembur: 0,
  transport: 0,
  bonus: 0,
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PDF PRINT HELPER
// ═══════════════════════════════════════════════════════════════════════════════
const printPayslip = (emp, period, attendanceRows, kasbon, sisaKasbon) => {
  const totalKehadiran = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.hadir || 0), 0);
  const totalTepatWaktu = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.tepatWaktu ? 3000 : 0), 0);
  const totalUangMakan = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.uangMakan || 0), 0);
  const totalBgorengPack = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.bgorengPack || 0), 0);
  const totalBgorengPesanan = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.bgorengPesanan || 0), 0);
  const totalLembur = attendanceRows.filter(r => r.status === "hadir").reduce((s, r) => s + (r.lembur || 0), 0);
  const totalTransport = attendanceRows.reduce((s, r) => s + (r.transport || 0), 0);
  const totalBonus = attendanceRows.reduce((s, r) => s + (r.bonus || 0), 0);
  const gaji = emp === "Dika" ? 45000 : 40000;
  const gajiPokok = attendanceRows.filter(r => r.status === "hadir").length * gaji;
  const totalGaji = gajiPokok + totalTepatWaktu + totalUangMakan + totalBgorengPack + totalBgorengPesanan + totalLembur + totalTransport + totalBonus;
  const sisaBayar = totalGaji - (kasbon || 0);

  const rows = attendanceRows.map(r => {
    const g = r.status === "hadir" ? gaji : 0;
    const tw = r.status === "hadir" && r.tepatWaktu ? 3000 : 0;
    const um = r.status === "hadir" ? (r.uangMakan || 0) : 0;
    const bp = r.status === "hadir" ? (r.bgorengPack || 0) : 0;
    const bpes = r.status === "hadir" ? (r.bgorengPesanan || 0) : 0;
    const lem = r.status === "hadir" ? (r.lembur || 0) : 0;
    const tr = r.transport || 0;
    const bon = r.bonus || 0;
    return `<tr>
      <td>${r.hari || ""}</td><td>${r.tanggal || ""}</td>
      <td>${r.status === "hadir" ? fmtNum(g) : r.status.toUpperCase()}</td>
      <td>${tw ? fmtNum(tw) : "-"}</td><td>${um ? fmtNum(um) : "-"}</td>
      <td>${bp ? fmtNum(bp) : "-"}</td><td>${bpes ? fmtNum(bpes) : "-"}</td>
      <td>${lem ? fmtNum(lem) : "-"}</td><td>${tr ? fmtNum(tr) : "-"}</td>
      <td>${bon ? fmtNum(bon) : "-"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Slip Gaji ${emp} - ${period}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#1a1a1a;background:#fff;padding:20px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #e85d04;padding-bottom:12px;margin-bottom:16px}
    .brand{font-size:18px;font-weight:700;color:#e85d04;letter-spacing:2px}
    .brand-sub{font-size:9px;color:#666;margin-top:2px}
    .slip-title{text-align:right}
    .slip-title h2{font-size:14px;font-weight:700;color:#1a1a1a}
    .slip-title p{color:#666;font-size:9px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#1a1a1a;color:#fff;padding:5px 6px;text-align:left;font-size:9px;font-weight:600}
    td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px}
    tr:nth-child(even) td{background:#fafafa}
    .totals{background:#fff7ed;border:2px solid #e85d04;border-radius:6px;padding:12px;margin-bottom:14px}
    .totals h3{font-size:11px;font-weight:700;color:#e85d04;margin-bottom:8px}
    .total-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #ddd}
    .total-row.grand{border-top:2px solid #e85d04;padding-top:6px;font-weight:700;font-size:11px;color:#e85d04}
    .kasbon-section{background:#fff0f0;border:1px solid #ffaaaa;border-radius:6px;padding:10px;margin-bottom:14px}
    .kasbon-section h3{font-size:10px;font-weight:700;color:#cc0000;margin-bottom:6px}
    .footer{border-top:2px solid #eee;padding-top:12px;display:flex;justify-content:space-between}
    .sign-box{text-align:center;width:140px}
    .sign-box .sign-name{font-weight:700;border-top:1px solid #333;padding-top:4px;margin-top:40px;font-size:9px}
    .sign-box .sign-title{font-size:8px;color:#666}
    @media print{body{padding:10px}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="brand">🍗 DKRIUK FRIED CHICKEN</div>
      <div class="brand-sub">Jln. Ikan Kakap No 2A, Tunjungsekar, Malang</div>
    </div>
    <div class="slip-title">
      <h2>SLIP GAJI</h2>
      <p>Nama: <strong>${emp}</strong></p>
      <p>Periode: ${period}</p>
      <p>Cetak: ${dateLabel(today())}</p>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Hari</th><th>Tanggal</th><th>Kehadiran</th><th>Tepat Waktu</th>
      <th>Uang Makan</th><th>B.Goreng Pack</th><th>B.Goreng Pesanan</th>
      <th>Lembur</th><th>Transport</th><th>Bonus</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <h3>REKAPITULASI GAJI</h3>
    <div class="total-row"><span>Gaji Pokok (${attendanceRows.filter(r=>r.status==="hadir").length} hari × ${fmtNum(gaji)})</span><span>Rp ${fmtNum(gajiPokok)}</span></div>
    <div class="total-row"><span>Bonus Tepat Waktu</span><span>Rp ${fmtNum(totalTepatWaktu)}</span></div>
    <div class="total-row"><span>Uang Makan</span><span>Rp ${fmtNum(totalUangMakan)}</span></div>
    <div class="total-row"><span>B. Goreng Pack</span><span>Rp ${fmtNum(totalBgorengPack)}</span></div>
    <div class="total-row"><span>B. Goreng Pesanan</span><span>Rp ${fmtNum(totalBgorengPesanan)}</span></div>
    <div class="total-row"><span>Lembur</span><span>Rp ${fmtNum(totalLembur)}</span></div>
    <div class="total-row"><span>Transport</span><span>Rp ${fmtNum(totalTransport)}</span></div>
    <div class="total-row"><span>Bonus Tak Terduga</span><span>Rp ${fmtNum(totalBonus)}</span></div>
    <div class="total-row grand"><span>TOTAL GAJI</span><span>Rp ${fmtNum(totalGaji)}</span></div>
  </div>
  ${kasbon ? `<div class="kasbon-section">
    <h3>KASBON & POTONGAN</h3>
    <div class="total-row"><span>Total Gaji</span><span>Rp ${fmtNum(totalGaji)}</span></div>
    <div class="total-row"><span>Kasbon / Potongan</span><span style="color:red">- Rp ${fmtNum(kasbon)}</span></div>
    <div class="total-row grand"><span>YANG DITERIMA</span><span>Rp ${fmtNum(sisaBayar)}</span></div>
    ${sisaKasbon ? `<div class="total-row" style="color:#cc0000"><span>Sisa Kasbon Belum Terbayar</span><span>Rp ${fmtNum(sisaKasbon)}</span></div>` : ""}
  </div>` : ""}
  <div class="footer">
    <div class="sign-box"><div class="sign-name">Penerima</div><div class="sign-title">${emp}</div></div>
    <div class="sign-box"><div class="sign-name">Admin / Pemilik</div><div class="sign-title">DKRIUK Ikan Kakap</div></div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("input");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // ── Data States ──
  const [dailyReports, setDailyReports] = useState({});
  const [attendance, setAttendance] = useState({});  // { "2026-04:Dika": [{date, hari, status, ...}] }
  const [kasbon, setKasbon] = useState({});           // { "2026-04:Dika": { kasbon: 0, sisa: 0 } }
  const [loading, setLoading] = useState(true);

  // ── Form States ──
  const [selectedDate, setSelectedDate] = useState(today());
  const [reportDraft, setReportDraft] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedEmp, setSelectedEmp] = useState("Dika");
  const [attendanceDraft, setAttendanceDraft] = useState(null);
  const [kasbonDraft, setKasbonDraft] = useState({ kasbon: 0, sisa: 0 });
  const [toast, setToast] = useState(null);

  // ── Load all data ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const dr = await storageGet("dailyReports") || {};
      const att = await storageGet("attendance") || {};
      const kb = await storageGet("kasbon") || {};
      setDailyReports(dr);
      setAttendance(att);
      setKasbon(kb);
      setLoading(false);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Login ──
  const handleLogin = () => {
    const u = USERS[loginForm.username.toLowerCase()];
    if (!u || u.password !== loginForm.password) { setLoginError("Username atau password salah!"); return; }
    setUser({ ...u, username: loginForm.username });
    setLoginError("");
    setActiveTab(u.role === "admin" ? "dashboard" : "input");
  };

  // ── Daily Report helpers ──
  const loadReport = useCallback((dateStr) => {
    const existing = dailyReports[dateStr];
    setReportDraft(existing ? JSON.parse(JSON.stringify(existing)) : emptyReport(dateStr));
  }, [dailyReports]);

  useEffect(() => { if (user) loadReport(selectedDate); }, [selectedDate, user]);

  const saveReport = async () => {
    if (!reportDraft) return;
    const updated = { ...dailyReports, [selectedDate]: reportDraft };
    setDailyReports(updated);
    await storageSet("dailyReports", updated);
    showToast("Laporan berhasil disimpan! ✓");
  };

  const updateItem = (idx, field, val) => {
    const draft = JSON.parse(JSON.stringify(reportDraft));
    draft.items[idx][field] = Number(val) || 0;
    // auto-calc total for main items
    if (field === "masak1" || field === "masak2" || field === "terjual") {
      const item = draft.items[idx];
      if (item.category === "ayam" && item.id <= 8) {
        // terjual is manual
      }
    }
    setReportDraft(draft);
  };

  const updatePengeluaran = (idx, field, val) => {
    const draft = JSON.parse(JSON.stringify(reportDraft));
    if (!draft.pengeluaran[idx]) draft.pengeluaran[idx] = { nama: "", qty: 1, harga: 0 };
    draft.pengeluaran[idx][field] = field === "nama" ? val : (Number(val) || 0);
    setReportDraft(draft);
  };

  const addPengeluaran = () => {
    const draft = JSON.parse(JSON.stringify(reportDraft));
    draft.pengeluaran.push({ nama: "", qty: 1, harga: 0 });
    setReportDraft(draft);
  };

  const removePengeluaran = (idx) => {
    const draft = JSON.parse(JSON.stringify(reportDraft));
    draft.pengeluaran.splice(idx, 1);
    setReportDraft(draft);
  };

  // ── Attendance helpers ──
  const attKey = (month, emp) => `${month}:${emp}`;

  const loadAttendance = useCallback((month, emp) => {
    const key = attKey(month, emp);
    const existing = attendance[key];
    if (existing) { setAttendanceDraft(JSON.parse(JSON.stringify(existing))); }
    else {
      // generate all days of month
      const [y, m] = month.split("-").map(Number);
      const days = new Date(y, m, 0).getDate();
      const rows = [];
      for (let d = 1; d <= days; d++) {
        const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const dow = new Date(dateStr).getDay();
        rows.push({ date: dateStr, hari: HARI[dow], tanggal: `${d} ${MONTHS[m-1]} ${y}`,
          status: dow === 0 ? "libur" : "hadir", tepatWaktu: false,
          hadir: emp === "Dika" ? 45000 : 40000,
          uangMakan: 0, bgorengPack: 0, bgorengPesanan: 0, lembur: 0, transport: 0, bonus: 0 });
      }
      setAttendanceDraft(rows);
    }
    const kb = kasbon[key] || { kasbon: 0, sisa: 0 };
    setKasbonDraft(kb);
  }, [attendance, kasbon]);

  useEffect(() => { if (user?.role === "admin") loadAttendance(selectedMonth, selectedEmp); }, [selectedMonth, selectedEmp, user]);

  const updateAttRow = (idx, field, val) => {
    const draft = [...attendanceDraft];
    draft[idx] = { ...draft[idx], [field]: field === "status" || field === "hari" ? val : field === "tepatWaktu" ? val : (Number(val) || 0) };
    setAttendanceDraft(draft);
  };

  const saveAttendance = async () => {
    const key = attKey(selectedMonth, selectedEmp);
    const updatedAtt = { ...attendance, [key]: attendanceDraft };
    const updatedKb = { ...kasbon, [key]: kasbonDraft };
    setAttendance(updatedAtt);
    setKasbon(updatedKb);
    await storageSet("attendance", updatedAtt);
    await storageSet("kasbon", updatedKb);
    showToast("Data absensi & gaji disimpan! ✓");
  };

  // ── Computed values ──
  const reportTotals = (r) => {
    if (!r) return { pendapatan: 0, pengeluaran: 0 };
    const pendapatan = r.items.reduce((s, it) => s + (it.terjual * it.price), 0);
    const pengeluaran = r.pengeluaran.reduce((s, p) => s + ((p.qty || 1) * (p.harga || 0)), 0);
    return { pendapatan, pengeluaran, total: pendapatan - pengeluaran };
  };

  const monthlyRecap = (month) => {
    const prefix = month + "-";
    const entries = Object.entries(dailyReports)
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([date, r]) => ({ date, ...reportTotals(r) }));
  };

  const attTotals = (rows, emp) => {
    if (!rows) return {};
    const gaji = emp === "Dika" ? 45000 : 40000;
    const hadirDays = rows.filter(r => r.status === "hadir");
    const gajiPokok = hadirDays.length * gaji;
    const tepatWaktu = hadirDays.reduce((s, r) => s + (r.tepatWaktu ? 3000 : 0), 0);
    const uangMakan = hadirDays.reduce((s, r) => s + (r.uangMakan || 0), 0);
    const bgorengPack = hadirDays.reduce((s, r) => s + (r.bgorengPack || 0), 0);
    const bgorengPesanan = hadirDays.reduce((s, r) => s + (r.bgorengPesanan || 0), 0);
    const lembur = hadirDays.reduce((s, r) => s + (r.lembur || 0), 0);
    const transport = rows.reduce((s, r) => s + (r.transport || 0), 0);
    const bonus = rows.reduce((s, r) => s + (r.bonus || 0), 0);
    const total = gajiPokok + tepatWaktu + uangMakan + bgorengPack + bgorengPesanan + lembur + transport + bonus;
    return { gajiPokok, tepatWaktu, uangMakan, bgorengPack, bgorengPesanan, lembur, transport, bonus, total, hadirCount: hadirDays.length };
  };

  // ═══════ RENDER ═══════════════════════════════════════════════════════════════
  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh", background:"#0f0f0f", color:"#e85d04", fontFamily:"monospace", fontSize:18 }}>
      Memuat data...
    </div>
  );

  if (!user) return <LoginScreen loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} loginError={loginError} />;

  const isAdmin = user.role === "admin";
  const recap = reportDraft ? reportTotals(reportDraft) : {};
  const monthRows = monthlyRecap(selectedMonth);
  const attRows = attendanceDraft || [];
  const at = attTotals(attRows, selectedEmp);
  const kb = kasbon[attKey(selectedMonth, selectedEmp)] || { kasbon: 0, sisa: 0 };

  const tabs = isAdmin
    ? [["dashboard","📊 Dashboard"],["input","📋 Input Penjualan"],["absensi","👥 Absensi & Gaji"],["rekap","📈 Rekap Bulanan"]]
    : [["input","📋 Input Penjualan"]];

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", color:"#f5f5f5", fontFamily:"'Courier New', monospace" }}>
      {/* ── NAV ── */}
      <nav style={{ background:"#1a0800", borderBottom:"2px solid #e85d04", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ color:"#e85d04", fontWeight:700, fontSize:16, letterSpacing:2, padding:"14px 0" }}>🍗 DKRIUK</span>
          <div style={{ display:"flex", gap:2 }}>
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{ background: activeTab===id ? "#e85d04" : "transparent", color: activeTab===id ? "#fff" : "#ccc",
                  border:"none", padding:"10px 14px", cursor:"pointer", fontSize:12, fontFamily:"inherit",
                  borderRadius:4, transition:"all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:12, color:"#aaa" }}>{user.name} <span style={{ background: isAdmin?"#e85d04":"#2a6a2a", color:"#fff", borderRadius:3, padding:"2px 6px", fontSize:10 }}>{user.role.toUpperCase()}</span></span>
          <button onClick={() => setUser(null)} style={{ background:"transparent", border:"1px solid #555", color:"#aaa", padding:"5px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", borderRadius:4 }}>Keluar</button>
        </div>
      </nav>

      {/* ── TOAST ── */}
      {toast && <div style={{ position:"fixed", top:60, right:20, background: toast.type==="success"?"#1a4a1a":"#4a1a1a", border:`1px solid ${toast.type==="success"?"#4caf50":"#f44336"}`, color: toast.type==="success"?"#4caf50":"#f44336", padding:"10px 18px", borderRadius:6, zIndex:999, fontSize:13 }}>{toast.msg}</div>}

      <div style={{ maxWidth:1200, margin:"0 auto", padding:20 }}>

        {/* ══════ DASHBOARD ══════ */}
        {activeTab === "dashboard" && isAdmin && (
          <div>
            <SectionTitle>Dashboard {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}</SectionTitle>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:"#aaa", fontSize:12, marginRight:8 }}>Pilih Bulan:</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={inputStyle} />
            </div>
            {/* Summary Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:12, marginBottom:24 }}>
              {[
                { label:"Total Pendapatan", val: fmt(monthRows.reduce((s,r)=>s+r.pendapatan,0)), color:"#4caf50" },
                { label:"Total Pengeluaran", val: fmt(monthRows.reduce((s,r)=>s+r.pengeluaran,0)), color:"#f44336" },
                { label:"Net Profit", val: fmt(monthRows.reduce((s,r)=>s+r.total,0)), color:"#e85d04" },
                { label:"Hari Tercatat", val: monthRows.length + " hari", color:"#2196f3" },
              ].map(c => (
                <div key={c.label} style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:8, padding:"16px 20px" }}>
                  <div style={{ color:"#888", fontSize:11, marginBottom:6 }}>{c.label}</div>
                  <div style={{ color:c.color, fontSize:20, fontWeight:700 }}>{c.val}</div>
                </div>
              ))}
            </div>
            {/* Recent entries */}
            <Card title="Entri Terbaru">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr>{["Tanggal","Hari","Pendapatan","Pengeluaran","Net"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {monthRows.slice(-10).reverse().map(r => (
                    <tr key={r.date}>
                      <Td>{dateLabel(r.date)}</Td><Td>{hariLabel(r.date)}</Td>
                      <Td style={{color:"#4caf50"}}>{fmt(r.pendapatan)}</Td>
                      <Td style={{color:"#f44336"}}>{fmt(r.pengeluaran)}</Td>
                      <Td style={{color:"#e85d04",fontWeight:700}}>{fmt(r.total)}</Td>
                    </tr>
                  ))}
                  {monthRows.length === 0 && <tr><td colSpan={5} style={{textAlign:"center",color:"#555",padding:20}}>Belum ada data bulan ini</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ══════ INPUT PENJUALAN ══════ */}
        {activeTab === "input" && (
          <div>
            <SectionTitle>Input Penjualan Harian</SectionTitle>
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:20, flexWrap:"wrap" }}>
              <div>
                <label style={{ color:"#aaa", fontSize:12, display:"block", marginBottom:4 }}>Pilih Tanggal</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
              </div>
              {reportDraft && <div style={{ background:"#1a2a1a", border:"1px solid #4caf50", borderRadius:6, padding:"8px 14px", fontSize:12 }}>
                <span style={{color:"#888"}}>Hari: </span><span style={{color:"#4caf50",fontWeight:700}}>{hariLabel(selectedDate)}, {dateLabel(selectedDate)}</span>
              </div>}
            </div>

            {reportDraft && (
              <>
                {/* Menu Items */}
                <Card title="🍗 Item Penjualan - Ayam">
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead><tr>{["No","Nama Item","Masak Awal","Masak Tambah","Total Terjual","Harga","Total Uang","Sisa"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {reportDraft.items.filter(it=>it.category==="ayam").map((item, i) => {
                        const realIdx = reportDraft.items.findIndex(x=>x.id===item.id);
                        return (
                          <tr key={item.id}>
                            <Td>{item.id}</Td>
                            <Td>{item.name}</Td>
                            <Td><NumInput val={item.masak1} onChange={v=>updateItem(realIdx,"masak1",v)} /></Td>
                            <Td><NumInput val={item.masak2} onChange={v=>updateItem(realIdx,"masak2",v)} /></Td>
                            <Td><NumInput val={item.terjual} onChange={v=>updateItem(realIdx,"terjual",v)} /></Td>
                            <Td style={{color:"#aaa"}}>{fmtNum(item.price)}</Td>
                            <Td style={{color:"#4caf50",fontWeight:700}}>{fmtNum(item.terjual*item.price)}</Td>
                            <Td><NumInput val={item.sisa} onChange={v=>updateItem(realIdx,"sisa",v)} /></Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>

                <Card title="🥫 Varian Saos">
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead><tr>{["No","Nama Saos","Terjual","Harga","Total"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {reportDraft.items.filter(it=>it.category==="saos").map((item) => {
                        const realIdx = reportDraft.items.findIndex(x=>x.id===item.id);
                        return (
                          <tr key={item.id}>
                            <Td>{item.id}</Td><Td>{item.name}</Td>
                            <Td><NumInput val={item.terjual} onChange={v=>updateItem(realIdx,"terjual",v)} /></Td>
                            <Td style={{color:"#aaa"}}>{fmtNum(item.price)}</Td>
                            <Td style={{color:"#4caf50"}}>{fmtNum(item.terjual*item.price)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>

                {/* Pengeluaran - only for admin */}
                {isAdmin && (
                  <Card title="💸 Pengeluaran Harian">
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:8 }}>
                      <thead><tr>{["No","Nama Barang","Qty","Harga Satuan","Total",""].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                      <tbody>
                        {reportDraft.pengeluaran.map((p, i) => (
                          <tr key={i}>
                            <Td>{i+1}</Td>
                            <Td><input value={p.nama} onChange={e=>updatePengeluaran(i,"nama",e.target.value)} style={{...inputStyle,width:"100%",padding:"3px 6px"}} placeholder="Nama barang" /></Td>
                            <Td><NumInput val={p.qty||1} onChange={v=>updatePengeluaran(i,"qty",v)} /></Td>
                            <Td><NumInput val={p.harga} onChange={v=>updatePengeluaran(i,"harga",v)} /></Td>
                            <Td style={{color:"#f44336"}}>{fmtNum((p.qty||1)*(p.harga||0))}</Td>
                            <Td><button onClick={()=>removePengeluaran(i)} style={{background:"transparent",border:"1px solid #555",color:"#f44336",cursor:"pointer",padding:"2px 6px",borderRadius:3,fontSize:10}}>✕</button></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={addPengeluaran} style={{...btnStyle, background:"#1a3a1a", color:"#4caf50", border:"1px solid #4caf50", fontSize:12}}>+ Tambah Pengeluaran</button>
                  </Card>
                )}

                {/* Summary */}
                <div style={{ background:"#1a0a00", border:"2px solid #e85d04", borderRadius:8, padding:16, marginBottom:16 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, textAlign:"center" }}>
                    <div><div style={{color:"#888",fontSize:11}}>PENDAPATAN</div><div style={{color:"#4caf50",fontSize:18,fontWeight:700}}>{fmt(recap.pendapatan)}</div></div>
                    {isAdmin && <div><div style={{color:"#888",fontSize:11}}>PENGELUARAN</div><div style={{color:"#f44336",fontSize:18,fontWeight:700}}>{fmt(recap.pengeluaran)}</div></div>}
                    {isAdmin && <div><div style={{color:"#888",fontSize:11}}>NET</div><div style={{color:"#e85d04",fontSize:18,fontWeight:700}}>{fmt(recap.total)}</div></div>}
                  </div>
                </div>

                <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                  <button onClick={saveReport} style={{...btnStyle, background:"#e85d04", color:"#fff", flex:1}}>💾 Simpan Laporan</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ ABSENSI & GAJI ══════ */}
        {activeTab === "absensi" && isAdmin && (
          <div>
            <SectionTitle>Absensi & Slip Gaji</SectionTitle>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
              <div>
                <label style={{ color:"#aaa", fontSize:12, display:"block", marginBottom:4 }}>Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ color:"#aaa", fontSize:12, display:"block", marginBottom:4 }}>Pegawai</label>
                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={inputStyle}>
                  {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <Card title={`📋 Absensi ${selectedEmp} — ${MONTHS[parseInt(selectedMonth.split("-")[1])-1]} ${selectedMonth.split("-")[0]}`}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr>
                    {["Hari","Tanggal","Status","Tepat Waktu","Uang Makan","B.Goreng Pack","B.Goreng Pesanan","Lembur","Transport","Bonus"].map(h=><Th key={h}>{h}</Th>)}
                  </tr></thead>
                  <tbody>
                    {attRows.map((row, i) => (
                      <tr key={row.date} style={{ background: row.status==="libur"?"#0a0a0a": row.status!=="hadir"?"#1a0a0a":"transparent" }}>
                        <Td style={{color:"#888"}}>{row.hari}</Td>
                        <Td>{row.tanggal}</Td>
                        <Td>
                          <select value={row.status} onChange={e=>updateAttRow(i,"status",e.target.value)}
                            style={{...inputStyle,padding:"2px 4px",fontSize:10,background:row.status==="hadir"?"#0a1a0a":row.status==="libur"?"#0a0a0a":"#1a0000"}}>
                            <option value="hadir">Hadir</option>
                            <option value="sakit">Sakit</option>
                            <option value="izin">Izin</option>
                            <option value="libur">Libur</option>
                          </select>
                        </Td>
                        {row.status === "hadir" ? <>
                          <Td><input type="checkbox" checked={!!row.tepatWaktu} onChange={e=>updateAttRow(i,"tepatWaktu",e.target.checked)} /></Td>
                          <Td><NumInput val={row.uangMakan} onChange={v=>updateAttRow(i,"uangMakan",v)} /></Td>
                          <Td><NumInput val={row.bgorengPack} onChange={v=>updateAttRow(i,"bgorengPack",v)} /></Td>
                          <Td><NumInput val={row.bgorengPesanan} onChange={v=>updateAttRow(i,"bgorengPesanan",v)} /></Td>
                          <Td><NumInput val={row.lembur} onChange={v=>updateAttRow(i,"lembur",v)} /></Td>
                          <Td><NumInput val={row.transport} onChange={v=>updateAttRow(i,"transport",v)} /></Td>
                          <Td><NumInput val={row.bonus} onChange={v=>updateAttRow(i,"bonus",v)} /></Td>
                        </> : <td colSpan={7} style={{color:"#555",fontSize:10,padding:"4px 6px",fontStyle:"italic"}}>{row.status.toUpperCase()}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Kasbon */}
            <Card title="💳 Kasbon & Potongan">
              <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:12 }}>
                <div>
                  <label style={{color:"#aaa",fontSize:11,display:"block",marginBottom:4}}>Total Kasbon</label>
                  <input type="number" value={kasbonDraft.kasbon} onChange={e=>setKasbonDraft({...kasbonDraft, kasbon: Number(e.target.value)||0})} style={{...inputStyle,width:150}} />
                </div>
                <div>
                  <label style={{color:"#aaa",fontSize:11,display:"block",marginBottom:4}}>Sisa Kasbon Terbayar Sebelumnya</label>
                  <input type="number" value={kasbonDraft.sisa} onChange={e=>setKasbonDraft({...kasbonDraft, sisa: Number(e.target.value)||0})} style={{...inputStyle,width:150}} />
                </div>
              </div>
            </Card>

            {/* Totals */}
            <div style={{ background:"#1a0a00", border:"2px solid #e85d04", borderRadius:8, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#e85d04", marginBottom:12 }}>REKAPITULASI GAJI {selectedEmp.toUpperCase()}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:12, marginBottom:12 }}>
                {[
                  ["Hari Hadir", at.hadirCount + " hari"],
                  ["Gaji Pokok", fmt(at.gajiPokok)],
                  ["Bonus Tepat Waktu", fmt(at.tepatWaktu)],
                  ["Uang Makan", fmt(at.uangMakan)],
                  ["B. Goreng Pack", fmt(at.bgorengPack)],
                  ["B. Goreng Pesanan", fmt(at.bgorengPesanan)],
                  ["Lembur", fmt(at.lembur)],
                  ["Transport", fmt(at.transport)],
                  ["Bonus Tak Terduga", fmt(at.bonus)],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #333" }}>
                    <span style={{color:"#aaa"}}>{l}</span><span style={{color:"#f5f5f5"}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:"2px solid #e85d04", fontSize:15, fontWeight:700 }}>
                <span style={{color:"#f5f5f5"}}>TOTAL GAJI</span><span style={{color:"#e85d04"}}>{fmt(at.total)}</span>
              </div>
              {kasbonDraft.kasbon > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                  <span style={{color:"#f44336"}}>Kasbon / Potongan</span><span style={{color:"#f44336"}}>- {fmt(kasbonDraft.kasbon)}</span>
                </div>
              )}
              {kasbonDraft.kasbon > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #555", fontSize:14, fontWeight:700 }}>
                  <span style={{color:"#fff"}}>YANG DITERIMA</span><span style={{color:"#4caf50"}}>{fmt(at.total - kasbonDraft.kasbon)}</span>
                </div>
              )}
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={saveAttendance} style={{...btnStyle, background:"#e85d04", color:"#fff", flex:1}}>💾 Simpan Absensi & Gaji</button>
              <button onClick={() => {
                const period = `${MONTHS[parseInt(selectedMonth.split("-")[1])-1]} ${selectedMonth.split("-")[0]}`;
                printPayslip(selectedEmp, period, attRows, kasbonDraft.kasbon, kasbonDraft.sisa);
              }} style={{...btnStyle, background:"#1a1a4a", color:"#7799ff", border:"1px solid #7799ff", flex:1}}>
                🖨️ Print Slip Gaji PDF
              </button>
            </div>
          </div>
        )}

        {/* ══════ REKAP BULANAN ══════ */}
        {activeTab === "rekap" && isAdmin && (
          <div>
            <SectionTitle>Rekap Bulanan</SectionTitle>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:"#aaa", fontSize:12, marginRight:8 }}>Bulan:</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={inputStyle} />
            </div>

            {/* Summary */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginBottom:20 }}>
              {[
                { label:"Total Pendapatan", val: monthRows.reduce((s,r)=>s+r.pendapatan,0), color:"#4caf50" },
                { label:"Total Pengeluaran", val: monthRows.reduce((s,r)=>s+r.pengeluaran,0), color:"#f44336" },
                { label:"Net Profit", val: monthRows.reduce((s,r)=>s+r.total,0), color:"#e85d04" },
                { label:"Hari Operasional", val: monthRows.length, color:"#2196f3", suffix:" hari" },
                { label:"Rata-rata Harian", val: monthRows.length ? Math.round(monthRows.reduce((s,r)=>s+r.pendapatan,0)/monthRows.length) : 0, color:"#9c27b0" },
              ].map(c => (
                <div key={c.label} style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:8, padding:"14px 16px" }}>
                  <div style={{ color:"#666", fontSize:10, marginBottom:4 }}>{c.label}</div>
                  <div style={{ color:c.color, fontSize:16, fontWeight:700 }}>{c.suffix ? (fmtNum(c.val)+c.suffix) : fmt(c.val)}</div>
                </div>
              ))}
            </div>

            <Card title={`Detail Harian — ${MONTHS[parseInt(selectedMonth.split("-")[1])-1]} ${selectedMonth.split("-")[0]}`}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr>{["No","Tanggal","Hari","Pendapatan","Pengeluaran","Net"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {monthRows.map((r, i) => (
                    <tr key={r.date}>
                      <Td style={{color:"#555"}}>{i+1}</Td>
                      <Td>{dateLabel(r.date)}</Td>
                      <Td style={{color:"#888"}}>{hariLabel(r.date)}</Td>
                      <Td style={{color:"#4caf50"}}>{fmt(r.pendapatan)}</Td>
                      <Td style={{color:"#f44336"}}>{fmt(r.pengeluaran)}</Td>
                      <Td style={{color: r.total>=0 ? "#e85d04":"#f44336", fontWeight:700}}>{fmt(r.total)}</Td>
                    </tr>
                  ))}
                  {monthRows.length === 0 && <tr><td colSpan={6} style={{textAlign:"center",color:"#555",padding:20,fontStyle:"italic"}}>Belum ada data untuk bulan ini</td></tr>}
                  {monthRows.length > 0 && (
                    <tr style={{borderTop:"2px solid #333", fontWeight:700}}>
                      <Td colSpan={3} style={{color:"#e85d04"}}>TOTAL</Td>
                      <Td style={{color:"#4caf50"}}>{fmt(monthRows.reduce((s,r)=>s+r.pendapatan,0))}</Td>
                      <Td style={{color:"#f44336"}}>{fmt(monthRows.reduce((s,r)=>s+r.pengeluaran,0))}</Td>
                      <Td style={{color:"#e85d04"}}>{fmt(monthRows.reduce((s,r)=>s+r.total,0))}</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>

            {/* Gaji Summary per Pegawai */}
            <Card title="👥 Ringkasan Gaji Pegawai">
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
                {EMPLOYEES.map(emp => {
                  const empRows = attendance[attKey(selectedMonth, emp)] || [];
                  const empAt = attTotals(empRows, emp);
                  const empKb = kasbon[attKey(selectedMonth, emp)] || { kasbon: 0 };
                  return (
                    <div key={emp} style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:8, padding:14 }}>
                      <div style={{ fontWeight:700, color:"#e85d04", marginBottom:10, fontSize:13 }}>👤 {emp}</div>
                      <div style={{ fontSize:11, display:"grid", gap:3 }}>
                        {[["Hari Hadir", empAt.hadirCount+" hari"], ["Gaji Pokok", fmt(empAt.gajiPokok)], ["Tunjangan", fmt((empAt.tepatWaktu||0)+(empAt.uangMakan||0)+(empAt.bgorengPack||0)+(empAt.bgorengPesanan||0)+(empAt.lembur||0)+(empAt.transport||0)+(empAt.bonus||0))], ["Kasbon", fmt(empKb.kasbon)]].map(([l,v])=>(
                          <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:3, borderBottom:"1px solid #222" }}>
                            <span style={{color:"#888"}}>{l}</span><span>{v}</span>
                          </div>
                        ))}
                        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:6, fontWeight:700, fontSize:12 }}>
                          <span style={{color:"#fff"}}>Take Home</span><span style={{color:"#4caf50"}}>{fmt((empAt.total||0)-(empKb.kasbon||0))}</span>
                        </div>
                      </div>
                      <button onClick={() => {
                        const period = `${MONTHS[parseInt(selectedMonth.split("-")[1])-1]} ${selectedMonth.split("-")[0]}`;
                        printPayslip(emp, period, empRows, empKb.kasbon, empKb.sisa);
                      }} style={{...btnStyle, width:"100%", marginTop:10, background:"#1a1a3a", color:"#7799ff", border:"1px solid #446", fontSize:11}}>
                        🖨️ Print Slip Gaji
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Small components ──
const inputStyle = { background:"#1a1a1a", border:"1px solid #444", color:"#f5f5f5", padding:"6px 10px", borderRadius:4, fontFamily:"inherit", fontSize:12, outline:"none" };
const btnStyle = { padding:"10px 16px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13, border:"none", transition:"opacity 0.2s" };
const Th = ({ children }) => <th style={{ background:"#1a0800", color:"#e85d04", padding:"7px 8px", textAlign:"left", fontSize:10, fontWeight:700, borderBottom:"1px solid #333", whiteSpace:"nowrap" }}>{children}</th>;
const Td = ({ children, style, colSpan }) => <td colSpan={colSpan} style={{ padding:"5px 8px", borderBottom:"1px solid #1e1e1e", ...style }}>{children}</td>;
const SectionTitle = ({ children }) => <h2 style={{ color:"#e85d04", marginBottom:16, fontSize:18, fontWeight:700, letterSpacing:1 }}>{children}</h2>;
const Card = ({ title, children }) => (
  <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:8, marginBottom:16, overflow:"hidden" }}>
    <div style={{ background:"#1a0800", padding:"10px 16px", fontSize:12, fontWeight:700, color:"#e85d04", borderBottom:"1px solid #2a2a2a" }}>{title}</div>
    <div style={{ padding:14 }}>{children}</div>
  </div>
);
const NumInput = ({ val, onChange }) => (
  <input type="number" value={val || 0} min={0}
    onChange={e => onChange(e.target.value)}
    style={{ ...inputStyle, width:80, padding:"3px 6px", textAlign:"right" }} />
);

function LoginScreen({ loginForm, setLoginForm, handleLogin, loginError }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Courier New', monospace" }}>
      <div style={{ background:"#1a0800", border:"2px solid #e85d04", borderRadius:12, padding:"40px 48px", width:360, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:8 }}>🍗</div>
        <div style={{ color:"#e85d04", fontSize:22, fontWeight:700, letterSpacing:3, marginBottom:4 }}>DKRIUK</div>
        <div style={{ color:"#888", fontSize:11, marginBottom:28 }}>Sistem Manajemen Penjualan</div>
        <div style={{ marginBottom:14, textAlign:"left" }}>
          <label style={{ color:"#aaa", fontSize:11, display:"block", marginBottom:5 }}>USERNAME</label>
          <input value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}
            onKeyDown={e => e.key==="Enter" && handleLogin()}
            style={{ width:"100%", background:"#111", border:"1px solid #444", color:"#f5f5f5", padding:"10px 12px", borderRadius:6, fontFamily:"inherit", fontSize:13, outline:"none", boxSizing:"border-box" }}
            placeholder="admin / dika / fathur / virdo" />
        </div>
        <div style={{ marginBottom:20, textAlign:"left" }}>
          <label style={{ color:"#aaa", fontSize:11, display:"block", marginBottom:5 }}>PASSWORD</label>
          <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
            onKeyDown={e => e.key==="Enter" && handleLogin()}
            style={{ width:"100%", background:"#111", border:"1px solid #444", color:"#f5f5f5", padding:"10px 12px", borderRadius:6, fontFamily:"inherit", fontSize:13, outline:"none", boxSizing:"border-box" }} />
        </div>
        {loginError && <div style={{ color:"#f44336", fontSize:12, marginBottom:14 }}>{loginError}</div>}
        <button onClick={handleLogin}
          style={{ width:"100%", background:"#e85d04", color:"#fff", border:"none", padding:"12px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:14, letterSpacing:1 }}>
          MASUK
        </button>
        <div style={{ marginTop:20, color:"#555", fontSize:10 }}>
          Admin: admin / admin123<br/>
          Pegawai: dika/fathur/virdo + nama123
        </div>
      </div>
    </div>
  );
}
