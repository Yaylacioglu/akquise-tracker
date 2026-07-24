/* =====================================================================
   VORSORGE – zentrale Daten & Texte
   Rechtsstand: 07/2026 – alle Werte hier pflegen, Logik in vorsorge-app.js
   ---------------------------------------------------------------------
   TODO vor Livegang (Verifikations-Status siehe Kommentare an Ort und Stelle):
   [ ] ATV-Altersfaktoren-Tabelle gegen offizielles PDF prüfen
       (versorgungskassen.de → Zusatzversorgung → Altersfaktoren)
   [ ] § 37 ATV soziale Komponente (Elternzeit): Parameter im ATV nachlesen
   [ ] Versorgungsfreibetrag 2026 (§ 19 Abs. 2 EStG) gegen BMF-Tabelle prüfen
   ===================================================================== */

const CONFIG = {
  stand: "2026-07",

  disclaimer:
    "Vereinfachte Modellrechnung mit Rechtsstand 2026. Ersetzt keine Auskunft der " +
    "Rentenversicherung / Versorgungskasse / des Dienstherrn und keine Steuer- oder " +
    "Rechtsberatung. Alle Angaben ohne Gewähr.",

  /* ---------- Gesetzliche Rentenversicherung ---------- */
  grv: {
    rentenwert: 42.52,            // €/Entgeltpunkt ab 01.07.2026 (DRV)
    durchschnittsentgelt: 51944,  // € vorläufiges Durchschnittsentgelt 2026
    bbgJahr: 101400,              // BBG allgemeine RV €/Jahr (= 8.450 €/Monat)
    beitragssatz: 0.186,          // 18,6 % (AG+AN je hälftig)
    abschlagProMonat: 0.003,      // Zugangsfaktor −0,3 %/Monat vorzeitig (§ 77 SGB VI)
    zuschlagProMonat: 0.005,      // +0,5 %/Monat bei späterem Rentenbeginn
    maxAbschlagAltersrente: 0.144,// max. −14,4 % (48 Monate) bei Altersrente
    besteuerungsanteilStart2026: 0.84, // +0,5 %-Pkt. je späterem Startjahr, 100 % ab 2058
    emAbschlagMax: 0.108,         // EM-Rente: Abschlag max. −10,8 %
    emZurechnungsalter2026: { jahre: 66, monate: 3 }, // steigt bis 67 (2031)
    epProKindMonat: 0.0833,       // Kindererziehungszeit § 70 Abs. 2 SGB VI
    kezMonateAb2027: 36,          // Mütterrente III: einheitlich 36 Monate ab 01.01.2027
  },

  /* ---------- Kranken-/Pflegeversicherung der Rentner ---------- */
  kvpv: {
    kvSatz: 0.146,                // allgemeiner KV-Satz – Rentner zahlt die Hälfte
    kvZusatzDurchschnitt: 0.029,  // Ø-Zusatzbeitrag 2026 – ebenfalls hälftig (GRV-Rente)
    pvSatz: 0.036,                // PV: Rentner trägt den Beitrag voll allein
    pvSatzKinderlos: 0.042,       // PV-Satz für Kinderlose ab 23
    bbgKvJahr: 69750,             // BBG KV/PV €/Jahr
    bezugsgroesseMonat: 3955,     // Bezugsgröße 2026 €/Monat
    betriebsrenteFreibetragKV: 197.75, // 1/20 Bezugsgröße; NUR KV, nur Betriebsrenten (§ 226 SGB V)
  },

  /* ---------- Zusatzversorgung öffentlicher Dienst (Punktemodell ATV/ATV-K) ---------- */
  vbl: {
    referenzentgeltJahr: 12000,   // Referenzentgelt = 1.000 €/Monat (§ 36 ATV)
    messbetrag: 4.0,              // € Monatsrente je Versorgungspunkt
    wartezeitMonate: 60,          // 60 Umlage-/Beitragsmonate, sonst Verfall (§ 34 ATV)
    abschlagProMonat: 0.003,
    abschlagMax: 0.108,           // max. −10,8 %
    dynamikProJahr: 0.01,         // Betriebsrente +1 % p. a. (GRV dagegen lohnfolgend!)
    grvAnpassungBeispiel: 0.0424, // GRV-Anpassung 01.07.2026: +4,24 % (Vergleichswert)
    umlageWest: { gesamt: 0.069, ag: 0.0549, an: 0.0141, anZusatz: 0.004 },
    // Altersfaktoren § 36 Abs. 2 ATV – Anker 34→1,8 verifiziert; Tabelle vor Livegang
    // gegen offizielles PDF prüfen: versorgungskassen.de → Zusatzversorgung → Altersfaktoren
    altersfaktoren: { 17:3.1,18:3.0,19:2.9,20:2.8,21:2.7,22:2.6,23:2.5,24:2.4,25:2.4,
      26:2.3,27:2.2,28:2.2,29:2.1,30:2.0,31:2.0,32:1.9,33:1.9,34:1.8,35:1.7,36:1.7,
      37:1.6,38:1.6,39:1.6,40:1.5,41:1.5,42:1.4,43:1.4,44:1.4,45:1.3,46:1.3,47:1.3,
      48:1.2,49:1.2,50:1.2,51:1.1,52:1.1,53:1.1,54:1.1,55:1.0,56:1.0,57:1.0,58:1.0,
      59:1.0,60:0.9,61:0.9,62:0.9,63:0.9,64:0.9,65:0.8 }, // ab 65: 0,8
  },

  /* ---------- Beamtenversorgung (BeamtVG / LBeamtVG NRW) ---------- */
  beamte: {
    steigerungProJahr: 0.0179375, // § 14 Abs. 1 BeamtVG: 1,79375 %/Jahr
    hoechstsatz: 0.7175,          // 71,75 % – erst ab 40 VZ-Dienstjahren
    wartezeitJahre: 5,            // § 4 BeamtVG
    abschlagProMonat: 0.003,      // Versorgungsabschlag 0,3 %/Monat (§ 14 Abs. 3)
    abschlagMaxDU: 0.108,         // max. −10,8 % bei Dienstunfähigkeit
    abschlagMaxAntrag: 0.144,     // max. −14,4 % bei Antragsruhestand
    mindestAmtsabhaengig: 0.35,   // 35 % der ruhegehaltfähigen Bezüge
    mindestAmtsunabhaengig: { prozentA4End: 0.65, fixbetrag: 30.68, caBrutto: 2100 },
    unfallruhegehaltMin: 0.6667,  // Unfallruhegehalt mind. 66 2/3 %
    duZurechnungBisAlter: 60,     // Zurechnungszeit bei DU: bis 60. Lebensjahr zu 2/3
    duZurechnungFaktor: 2 / 3,
    durchschnittssatzReal: 0.669, // Ø-Ruhegehaltssatz Versorgungszugänge Bund 2024 – Beratungsargument!
    versorgungsfreibetrag2026: { prozent: 0.124, maxJahr: 930, zuschlag: 279 }, // § 19 Abs. 2 EStG, prüfen
  },

  /* ---------- Berufsständische Versorgungswerke ---------- */
  versorgungswerk: {
    regelhoechstbeitragMonat: 1571.70, // 18,6 % × 8.450 € BBG-Monat (2026)
    befreiungsfristMonate: 3,          // § 6 Abs. 4 SGB VI – Antrag binnen 3 Monaten, elektronisch
  },

  /* ---------- Annahmen für die Sparraten-Orientierung ---------- */
  annahmen: {
    rentenfaktorJe10k: 30,        // € Monatsrente je 10.000 € Kapital (Orientierungswert)
    renditeMin: 0.02, renditeMax: 0.06, renditeDefault: 0.04,
    grvAnpassungLangfrist: 0.025, // Beispielannahme GRV-Dynamik für Kaufkraftvergleich
  },

  /* ---------- Regelaltersgrenze §§ 35, 235 SGB VI ---------- */
  // bis 1946: 65 | 1947–1958: 65 J. + (Jahrgang−1946) Monate |
  // 1959–1963: 66 J. + (Jahrgang−1958)×2 Monate | ab 1964: 67
  regelaltersgrenze: function (geburtsjahr) {
    if (geburtsjahr <= 1946) return { jahre: 65, monate: 0 };
    if (geburtsjahr <= 1958) return { jahre: 65, monate: geburtsjahr - 1946 };
    if (geburtsjahr <= 1963) return { jahre: 66, monate: (geburtsjahr - 1958) * 2 };
    return { jahre: 67, monate: 0 };
  },

  /* ---------- Modus „Wissen“: Karten (wird in Schritt 6 befüllt) ---------- */
  wissen: [],

  /* ---------- Modus „Unterlagen-Check“: Checklisten (wird in Schritt 7 befüllt) ---------- */
  checklisten: {},
};
