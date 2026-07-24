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
    inp._show = show; // für Resync nach Formular-Restore (pageshow)
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

/* =====================================================================
   ZVK/VBL-Rechner (Punktemodell ATV/ATV-K)
   ===================================================================== */
state.zvkEntgeltTouched = false;
$("inZvkEntgelt").addEventListener("input", () => { state.zvkEntgeltTouched = true; });
$("inBrutto").addEventListener("input", () => {
  // Entgelt folgt dem Brutto, solange der Berater es nicht selbst angefasst hat
  if (!state.zvkEntgeltTouched) {
    $("inZvkEntgelt").value = Math.min(100000, val("inBrutto"));
    $("outZvkEntgelt").textContent = fmtEur0(val("inZvkEntgelt"));
  }
});

function zvkAltersfaktor(alter) {
  const T = CONFIG.vbl.altersfaktoren;
  if (alter >= 64) return T[64];
  if (alter < 17) return T[17];
  return T[alter];
}

function calcZvk(c) {
  const V = CONFIG.vbl, K = CONFIG.kvpv;
  const entgelt = val("inZvkEntgelt");
  const eintritt = val("inZvkEintritt");
  const vpEingabe = val("inZvkVp");
  const renteJahr = c.geburtsjahr + c.rentenalter;

  const startJahr = vpEingabe > 0 ? c.heute : eintritt;
  let vp = vpEingabe > 0 ? vpEingabe : 0;
  let vpProJahrAktuell = 0;
  for (let jahr = startJahr; jahr < renteJahr; jahr++) {
    const alter = jahr - c.geburtsjahr;
    if (alter < 17) continue;
    const j = entgelt / V.referenzentgeltJahr * zvkAltersfaktor(alter);
    vp += j;
    if (jahr === c.heute) vpProJahrAktuell = j;
  }
  if (!vpProJahrAktuell) vpProJahrAktuell = entgelt / V.referenzentgeltJahr * zvkAltersfaktor(c.alter);

  // Abschlag: 0,3 %/Monat vor der Regelaltersgrenze, max. 10,8 %
  const ragMon = c.rag.jahre * 12 + c.rag.monate;
  const frueher = Math.max(0, ragMon - c.rentenalter * 12);
  const abschlag = Math.min(frueher * V.abschlagProMonat, V.abschlagMax);
  const brutto = vp * V.messbetrag * (1 - abschlag);

  // Wartezeit 60 Monate Pflichtversicherung (Eintritt bis Rentenbeginn)
  const pflichtMonate = Math.max(0, (renteJahr - eintritt) * 12);

  // Betriebsrente: VOLLER KV-Satz, Freibetrag nur KV; PV voll ohne Freibetrag
  const kvSatzVoll = K.kvSatz + K.kvZusatzDurchschnitt;
  const kv = Math.max(0, brutto - K.betriebsrenteFreibetragKV) * kvSatzVoll;
  const pv = brutto * pvSatz(c.kinderlos);
  const netto = brutto - kv - pv;

  // Kaufkraft-/Dynamikvergleich: ZVK +1 % p. a. vs. Beispiel-GRV-Anpassung
  const g = CONFIG.annahmen.grvAnpassungLangfrist;
  const dyn = [10, 20].map((n) => ({
    n,
    zvk: brutto * Math.pow(1 + V.dynamikProJahr, n),
    grv: brutto * Math.pow(1 + g, n),
  }));

  return { entgelt, eintritt, vp, vpProJahrAktuell, abschlag, frueher, brutto,
           kv, pv, netto, kvSatzVoll, pflichtMonate, dyn, renteJahr };
}

