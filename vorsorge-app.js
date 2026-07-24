/* =====================================================================
   VORSORGE – Logik
   Keine Speicherung von Eingaben (kein localStorage, kein Server) –
   beim Neuladen ist alles weg. Das ist gewollt (DSGVO).
   ===================================================================== */
"use strict";

/* ---------- Formatierung (deutsch) ---------- */
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const EUR0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const fmtEur = (x) => EUR.format(x);
const fmtEur0 = (x) => EUR0.format(x);
const fmtNum = (x) => NUM.format(x);
const fmtPct = (x, nk = 1) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: nk, maximumFractionDigits: nk }).format(x * 100) + " %";
const fmtAlter = (a) => {
  const j = Math.floor(a), m = Math.round((a - j) * 12);
  return m === 0 ? `${j} Jahre` : `${j} J. ${m} M.`;
};
const $ = (id) => document.getElementById(id);

/* ---------- Zustand (nur im Speicher, nie persistiert) ---------- */
const state = {
  mode: "beratung",
  systeme: { grv: false, zvk: false, beamte: false, vw: false },
};

/* ---------- Moduswechsel ---------- */
document.querySelectorAll("#modeSwitch button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll("#modeSwitch button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".modeSection").forEach((s) =>
      s.classList.toggle("active", s.id === "mode-" + state.mode));
  });
});

/* ---------- System-Auswahl (Mehrfachauswahl) ---------- */
document.querySelectorAll("#sysWahl .sysChip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const sys = chip.dataset.sys;
    state.systeme[sys] = !state.systeme[sys];
    chip.classList.toggle("on", state.systeme[sys]);
    const card = $("card-" + sys);
    if (card) card.classList.toggle("on", state.systeme[sys]);
    recalc();
  });
});

/* ---------- Eingaben binden ---------- */
function bindInputs(rootSelector) {
  document.querySelectorAll(rootSelector + " input[type=range]").forEach((inp) => {
    const out = $(inp.id.replace(/^in/, "out"));
    const show = () => {
      if (!out) return;
      const v = parseFloat(inp.value);
      switch (inp.dataset.fmt) {
        case "eur0": out.textContent = fmtEur0(v); break;
        case "jahre": out.textContent = v + " Jahre"; break;
        case "pct": out.textContent = fmtPct(v / 100, 0); break;
        default: out.textContent = String(v);
      }
    };
    inp.addEventListener("input", () => { show(); recalc(); });
    show();
  });
  document.querySelectorAll(rootSelector + " input[type=number], " + rootSelector + " select").forEach((inp) => {
    inp.addEventListener("input", recalc);
  });
}

const val = (id) => parseFloat($(id).value) || 0;

/* ---------- Gemeinsame Größen ---------- */
function commonWerte() {
  const geburtsjahr = val("inGeburtsjahr");
  const heute = 2026; // Rechenjahr = Rechtsstand
  const alter = heute - geburtsjahr;
  const rentenalter = val("inRentenalter");
  const kinder = val("inKinder");
  const kinderlos = kinder === 0 && alter >= 23;
  const rag = CONFIG.regelaltersgrenze(geburtsjahr);
  const ragDezimal = rag.jahre + rag.monate / 12;
  const rentenbeginnJahr = geburtsjahr + rentenalter;
  const jahreBisRente = Math.max(0, rentenalter - alter);
  return {
    geburtsjahr, heute, alter, rentenalter, kinder, kinderlos,
    brutto: val("inBrutto"), wunsch: val("inWunsch"),
    rag, ragDezimal, rentenbeginnJahr, jahreBisRente,
  };
}

/* PV-Satz: Rentner tragen den Pflegebeitrag voll allein; Kinderlose ab 23 zahlen mehr */
function pvSatz(kinderlos) {
  return kinderlos ? CONFIG.kvpv.pvSatzKinderlos : CONFIG.kvpv.pvSatz;
}

/* ---------- Rechenweg-Helfer ---------- */
function wegHtml(zeilen) {
  return zeilen.map((z) =>
    `<div class="wegZeile"><div><b>${z.t}</b></div><div class="wf">${z.f}</div>` +
    (z.q ? `<div class="wq">Quelle: ${z.q}</div>` : "") + `</div>`).join("");
}
function ketteHtml(zeilen) {
  return zeilen.map((z) => {
    const cls = z.art ? ` class="${z.art}"` : "";
    const sub = z.sub ? `<span class="sub">${z.sub}</span>` : "";
    return `<tr${cls}><td>${z.t}${sub}</td><td class="z">${z.v}</td></tr>`;
  }).join("");
}

/* ---------- Neuberechnung (Rechner folgen in den nächsten Schritten) ---------- */
function recalc() {
  const c = commonWerte();
  $("ragAnzeige").innerHTML =
    `Regelaltersgrenze Jahrgang ${c.geburtsjahr}: <b>${fmtAlter(c.ragDezimal)}</b> (§§ 35, 235 SGB VI)`;
  $("pvHinweis").textContent = c.kinderlos
    ? "Pflegeversicherung: Zuschlag für Kinderlose ab 23 (" + fmtPct(CONFIG.kvpv.pvSatzKinderlos) + ") wird angesetzt."
    : "Pflegeversicherung: Satz " + fmtPct(CONFIG.kvpv.pvSatz) + " (mit Kind).";
}

/* ---------- Fußzeile & Druckkopf ---------- */
(function initStatic() {
  const standTxt = "Stand: " + CONFIG.stand.replace(/(\d{4})-(\d{2})/, "$2/$1");
  $("footerText").textContent = CONFIG.disclaimer + " " + standTxt;
  $("printDatum").textContent =
    "Erstellt am " + new Date().toLocaleDateString("de-DE") + " · " + standTxt +
    " · unverbindliche Orientierung";
  bindInputs("#mode-beratung");
  recalc();
})();
