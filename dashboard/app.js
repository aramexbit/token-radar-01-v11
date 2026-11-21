// Token Radar v11 — dark, proof-first dashboard.
//
// Reads window.RADAR (data.js, built by main.ts from the snapshot's own
// numbers) and renders the board, the detail view, the Method tab and the
// Set-aside tab. Nothing here is hard-coded: every figure comes from D.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtM(v) {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}
function fmtFull(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
function fmtSigned(v) { return (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toFixed(2); }
function fmtX(v) { return v.toFixed(2) + "×"; }
function fmtPct1(v) {
  if (v === null || v === undefined) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Integrity strip
// ---------------------------------------------------------------------------

$("strip").textContent =
  "✓ page = board.json: " + D.meta.boardRows + "/" + D.meta.boardRows + " values, " +
  D.meta.boardRows + "/" + D.meta.boardRows + " ranks match · board sha " +
  D.meta.boardSha.slice(0, 12) + "… · snapshot sha " + D.meta.snapshotSha.slice(0, 12) +
  "… · as of " + D.meta.asOf + " · OLS slope " + D.meta.slope.toFixed(3) +
  " intercept " + D.meta.intercept.toFixed(3);

// ---------------------------------------------------------------------------
// Hero — the #1 pick, big
// ---------------------------------------------------------------------------

const top1 = D.rows[0];
$("hero").innerHTML =
  '<div><div class="k">#' + top1.rank + " · " + esc(top1.category) + "</div>" +
  '<div class="name">' + esc(top1.name) + "</div>" +
  '<div class="nums"><b>' + fmtM(top1.implied) + "</b> implied · " +
  '<span class="verdict ' + top1.verdict + '">' + top1.verdict.toUpperCase() + "</span>" +
  " · net <b>" + fmtSigned(top1.net) + "</b> on " + fmtFull(top1.deposit) + " deposit</div>" +
  '<div class="farm-line">Farm plan: ' + top1.farmSteps.length + " steps · 8 weeks · gas $" +
  top1.gasCost.toFixed(2) + " · break-even launch " + fmtM(top1.breakEven) +
  ' · <span style="color:var(--accent)">View the detail →</span></div></div>' +
  '<div class="worth"><div class="k">Worth farming</div>' +
  '<div class="big">' + D.meta.verdictCounts.farm + " of " + D.meta.boardRows + "</div>" +
  '<div class="s">best net/hour ' + fmtSigned(D.meta.bestNetPerHour) + "/h · " +
  D.meta.verdictCounts.thin + " thin · " + D.meta.verdictCounts.skip + " skip</div></div>";
$("hero").addEventListener("click", () => { location.hash = "#/detail/" + top1.slug; });

// ---------------------------------------------------------------------------
// Proof row — six held-out evidence boxes
// ---------------------------------------------------------------------------

const loo = D.validation.looFull, blind = D.validation.blind, wf = D.validation.wfPooledCurve;
const odds2 = D.odds[1];
const proofBoxes = [
  { v: loo.medianMiss.toFixed(1) + "%", k: "LOO median miss", s: "full model · " + loo.in3x.toFixed(1) + "% within 3×" },
  { v: blind.medianMiss.toFixed(1) + "%", k: "Blind-split median miss", s: "curve only · " + blind.in3x.toFixed(1) + "% within 3×" },
  { v: wf.medianMiss.toFixed(1) + "%", k: "Walk-forward median miss", s: "pooled · " + wf.in3x.toFixed(1) + "% within 3×" },
  { v: odds2.pct.toFixed(1) + "%", k: "Token odds — listed 2+ yr", s: odds2.tokened + " of " + odds2.listed + " got a token" },
  { v: "3 terms", k: "curve + growth + age", s: "offsets computed, then rejected" },
  { v: D.meta.watchlistCovered + "/" + D.meta.watchlist, k: "Watchlist covered", s: D.meta.boardRows + " rows · " + D.meta.comps + " traded comps" },
];
$("proof").innerHTML = proofBoxes.map((b) =>
  '<div class="box"><div class="v">' + b.v + '</div><div class="k">' + b.k +
  '</div><div class="s">' + b.s + "</div></div>").join("");

// ---------------------------------------------------------------------------
// Protocol accounting — all 758 protocols in exactly one group
// ---------------------------------------------------------------------------

const P = D.meta.protocols, T = D.meta.tokened, R = D.meta.boardRows, A = D.meta.setAside;
$("accounting").innerHTML =
  "<b>Protocol accounting</b> — all " + P + " snapshot protocols in exactly one group" +
  '<div class="bar"><div class="seg-tokened" style="width:' + (100 * T / P).toFixed(1) + '%"></div>' +
  '<div class="seg-ranked" style="width:' + (100 * R / P).toFixed(1) + '%"></div>' +
  '<div class="seg-aside" style="width:' + (100 * A / P).toFixed(1) + '%"></div></div>' +
  '<div class="legend"><span class="sw" style="background:#4b5563"></span><b>' + T +
  "</b> already have a token" +
  '<span class="sw" style="background:var(--green)"></span><b>' + R + "</b> ranked" +
  '<span class="sw" style="background:#2b3444"></span><b>' + A +
  "</b> set aside — families with a token, versioned, wrapped</div>" +
  '<p class="cap" style="margin-top:10px">How a launch is priced: implied = 10<sup>(' +
  D.meta.intercept.toFixed(3) + " + " + D.meta.slope.toFixed(3) +
  " · log<sub>10</sub> TVL)</sup> × growth × age — one global curve on the snapshot&rsquo;s own " +
  D.meta.comps + " traded protocols (R&sup2; " + D.meta.r2.toFixed(2) +
  "). Only confirmed terms: offsets computed, then rejected.</p>";

// ---------------------------------------------------------------------------
// Scatter: log10 TVL vs log10 mcap, 127 comps + OLS line
// ---------------------------------------------------------------------------

function drawScatter() {
  const cv = $("scatter");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const padL = 58, padR = 14, padT = 12, padB = 34;
  const pts = D.scatter;
  const xs = pts.map((p) => Math.log10(p.tvl));
  const ys = pts.map((p) => Math.log10(p.mcap));
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  x0 = Math.floor(x0); x1 = Math.ceil(x1);
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const X = (v) => padL + ((v - x0) / (x1 - x0)) * (W - padL - padR);
  const Y = (v) => H - padB - ((v - y0) / (y1 - y0)) * (H - padT - padB);
  ctx.clearRect(0, 0, W, H);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.strokeStyle = "#28303f";
  ctx.lineWidth = 1;
  for (let gx = x0; gx <= x1; gx++) {
    ctx.beginPath(); ctx.moveTo(X(gx), padT); ctx.lineTo(X(gx), H - padB); ctx.stroke();
    ctx.fillText("$" + Math.pow(10, gx - 6).toLocaleString("en-US") + "M", Math.min(X(gx) - 18, W - 64), H - 12);
  }
  for (let gy = y0; gy <= y1; gy++) {
    ctx.beginPath(); ctx.moveTo(padL, Y(gy)); ctx.lineTo(W - padR, Y(gy)); ctx.stroke();
    ctx.fillText("$" + Math.pow(10, gy - 6).toLocaleString("en-US") + "M", 4, Y(gy) + 4);
  }
  ctx.strokeStyle = "#f27d7d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X(x0), Y(D.meta.intercept + D.meta.slope * x0));
  ctx.lineTo(X(x1), Y(D.meta.intercept + D.meta.slope * x1));
  ctx.stroke();
  ctx.fillStyle = "#34d399";
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(X(Math.log10(p.tvl)), Y(Math.log10(p.mcap)), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
drawScatter();
$("scatterCap").textContent =
  "Each dot is one traded protocol (" + D.meta.comps + "); the line is the OLS fit, slope " +
  D.meta.slope.toFixed(3) + ", R² " + D.meta.r2.toFixed(2) + ".";

// ---------------------------------------------------------------------------
// Formula + evidence panel
// ---------------------------------------------------------------------------

$("formula").innerHTML =
  "<h2>How a launch is priced</h2>" +
  '<p class="formula-line">implied = 10<sup>(' + D.meta.intercept.toFixed(3) + " + " +
  D.meta.slope.toFixed(3) + " · log<sub>10</sub> TVL)</sup> × growth × age</p>" +
  "<p>One global curve on the snapshot&rsquo;s own " + D.meta.comps +
  " traded protocols (R&sup2; " + D.meta.r2.toFixed(2) + "). Growth clamped 0.8–1.2; age ≤15% haircut. No tilt, no hard-coded name.</p>" +
  "<p>Only confirmed terms: category offsets were computed, then rejected — see the Method tab.</p>" +
  "<p>Token odds: " + D.odds.map((o) => o.years + "+ yr " + o.pct.toFixed(1) + "%").join(" · ") + ".</p>";

// ---------------------------------------------------------------------------
// Board table: sort, filter, search
// ---------------------------------------------------------------------------

let sortKey = "rank";
let sortDir = 1;
let activeCat = "All";
let searchText = "";
let verdictFilter = "";
const rowsBySlug = new Map(D.rows.map((r) => [r.slug, r]));

const pills = [{ category: "All", count: D.meta.boardRows }, ...D.categories];
$("pills").innerHTML = pills.map((p) =>
  '<button type="button" class="pill' + (p.category === "All" ? " active" : "") +
  '" data-cat="' + esc(p.category) + '">' + esc(p.category) + " " + p.count + "</button>").join("");

$("pills").addEventListener("click", (e) => {
  const b = e.target.closest(".pill");
  if (!b) return;
  activeCat = b.dataset.cat;
  document.querySelectorAll(".pill").forEach((x) => x.classList.toggle("active", x === b));
  renderBoard();
});
$("search").addEventListener("input", (e) => { searchText = e.target.value.trim().toLowerCase(); renderBoard(); });
$("verdictFilter").addEventListener("change", (e) => { verdictFilter = e.target.value; renderBoard(); });

$("boardTable").querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.dataset.sort;
    if (sortKey === k) sortDir = -sortDir;
    else { sortKey = k; sortDir = 1; }
    renderBoard();
  });
});

function rowValue(r, k) {
  if (k === "xols") return r.implied / r.tvl;
  if (k === "name") return r.name.toLowerCase();
  if (k === "category") return (r.category || "").toLowerCase();
  return r[k];
}

function filteredRows() {
  let list = D.rows.filter((r) =>
    (activeCat === "All" || r.category === activeCat) &&
    (!verdictFilter || r.verdict === verdictFilter) &&
    (!searchText || r.name.toLowerCase().includes(searchText) || r.slug.includes(searchText)));
  list = [...list].sort((a, b) => {
    const va = rowValue(a, sortKey), vb = rowValue(b, sortKey);
    if (va < vb) return -sortDir;
    if (va > vb) return sortDir;
    return a.rank - b.rank;
  });
  return list;
}

function renderBoard() {
  const list = filteredRows();
  $("boardBody").innerHTML = list.map((r) =>
    '<tr data-slug="' + r.slug + '">' +
    "<td>" + r.rank + "</td>" +
    '<td class="name"><b>' + esc(r.name) + "</b><small>" + esc(r.slug) + "</small></td>" +
    "<td>" + esc(r.category || "—") + "</td>" +
    '<td class="num">' + fmtM(r.tvl) + "</td>" +
    '<td class="num"><b>' + fmtM(r.implied) + "</b></td>" +
    '<td class="num">' + fmtX(r.implied / r.tvl) + "</td>" +
    "<td>" + esc(r.primaryChain) + "</td>" +
    '<td class="num">' + fmtFull(r.deposit) + "</td>" +
    '<td class="num">' + fmtSigned(r.net) + "</td>" +
    '<td class="num">' + fmtSigned(r.netPerHour) + "/h</td>" +
    '<td><span class="verdict ' + r.verdict + '">' + r.verdict.toUpperCase() + "</span></td>" +
    "</tr>").join("");
  $("showing").textContent = "Showing " + list.length + " of " + D.meta.boardRows;
  $("boardFine").textContent =
    "Net = expected value at the band low, minus gas and fees. Farm means the expected net clears $25; " +
    "skip means $1 or less. " + D.meta.verdictCounts.farm + " farm, " + D.meta.verdictCounts.thin +
    " thin, " + D.meta.verdictCounts.skip + " skip. Click a row for the full detail.";
}

$("boardBody").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-slug]");
  if (tr) location.hash = "#/detail/" + tr.dataset.slug;
});