function renderZvk(c) {
  const r = calcZvk(c);
  const K = CONFIG.kvpv;
  $("zvkBrutto").textContent = fmtEur(r.brutto);
  $("zvkBeginnLbl").textContent = `(Beginn ${r.renteJahr}, ${fmtNum(r.vp)} Versorgungspunkte)`;
  $("zvkKette").innerHTML = ketteHtml([
    { t: "Betriebsrente brutto", sub: fmtNum(r.vp) + " VP × 4,00 € × " + fmtNum(1 - r.abschlag), v: fmtEur(r.brutto) },
    { t: "Krankenversicherung", sub: `voller Satz ${fmtPct(r.kvSatzVoll, 1)} auf (Rente − Freibetrag ${fmtEur(K.betriebsrenteFreibetragKV)})`, v: "− " + fmtEur(r.kv), art: "minus" },
    { t: "Pflegeversicherung", sub: "voller Beitrag, ohne Freibetrag (" + fmtPct(pvSatz(c.kinderlos)) + ")", v: "− " + fmtEur(r.pv), art: "minus" },
    { t: "Netto vor Steuern", v: fmtEur(r.netto), art: "sum" },
  ]);
  const warn = $("zvkWartezeitWarn");
  if (r.pflichtMonate < CONFIG.vbl.wartezeitMonate) {
    warn.style.display = "block";
    warn.innerHTML = `<b>Wartezeit nicht erfüllt (${r.pflichtMonate} von 60 Monaten):</b> ` +
      `Bei Ausscheiden vor Erfüllung der Wartezeit verfällt die Anwartschaft ersatzlos (§ 34 ATV).`;
  } else warn.style.display = "none";
  $("zvkDynamik").innerHTML =
    `<b>Dynamik-Falle:</b> Die Betriebsrente steigt nur 1 %/Jahr, die GRV folgt den Löhnen ` +
    `(01.07.2026: +4,24 %). Beispiel bei ${fmtPct(CONFIG.annahmen.grvAnpassungLangfrist)} GRV-Dynamik: ` +
    r.dyn.map((d) => `nach ${d.n} Rentenjahren ${fmtEur0(d.zvk)} statt ${fmtEur0(d.grv)}`).join(" · ") +
    ` → reale Entwertung als Beratungsargument.`;
  $("zvkWeg").innerHTML = wegHtml([
    { t: "Versorgungspunkte pro Jahr (aktuell)", f: `${fmtEur0(r.entgelt)} ÷ 12.000 € × Altersfaktor ${fmtNum(zvkAltersfaktor(c.alter))} (Alter ${c.alter}) = ${fmtNum(r.vpProJahrAktuell)} VP`, q: "§ 36 ATV (Punktemodell), vbl.de / versorgungskassen.de" },
    { t: "Summe Versorgungspunkte", f: `${fmtNum(r.vp)} VP (jahrweise mit Altersfaktor summiert${val("inZvkVp") > 0 ? ", inkl. vorhandener VP lt. Mitteilung" : ", ab Eintritt " + r.eintritt})`, q: "§ 36 ATV" },
    { t: "Abschlag", f: r.frueher > 0 ? `${r.frueher} Monate vor Regelaltersgrenze × 0,3 % = −${fmtPct(r.abschlag)} (max. 10,8 %)` : "kein Abschlag (Beginn ab Regelaltersgrenze)", q: "§ 35 ATV" },
    { t: "Betriebsrente", f: `${fmtNum(r.vp)} VP × 4,00 € × ${fmtNum(1 - r.abschlag)} = ${fmtEur(r.brutto)}`, q: "Messbetrag § 35 ATV" },
    { t: "KV-Beitrag (voller Satz!)", f: `(${fmtEur(r.brutto)} − ${fmtEur(K.betriebsrenteFreibetragKV)}) × 17,5 % = ${fmtEur(r.kv)}`, q: "§ 226 Abs. 2, § 229 SGB V (Versorgungsbezug); Freibetrag nur KV" },
    { t: "PV-Beitrag", f: `${fmtEur(r.brutto)} × ${fmtPct(pvSatz(c.kinderlos))} = ${fmtEur(r.pv)} (kein Freibetrag in der PV)`, q: "§ 57 SGB XI" },
  ]);
}

/* =====================================================================
   Beamten-Rechner (§ 14 BeamtVG)
   ===================================================================== */
state.beamteTab = "alter";
document.querySelectorAll("#beamteTab button").forEach((b) => {
  b.addEventListener("click", () => {
    state.beamteTab = b.dataset.tab;
    document.querySelectorAll("#beamteTab button").forEach((x) => x.classList.toggle("active", x === b));
    recalc();
  });
});

