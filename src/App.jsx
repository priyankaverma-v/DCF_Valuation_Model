import { useState, useMemo } from "react";

// ─── Color constants ────────────────────────────────────────────────────────
const C = {
  bg: "#0a0e1a",
  panel: "#111827",
  card: "#1a2235",
  border: "#1e2d45",
  accent: "#00d4aa",
  accentDim: "#00d4aa22",
  gold: "#f5c842",
  red: "#ff5c5c",
  blue: "#4c9fff",
  text: "#e2e8f0",
  muted: "#64748b",
  input: "#0d1526",
  hardcode: "#4c9fff",
  formula: "#e2e8f0",
  green: "#22c55e",
};

const fmt = (n, dec = 0) =>
  n == null || isNaN(n)
    ? "—"
    : Math.abs(n) < 0.005 && n !== 0
    ? "—"
    : n < 0
    ? `(${Math.abs(n).toFixed(dec)})`
    : n.toFixed(dec);

const fmtCr = (n) => (n == null ? "—" : `₹${fmt(n, 1)} Cr`);
const fmtPct = (n) => (n == null ? "—" : `${fmt(n * 100, 1)}%`);
const fmtX = (n) => (n == null ? "—" : `${fmt(n, 1)}x`);

// ─── Input cell component ───────────────────────────────────────────────────
function Input({ value, onChange, suffix = "", step = 0.1, min, max, small }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        step={step}
        min={min}
        max={max}
        style={{
          background: C.input,
          border: `1px solid ${C.accent}55`,
          color: C.hardcode,
          borderRadius: 4,
          padding: small ? "1px 4px" : "2px 6px",
          width: small ? 60 : 72,
          fontSize: small ? 11 : 12,
          fontFamily: "monospace",
          outline: "none",
          textAlign: "right",
        }}
      />
      {suffix && <span style={{ color: C.muted, fontSize: 11 }}>{suffix}</span>}
    </span>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
      <div style={{ color: C.accent, fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      {subtitle && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function Row({ label, values, bold, muted, highlight, indent, isInput, pct, sep }) {
  if (sep) return <tr><td colSpan={99} style={{ padding: "2px 0" }}><div style={{ borderTop: `1px solid ${C.border}` }} /></td></tr>;
  return (
    <tr style={{ background: highlight ? C.accentDim : "transparent" }}>
      <td style={{ padding: "3px 8px 3px 0", color: muted ? C.muted : C.text, fontSize: 12, fontWeight: bold ? 700 : 400, paddingLeft: indent ? 16 : 0, whiteSpace: "nowrap" }}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} style={{ padding: "3px 6px", textAlign: "right", fontSize: 12, fontFamily: "monospace", color: bold ? C.accent : muted ? C.muted : C.formula, fontWeight: bold ? 700 : 400 }}>
          {v}
        </td>
      ))}
    </tr>
  );
}

