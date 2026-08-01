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
    // Die Krankheits-Treppe hängt an der GRV (Krankengeld und EM-Rente kommen von dort)
    if (sys === "grv") $("card-krank").classList.toggle("on", state.systeme.grv);
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
state.grvWartezeit = "regel"; // "regel" | "35" | "45"
document.querySelectorAll("#grvWartezeit button").forEach((b) => {
  b.addEventListener("click", () => {
    state.grvWartezeit = b.dataset.wz;
    document.querySelectorAll("#grvWartezeit button").forEach((x) => x.classList.toggle("active", x === b));
    recalc();
  });
});

/* Zugangsfaktor § 77 SGB VI: −0,3 %/Monat vorzeitig (max. −14,4 %), +0,5 %/Monat später.
   Regelaltersrente (5 J.): frühestens zur Regelaltersgrenze.
   35 J. Wartezeit: frühestens ab 63. 45 J.: abschlagsfrei ab Regelalter − 24 Monate. */
function zugangsfaktorGrv(c, variante) {
  const ragMon = c.rag.jahre * 12 + c.rag.monate;
  let wunschMon = c.rentenalter * 12;
  let hinweis = "";
  const fruehestMon = variante === "regel" ? ragMon
    : variante === "45" ? ragMon - 24
    : 63 * 12;
  if (wunschMon < fruehestMon) {
    const grund = variante === "regel"
      ? "(Regelaltersrente: erst zur Regelaltersgrenze – früher nur mit 35/45 J. Wartezeit)"
      : variante === "45" ? "(45 J., 2 J. vor Regelalter)" : "(ab 63)";
    hinweis = `Frühestmöglicher Beginn ${grund}: ` +
      fmtAlter(fruehestMon / 12) + " – Rechnung mit diesem Alter.";
    wunschMon = fruehestMon;
  }
  const diff = wunschMon - ragMon; // Monate (negativ = früher)
  let faktor = 1, detail = "";
  if (diff < 0) {
    if (variante === "45") {
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

/* Einzige Quelle für die volle EM-Rente: Wert aus der Renteninformation, sonst
   die Näherung aus den Entgeltpunkten. GRV-Karte und Krankheits-Treppe greifen
   beide hierauf zu, damit auf dem Bildschirm nie zwei Zahlen stehen. */
function emRenteVollBrutto(c, grvErgebnis) {
  const eingabe = val("inEmRente");
  if (eingabe > 0) return { brutto: eingabe, ausRenteninfo: true };
  return { brutto: (grvErgebnis || calcGrv(c)).emBrutto, ausRenteninfo: false };
}

function calcGrv(c) {
  const G = CONFIG.grv, K = CONFIG.kvpv;
  const epProJahr = Math.min(c.brutto, G.bbgJahr) / G.durchschnittsentgelt;
  const epEingabe = val("inGrvEp");
  const jahreBisher = val("inGrvJahre");
  const epBisher = epEingabe > 0 ? epEingabe : jahreBisher * epProJahr;
  const zf = zugangsfaktorGrv(c, state.grvWartezeit);
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
  const em = emRenteVollBrutto(c, r);
  $("grvEmBox").innerHTML =
    `<b>Gesprächseinstieg BU/EM:</b> Bei voller Erwerbsminderung heute ergäben sich ca. ` +
    `<b>${fmtEur(em.brutto)}</b> brutto/Monat ` +
    (em.ausRenteninfo
      ? `(Wert aus der Renteninformation, oben eingetragen).`
      : `(Näherung: EP bisher + Zurechnungszeit bis ${CONFIG.grv.emZurechnungsalter2026.jahre} J. ` +
        `${CONFIG.grv.emZurechnungsalter2026.monate} M., Abschlag −10,8 %).`) +
    ` Voraussetzung u. a. 3/5-Belegung – dieser Schutz erlischt bei Lücken schleichend. ` +
    `Die vollständige Kette steht unten in der Krankheits-Übersicht.`;
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
   Krankheits-Verlauf: Lohnfortzahlung → Krankengeld → EM-Rente
   ===================================================================== */
state.emGrad = "voll";
document.querySelectorAll("#emGrad button").forEach((b) => {
  b.addEventListener("click", () => {
    state.emGrad = b.dataset.g;
    document.querySelectorAll("#emGrad button").forEach((x) => x.classList.toggle("active", x === b));
    recalc();
  });
});

/* Netto folgt dem Brutto, bis der Berater den Regler selbst anfasst */
state.nettoTouched = false;
$("inNetto").addEventListener("input", () => { state.nettoTouched = true; });
$("inBrutto").addEventListener("input", () => {
  if (!state.nettoTouched) {
    // grobe Startschätzung: rund 60 % des Bruttos bleiben netto
    const v = Math.max(800, Math.min(6000, Math.round(val("inBrutto") / 12 * 0.6 / 50) * 50));
    $("inNetto").value = v;
    $("outNetto").textContent = fmtEur0(v);
  }
});

function calcKrankheit(c) {
  const K = CONFIG.krankheit;
  const netto = val("inNetto");
  const bruttoMonat = c.brutto / 12;
  const regelentgelt = Math.min(bruttoMonat, K.bbgKvMonat);

  // Krankengeld: 70 % vom Regelentgelt, gedeckelt auf 90 % des Nettos (§ 47 SGB V)
  const ausBrutto = regelentgelt * K.krankengeldSatzBrutto;
  const ausNetto = netto * K.krankengeldDeckelNetto;
  const kgBrutto = Math.min(ausBrutto, ausNetto);
  const deckelGreift = ausNetto < ausBrutto;

  // Beitragspflichtig sind 80 % des Regelentgelts; KV entfällt, RV/AV/PV bleiben
  const B = K.anBeitraege;
  const satz = B.rv + B.av + B.pv + (c.kinderlos ? B.pvKinderlosZuschlag : 0);
  const beitragsbasis = regelentgelt * K.beitragsbasisAnteil;
  const abzuege = beitragsbasis * satz;
  const kgNetto = Math.max(0, kgBrutto - abzuege);

  // EM-Rente aus der gemeinsamen Quelle – identisch mit der Anzeige im GRV-Rechner
  const em = emRenteVollBrutto(c);
  const emVollBrutto = em.brutto;
  const faktor = state.emGrad === "voll" ? K.emFaktorVoll : K.emFaktorTeilweise;
  const emBrutto = emVollBrutto * faktor;

  // Abzüge wie bei jeder GRV-Rente: halber KV-Satz, PV voll
  const kvSatzHalb = (CONFIG.kvpv.kvSatz + CONFIG.kvpv.kvZusatzDurchschnitt) / 2;
  const emKv = emBrutto * kvSatzHalb;
  const emPv = emBrutto * pvSatz(c.kinderlos);
  const emNetto = emBrutto - emKv - emPv;

  const kgWochen = K.hoechstdauerWochen - K.lohnfortzahlungWochen;
  return { netto, bruttoMonat, regelentgelt, ausBrutto, ausNetto, kgBrutto, deckelGreift,
           satz, beitragsbasis, abzuege, kgNetto, emVollBrutto, faktor,
           emBrutto, emKv, emPv, emNetto, kvSatzHalb, kgWochen, quelleEm: em.ausRenteninfo };
}

function renderKrankheit(c) {
  const K = CONFIG.krankheit;
  const r = calcKrankheit(c);
  const stufen = [
    { phase: "Lohnfortzahlung", dauer: `Woche 1–${K.lohnfortzahlungWochen}`, wert: r.netto,
      farbe: "var(--sage)", flex: 1, proz: "100 % Ihres Nettos" },
    { phase: "Krankengeld", dauer: `Woche ${K.lohnfortzahlungWochen + 1}–${K.hoechstdauerWochen} (${r.kgWochen} Wochen)`,
      wert: r.kgNetto, farbe: "var(--amber)", flex: 2.4,
      proz: fmtPct(r.kgNetto / r.netto, 0) + " Ihres Nettos" },
    { phase: state.emGrad === "voll" ? "Volle EM-Rente" : "Teilweise EM-Rente",
      dauer: `ab Monat 18 (nach ${K.hoechstdauerWochen} Wochen)`, wert: r.emNetto,
      farbe: "var(--terracotta)", flex: 2,
      proz: fmtPct(r.emNetto / r.netto, 0) + " Ihres Nettos" },
  ];
  const maxWert = Math.max(r.netto, ...stufen.map((s) => s.wert), 1);
  const H = 224; // Balkenfläche in px (Container 250 minus Kopfraum)

  $("krankTreppe").innerHTML =
    `<div class="tNettoLinie" style="bottom:${Math.round(r.netto / maxWert * H) + 26}px">
       <span>heutiges Netto ${fmtEur0(r.netto)}</span></div>` +
    stufen.map((s) => {
      const h = Math.max(26, Math.round(s.wert / maxWert * H));
      return `<div class="tStufe" style="flex:${s.flex}">
        <div class="tBalken" style="height:${h}px;background:${s.farbe}">
          <span class="tVal">${fmtEur0(s.wert)}</span>
          ${h > 56 ? `<span class="tProz">${s.proz}</span>` : ""}
        </div>
        <div class="tFuss"><div class="tPhase">${s.phase}</div><div class="tDauer">${s.dauer}</div></div>
      </div>`;
    }).join("");

  $("krankKette").innerHTML = ketteHtml([
    { t: "Krankengeld brutto", sub: r.deckelGreift
        ? `90 %-Deckel auf das Netto greift (70 % vom Brutto wären ${fmtEur(r.ausBrutto)})`
        : `70 % des Regelentgelts ${fmtEur(r.regelentgelt)}`, v: fmtEur(r.kgBrutto) },
    { t: "Beiträge RV / AV / PV", sub: `${fmtPct(r.satz, 1)} auf 80 % des Regelentgelts – die Krankenkasse trägt die andere Hälfte`,
      v: "− " + fmtEur(r.abzuege), art: "minus" },
    { t: "Krankengeld ausgezahlt", v: fmtEur(r.kgNetto), art: "sum" },
    { t: state.emGrad === "voll" ? "EM-Rente brutto (voll)" : "EM-Rente brutto (teilweise, Faktor 0,5)",
      sub: r.quelleEm ? "aus der Renteninformation" : "Näherung: Entgeltpunkte + Zurechnungszeit, Abschlag −10,8 %",
      v: fmtEur(r.emBrutto) },
    { t: "KV + PV auf die Rente", sub: `KV halber Satz (${fmtPct(r.kvSatzHalb, 2)}), PV voll (${fmtPct(pvSatz(c.kinderlos))})`,
      v: "− " + fmtEur(r.emKv + r.emPv), art: "minus" },
    { t: "EM-Rente ausgezahlt (vor Steuern)", v: fmtEur(r.emNetto), art: "sum" },
  ]);

  const luecke = r.netto - r.emNetto;
  $("krankLuecke").innerHTML =
    `<b>Einkommenslücke ab Monat 18: ${fmtEur(luecke)} im Monat</b>` +
    `Aus ${fmtEur0(r.netto)} Nettoeinkommen werden ${fmtEur0(r.emNetto)} – das sind ` +
    `${fmtPct(r.emNetto / r.netto, 0)} des heutigen Einkommens. Bereits das Krankengeld kostet ` +
    `${fmtEur(r.netto - r.kgNetto)} im Monat.`;

  $("krankHinweise").innerHTML =
    `<b>Was in dieser Rechnung nicht steckt:</b>
     <ul style="margin:6px 0 0;padding-left:18px">
       <li>Die 78 Wochen gelten je Krankheit innerhalb von drei Jahren – bei einer neuen Erkrankung beginnt die Frist neu.</li>
       <li>Die EM-Rente kommt nicht automatisch: Sie muss beantragt und durch Gutachten bewilligt werden. Voraussetzung sind u. a. 36 Pflichtbeitragsmonate in den letzten 60 (3/5-Regel).</li>
       <li>Wird der Antrag abgelehnt oder zieht sich das Verfahren, greift zwischenzeitlich meist Arbeitslosengeld (Nahtlosigkeitsregelung § 145 SGB III) – nicht selten mit Lücke dazwischen.</li>
       <li>Bei teilweiser EM wird erwartet, dass 3–6 Stunden täglich gearbeitet wird. Findet sich keine Stelle, kann daraus eine Arbeitsmarktrente werden.</li>
     </ul>`;

  $("krankWeg").innerHTML = wegHtml([
    { t: "Lohnfortzahlung", f: `${K.lohnfortzahlungWochen} Wochen volles Arbeitsentgelt = ${fmtEur(r.netto)} netto`, q: "§ 3 Abs. 1 EFZG, gesetze-im-internet.de" },
    { t: "Regelentgelt", f: `min(${fmtEur(r.bruttoMonat)} Bruttomonatsentgelt; BBG ${fmtEur(K.bbgKvMonat)}) = ${fmtEur(r.regelentgelt)}`, q: "§ 47 Abs. 1, 6 SGB V" },
    { t: "Krankengeld brutto", f: `min(70 % × ${fmtEur(r.regelentgelt)} = ${fmtEur(r.ausBrutto)}; 90 % × ${fmtEur(r.netto)} = ${fmtEur(r.ausNetto)}) = ${fmtEur(r.kgBrutto)}`, q: "§ 47 Abs. 1 SGB V" },
    { t: "Beitragsabzug", f: `80 % × ${fmtEur(r.regelentgelt)} = ${fmtEur(r.beitragsbasis)} × ${fmtPct(r.satz, 1)} (RV 9,3 % + AV 1,3 % + PV ${c.kinderlos ? "2,4" : "1,8"} %) = ${fmtEur(r.abzuege)}`, q: "§§ 226, 232a SGB V; § 166 SGB VI" },
    { t: "Krankengeld ausgezahlt", f: `${fmtEur(r.kgBrutto)} − ${fmtEur(r.abzuege)} = ${fmtEur(r.kgNetto)}`, q: "eigene Berechnung" },
    { t: "Höchstdauer", f: `${K.hoechstdauerWochen} Wochen je Krankheit in 3 Jahren, abzüglich ${K.lohnfortzahlungWochen} Wochen Lohnfortzahlung = ${r.kgWochen} Wochen Krankengeld`, q: "§ 48 Abs. 1 SGB V" },
    { t: "EM-Rente", f: r.quelleEm
        ? `${fmtEur(r.emVollBrutto)} lt. Renteninformation × Faktor ${fmtNum(r.faktor)} = ${fmtEur(r.emBrutto)}`
        : `Näherung ${fmtEur(r.emVollBrutto)} × Faktor ${fmtNum(r.faktor)} = ${fmtEur(r.emBrutto)}`,
      q: "§ 43 SGB VI; Zurechnungszeit § 59 SGB VI" },
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
  state.kombiErgebnis = { summe, luecke, wunsch: c.wunsch }; // für das Schluss-Ergebnis
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
    msciRateVorschlag(rate);
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
  if (state.systeme.grv) { renderGrv(c); renderKrankheit(c); } // Reihenfolge wie auf dem Bildschirm
  if (state.systeme.zvk) renderZvk(c);
  if (state.systeme.beamte) renderBeamte(c);
  if (state.systeme.vw) renderVw(c);
  renderKombi(c);
  renderFazit(c);
}

/* =====================================================================
   MSCI World-Renditedreieck (monatliche Geldanlage, Quelle: DAI 31.12.2023)
   ===================================================================== */
const MSCI = (() => {
  const D = CONFIG.msciSparplan;
  const matrix = {}; // matrix[start][ziel] = Rendite % p.a.
  let startMin = Infinity;
  Object.keys(D.zeilen).forEach((s) => {
    const start = +s;
    startMin = Math.min(startMin, start);
    matrix[start] = {};
    D.zeilen[s].trim().split(/\s+/).forEach((v, i) => {
      matrix[start][start + 1 + i] = parseFloat(v.replace(",", "."));
    });
  });
  return { matrix, startMin, zielMax: D.zielMax };
})();

state.msciSel = { start: 1984, ziel: MSCI.zielMax }; // Beispiel aus dem Beratungsalltag
state.msciRateTouched = false;
$("inMsciRate").addEventListener("input", () => {
  state.msciRateTouched = true;
  renderMsciDetail();
  renderFazit(commonWerte());
});

function msciFarbklasse(r) {
  if (r >= 8) return "mc5";
  if (r >= 4) return "mc4";
  if (r >= 0.5) return "mc3";
  if (r > -0.5) return "mc2";
  if (r > -10) return "mc1";
  return "mc0";
}
const istKrisenjahr = (j) => CONFIG.msciSparplan.krisen.some((k) => j >= k.von && j <= k.bis);

/* Endwert eines monatlichen Sparplans bei Rendite r % p.a. über n Jahre */
function sparplanEndwert(rate, rProzent, jahre) {
  const m = jahre * 12;
  const i = Math.pow(1 + rProzent / 100, 1 / 12) - 1;
  const endwert = i === 0 ? rate * m : rate * (Math.pow(1 + i, m) - 1) / i;
  return { eingezahlt: rate * m, endwert };
}

/* Min/Ø/Max über alle Zeiträume einer Spardauer */
function msciStatistik(dauer) {
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  for (let s = MSCI.startMin; s + dauer <= MSCI.zielMax; s++) {
    const r = MSCI.matrix[s] && MSCI.matrix[s][s + dauer];
    if (r === undefined) continue;
    min = Math.min(min, r); max = Math.max(max, r); sum += r; n++;
  }
  return n ? { min, max, avg: sum / n, n } : null;
}

/* Kleinste Spardauer, die in 50 Jahren nie eine negative Rendite hatte */
const msciSichereDauer = (() => {
  for (let d = 1; d <= 50; d++) {
    const st = msciStatistik(d);
    if (st && st.min >= 0) return { dauer: d, min: st.min };
  }
  return null;
})();

function renderMsciGrid() {
  const frag = [];
  for (let start = MSCI.zielMax - 1; start >= MSCI.startMin; start--) {
    const row = MSCI.zielMax - 1 - start + 1;
    for (let ziel = start + 1; ziel <= MSCI.zielMax; ziel++) {
      const r = MSCI.matrix[start][ziel];
      const col = ziel - MSCI.startMin; // 1974 → Spalte 1
      frag.push(`<div class="mCell ${msciFarbklasse(r)}" data-s="${start}" data-z="${ziel}" ` +
        `style="grid-row:${row};grid-column:${col}" title="Start ${start} → Ziel ${ziel}: ${fmtNum(r)} % p.a."></div>`);
    }
    if (start % 5 === 0 || start === MSCI.startMin || start === MSCI.zielMax - 1) {
      frag.push(`<div class="mRowLbl" style="grid-row:${row}">${start}</div>`);
    }
  }
  $("msciGrid").innerHTML = frag.join("");

  const axe = [];
  for (let ziel = MSCI.startMin + 1; ziel <= MSCI.zielMax; ziel++) {
    const col = ziel - MSCI.startMin;
    const kr = istKrisenjahr(ziel);
    if (ziel % 5 === 0 || kr) {
      axe.push(`<span class="${kr ? "krise" : ""}" style="grid-column:${col}">${ziel}</span>`);
    }
  }
  $("msciAxe").innerHTML = axe.join("");

  $("msciGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".mCell");
    if (!c) return;
    state.msciSel = { start: +c.dataset.s, ziel: +c.dataset.z };
    renderMsciDetail();
  });
}

/* Jahr-Regler ↔ Dreieck koppeln (Regler bewegen = Zelle wählen, Zelle tippen = Regler stellen) */
function msciSelVonReglern(vonSlider) {
  let s = val("inMsciStart"), z = val("inMsciZiel");
  if (z <= s) { if (vonSlider === "start") z = Math.min(s + 1, MSCI.zielMax); else s = Math.max(z - 1, MSCI.startMin); }
  state.msciSel = { start: s, ziel: z };
  renderMsciDetail();
}
$("inMsciStart").addEventListener("input", () => msciSelVonReglern("start"));
$("inMsciZiel").addEventListener("input", () => msciSelVonReglern("ziel"));

function renderMsciDetail() {
  const { start, ziel } = state.msciSel;
  $("inMsciStart").value = start; $("outMsciStart").textContent = start;
  $("inMsciZiel").value = ziel;   $("outMsciZiel").textContent = ziel;
  const r = MSCI.matrix[start][ziel];
  const dauer = ziel - start;
  const rate = val("inMsciRate");
  const fv = sparplanEndwert(rate, r, dauer);
  const krisen = CONFIG.msciSparplan.krisen.filter((k) => k.bis > start && k.von <= ziel);
  const st = msciStatistik(dauer);

  document.querySelectorAll("#msciGrid .mCell.sel").forEach((c) => c.classList.remove("sel"));
  const cell = document.querySelector(`#msciGrid .mCell[data-s="${start}"][data-z="${ziel}"]`);
  if (cell) cell.classList.add("sel");

  $("msciDetail").innerHTML = `
    <div>
      <div class="mdBig">${fmtNum(r)} % p. a.</div>
      <div class="mdLbl">Sparplan Ende ${start} bis Ende ${ziel} (${dauer} ${dauer === 1 ? "Jahr" : "Jahre"}) –
        zum Vergleich alle ${dauer}-Jahres-Zeiträume:
        min. ${fmtNum(st.min)} % · Ø ${fmtNum(st.avg)} % · max. ${fmtNum(st.max)} %</div>
    </div>
    <div>
      <div class="mdBig">${fmtEur0(fv.endwert)}</div>
      <div class="mdLbl">Endwert bei ${fmtEur0(rate)}/Monat – eingezahlt ${fmtEur0(fv.eingezahlt)},
        Wertzuwachs ${fmtEur0(fv.endwert - fv.eingezahlt)}</div>
    </div>
    <div class="mdKrisen">
      <b>${krisen.length ? "Durchlebte Krisen – trotzdem dieses Ergebnis:" : "Keine große Krise im Zeitraum."}</b>
      ${krisen.map((k) => k.name).join(" · ")}
    </div>`;
}

function initMsci() {
  const D = CONFIG.msciSparplan;
  $("msciSub").textContent =
    `Was ein monatlicher Sparplan (${D.produktBeispiel}) historisch gebracht hätte – jedes Kästchen antippen: ` +
    `Startjahr trifft Zieljahr. Datenbasis: ${D.quelle}.`;
  $("msciSicherheit").innerHTML = msciSichereDauer
    ? `<b>Das Sicherheits-Argument:</b> In 50 Jahren MSCI World gab es ab <b>${msciSichereDauer.dauer} Jahren Spardauer ` +
      `keinen einzigen Zeitraum mit negativer Rendite</b> (schlechtester Fall: +${fmtNum(msciSichereDauer.min)} % p. a.). ` +
      `Kurzfristig sind Verluste normal – Zeit heilt die Schwankung.`
    : "";
  $("msciDisclaimer").innerHTML =
    `<b>Pflichthinweis:</b> Modellrechnung auf Indexbasis (Bruttoindex in EUR, vor 2000 DM) ohne Kosten, Steuern ` +
    `und Produktgebühren. Wertentwicklungen der Vergangenheit sind kein verlässlicher Indikator für die künftige ` +
    `Wertentwicklung. Kein Angebot und keine Anlageempfehlung – Produktauswahl und Geeignetheitsprüfung erfolgen ` +
    `im Beratungsgespräch. Quelle: <a href="${D.quelleUrl}" target="_blank" rel="noopener">Deutsches Aktieninstitut</a>, Stand 12/2023.`;
  renderMsciGrid();
  renderMsciDetail();
}

/* =====================================================================
   Produktkosten Provinzial FondsRente Vario (Effektivkosten laut BIB)
   ===================================================================== */
/* Produktkosten werden immer eingerechnet: fester Pauschalsatz aus CONFIG. */
const kostenPauschal = () => CONFIG.provinzial.effektivkostenPauschal;

/* Die laufzeitabhängigen Kostentabellen (mantelkosten, effektivkosten) liegen
   weiterhin in CONFIG.provinzial, werden aktuell aber nicht gerechnet – die
   Seite nutzt bewusst den Pauschalsatz. */

/* =====================================================================
   Schluss-Ergebnis: Kapitalauszahlung × Rentenfaktor gegen die Rentenlücke
   ===================================================================== */
function renderFazit(c) {
  const card = $("fazitCard");
  const K = state.kombiErgebnis;
  const aktiv = Object.values(state.systeme).some(Boolean);
  if (!aktiv || !K) { card.style.display = "none"; return; }
  card.style.display = "";

  const rate = val("inMsciRate");
  const n = Math.round(c.jahreBisRente);
  const RF = CONFIG.annahmen.rentenfaktorJe10k;

  if (K.luecke <= 0) {
    $("fazitSub").textContent = "";
    $("fazitGrid").innerHTML = "";
    const vd = $("fazitVerdict");
    vd.className = "lueckeBlock ok";
    vd.innerHTML = `<div class="lVal">Keine Lücke</div><div class="lLbl">Die Versorgung liegt bereits über der ` +
      `Wunschrente – ein Sparplan baut zusätzliches Vermögen oder Spielraum für früheren Ruhestand auf.</div>`;
    $("fazitHint").textContent = "";
    return;
  }
  if (n < 1) {
    $("fazitSub").textContent = "";
    $("fazitGrid").innerHTML = "";
    const vd = $("fazitVerdict");
    vd.className = "lueckeBlock";
    vd.innerHTML = `<div class="lVal">− ${fmtEur(K.luecke)}</div><div class="lLbl">Rentenbeginn liegt nicht in ` +
      `der Zukunft – für einen Sparplan fehlt die Ansparzeit. Thema: vorhandenes Kapital / Einmalanlage.</div>`;
    $("fazitHint").textContent = "";
    return;
  }

  const st = msciStatistik(Math.min(n, 50));
  const kostenPa = kostenPauschal();

  const szenarien = [
    { name: "Schlechtester Fall", r: st.min, cls: "" },
    { name: "Historischer Durchschnitt", r: st.avg, cls: "mittel" },
    { name: "Bester Fall", r: st.max, cls: "" },
  ].map((s) => {
    const rNetto = s.r - kostenPa;
    const fv = sparplanEndwert(rate, rNetto, n);
    const rente = fv.endwert / 10000 * RF;
    return { ...s, rNetto, endwert: fv.endwert, rente, deckung: rente / K.luecke };
  });

  const P = CONFIG.provinzial;
  // Kostensätze werden bewusst nicht angezeigt – nur die Tatsache, dass sie
  // eingerechnet sind. Die vollständige Aufstellung steht im Basisinformationsblatt.
  $("kostenBadge").textContent = `✓ ${P.kostenLabel}`;
  $("fazitSub").textContent =
    `Sparrate ${fmtEur0(rate)}/Monat über ${n} Jahre bis zur Rente, angesetzt mit der historischen ` +
    `Bandbreite aller ${Math.min(n, 50)}-Jahres-Sparpläne im MSCI World (${st.n} Zeiträume seit 1973) – ` +
    `Verrentung mit ${fmtNum(RF)} € je 10.000 € Kapital. ` +
    `Die Effektivkosten der ${P.produkt} sind bereits abgezogen.`;

  $("fazitGrid").innerHTML = szenarien.map((s) => `
    <div class="fzBox ${s.cls}">
      <div class="fzTitel">${s.name}</div>
      <div class="fzRendite"><b>${fmtNum(s.rNetto)} % p. a.</b> nach Effektivkosten</div>
      <div class="fzVal">${fmtEur0(s.endwert)}</div>
      <div class="fzRente">Kapitalauszahlung → <b>${fmtEur0(s.rente)}/Monat</b> Zusatzrente</div>
      <div class="fzBar"><div class="fzBarFill ${s.deckung < 1 ? "rot" : ""}" style="width:${Math.min(100, s.deckung * 100)}%"></div></div>
      <div class="fzDeckung ${s.deckung >= 1 ? "gut" : "schlecht"}">${Math.round(s.deckung * 100)} % der Lücke gedeckt</div>
    </div>`).join("");

  renderKostenBlock();

  const mittel = szenarien[1];
  const vd = $("fazitVerdict");
  if (mittel.deckung >= 1) {
    vd.className = "lueckeBlock ok";
    vd.innerHTML = `<div class="lVal">Lücke geschlossen</div><div class="lLbl">Im historischen Durchschnitt ` +
      `stünden ${fmtEur0(mittel.endwert)} Kapital bereit – das sind ${fmtEur0(mittel.rente)}/Monat bei einer Lücke von ` +
      `${fmtEur0(K.luecke)} (${Math.round(mittel.deckung * 100)} %). Selbst der schlechteste historische Verlauf ` +
      `hätte ${Math.round(szenarien[0].deckung * 100)} % gedeckt.</div>`;
  } else {
    vd.className = "lueckeBlock";
    const fehlt = K.luecke - mittel.rente;
    vd.innerHTML = `<div class="lVal">− ${fmtEur(fehlt)}</div><div class="lLbl">Auch im Durchschnittsszenario ` +
      `blieben ${fmtEur0(fehlt)}/Monat der Lücke offen (${Math.round(mittel.deckung * 100)} % gedeckt) – ` +
      `Stellschrauben: Sparrate erhöhen, früher starten oder Wunschrente anpassen.</div>`;
  }

  $("fazitHint").textContent =
    (n > 50 ? `Hinweis: Ansparzeit ${n} Jahre – historische Bandbreite auf 50 Jahre begrenzt. ` : "") +
    "Modellrechnung vor Steuern; historische Renditen sind kein verlässlicher Indikator für die Zukunft. " +
    "Verrentungsannahme wie in der Sparraten-Orientierung (" + fmtNum(RF) + " € je 10.000 €, in CONFIG änderbar).";
}

/* Kostenhinweis ohne Zahlen: nur die Tatsache der Berücksichtigung plus
   Verweis auf das Basisinformationsblatt, dazu die Leistungen des Vertrags. */
function renderKostenBlock() {
  const P = CONFIG.provinzial;
  $("kostenBlock").innerHTML = `
    <div class="infoBox">
      <b>Kosten sind berücksichtigt.</b>
      Alle Ergebnisse dieser Seite sind bereits um die Effektivkosten der ${P.produkt}
      (${P.versicherer}) bereinigt – einschließlich der Abschlusskosten, die über die ersten
      ${P.zillmerungJahre} Jahre verteilt werden, der laufenden Verwaltung und der Fondskosten.
      Die vollständige Kostenaufstellung finden Sie im Basisinformationsblatt zum Tarif
      (Stand ${P.standBib}), das Sie mit den Antragsunterlagen erhalten.
    </div>
    <div class="okBox">
      <b>Was der Vertrag dafür leistet (gegenüber einem reinen Depot):</b>
      <ul style="margin:6px 0 0;padding-left:18px">
        ${P.vorteile.map((v) => `<li>${v}</li>`).join("")}
      </ul>
    </div>`;
}

/* Sparrate aus der Lücken-Rechnung übernehmen, solange der Slider unberührt ist */
function msciRateVorschlag(rate) {
  $("msciRateHint").textContent = "Vorschlag aus der Lücken-Rechnung: " + fmtEur0(rate) + "/Monat.";
  if (!state.msciRateTouched) {
    const v = Math.max(25, Math.min(1500, Math.round(rate / 25) * 25));
    $("inMsciRate").value = v;
    $("outMsciRate").textContent = fmtEur0(v);
    renderMsciDetail();
  }
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
      (k.titel + " " + k.paragraf + " " + k.kernfakten.join(" ") + " " +
       (k.beispiel || "") + " " + k.beratungshinweis).toLowerCase().includes(q))
    .map((k) => `
      <details class="wCard"${q ? " open" : ""}>
        <summary>
          <span class="badge b-${k.sparte}">${SPARTE_NAME[k.sparte]}</span>
          <span class="wTitel">${k.titel}</span>
          <span class="wPara">${k.paragraf}</span>
        </summary>
        <div class="wBody">
          <ul>${k.kernfakten.map((f) => `<li>${f}</li>`).join("")}</ul>
          ${k.beispiel ? `<div class="wBeispiel"><b>Beispiel:</b> ${k.beispiel}</div>` : ""}
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
  initMsci();
  recalc();
  // Browser stellen Slider-Werte nach Reload/Back wieder her, ohne Events zu
  // feuern – Anzeigen und Rechnung danach einmal neu synchronisieren.
  window.addEventListener("pageshow", () => {
    document.querySelectorAll("#mode-beratung input[type=range]").forEach((i) => i._show && i._show());
    recalc();
  });
})();