function calcBeamte(c) {
  const B = CONFIG.beamte;
  const bezuege = val("inBeaBezuege");
  const jahreGesamt = val("inBeaJahre");
  const tzJahre = Math.min(val("inBeaTzJahre"), jahreGesamt);
  const tzQuote = val("inBeaTzQuote") / 100;
  const status = $("inBeaStatus").value;

  // Teilzeit zählt nur anteilig als ruhegehaltfähige Dienstzeit
  const jahreRgf = (jahreGesamt - tzJahre) + tzJahre * tzQuote;
  const satz = Math.min(jahreRgf * B.steigerungProJahr, B.hoechstsatz);
  const ruhegehaltOhne = bezuege * satz;

  // Abschlag bei vorzeitigem Antragsruhestand: 0,3 %/Monat, max. 14,4 %
  const ragMon = c.rag.jahre * 12 + c.rag.monate;
  const frueher = Math.max(0, ragMon - c.rentenalter * 12);
  const abschlag = Math.min(frueher * B.abschlagProMonat, B.abschlagMaxAntrag);
  const nachAbschlag = ruhegehaltOhne * (1 - abschlag);

  // Mindestversorgung (ohne Abschlag): amtsabhängig 35 % oder amtsunabhängig ~2.100 €
  const mindest = Math.max(bezuege * B.mindestAmtsabhaengig, B.mindestAmtsunabhaengig.caBrutto);
  const brutto = Math.max(nachAbschlag, mindest);
  const mindestGreift = mindest > nachAbschlag;

  // DU-Betrachtung: Zurechnungszeit bis 60 zu 2/3, Abschlag max. 10,8 %
  const jahreBisher = val("inBeaJahreBisher");
  const zurechnung = Math.max(0, B.duZurechnungBisAlter - c.alter) * B.duZurechnungFaktor;
  const satzDu = Math.min((jahreBisher + zurechnung) * B.steigerungProJahr, B.hoechstsatz);
  const duOhne = bezuege * satzDu * (1 - B.abschlagMaxDU);
  const duBrutto = Math.max(duOhne, mindest);
  const duMindestGreift = mindest > duOhne;

  return { bezuege, jahreGesamt, tzJahre, tzQuote, jahreRgf, satz, ruhegehaltOhne,
           frueher, abschlag, nachAbschlag, mindest, brutto, mindestGreift, status,
           jahreBisher, zurechnung, satzDu, duBrutto, duMindestGreift };
}