export default function App() {
  // ── Historical data (₹ Cr) ─────────────────────────────────────────────────
  const hist = {
    years: ["FY19", "FY20", "FY21", "FY22", "FY23", "FY24", "FY25"],
    revenue: [130, 156, 143, 247, 445, 724, 1149],
    opex: [123, 148, 128, 212, 375, 621, 989],
    ebitda: [7, 8, 14, 35, 70, 103, 160],
    depreciation: [1, 1, 1, 2, 4, 6, 11],
    interest: [2, 3, 3, 4, 4, 6, 4],
    otherIncome: [0, 1, 2, 1, 1, 12, 9],
    pbt: [4, 5, 11, 30, 63, 102, 154],
    taxRate: [0.31, 0.27, 0.26, 0.26, 0.25, 0.26, 0.26],
    netProfit: [3, 4, 8, 22, 47, 76, 114],
    capex: [1, 3, 2, 5, 14, 27, 11], // approx from investing CF
    debt: [11, 15, 31, 34, 36, 10, 8],
    cash: [5, 6, 6, 6, 11, 94, 174], // approx
    equity: [11, 14, 22, 45, 93, 422, 530],
    cfo: [3, 3, -10, 5, 27, 18, -13],
  };

  // ── Projection assumptions ────────────────────────────────────────────────
  const [revGrowth, setRevGrowth] = useState([50, 42, 35, 28, 22, 18, 15, 13, 11, 10]);
  const [ebitdaMargin, setEbitdaMargin] = useState([14.5, 14.5, 15, 15.5, 15.5, 16, 16, 16, 16, 16]);
  const [taxRateA, setTaxRateA] = useState(25.5);
  const [nwcPct, setNwcPct] = useState(23); // as % of revenue (working capital days ~84)
  const [capexPct, setCapexPct] = useState(1.2); // capex as % of rev
  const [depnPct, setDepnPct] = useState(0.95); // dep as % of rev
  const [termGrowth, setTermGrowth] = useState(5);
  const [wacc, setWacc] = useState(14);
  const [sharesOut, setSharesOut] = useState(5.61); // cr shares (56.1m / 10)
  const [currentPrice, setCurrentPrice] = useState(3424);
  const [netDebt, setNetDebt] = useState(-166); // cash heavy, so negative net debt

  const projYears = ["FY26E", "FY27E", "FY28E", "FY29E", "FY30E", "FY31E", "FY32E", "FY33E", "FY34E", "FY35E"];
  const N = 10;

  // ── Projections ────────────────────────────────────────────────────────────
  const proj = useMemo(() => {
    const baseRev = hist.revenue[6]; // FY25 = 1149
    const rev = [];
    const ebitda = [];
    const depn = [];
    const ebit = [];
    const nopat = [];
    const nwc = [];
    const dnwc = [];
    const capex = [];
    const fcff = [];
    const pvFcff = [];
    const waccDec = wacc / 100;
    const taxDec = taxRateA / 100;

    let prevNwc = baseRev * (nwcPct / 100) * 0.93; // FY25 NWC approx

    for (let i = 0; i < N; i++) {
      const prevRev = i === 0 ? baseRev : rev[i - 1];
      const r = prevRev * (1 + revGrowth[i] / 100);
      rev.push(r);
      const eb = r * (ebitdaMargin[i] / 100);
      ebitda.push(eb);
      const dep = r * (depnPct / 100);
      depn.push(dep);
      ebit.push(eb - dep);
      nopat.push((eb - dep) * (1 - taxDec));
      const curNwc = r * (nwcPct / 100);
      nwc.push(curNwc);
      dnwc.push(curNwc - prevNwc);
      prevNwc = curNwc;
      const cx = r * (capexPct / 100);
      capex.push(cx);
      const f = (eb - dep) * (1 - taxDec) + dep - cx - (curNwc - (i === 0 ? r / (1 + revGrowth[i] / 100) * (nwcPct / 100) * 0.93 : nwc[i - 1]));
      // Simplified: FCFF = NOPAT + Depn - Capex - ΔNWC
      const fc = nopat[i] + dep - cx - dnwc[i];
      fcff.push(fc);
      const pv = fc / Math.pow(1 + waccDec, i + 1);
      pvFcff.push(pv);
    }

    const sumPvFcff = pvFcff.reduce((a, b) => a + b, 0);
    const terminalFCFF = fcff[N - 1] * (1 + termGrowth / 100);
    const terminalValue = terminalFCFF / (waccDec - termGrowth / 100);
    const pvTerminal = terminalValue / Math.pow(1 + waccDec, N);
    const enterpriseValue = sumPvFcff + pvTerminal;
    const equityValue = enterpriseValue - netDebt;
    const intrinsicValue = (equityValue / sharesOut);
    const upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;

    return { rev, ebitda, depn, ebit, nopat, nwc, dnwc, capex, fcff, pvFcff, sumPvFcff, terminalValue, pvTerminal, enterpriseValue, equityValue, intrinsicValue, upside };
  }, [revGrowth, ebitdaMargin, taxRateA, nwcPct, capexPct, depnPct, termGrowth, wacc, sharesOut, currentPrice, netDebt]);

  // ── Sensitivity: intrinsic value grid ────────────────────────────────────
  const waccRange = [11, 12, 13, 14, 15, 16, 17];
  const tgRange = [3, 4, 5, 6, 7];

  const sensitivityGrid = useMemo(() => {
    return tgRange.map((tg) =>
      waccRange.map((w) => {
        const wDec = w / 100;
        const tDec = taxRateA / 100;
        const baseRev = hist.revenue[6];
        let prevNwcS = baseRev * (nwcPct / 100) * 0.93;
        const fcffArr = [];
        for (let i = 0; i < N; i++) {
          const prevRev = i === 0 ? baseRev : baseRev * revGrowth.slice(0, i).reduce((a, g) => a * (1 + g / 100), 1);
          const r = prevRev * (1 + revGrowth[i] / 100);
          const eb = r * (ebitdaMargin[i] / 100);
          const dep = r * (depnPct / 100);
          const nopat_ = (eb - dep) * (1 - tDec);
          const curNwc = r * (nwcPct / 100);
          const cx = r * (capexPct / 100);
          fcffArr.push(nopat_ + dep - cx - (curNwc - prevNwcS));
          prevNwcS = curNwc;
        }
        const sumPv = fcffArr.reduce((s, f, i) => s + f / Math.pow(1 + wDec, i + 1), 0);
        const tv = fcffArr[N - 1] * (1 + tg / 100) / (wDec - tg / 100);
        const pvTv = tv / Math.pow(1 + wDec, N);
        const ev = sumPv + pvTv;
        return (ev - netDebt) / sharesOut;
      })
    );
  }, [revGrowth, ebitdaMargin, taxRateA, nwcPct, capexPct, depnPct, termGrowth, wacc, sharesOut, netDebt]);

  const updateRevGrowth = (i, v) => {
    const arr = [...revGrowth];
    arr[i] = v;
    setRevGrowth(arr);
  };
  const updateEbitdaMargin = (i, v) => {
    const arr = [...ebitdaMargin];
    arr[i] = v;
    setEbitdaMargin(arr);
  };

  const bull = proj.intrinsicValue * 1.3;
  const bear = proj.intrinsicValue * 0.7;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Mono', monospace, monospace", color: C.text, padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, borderBottom: `2px solid ${C.accent}`, paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Discounted Cash Flow Valuation</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Netweb Technologies India Ltd</h1>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>NSE: NETWEB &nbsp;|&nbsp; High-End Computing Solutions &nbsp;|&nbsp; 10-Year FCFF Model</div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              ["Intrinsic Value", `₹${fmt(proj.intrinsicValue, 0)}`, proj.upside >= 0 ? C.green : C.red],
              ["Current Price", `₹${fmt(currentPrice, 0)}`, C.text],
              ["Upside / (Downside)", `${fmt(proj.upside, 1)}%`, proj.upside >= 0 ? C.green : C.red],
              ["Enterprise Value", `₹${fmt(proj.enterpriseValue / 100, 1)}k Cr`, C.gold],
            ].map(([label, val, col]) => (
              <div key={label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", minWidth: 140 }}>
                <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
                <div style={{ color: col, fontSize: 20, fontWeight: 800, marginTop: 3 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, fontSize: 11, flexWrap: "wrap" }}>
        {[["Blue = Hardcoded Input", C.hardcode], ["White = Formula", C.formula], ["Teal = Key Output", C.accent]].map(([l, c]) => (
          <span key={l} style={{ color: c }}>■ {l}</span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* ── Historical P&L ──────────────────────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <SectionHeader title="Historical Financials (₹ Cr)" subtitle="Source: Screener.in / BSE Filings" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: C.muted, fontSize: 11, paddingBottom: 6, fontWeight: 500 }}>Metric</th>
                  {hist.years.map((y) => <th key={y} style={{ textAlign: "right", color: C.muted, fontSize: 11, paddingBottom: 6, fontWeight: 500, paddingLeft: 8 }}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Revenue", hist.revenue],
                  ["EBITDA", hist.ebitda],
                  ["EBITDA Margin", hist.revenue.map((r, i) => `${fmt(hist.ebitda[i] / r * 100, 1)}%`)],
                  ["Depreciation", hist.depreciation],
                  ["Interest", hist.interest],
                  ["Net Profit", hist.netProfit],
                  ["Net Margin", hist.revenue.map((r, i) => `${fmt(hist.netProfit[i] / r * 100, 1)}%`)],
                  ["CFO", hist.cfo],
                ].map(([label, vals], ri) => (
                  <tr key={label} style={{ borderTop: ri === 2 || ri === 5 ? `1px solid ${C.border}` : "none" }}>
                    <td style={{ color: C.muted, fontSize: 11, padding: "3px 0" }}>{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} style={{ textAlign: "right", fontSize: 11, fontFamily: "monospace", color: typeof v === "string" && v.includes("%") ? C.muted : C.formula, paddingLeft: 8 }}>
                        {typeof v === "number" ? fmt(v, 0) : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Key Assumptions ─────────────────────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <SectionHeader title="DCF Assumptions" subtitle="Blue cells are editable inputs" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["WACC (%)", wacc, setWacc, "%", 0.5, 8, 25],
              ["Terminal Growth (%)", termGrowth, setTermGrowth, "%", 0.5, 2, 9],
              ["Long-run Tax Rate (%)", taxRateA, setTaxRateA, "%", 0.5, 20, 35],
              ["NWC as % of Rev", nwcPct, setNwcPct, "%", 0.5, 5, 40],
              ["CapEx as % of Rev", capexPct, setCapexPct, "%", 0.1, 0.2, 8],
              ["Dep'n as % of Rev", depnPct, setDepnPct, "%", 0.1, 0.2, 5],
              ["Shares Outstanding (Cr)", sharesOut, setSharesOut, "Cr", 0.1, 1, 20],
              ["Net Debt / (Cash) (₹Cr)", netDebt, setNetDebt, "Cr", 10, -500, 500],
              ["Current Market Price (₹)", currentPrice, setCurrentPrice, "₹", 50, 500, 10000],
            ].map(([label, val, setter, suf, step, min, max]) => (
              <div key={label} style={{ background: C.card, borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: C.muted, fontSize: 10, marginBottom: 4 }}>{label}</div>
                <Input value={val} onChange={setter} suffix={suf} step={step} min={min} max={max} />
              </div>
            ))}
          </div>
          {/* WACC build-up */}
          <div style={{ marginTop: 14, background: C.card, borderRadius: 6, padding: 10 }}>
            <div style={{ color: C.muted, fontSize: 10, marginBottom: 6 }}>WACC BUILD-UP (reference)</div>
            {[
              ["Risk-Free Rate (10Y G-Sec)", "6.8%"],
              ["Equity Risk Premium (India)", "5.5%"],
              ["Beta (est. for HCS sector)", "1.3x"],
              ["Cost of Equity (CAPM)", `${fmt(6.8 + 1.3 * 5.5, 1)}%`],
              ["Pre-tax Cost of Debt", "9.5%"],
              ["After-tax Cost of Debt", "7.0%"],
              ["Debt Weight (near zero)", "1%"],
              ["Equity Weight", "99%"],
              ["Blended WACC (applied)", `${wacc}%`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ color: l.includes("WACC") ? C.accent : C.formula, fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Revenue Growth & EBITDA Margin Inputs ──────────────────────────── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <SectionHeader title="Revenue Growth & Margin Assumptions (Editable)" subtitle="Adjust year-by-year growth and EBITDA margins" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: C.muted, fontSize: 11, paddingBottom: 8 }}>Year</th>
                {projYears.map((y) => <th key={y} style={{ textAlign: "center", color: C.muted, fontSize: 11, paddingBottom: 8, minWidth: 84 }}>{y}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: C.muted, fontSize: 11, paddingRight: 12 }}>Rev Growth (%)</td>
                {revGrowth.map((v, i) => (
                  <td key={i} style={{ textAlign: "center", padding: "3px 4px" }}>
                    <Input value={v} onChange={(val) => updateRevGrowth(i, val)} suffix="%" step={1} min={-20} max={100} small />
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ color: C.muted, fontSize: 11, paddingRight: 12 }}>EBITDA Margin (%)</td>
                {ebitdaMargin.map((v, i) => (
                  <td key={i} style={{ textAlign: "center", padding: "3px 4px" }}>
                    <Input value={v} onChange={(val) => updateEbitdaMargin(i, val)} suffix="%" step={0.5} min={5} max={35} small />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FCFF Projection Table ────────────────────────────────────────────── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <SectionHeader title="Free Cash Flow to Firm (FCFF) Projections (₹ Cr)" subtitle="FCFF = NOPAT + Depreciation − CapEx − ΔNWC" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: C.muted, fontSize: 11, paddingBottom: 8 }}>Item</th>
                {projYears.map((y) => <th key={y} style={{ textAlign: "right", color: C.muted, fontSize: 11, paddingBottom: 8, minWidth: 72 }}>{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Revenue", proj.rev, true, C.accent],
                ["  YoY Growth", proj.rev.map((r, i) => `${fmt(revGrowth[i], 1)}%`), false, C.muted],
                ["EBITDA", proj.ebitda, false, C.formula],
                ["  EBITDA Margin", proj.ebitda.map((e, i) => `${fmt(e / proj.rev[i] * 100, 1)}%`), false, C.muted],
                ["(–) Depreciation", proj.depn.map((d) => -d), false, C.formula],
                ["EBIT", proj.ebit, false, C.formula],
                ["(–) Taxes @" + fmt(taxRateA, 1) + "%", proj.ebit.map((e) => -e * taxRateA / 100), false, C.formula],
                ["NOPAT", proj.nopat, true, C.formula],
                ["(+) Depreciation", proj.depn, false, C.formula],
                ["(–) CapEx", proj.capex.map((c) => -c), false, C.formula],
                ["(–) ΔNWC", proj.dnwc.map((d) => -d), false, C.formula],
                ["FCFF", proj.fcff, true, C.gold],
                ["Discount Factor", proj.pvFcff.map((pv, i) => `${fmt(1 / Math.pow(1 + wacc / 100, i + 1), 3)}x`), false, C.muted],
                ["PV of FCFF", proj.pvFcff, true, C.accent],
              ].map(([label, vals, bold, color], ri) => (
                <tr key={label} style={{ borderTop: [7, 11, 13].includes(ri) ? `1px solid ${C.border}` : "none" }}>
                  <td style={{ color: color, fontSize: 11, padding: "3px 0", fontWeight: bold ? 700 : 400 }}>{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} style={{ textAlign: "right", fontSize: 11, fontFamily: "monospace", color: bold ? color : typeof v === "string" ? C.muted : v < 0 ? C.red : color, padding: "3px 0 3px 8px" }}>
                      {typeof v === "number" ? fmt(v, 1) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Valuation Bridge & Sensitivity ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Bridge */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <SectionHeader title="Valuation Bridge (₹ Cr)" subtitle="Enterprise Value → Equity Value → Per Share" />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Sum of PV (FCFF)", proj.sumPvFcff, false, C.formula],
                ["Terminal Value (Gordon Growth)", proj.terminalValue, false, C.formula],
                ["PV of Terminal Value", proj.pvTerminal, false, C.formula],
                ["PV(TV) / EV %", `${fmt(proj.pvTerminal / proj.enterpriseValue * 100, 1)}%`, false, C.muted],
                null,
                ["Enterprise Value", proj.enterpriseValue, true, C.accent],
                ["(–) Net Debt / (+) Net Cash", -netDebt, false, C.formula],
                ["Equity Value", proj.equityValue, true, C.accent],
                ["Shares Outstanding (Cr)", sharesOut, false, C.muted],
                null,
                ["Intrinsic Value Per Share", `₹${fmt(proj.intrinsicValue, 0)}`, true, C.gold],
                ["Current Market Price", `₹${fmt(currentPrice, 0)}`, false, C.formula],
                ["Upside / (Downside)", `${fmt(proj.upside, 1)}%`, true, proj.upside >= 0 ? C.green : C.red],
                null,
                ["Bull Case (+30%)", `₹${fmt(bull, 0)}`, false, C.green],
                ["Base Case", `₹${fmt(proj.intrinsicValue, 0)}`, false, C.gold],
                ["Bear Case (–30%)", `₹${fmt(bear, 0)}`, false, C.red],
              ].map((row, i) =>
                row === null ? (
                  <tr key={`sep-${i}`}><td colSpan={2}><div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0" }} /></td></tr>
                ) : (
                  <tr key={row[0]}>
                    <td style={{ color: C.muted, fontSize: 12, padding: "4px 0", fontWeight: row[2] ? 700 : 400 }}>{row[0]}</td>
                    <td style={{ textAlign: "right", fontSize: 12, fontFamily: "monospace", color: row[3], fontWeight: row[2] ? 700 : 400 }}>
                      {typeof row[1] === "number" ? fmt(row[1], 1) : row[1]}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Sensitivity */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <SectionHeader title="Sensitivity: Intrinsic Value (₹/share)" subtitle="WACC (columns) vs Terminal Growth Rate (rows)" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <td style={{ color: C.muted, padding: "4px 8px", fontSize: 10 }}>TGR \ WACC</td>
                  {waccRange.map((w) => (
                    <th key={w} style={{ textAlign: "center", color: w === wacc ? C.accent : C.muted, padding: "4px 6px", fontSize: 11, fontWeight: w === wacc ? 800 : 500 }}>
                      {w}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tgRange.map((tg, ri) => (
                  <tr key={tg}>
                    <td style={{ color: tg === termGrowth ? C.accent : C.muted, padding: "4px 8px", fontWeight: tg === termGrowth ? 800 : 500, fontSize: 11 }}>{tg}%</td>
                    {sensitivityGrid[ri].map((val, ci) => {
                      const isBase = waccRange[ci] === wacc && tg === termGrowth;
                      const col = val > currentPrice * 1.3 ? C.green : val > currentPrice ? "#86efac" : val > currentPrice * 0.7 ? C.gold : C.red;
                      return (
                        <td key={ci} style={{ textAlign: "center", padding: "4px 6px", fontFamily: "monospace", color: isBase ? C.bg : col, background: isBase ? C.accent : "transparent", borderRadius: isBase ? 4 : 0, fontWeight: isBase ? 800 : 400 }}>
                          {fmt(val, 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: C.muted }}>
            <span style={{ color: C.green }}>■</span> &gt;30% upside &nbsp;
            <span style={{ color: "#86efac" }}>■</span> &gt;0% upside &nbsp;
            <span style={{ color: C.gold }}>■</span> &gt;–30% &nbsp;
            <span style={{ color: C.red }}>■</span> &gt;30% downside
          </div>

          {/* Ratio context */}
          <div style={{ marginTop: 14, background: C.card, borderRadius: 6, padding: 10 }}>
            <div style={{ color: C.muted, fontSize: 10, marginBottom: 6 }}>IMPLIED VALUATION MULTIPLES (Base Case)</div>
            {[
              ["EV / TTM EBITDA", fmtX(proj.enterpriseValue / 247)],
              ["EV / FY25 EBITDA", fmtX(proj.enterpriseValue / 160)],
              ["P/E (FY25 EPS)", fmtX(proj.intrinsicValue / 20.21)],
              ["P/Sales (FY25)", fmtX((proj.intrinsicValue * sharesOut) / 1149)],
              ["EV/Revenue (TTM)", fmtX(proj.enterpriseValue / 1825)],
              ["Market Cap @ CMP", `₹${fmt(currentPrice * sharesOut / 100, 1)}k Cr`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ color: C.formula, fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Investment Thesis ─────────────────────────────────────────────────── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <SectionHeader title="Investment Thesis & Key Risks" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ color: C.green, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>✦ BULL CASE DRIVERS</div>
            {["India's AI & HPC infra build-out (₹10,000 Cr+ opportunity)", "Only domestic supercomputer manufacturer; NVIDIA partnership", "15 entries in global Top-500 supercomputer list", "Revenue 5Y CAGR of 49%; profit CAGR of 96%", "Near zero-debt balance sheet; ROCE ~32%", "Make-in-India tailwind; import substitution moat", "Expanding into liquid-cooled AI data centre racks (Vertiv tie-up)"].map((t) => (
              <div key={t} style={{ fontSize: 11, color: C.text, padding: "2px 0" }}>+ {t}</div>
            ))}
          </div>
          <div>
            <div style={{ color: C.red, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>✦ BEAR CASE / RISKS</div>
            {["Highly concentrated revenue: few large government/PSU clients", "CFO turned negative in FY25; high working capital intensity (~84 days)", "Premium valuation (P/E ~109x TTM) leaves no margin for error", "Semiconductor supply chain risk (NVIDIA GPUs allocation)", "Intense global competition from Dell, HPE, Lenovo", "Small-cap illiquidity; promoter holding declined to 71%", "Revenue timing risk: lumpy govt orders affect quarterly visibility"].map((t) => (
              <div key={t} style={{ fontSize: 11, color: C.text, padding: "2px 0" }}>– {t}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ color: C.muted, fontSize: 10, textAlign: "center", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        DISCLAIMER: This DCF model is for educational and informational purposes only. Not financial advice. All projections are estimates and may differ materially from actual results. Past performance is not indicative of future results. Data sourced from BSE filings, Screener.in, Equitymaster. Model date: March 2026.
      </div>
    </div>
  );
}