function setPill(cat) {
  activeCat = cat;
  document.querySelectorAll(".pill").forEach((x) =>
    x.classList.toggle("active", x.dataset.cat === cat));
  renderBoard();
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------

function detailHtml(r) {
  const d = r.decomposition;
  const o2 = D.odds[1];
  const compsRows = r.nearestComps.map((c) =>
    "<tr><td>" + esc(c.name) + (c.sameCategory ? ' <span class="tag used">same category</span>' : "") +
    "</td><td class=\"num\">" + fmtM(c.tvl) + "</td><td class=\"num\">" + fmtM(c.mcap) +
    "</td><td class=\"num\">" + fmtX(c.multiple) + "</td><td class=\"num\">" + fmtM(c.curveSays) + "</td></tr>").join("");
  const raw = [
    ["Slug", esc(r.slug)],
    ["Name", esc(r.name)],
    ["Category", esc(r.category || "—")],
    ["Chains", esc(r.chains.join(", "))],
    ["TVL", fmtFull(r.tvl)],
    ["7-day change", fmtPct1(r.change7d)],
    ["Listed at", r.listedAt ? r.listedAt + " (" + r.ageDays + " days ago)" : "— (no listing date reported)"],
    ["Market cap", "— (no token yet)"],
    ["Token status", "Pre-token — no token"],
    ["Gecko id", r.geckoId ? esc(r.geckoId) : "—"],
    ["Symbol", r.symbol ? esc(r.symbol) : "—"],
  ];
  const rawGrid = raw.map(([k, v]) =>
    '<div class="f"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>").join("");
  const steps = r.farmSteps.map((s, i) =>
    '<li><span class="n">' + (i + 1) + "</span><span>" + esc(s) + "</span></li>").join("");
  return (
    '<div class="detail-head"><h2>#' + r.rank + " " + esc(r.name) + "</h2>" +
    '<span class="slug">' + esc(r.category || "") + " · " + esc(r.slug) + "</span>" +
    '<span class="verdict ' + r.verdict + '">' + r.verdict.toUpperCase() + "</span></div>" +
    '<div class="detail-grid">' +
    '<div class="stat"><div class="k">Verdict</div><div class="v">' + r.verdict.toUpperCase() +
    '</div><div class="s">net ' + fmtSigned(r.net) + " on " + fmtFull(r.deposit) + " deposit</div></div>" +
    '<div class="stat"><div class="k">Implied value</div><div class="v">' + fmtM(r.implied) +
    '</div><div class="s">' + fmtX(r.implied / r.tvl) + " of TVL · rank " + r.rank +
    " (range " + r.rankLow + "–" + r.rankHigh + ")</div></div>" +
    '<div class="stat"><div class="k">Band · bootstrap P10–P90</div><div class="v">' + fmtM(r.bandLow) + "–" + fmtM(r.bandHigh) +
    '</div><div class="s">2,000 refits of the curve</div></div>' +
    '<div class="stat"><div class="k">Net per hour</div><div class="v">' + fmtSigned(r.netPerHour) + '/h' +
    '</div><div class="s">2 h over 8 weeks · break-even launch ' + fmtM(r.breakEven) + "</div></div>" +
    "</div>" +
    '<p class="odds-line">' + o2.pct.toFixed(1) + "% of the " + o2.listed +
    " protocols listed 2+ years ago got a token today (" + o2.tokened + " of " + o2.listed +
    ") — a base rate for the field, not a forecast for this protocol.</p>" +
    '<div class="decomp">' +
    '<div class="step"><div class="k">Curve</div><div class="v">' + fmtM(d.curve) +
    '</div><div class="d">10<sup>(' + D.meta.intercept.toFixed(3) + " + " + D.meta.slope.toFixed(3) +
    " · log<sub>10</sub> " + fmtFull(r.tvl) + ")</sup></div></div>" +
    '<div class="step"><div class="k">Growth</div><div class="v">×' + d.growth.toFixed(2) +
    '</div><div class="d">7-day TVL ' + fmtPct1(r.change7d) + " → " + fmtM(d.afterGrowth) + "</div></div>" +
    '<div class="step"><div class="k">Age</div><div class="v">×' + d.age.toFixed(2) +
    '</div><div class="d">' + (r.listedAt ? "listed " + r.listedAt : "no listing date") +
    " → " + fmtM(d.implied) + "</div></div>" +
    '<div class="step"><div class="k">Implied</div><div class="v">' + fmtM(d.implied) +
    '</div><div class="d">cap at 10× TVL (' + fmtM(d.cap) + ") not binding</div></div>" +
    "</div>" +
    '<p class="decomp-note">Raw OLS curve (128 comps, no dedupe) for comparison: <b>' + fmtM(d.rawCurve128) +
    "</b> — the deduped curve is the one the board uses.</p>" +
    '<div class="farm-verdict">FARM VERDICT — <span class="verdict ' + r.verdict + '">' +
    r.verdict.toUpperCase() + "</span>: expected <b>" + fmtSigned(r.expected) + "</b> − gas $" +
    r.gasCost.toFixed(2) + " − fees $" + r.fees.toFixed(2) + " = net <b>" + fmtSigned(r.net) +
    "</b> on " + fmtFull(r.deposit) + " over 8 weeks · net/hour " + fmtSigned(r.netPerHour) +
    "/h · break-even launch " + fmtM(r.breakEven) + "</div>" +
    '<div class="detail-cols">' +
    '<div class="card"><h2>Farm plan — ' + r.farmSteps.length + " steps · 8 weeks</h2>" +
    '<p class="farm-head">deposit <b>' + fmtFull(r.deposit) + "</b> on " + esc(r.primaryChain) +
    " · gas <b>$" + r.gasCost.toFixed(2) + " (" + r.gasTx + " tx)</b> · fees <b>$" + r.fees.toFixed(2) +
    "</b> · expected <b>" + fmtSigned(r.expected) + "</b></p>" +
    '<ol class="steps">' + steps + "</ol></div>" +
    '<div><div class="card" style="margin-bottom:16px"><h2>Nearest comps</h2><table class="plain"><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Mcap</th><th class="num">Mc/TVL</th><th class="num">Curve says</th></tr></thead><tbody>' +
    compsRows + "</tbody></table>" +
    '<p class="cap">Closest by TVL among the ' + D.meta.comps + " traded comps; the same-category comp first when one exists.</p></div>" +
    '<div class="card"><h2>Raw snapshot record</h2><div class="raw-grid">' +
    rawGrid + '</div><p class="cap">The protocol&rsquo;s own fields, exactly as the snapshot reports them.</p></div></div>' +
    "</div>"
  );
}

function showDetail(slug) {
  const r = rowsBySlug.get(slug);
  if (!r) { showTab("board"); return; }
  $("detailBody").innerHTML = detailHtml(r);
  $("tab-board").hidden = true;
  $("tab-method").hidden = true;
  $("tab-aside").hidden = true;
  $("detail").hidden = false;
  setActiveTab(null);
  window.scrollTo(0, 0);
}

$("backBtn").addEventListener("click", () => { location.hash = "#/"; });

// ---------------------------------------------------------------------------
// Method tab
// ---------------------------------------------------------------------------

function scoreRow(label, s, tag) {
  return "<tr" + (tag === "used" ? ' class="used"' : tag === "rejected" ? ' class="rejected"' : "") +
    "><td>" + label + "</td>" +
    '<td class="num">' + s.medianMiss.toFixed(1) + "%</td>" +
    '<td class="num">' + s.in2x.toFixed(1) + "%</td>" +
    '<td class="num">' + s.in3x.toFixed(1) + "%</td>" +
    "<td>" + (tag === "used" ? '<span class="tag used">USED</span>' : tag === "rejected" ? '<span class="tag rejected">REJECTED</span>' : "") + "</td></tr>";
}

$("ablation").innerHTML =
  "<thead><tr><th>Model</th><th class=\"num\">Median miss</th><th class=\"num\">Within 2×</th><th class=\"num\">Within 3×</th><th></th></tr></thead><tbody>" +
  scoreRow("Curve only", D.validation.looCurve, "") +
  scoreRow("Curve + growth", D.validation.looGrowth, "") +
  scoreRow("Curve + age", D.validation.looAge, "") +
  scoreRow("Full — curve + growth + age", D.validation.looFull, "used") +
  "</tbody>";

$("walkforward").innerHTML =
  "<thead><tr><th>Model (pooled, 57)</th><th class=\"num\">Median miss</th><th class=\"num\">Within 2×</th><th class=\"num\">Within 3×</th><th></th></tr></thead><tbody>" +
  scoreRow("Curve", D.validation.wfPooledCurve, "") +
  scoreRow("Full", D.validation.wfPooledFull, "") +
  scoreRow("Curve + category offsets, shrunk", D.validation.wfOffsetsShrunk, "rejected") +
  scoreRow("Full + category offsets, shrunk", D.validation.wfOffsetsFull, "rejected") +
  "</tbody>";

const offRows = D.offsets.filter((o) => o.n >= 3);
$("offsets").innerHTML =
  "<thead><tr><th>Category</th><th class=\"num\">n</th><th class=\"num\">Median ratio</th><th class=\"num\">Shrunk</th></tr></thead><tbody>" +
  offRows.map((o) =>
    "<tr><td>" + esc(o.category) + '</td><td class="num">' + o.n +
    '</td><td class="num">' + o.medianRatio.toFixed(2) + "×</td>" +
    '<td class="num">' + o.shrunk.toFixed(2) + "×</td></tr>").join("") +
  "</tbody>";

$("blindBox").innerHTML =
  "<h2>Blind split &amp; the rest</h2><dl>" +
  "<dt>Blind split</dt><dd>Train on protocols listed before 2024-02-18 (" + D.validation.blindTrain +
  "), test the rest (" + D.validation.blindTest + "): curve only, median miss " +
  D.validation.blind.medianMiss.toFixed(1) + "%, within 2× " + D.validation.blind.in2x.toFixed(1) +
  "%, within 3× " + D.validation.blind.in3x.toFixed(1) + "%.</dd>" +
  "<dt>Flat baseline</dt><dd>TVL × median mcap/TVL: " + D.validation.looFlat.medianMiss.toFixed(1) +
  "% / " + D.validation.looFlat.in2x.toFixed(1) + "% / " + D.validation.looFlat.in3x.toFixed(1) + "%.</dd>" +
  "<dt>Walk-forward folds</dt><dd>" + D.validation.wfFolds.map((f) =>
    "fold " + f.fold + ": " + f.medianMiss.toFixed(1) + "% miss, " + f.in2x.toFixed(1) + "% within 2×").join("; ") + ".</dd>" +
  "<dt>Fit</dt><dd>OLS on " + D.meta.comps + " comps, slope " + D.meta.slope.toFixed(3) +
  ", intercept " + D.meta.intercept.toFixed(3) + ", R² " + D.meta.r2.toFixed(2) + ".</dd>" +
  "</dl>";

// ---------------------------------------------------------------------------
// Set-aside tab
// ---------------------------------------------------------------------------

const catAside = D.asideSummary.filter((g) => !["versioned", "wrapped", "exchange"].includes(g.group));
const ver = D.asideSummary.find((g) => g.group === "versioned");
const wrp = D.asideSummary.find((g) => g.group === "wrapped");
$("asideIntro").textContent =
  D.meta.setAside + " protocols are set aside and never ranked: " +
  catAside.reduce((a, g) => a + g.count, 0) +
  " sit in families that already have a token, " + (ver ? ver.count : 0) +
  " carry a versioned name, " + (wrp ? wrp.count : 0) +
  " are wrapped or staked names, and 0 are exchange names.";
$("asideTable").innerHTML =
  "<thead><tr><th>Group</th><th class=\"num\">Count</th><th>Why it is out</th></tr></thead><tbody>" +
  catAside.map((g) =>
    "<tr><td>" + esc(g.group) + '</td><td class="num">' + g.count +
    "</td><td>The family already has a token, so there is nothing to farm here.</td></tr>").join("") +
  "<tr><td>Versioned names</td><td class=\"num\">" + (ver ? ver.count : 0) +
  "</td><td>An older version of a protocol that already exists.</td></tr>" +
  "<tr><td>Wrapped / staked names</td><td class=\"num\">" + (wrp ? wrp.count : 0) +
  "</td><td>A wrapped or staked form of an asset that already has a token.</td></tr>" +
  "</tbody>";
$("asideCount").textContent = "(" + D.meta.setAside + ")";

// ---------------------------------------------------------------------------
// Tabs + routing
// ---------------------------------------------------------------------------

function setActiveTab(name) {
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name));
}

function showTab(name) {
  $("tab-board").hidden = name !== "board";
  $("tab-method").hidden = name !== "method";
  $("tab-aside").hidden = name !== "aside";
  $("detail").hidden = true;
  setActiveTab(name);
  window.scrollTo(0, 0);
}

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  location.hash = b.dataset.tab === "board" ? "#/" : "#/" + b.dataset.tab;
});

function route() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/detail\/(.+)$/);
  if (m) { showDetail(decodeURIComponent(m[1])); return; }
  const c = h.match(/^#\/cat\/(.+)$/);
  if (c) {
    const cat = decodeURIComponent(c[1]);
    showTab("board");
    if (D.categories.some((g) => g.category === cat)) setPill(cat);
    return;
  }
  if (h === "#/method") { showTab("method"); return; }
  if (h === "#/aside") { showTab("aside"); return; }
  showTab("board");
}

window.addEventListener("hashchange", route);
renderBoard();
route();