function renderBeamte(c) {
  const r = calcBeamte(c);
  const B = CONFIG.beamte;
  const normal = $("beaErgebnisNormal"), duWarn = $("beaDuWarn");
  $("beaDienstBisherWrap").style.display = state.beamteTab === "du" ? "" : "none";

  if (r.status !== "lebenszeit") {
    normal.style.display = "none";
    duWarn.style.display = "block";
    duWarn.innerHTML =
      `<b>Beamter auf ${r.status === "probe" ? "Probe" : "Widerruf"}: kein Ruhegehalt bei Dienstunfähigkeit!</b>` +
      `Statt Pension droht die Entlassung mit Nachversicherung in der GRV. Der EM-Anspruch dort scheitert ` +
      `meist an der 3/5-Regel (36 Pflichtbeitragsmonate in den letzten 60). ` +
      `<b style="margin-top:6px">→ Private Dienstunfähigkeitsabsicherung ist Pflichtthema.</b>`;
    $("beaWeg").innerHTML = wegHtml([
      { t: "Rechtslage Probe/Widerruf", f: "Keine Versorgung aus dem Beamtenverhältnis (Ausnahme: Dienstunfall) → Entlassung + Nachversicherung GRV", q: "§§ 28 ff. BeamtVG; § 8 SGB VI, gesetze-im-internet.de" },
    ]);
    return;
  }
  normal.style.display = "";
  duWarn.style.display = "none";

  if (state.beamteTab === "alter") {
    $("beaBrutto").textContent = fmtEur(r.brutto);
    $("beaLbl").textContent = "Ruhegehalt brutto / Monat";
    $("beaKette").innerHTML = ketteHtml([
      { t: "Ruhegehaltssatz", sub: fmtNum(r.jahreRgf) + " ruhegehaltf. Jahre × 1,79375 % (max. 71,75 %)", v: fmtPct(r.satz, 2) },
      { t: "Ruhegehalt", sub: fmtEur(r.bezuege) + " × " + fmtPct(r.satz, 2), v: fmtEur(r.ruhegehaltOhne) },
      ...(r.abschlag > 0 ? [{ t: "Versorgungsabschlag", sub: r.frueher + " Monate × 0,3 % (max. 14,4 %)", v: "− " + fmtEur(r.ruhegehaltOhne - r.nachAbschlag), art: "minus" }] : []),
      ...(r.mindestGreift ? [{ t: "Mindestversorgung greift", sub: "höherer Wert zählt, ohne Abschlag", v: fmtEur(r.mindest), art: "plus" }] : []),
      { t: "Ruhegehalt brutto", v: fmtEur(r.brutto), art: "sum" },
    ]);
    $("beaHinweis").innerHTML =
      `<b>Einordnung:</b> keine GKV-Abzüge – dafür laufen PKV-Beitrag (Beihilfe im Ruhestand i. d. R. 70 %) ` +
      `und volle Besteuerung (§ 19 EStG). Real erreichen Neupensionäre im Schnitt nur ` +
      `<b>${fmtPct(B.durchschnittssatzReal, 1)}</b> statt 71,75 % – Teilzeit und späte Verbeamtung kosten.` +
      (r.tzJahre > 0 ? `<br><b>Teilzeit-Effekt:</b> ${r.tzJahre} Jahre × ${fmtPct(r.tzQuote, 0)} zählen nur als ${fmtNum(r.tzJahre * r.tzQuote)} Jahre.` : "");
  } else {
    $("beaBrutto").textContent = fmtEur(r.duBrutto);
    $("beaLbl").textContent = "Ruhegehalt bei Dienstunfähigkeit heute (brutto / Monat)";
    $("beaKette").innerHTML = ketteHtml([
      { t: "Dienstjahre bisher", v: fmtNum(r.jahreBisher) + " J." },
      { t: "Zurechnungszeit", sub: "bis Alter 60 zu 2/3 (" + fmtNum(Math.max(0, B.duZurechnungBisAlter - c.alter)) + " J. × 2/3)", v: "+ " + fmtNum(r.zurechnung) + " J.", art: "plus" },
      { t: "Ruhegehaltssatz DU", sub: "× 1,79375 %, Abschlag −10,8 %", v: fmtPct(r.satzDu, 2) },
      ...(r.duMindestGreift ? [{ t: "Mindestversorgung greift", sub: "ca. " + fmtEur(r.mindest), v: fmtEur(r.mindest), art: "plus" }] : []),
      { t: "DU-Ruhegehalt brutto", v: fmtEur(r.duBrutto), art: "sum" },
    ]);
    $("beaHinweis").innerHTML =
      `<b>Gesprächseinstieg:</b> Frühe DU bedeutet oft nur Mindestversorgung ` +
      `(~${fmtEur0(r.mindest)} brutto). Die Lücke zum aktuellen Netto schließt nur eine private DU-Klausel.`;
  }
  $("beaWeg").innerHTML = wegHtml([
    { t: "Ruhegehaltfähige Dienstzeit", f: `(${r.jahreGesamt} − ${r.tzJahre}) Jahre Vollzeit + ${r.tzJahre} × ${fmtPct(r.tzQuote, 0)} Teilzeit = ${fmtNum(r.jahreRgf)} Jahre`, q: "§ 6 BeamtVG (Teilzeit anteilig)" },
    { t: "Ruhegehaltssatz", f: `${fmtNum(r.jahreRgf)} × 1,79375 % = ${fmtPct(r.jahreRgf * B.steigerungProJahr, 2)} → angesetzt ${fmtPct(r.satz, 2)} (Deckel 71,75 %)`, q: "§ 14 Abs. 1 BeamtVG, gesetze-im-internet.de" },
    { t: "Versorgungsabschlag", f: r.frueher > 0 ? `${r.frueher} Monate × 0,3 % = −${fmtPct(r.abschlag)} (max. 14,4 % Antrag / 10,8 % DU)` : "kein Abschlag", q: "§ 14 Abs. 3 BeamtVG" },
    { t: "Mindestversorgung", f: `max(35 % × ${fmtEur(r.bezuege)}; amtsunabhängig ca. ${fmtEur0(B.mindestAmtsunabhaengig.caBrutto)}) = ${fmtEur(r.mindest)} – ohne Abschlag`, q: "§ 14 Abs. 4 BeamtVG" },
    { t: "DU-Zurechnungszeit", f: `(60 − ${c.alter}) × 2/3 = ${fmtNum(r.zurechnung)} Jahre zusätzlich`, q: "§ 13 BeamtVG" },
    { t: "Realer Durchschnitt", f: `Versorgungszugänge Bund 2024: Ø ${fmtPct(B.durchschnittssatzReal, 1)} Ruhegehaltssatz`, q: "Versorgungsbericht des Bundes, bmi.bund.de" },
  ]);
}

