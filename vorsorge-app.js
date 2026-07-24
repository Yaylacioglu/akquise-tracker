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

/* =====================================================================
   GRV-Rechner
   ===================================================================== */
state.grvWartezeit45 = false;
document.querySelectorAll("#grvWartezeit button").forEach((b) => {
  b.addEventListener("click", () => {
    state.grvWartezeit45 = b.dataset.wz === "45";
    document.querySelectorAll("#grvWartezeit button").forEach((x) => x.classList.toggle("active", x === b));
    recalc();
  });
});

/* Zugangsfaktor § 77 SGB VI: −0,3 %/Monat vorzeitig (max. −14,4 %), +0,5 %/Monat später.
   35 J. Wartezeit: frühestens ab 63. 45 J.: abschlagsfrei ab Regelalter − 24 Monate. */
function zugangsfaktorGrv(c, wartezeit45) {
  const ragMon = c.rag.jahre * 12 + c.rag.monate;
  let wunschMon = c.rentenalter * 12;
  let hinweis = "";
  const fruehestMon = wartezeit45 ? ragMon - 24 : 63 * 12;
  if (wunschMon < fruehestMon) {
    hinweis = `Frühestmöglicher Beginn ${wartezeit45 ? "(45 J., 2 J. vor Regelalter)" : "(ab 63)"}: ` +
      fmtAlter(fruehestMon / 12) + " – Rechnung mit diesem Alter.";
    wunschMon = fruehestMon;
  }
  const diff = wunschMon - ragMon; // Monate (negativ = früher)
  let faktor = 1, detail = "";
  if (diff < 0) {
    if (wartezeit45) {
      detail = "45 Jahre Wartezeit: abschlagsfrei bis 2 Jahre vor Regelalter";
    } else {
      const abschlag = Math.min(-diff * CONFIG.grv.abschlagProMonat, CONFIG.grv.maxAbschlagAltersrente);
      faktor = 1 - abschlag;
      detail = `${-diff} Monate früher × 0,3 % = −${fmtPct(abschlag)}`;
    }
  } else if (diff > 0) {
    faktor = 1 + diff * CONFIG.grv.zuschlagProMonat;
    detail = `${diff} Monate später × 0,5 % = +${fmtPct(diff * CONFIG.grv.zuschlagProMonat)}`;
  } else {
    detail = "Rentenbeginn genau zur Regelaltersgrenze";
  }
  return { faktor, detail, hinweis, effektivMon: wunschMon };
}

function calcGrv(c) {
  const G = CONFIG.grv, K = CONFIG.kvpv;
  const epProJahr = Math.min(c.brutto, G.bbgJahr) / G.durchschnittsentgelt;
  const epEingabe = val("inGrvEp");
  const jahreBisher = val("inGrvJahre");
  const epBisher = epEingabe > 0 ? epEingabe : jahreBisher * epProJahr;
  const zf = zugangsfaktorGrv(c, state.grvWartezeit45);
  const jahreKuenftig = Math.max(0, zf.effektivMon / 12 - c.alter);
  const epGesamt = epBisher + jahreKuenftig * epProJahr;
  const brutto = epGesamt * zf.faktor * G.rentenwert;

  const kvSatzHalb = (K.kvSatz + K.kvZusatzDurchschnitt) / 2;
  const kv = brutto * kvSatzHalb;
  const pv = brutto * pvSatz(c.kinderlos);
  const netto = brutto - kv - pv;

  const beginnJahr = c.geburtsjahr + Math.round(zf.effektivMon / 12);
  const bestAnteil = Math.min(1, G.besteuerungsanteilStart2026 + Math.max(0, beginnJahr - 2026) * 0.005);

  /* EM-Näherung: bisherige EP + Zurechnungszeit bis 66 J. 3 M. (§ 59 SGB VI) */
  const zurAlter = G.emZurechnungsalter2026.jahre + G.emZurechnungsalter2026.monate / 12;
  const epEm = epBisher + Math.max(0, zurAlter - c.alter) * epProJahr;
  const emBrutto = epEm * (1 - G.emAbschlagMax) * G.rentenwert;

  return { epProJahr, epBisher, epGesamt, zf, brutto, kv, pv, netto, kvSatzHalb,
           beginnJahr, bestAnteil, emBrutto, epEm, jahreKuenftig };
}