/* =====================================================================
   Versorgungswerk: „zweite Rente“-Widget (KEZ laufen in die GRV!)
   ===================================================================== */
function calcVw(c) {
  const kezJahreProKind = CONFIG.grv.kezMonateAb2027 / 12; // 3 Jahre (ab 2027 einheitlich)
  const kezJahre = c.kinder * kezJahreProKind;
  const grvJahreAlt = val("inVwGrvJahre");
  const wartezeitJahre = kezJahre + grvJahreAlt;
  const wartezeitErfuellt = wartezeitJahre >= 5;
  const epKez = c.kinder * CONFIG.grv.kezMonateAb2027 * CONFIG.grv.epProKindMonat;
  const miniGrv = epKez * CONFIG.grv.rentenwert;
  return { kezJahre, grvJahreAlt, wartezeitJahre, wartezeitErfuellt, epKez, miniGrv };
}

function renderVw(c) {
  const r = calcVw(c);
  $("vwRegelbeitrag").textContent = fmtEur(CONFIG.versorgungswerk.regelhoechstbeitragMonat);
  $("vwMiniGrv").textContent = fmtEur(r.miniGrv);
  $("vwKette").innerHTML = ketteHtml([
    { t: "Kindererziehungszeiten", sub: c.kinder + " Kind(er) × 36 Monate × 0,0833 EP", v: fmtNum(r.epKez) + " EP" },
    { t: "Alte GRV-Beitragsjahre", sub: "vor der Befreiung (EP daraus zusätzlich, hier nicht beziffert)", v: fmtNum(r.grvJahreAlt) + " J." },
    { t: "Mini-GRV-Rente aus KEZ", sub: fmtNum(r.epKez) + " EP × " + fmtEur(CONFIG.grv.rentenwert), v: fmtEur(r.miniGrv), art: "sum" },
  ]);
  $("vwWartezeitBox").innerHTML = r.wartezeitErfuellt
    ? `<div class="okBox"><b>Allgemeine Wartezeit (5 J.) der GRV erfüllt</b> – ` +
      `${fmtNum(r.kezJahre)} J. Kindererziehung + ${fmtNum(r.grvJahreAlt)} J. alte Beiträge = ` +
      `${fmtNum(r.wartezeitJahre)} J. → es gibt eine eigene kleine GRV-Rente <i>zusätzlich</i> zum Versorgungswerk. Aha-Moment!</div>`
    : `<div class="warnBox"><b>Allgemeine Wartezeit (5 J.) noch nicht erfüllt</b> – aktuell ` +
      `${fmtNum(r.wartezeitJahre)} J. (${fmtNum(r.kezJahre)} J. KEZ + ${fmtNum(r.grvJahreAlt)} J. alte Beiträge). ` +
      `Option: freiwillige Beiträge oder künftige KEZ schließen die Lücke – sonst nur Beitragserstattung.</div>`;
  $("vwWeg").innerHTML = wegHtml([
    { t: "KEZ-Entgeltpunkte", f: `${c.kinder} × 36 Monate × 0,0833 EP = ${fmtNum(r.epKez)} EP`, q: "§ 70 Abs. 2 SGB VI; Mütterrente III ab 2027 einheitlich 36 Monate" },
    { t: "Mini-GRV-Rente", f: `${fmtNum(r.epKez)} EP × ${fmtEur(CONFIG.grv.rentenwert)} = ${fmtEur(r.miniGrv)}`, q: "§ 64 SGB VI; deutsche-rentenversicherung.de" },
    { t: "Wartezeitprüfung", f: `${fmtNum(r.kezJahre)} J. KEZ + ${fmtNum(r.grvJahreAlt)} J. Beiträge = ${fmtNum(r.wartezeitJahre)} J. ${r.wartezeitErfuellt ? "≥" : "<"} 5 J.`, q: "§ 50 Abs. 1 SGB VI" },
    { t: "Befreiung", f: "Tätigkeitsbezogen, je Stellenwechsel neuer Antrag binnen 3 Monaten, elektronisch", q: "§ 6 Abs. 1 Nr. 1, Abs. 4 SGB VI; abv.de" },
  ]);
}

/* =====================================================================
   Kombi-Ansicht: gestapelter Versorgungsbalken + Lücke + Sparrate
   ===================================================================== */
const SYS_META = {
  grv:    { name: "GRV",             farbe: "var(--blue)" },
  zvk:    { name: "ZVK/VBL",         farbe: "var(--amber)" },
  beamte: { name: "Beamtenpension",  farbe: "var(--sage)" },
  vw:     { name: "Mini-GRV (KEZ)",  farbe: "var(--navy-light)" },
};

function kombiBausteine(c) {
  const teile = [];
  if (state.systeme.grv) {
    const r = calcGrv(c);
    teile.push({ sys: "grv", brutto: r.brutto, netto: r.netto,
      sub: `brutto ${fmtEur(r.brutto)} − KV (halber Satz) − PV` });
  }
  if (state.systeme.zvk) {
    const r = calcZvk(c);
    teile.push({ sys: "zvk", brutto: r.brutto, netto: r.netto,
      sub: `brutto ${fmtEur(r.brutto)} − KV (voller Satz, Freibetrag) − PV` });
  }
  if (state.systeme.beamte) {
    const r = calcBeamte(c);
    if (r.status === "lebenszeit") {
      teile.push({ sys: "beamte", brutto: r.brutto, netto: r.brutto,
        sub: "brutto = Ansatz (keine GKV; PKV & Steuer individuell)" });
    }
  }
  if (state.systeme.vw) {
    const r = calcVw(c);
    if (r.miniGrv > 0) {
      const nettoMini = r.miniGrv * (1 - (CONFIG.kvpv.kvSatz + CONFIG.kvpv.kvZusatzDurchschnitt) / 2 - pvSatz(c.kinderlos));
      teile.push({ sys: "vw", brutto: r.miniGrv, netto: nettoMini,
        sub: "aus Kindererziehung; Versorgungswerksrente selbst lt. Kammer-Auskunft ergänzen" });
    }
  }
  return teile;
}