function renderGrv(c) {
  const r = calcGrv(c);
  $("grvBrutto").textContent = fmtEur(r.brutto);
  $("grvBeginnLbl").textContent = `(Beginn ${r.beginnJahr}, mit ${fmtAlter(r.zf.effektivMon / 12)})`;
  $("grvKette").innerHTML = ketteHtml([
    { t: "Bruttorente", sub: fmtNum(r.epGesamt) + " EP × " + fmtNum(r.zf.faktor) + " × " + fmtEur(CONFIG.grv.rentenwert), v: fmtEur(r.brutto) },
    { t: "Krankenversicherung", sub: "halber Satz inkl. Ø-Zusatzbeitrag (" + fmtPct(r.kvSatzHalb, 2) + ")", v: "− " + fmtEur(r.kv), art: "minus" },
    { t: "Pflegeversicherung", sub: "voller Beitrag allein (" + fmtPct(pvSatz(c.kinderlos)) + ")", v: "− " + fmtEur(r.pv), art: "minus" },
    { t: "Netto vor Steuern", v: fmtEur(r.netto), art: "sum" },
  ]);
  $("grvSteuerHint").innerHTML =
    `<b>Steuern:</b> Bei Rentenbeginn ${r.beginnJahr} sind ${fmtPct(r.bestAnteil, 1)} der Rente steuerpflichtig ` +
    `(84 % bei Start 2026, +0,5 %-Pkt. je Jahr, 100 % ab 2058). Die tatsächliche Steuer hängt vom Gesamteinkommen ab.` +
    (r.zf.hinweis ? `<br><b>Hinweis:</b> ${r.zf.hinweis}` : "");
  $("grvEmBox").innerHTML =
    `<b>Gesprächseinstieg BU/EM:</b> Bei voller Erwerbsminderung heute ergäbe die Näherung ca. ` +
    `<b>${fmtEur(r.emBrutto)}</b> brutto/Monat (EP bisher + Zurechnungszeit bis ` +
    `${CONFIG.grv.emZurechnungsalter2026.jahre} J. ${CONFIG.grv.emZurechnungsalter2026.monate} M., Abschlag −10,8 %). ` +
    `Voraussetzung u. a. 3/5-Belegung – dieser Schutz erlischt bei Lücken schleichend.`;
  $("grvKinderHint").innerHTML = c.kinder > 0
    ? `Kindererziehung: ${c.kinder} Kind(er) × ca. 3 EP ≈ <b>+ ${fmtEur(c.kinder * 3 * CONFIG.grv.rentenwert)}/Monat</b>, ` +
      `falls noch nicht in den Entgeltpunkten enthalten (§ 70 Abs. 2 SGB VI, Mütterrente III ab 2027 einheitlich 36 Monate).`
    : "";
  $("grvWeg").innerHTML = wegHtml([
    { t: "Entgeltpunkte pro Jahr", f: `min(${fmtEur0(c.brutto)}; BBG ${fmtEur0(CONFIG.grv.bbgJahr)}) ÷ Durchschnittsentgelt ${fmtEur0(CONFIG.grv.durchschnittsentgelt)} = ${fmtNum(r.epProJahr)} EP`, q: "§ 63 SGB VI; DRV-Werte 2026, deutsche-rentenversicherung.de" },
    { t: "Entgeltpunkte gesamt", f: `${fmtNum(r.epBisher)} EP bisher + ${fmtNum(r.jahreKuenftig)} Jahre × ${fmtNum(r.epProJahr)} EP = ${fmtNum(r.epGesamt)} EP`, q: "eigene Näherung; genaue EP lt. Renteninformation" },
    { t: "Zugangsfaktor", f: `${r.zf.detail} → Faktor ${fmtNum(r.zf.faktor)}`, q: "§ 77 SGB VI, gesetze-im-internet.de" },
    { t: "Bruttorente", f: `${fmtNum(r.epGesamt)} EP × ${fmtNum(r.zf.faktor)} × ${fmtEur(CONFIG.grv.rentenwert)} = ${fmtEur(r.brutto)}`, q: "§ 64 SGB VI; Rentenwert ab 01.07.2026" },
    { t: "KV-Beitrag (Rentner zahlt die Hälfte)", f: `${fmtEur(r.brutto)} × (14,6 % + 2,9 %) ÷ 2 = ${fmtEur(r.kv)}`, q: "§ 249a SGB V" },
    { t: "PV-Beitrag (Rentner allein)", f: `${fmtEur(r.brutto)} × ${fmtPct(pvSatz(c.kinderlos))} = ${fmtEur(r.pv)}`, q: "§ 59 SGB XI" },
    { t: "EM-Näherung", f: `(${fmtNum(r.epBisher)} EP + Zurechnung bis 66 J. 3 M.) × 0,892 × ${fmtEur(CONFIG.grv.rentenwert)} = ${fmtEur(r.emBrutto)}`, q: "§§ 59, 77 SGB VI" },
  ]);
}

/* ---------- Neuberechnung ---------- */
function recalc() {
  const c = commonWerte();
  $("ragAnzeige").innerHTML =
    `Regelaltersgrenze Jahrgang ${c.geburtsjahr}: <b>${fmtAlter(c.ragDezimal)}</b> (§§ 35, 235 SGB VI)`;
  $("pvHinweis").textContent = c.kinderlos
    ? "Pflegeversicherung: Zuschlag für Kinderlose ab 23 (" + fmtPct(CONFIG.kvpv.pvSatzKinderlos) + ") wird angesetzt."
    : "Pflegeversicherung: Satz " + fmtPct(CONFIG.kvpv.pvSatz) + " (mit Kind).";
  if (state.systeme.grv) renderGrv(c);
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