function renderKombi(c) {
  const card = $("kombiCard");
  const teile = kombiBausteine(c);
  const aktiv = Object.values(state.systeme).some(Boolean);
  card.style.display = aktiv ? "" : "none";
  if (!aktiv) return;

  const summe = teile.reduce((s, t) => s + t.netto, 0);
  const luecke = Math.max(0, c.wunsch - summe);
  const H = 260, maxVal = Math.max(c.wunsch, summe, 1);
  const px = (v) => Math.max(v > 0 ? 3 : 0, Math.round(v / maxVal * H));

  let ist = teile.map((t) =>
    `<div class="balkenSeg" style="height:${px(t.netto)}px;background:${SYS_META[t.sys].farbe}">` +
    (px(t.netto) > 30 ? `<span class="segVal">${fmtEur0(t.netto)}</span>` : "") + `</div>`).join("");
  if (luecke > 0) {
    ist += `<div class="balkenSeg luecke" style="height:${px(luecke)}px">` +
      (px(luecke) > 30 ? `<span class="segVal">−${fmtEur0(luecke)}</span>` : "") + `</div>`;
  }
  ist += `<div class="wunschLinie" style="bottom:${Math.round(c.wunsch / maxVal * H)}px"><span>Wunsch ${fmtEur0(c.wunsch)}</span></div>`;
  $("balkenIst").innerHTML = ist;
  $("balkenIst").style.height = H + "px";
  $("balkenIstSum").textContent = fmtEur0(summe) + " netto";
  $("balkenSoll").innerHTML = `<div class="balkenSeg" style="height:${px(c.wunsch)}px;background:var(--ink-soft)"></div>`;
  $("balkenSoll").style.height = H + "px";
  $("balkenSollSum").textContent = fmtEur0(c.wunsch);

  $("kombiLegende").innerHTML = teile.map((t) =>
    `<span class="lg"><span class="sw" style="background:${SYS_META[t.sys].farbe}"></span>${SYS_META[t.sys].name}</span>`).join("") +
    (luecke > 0 ? `<span class="lg"><span class="sw" style="background:var(--terracotta)"></span>Lücke</span>` : "");

  $("kombiKette").innerHTML = ketteHtml([
    ...teile.map((t) => ({ t: SYS_META[t.sys].name, sub: t.sub, v: fmtEur(t.netto) })),
    { t: "Versorgung netto (vor Steuern)", v: fmtEur(summe), art: "sum" },
    { t: "Wunschrente netto", v: fmtEur(c.wunsch) },
    luecke > 0
      ? { t: "Versorgungslücke", v: "− " + fmtEur(luecke), art: "minus" }
      : { t: "Überschuss", v: "+ " + fmtEur(summe - c.wunsch), art: "plus" },
  ]);

  const lb = $("lueckeBlock");
  if (luecke > 0) {
    lb.className = "lueckeBlock";
    lb.innerHTML = `<div class="lVal">− ${fmtEur(luecke)}</div><div class="lLbl">monatliche Versorgungslücke gegenüber der Wunschrente</div>`;
  } else {
    lb.className = "lueckeBlock ok";
    lb.innerHTML = `<div class="lVal">${fmtEur(summe - c.wunsch)}</div><div class="lLbl">über der Wunschrente – keine rechnerische Lücke</div>`;
  }

  // Sparraten-Orientierung (Annuitätennäherung)
  const A = CONFIG.annahmen;
  const spar = $("sparrateText");
  if (luecke > 0 && c.jahreBisRente > 0) {
    const kapital = luecke / A.rentenfaktorJe10k * 10000;
    const i = val("inRendite") / 100 / 12, n = c.jahreBisRente * 12;
    const rate = i > 0 ? kapital * i / (Math.pow(1 + i, n) - 1) : kapital / n;
    spar.innerHTML =
      `<b>Benötigte mtl. Sparrate als Orientierung: ${fmtEur(rate)}</b> über ${c.jahreBisRente} Jahre ` +
      `(Kapitalbedarf ≈ ${fmtEur0(kapital)} bei Rentenfaktor-Annahme ${fmtNum(A.rentenfaktorJe10k)} € Rente je 10.000 € Kapital – ` +
      `tatsächliche Tarife weichen ab; bewusst nur Orientierung, keine Produktberechnung).`;
  } else {
    spar.innerHTML = luecke > 0
      ? "<b>Rentenbeginn liegt nicht in der Zukunft</b> – Sparraten-Orientierung nicht sinnvoll."
      : "<b>Keine Lücke</b> – keine Sparrate erforderlich.";
  }

  // Ruhensregelung § 55 BeamtVG bei Beamtenpension + GRV-Rente
  const ruhens = $("ruhensHinweis");
  if (state.systeme.beamte && (state.systeme.grv || state.systeme.vw)) {
    ruhens.style.display = "block";
    ruhens.innerHTML = `<b>Ruhensregelung § 55 BeamtVG beachten:</b> Treffen Beamtenpension und gesetzliche Rente ` +
      `zusammen, wird die Summe auf eine Höchstgrenze gekappt – die Rente wird teilweise auf die Pension angerechnet. ` +
      `Die Summe hier ist daher eine Obergrenze; exakte Berechnung nur durch die Versorgungsstelle (NRW: LBV).`;
  } else ruhens.style.display = "none";
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
  if (state.systeme.zvk) renderZvk(c);
  if (state.systeme.beamte) renderBeamte(c);
  if (state.systeme.vw) renderVw(c);
  renderKombi(c);
}

/* =====================================================================
   Modus „Wissen“: durchsuchbares Nachschlagewerk
   ===================================================================== */
const SPARTE_NAME = { grv: "GRV", zvk: "ZVK/VBL", beamte: "Beamte", vw: "Versorgungswerk" };
state.wSparte = "alle";

function renderWissen() {
  const q = $("wSuche").value.trim().toLowerCase();
  const html = CONFIG.wissen
    .filter((k) => state.wSparte === "alle" || k.sparte === state.wSparte)
    .filter((k) => !q ||
      (k.titel + " " + k.paragraf + " " + k.kernfakten.join(" ") + " " + k.beratungshinweis)
        .toLowerCase().includes(q))
    .map((k) => `
      <details class="wCard"${q ? " open" : ""}>
        <summary>
          <span class="badge b-${k.sparte}">${SPARTE_NAME[k.sparte]}</span>
          <span class="wTitel">${k.titel}</span>
          <span class="wPara">${k.paragraf}</span>
        </summary>
        <div class="wBody">
          <ul>${k.kernfakten.map((f) => `<li>${f}</li>`).join("")}</ul>
          <div class="wBeratung"><b>Beratungshinweis:</b> ${k.beratungshinweis}</div>
          <div class="wQuelle">Quelle: <a href="${k.quelleUrl}" target="_blank" rel="noopener">${k.quelleUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</a></div>
        </div>
      </details>`).join("");
  $("wListe").innerHTML = html ||
    `<p class="hint" style="text-align:center;padding:30px">Kein Treffer – Suchbegriff kürzen oder Sparte auf „Alle“ stellen.</p>`;
}

$("wSuche").addEventListener("input", renderWissen);
document.querySelectorAll("#wFilter button").forEach((b) => {
  b.addEventListener("click", () => {
    state.wSparte = b.dataset.sparte;
    document.querySelectorAll("#wFilter button").forEach((x) => x.classList.toggle("active", x === b));
    renderWissen();
  });
});

/* =====================================================================
   Modus „Unterlagen-Check“: Ampel-Checklisten
   Status lebt nur im Speicher – Neuladen setzt alles zurück (gewollt).
   ===================================================================== */
state.checkSparte = "grv";
state.checkStatus = {}; // { "grv-0": "g"|"y"|"r" }

function renderCheckFilter() {
  $("cFilter").innerHTML = Object.entries(CONFIG.checklisten).map(([key, l]) =>
    `<button data-cs="${key}"${key === state.checkSparte ? ' class="active"' : ""}>${l.name}</button>`).join("");
  document.querySelectorAll("#cFilter button").forEach((b) => {
    b.addEventListener("click", () => { state.checkSparte = b.dataset.cs; renderCheck(); });
  });
}

function renderCheck() {
  renderCheckFilter();
  const liste = CONFIG.checklisten[state.checkSparte];
  if (!liste) { $("cListe").innerHTML = ""; return; }

  const counts = { g: 0, y: 0, r: 0 };
  const items = liste.punkte.map((p, i) => {
    const key = state.checkSparte + "-" + i;
    const st = state.checkStatus[key] || "y";
    counts[st]++;
    return `
      <div class="checkItem${st === "r" ? " rot" : ""}" data-key="${key}">
        <div class="ciRow">
          <div class="ciFrage">${p.frage}</div>
          <div class="ampel">
            <button class="gruen${st === "g" ? " on" : ""}" data-st="g" title="in Ordnung">✓</button>
            <button class="gelb${st === "y" ? " on" : ""}" data-st="y" title="offen / nicht geprüft">?</button>
            <button class="rot${st === "r" ? " on" : ""}" data-st="r" title="Problem">✗</button>
          </div>
        </div>
        <div class="aktion"><b>${p.rotDiagnose}</b>${p.aktionstext}</div>
      </div>`;
  }).join("");

  $("cSummen").innerHTML =
    `<div class="cs" style="flex:1;min-width:200px"><span style="font-weight:400;font-size:12.5px;color:var(--ink-faint)">Dokument:</span><br>${liste.dokument}</div>` +
    `<div class="cs g"><span class="n">${counts.g}</span>in Ordnung</div>` +
    `<div class="cs y"><span class="n">${counts.y}</span>offen</div>` +
    `<div class="cs r"><span class="n">${counts.r}</span>Handlungsbedarf</div>`;

  $("cListe").innerHTML = items;
  document.querySelectorAll("#cListe .ampel button").forEach((b) => {
    b.addEventListener("click", () => {
      state.checkStatus[b.closest(".checkItem").dataset.key] = b.dataset.st;
      renderCheck();
    });
  });
}

/* ---------- Fußzeile & Druckkopf ---------- */
(function initStatic() {
  const standTxt = "Stand: " + CONFIG.stand.replace(/(\d{4})-(\d{2})/, "$2/$1");
  $("footerText").textContent = CONFIG.disclaimer + " " + standTxt;
  $("printDatum").textContent =
    "Erstellt am " + new Date().toLocaleDateString("de-DE") + " · " + standTxt +
    " · unverbindliche Orientierung";
  bindInputs("#mode-beratung");
  renderWissen();
  renderCheck();
  recalc();
  // Browser stellen Slider-Werte nach Reload/Back wieder her, ohne Events zu
  // feuern – Anzeigen und Rechnung danach einmal neu synchronisieren.
  window.addEventListener("pageshow", () => {
    document.querySelectorAll("#mode-beratung input[type=range]").forEach((i) => i._show && i._show());
    recalc();
  });
})();
