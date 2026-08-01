/* =====================================================================
   VORSORGE – zentrale Daten & Texte
   Rechtsstand: 07/2026 – alle Werte hier pflegen, Logik in vorsorge-app.js
   ---------------------------------------------------------------------
   Verifikations-Status (geprüft am 25.07.2026):
   [x] ATV-Altersfaktoren: gegen ATV-Text (recht.nrw.de) UND Altersfaktoren-
       tabelle der ZVK Hannover geprüft – Tabelle unten entsprechend korrigiert
       (ursprünglicher Entwurf war ab Alter 44 um eine Stufe zu hoch).
   [x] § 37 ATV soziale Komponente: je vollem Kalendermonat Elternzeit werden
       VP aus einem fiktiven Entgelt von 500 €/Monat gutgeschrieben, je Kind
       max. 36 Monate (ATV-Text, recht.nrw.de).
   [x] Versorgungsfreibetrag 2026: 12,8 % / max. 960 € + 288 € Zuschlag
       (amtliche Tabelle LBV Baden-Württemberg; 12,4/930/279 gilt erst 2027).
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

  /* ---------- Absicherung bei Krankheit: Lohnfortzahlung → Krankengeld → EM ---------- */
  krankheit: {
    lohnfortzahlungWochen: 6,        // § 3 EFZG: 6 Wochen volles Entgelt
    krankengeldSatzBrutto: 0.70,     // § 47 SGB V: 70 % des Regelentgelts …
    krankengeldDeckelNetto: 0.90,    // … höchstens 90 % des Nettoarbeitsentgelts
    beitragsbasisAnteil: 0.80,       // beitragspflichtig sind 80 % des Regelentgelts
    hoechstdauerWochen: 78,          // je Krankheit in 3 Jahren, inkl. Lohnfortzahlung
    // Arbeitnehmeranteile, die vom Krankengeld einbehalten werden (KV entfällt)
    anBeitraege: { rv: 0.093, av: 0.013, pv: 0.018, pvKinderlosZuschlag: 0.006 },
    bbgKvMonat: 5812.50,             // BBG KV/PV 2026 monatlich (69.750 €/Jahr)
    emFaktorVoll: 1.0,               // volle EM: unter 3 Std./Tag
    emFaktorTeilweise: 0.5,          // teilweise EM: 3 bis unter 6 Std./Tag
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
    // Altersfaktoren (ATV-Anlage; in Kassensatzungen z. B. § 34/36) – verifiziert
    // am 25.07.2026 gegen ATV-Text (recht.nrw.de) und ZVK Hannover (identisch).
    // Maßgebliches Alter = Kalenderjahr − Geburtsjahr.
    altersfaktoren: { 17:3.1,18:3.0,19:2.9,20:2.8,21:2.7,22:2.6,23:2.5,24:2.4,25:2.4,
      26:2.3,27:2.2,28:2.2,29:2.1,30:2.0,31:2.0,32:1.9,33:1.9,34:1.8,35:1.7,36:1.7,
      37:1.6,38:1.6,39:1.6,40:1.5,41:1.5,42:1.4,43:1.4,44:1.3,45:1.3,46:1.3,47:1.2,
      48:1.2,49:1.2,50:1.1,51:1.1,52:1.1,53:1.0,54:1.0,55:1.0,56:1.0,57:0.9,58:0.9,
      59:0.9,60:0.9,61:0.9,62:0.8,63:0.8,64:0.8 }, // ab 64: 0,8
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
    // § 19 Abs. 2 EStG, Versorgungsbeginn 2026 – verifiziert 25.07.2026 gegen
    // amtliche Tabelle (LBV BW); 12,4 % / 930 € / 279 € gilt erst für Beginn 2027
    versorgungsfreibetrag2026: { prozent: 0.128, maxJahr: 960, zuschlag: 288 },
  },

  /* ---------- Berufsständische Versorgungswerke ---------- */
  versorgungswerk: {
    regelhoechstbeitragMonat: 1571.70, // 18,6 % × 8.450 € BBG-Monat (2026)
    befreiungsfristMonate: 3,          // § 6 Abs. 4 SGB VI – Antrag binnen 3 Monaten, elektronisch
  },

  /* ---------- Annahmen für die Sparraten-Orientierung ---------- */
  annahmen: {
    /* Rentenfaktor = monatliche Rente je 10.000 € Vertragsguthaben.
       ACHTUNG: 30 € ist bis auf Weiteres eine ANNAHME, nicht der Tarifwert!
       Die garantierten Rentenfaktoren der FondsRente Vario stehen laut § 2 Abs. 3
       der Bedingungen im individuellen Versicherungsschein; sie hängen vom
       Rentenbeginn ab (je Jahr der Abrufphase ein eigener Wert) und basieren auf
       0,5 % Rechnungszins und einer aus DAV 2004R (50 %) abgeleiteten
       geschlechtsneutralen Sterbetafel – daher liegen sie erfahrungsgemäß
       spürbar unter 30 €. Sobald ein Musterangebot vorliegt: hier den
       garantierten Faktor für das typische Rentenbeginnalter eintragen. */
    rentenfaktorJe10k: 30,
    renditeMin: 0.02, renditeMax: 0.06, renditeDefault: 0.04,
    grvAnpassungLangfrist: 0.025, // Beispielannahme GRV-Dynamik für Kaufkraftvergleich
  },

  /* ---------- MSCI World-Rendite-Dreieck (monatliche Geldanlage) ----------
     Quelle: Deutsches Aktieninstitut e.V., "Das MSCI World-Rendite-Dreieck für
     die monatliche Geldanlage", Stand 31.12.2023 (dai.de). Bruttoindex
     (Dividenden reinvestiert) in Euro, vor 2000 in DM; Monatsschlusskurse;
     ohne Kosten und Steuern. Werte = durchschnittliche jährliche Rendite in %
     eines monatlichen Sparplans von Ende <Startjahr> bis Ende <Zieljahr>.
     zeilen[start] = Renditen für Zieljahre start+1 … 2023 (Leerzeichen-getrennt,
     deutsches Komma). Übernommen 1:1 aus dem DAI-PDF am 25.07.2026. */
  msciSparplan: {
    stand: "2023-12",
    quelle: "Deutsches Aktieninstitut, MSCI World-Rendite-Dreieck für die monatliche Geldanlage, Stand 31.12.2023",
    quelleUrl: "https://www.dai.de",
    produktBeispiel: "z. B. iShares Core MSCI World UCITS ETF (Acc), ISIN IE00B4L5Y983",
    zielMax: 2023,
    zeilen: {
      2022: "19,1",
      2021: "-11,2 10,7",
      2020: "31,3 -2,0 9,3",
      2019: "24,0 29,4 5,4 11,3",
      2018: "23,6 15,3 23,5 7,4 11,5",
      2017: "-11,6 16,2 12,8 20,1 8,2 11,5",
      2016: "8,3 -2,7 13,4 11,6 17,8 8,5 11,2",
      2015: "22,6 11,9 2,3 13,0 11,5 16,7 9,0 11,3",
      2014: "1,5 11,3 9,6 3,3 11,8 10,7 15,3 9,0 11,0",
      2013: "24,2 12,2 12,9 10,9 5,4 11,9 10,9 14,9 9,4 11,1",
      2012: "18,7 20,7 14,6 13,8 11,9 7,1 12,3 11,3 14,7 9,8 11,3",
      2011: "9,5 17,6 19,3 15,4 14,4 12,6 8,3 12,6 11,7 14,7 10,3 11,6",
      2010: "2,9 10,2 15,9 17,8 15,3 14,4 12,9 9,1 12,8 11,9 14,5 10,6 11,7",
      2009: "23,4 5,6 9,9 14,5 16,4 14,8 14,1 12,8 9,5 12,7 11,9 14,3 10,7 11,8",
      2008: "38,3 25,8 10,9 12,2 15,2 16,6 15,2 14,5 13,3 10,3 13,1 12,3 14,4 11,1 12,0",
      2007: "-42,2 7,1 14,2 7,5 9,7 12,9 14,7 13,8 13,4 12,6 10,0 12,5 11,9 13,9 10,9 11,7",
      2006: "-7,7 -32,9 -1,9 7,2 4,1 7,0 10,4 12,4 12,1 12,0 11,4 9,2 11,7 11,2 13,1 10,4 11,2",
      2005: "11,1 0,2 -24,3 -3,2 4,6 2,8 5,6 8,9 10,9 10,9 11,0 10,6 8,7 11,0 10,6 12,5 10,0 10,8",
      2004: "29,7 14,3 5,0 -17,2 -2,2 4,1 2,6 5,2 8,2 10,1 10,2 10,4 10,1 8,4 10,6 10,2 12,0 9,7 10,5",
      2003: "4,0 20,8 14,1 7,1 -12,2 -1,0 4,2 2,9 5,1 7,8 9,6 9,8 10,0 9,8 8,2 10,3 10,0 11,7 9,5 10,3",
      2002: "18,7 9,3 18,5 14,2 8,6 -8,4 0,3 4,6 3,3 5,2 7,7 9,3 9,5 9,8 9,6 8,2 10,1 9,8 11,4 9,4 10,2",
      2001: "-33,8 -0,3 3,3 12,7 11,2 7,3 -7,1 0,4 4,1 3,1 4,8 7,1 8,7 9,0 9,3 9,1 7,9 9,7 9,5 11,0 9,1 9,9",
      2000: "-9,3 -27,6 -6,4 -0,9 8,1 8,1 5,6 -6,7 -0,1 3,4 2,5 4,2 6,4 8,0 8,3 8,6 8,6 7,4 9,2 9,0 10,5 8,8 9,5",
      1999: "-17,2 -12,6 -24,7 -9,0 -3,5 4,8 5,7 4,0 -6,7 -0,7 2,6 1,9 3,6 5,7 7,3 7,6 8,0 8,0 7,0 8,7 8,5 10,0 8,4 9,1",
      1998: "51,7 3,7 -4,9 -18,6 -7,7 -3,4 3,8 4,8 3,5 -6,2 -0,8 2,3 1,7 3,3 5,3 6,8 7,2 7,6 7,6 6,7 8,3 8,2 9,6 8,1 8,8",
      1997: "12,9 37,4 11,0 0,7 -13,0 -5,5 -2,3 3,8 4,6 3,5 -5,3 -0,5 2,3 1,8 3,2 5,1 6,5 6,9 7,3 7,4 6,5 8,1 8,0 9,3 7,9 8,6",
      1996: "23,1 17,0 31,9 14,2 4,6 -8,4 -3,1 -0,9 4,3 4,9 3,9 -4,2 0,0 2,5 2,0 3,4 5,1 6,4 6,8 7,2 7,3 6,4 7,9 7,9 9,2 7,8 8,5",
      1995: "20,7 28,5 21,4 31,0 17,2 8,2 -4,0 -0,5 1,0 5,3 5,7 4,6 -2,9 0,8 3,0 2,5 3,7 5,3 6,5 6,9 7,2 7,3 6,5 7,9 7,9 9,1 7,8 8,4",
      1994: "22,3 22,1 27,9 22,8 29,9 18,9 10,8 -0,5 1,9 2,8 6,3 6,6 5,5 -1,6 1,7 3,7 3,1 4,2 5,6 6,8 7,1 7,4 7,4 6,7 8,0 8,0 9,1 7,9 8,5",
      1993: "-7,4 9,1 15,9 22,9 20,5 26,9 18,3 11,4 1,2 3,1 3,7 6,8 6,9 5,9 -0,7 2,3 4,0 3,5 4,4 5,8 6,8 7,1 7,4 7,5 6,7 8,0 8,0 9,1 7,9 8,5",
      1992: "28,8 2,1 8,4 14,0 20,3 19,0 24,8 17,8 11,8 2,7 4,1 4,5 7,2 7,3 6,3 0,2 2,8 4,4 3,8 4,7 6,0 7,0 7,2 7,5 7,5 6,8 8,1 8,0 9,1 7,9 8,5",
      1991: "8,5 24,4 7,2 9,7 13,9 19,2 18,3 23,4 17,5 12,3 4,0 5,0 5,3 7,7 7,7 6,8 1,0 3,4 4,8 4,2 5,0 6,2 7,1 7,4 7,6 7,6 7,0 8,1 8,1 9,1 8,0 8,5",
      1990: "-0,7 2,7 17,2 7,0 9,0 12,7 17,5 17,1 21,8 16,8 12,2 4,6 5,5 5,7 7,9 7,9 7,0 1,6 3,7 5,1 4,5 5,2 6,3 7,2 7,4 7,7 7,7 7,0 8,1 8,1 9,1 8,0 8,5",
      1989: "-22,0 2,5 2,8 13,9 6,8 8,5 11,8 16,2 16,0 20,3 16,1 12,0 5,1 5,9 6,0 8,0 8,0 7,1 2,0 4,0 5,3 4,7 5,4 6,4 7,2 7,5 7,7 7,7 7,1 8,1 8,1 9,0 8,0 8,5",
      1988: "-0,4 -19,2 -1,2 0,4 10,3 5,4 7,2 10,3 14,4 14,6 18,7 15,0 11,4 5,1 5,8 5,9 7,8 7,8 7,0 2,2 4,1 5,3 4,7 5,4 6,4 7,2 7,4 7,6 7,6 7,0 8,0 8,0 8,9 7,9 8,4",
      1987: "27,4 12,9 -10,0 1,0 1,5 9,5 5,5 7,0 9,8 13,6 13,9 17,6 14,4 11,2 5,4 6,0 6,1 7,8 7,9 7,1 2,6 4,3 5,4 4,9 5,5 6,4 7,2 7,4 7,6 7,6 7,0 8,0 8,0 8,9 7,9 8,4",
      1986: "-28,6 14,4 11,7 -6,2 1,9 2,0 8,8 5,4 6,8 9,3 12,8 13,2 16,7 13,9 10,9 5,5 6,1 6,2 7,8 7,8 7,1 2,8 4,5 5,5 5,0 5,6 6,5 7,2 7,4 7,6 7,6 7,0 8,0 7,9 8,8 7,9 8,3",
      1985: "4,6 -9,2 13,4 12,0 -2,9 3,1 2,8 8,6 5,7 6,8 9,1 12,3 12,7 16,0 13,5 10,7 5,8 6,3 6,3 7,8 7,9 7,2 3,1 4,6 5,6 5,1 5,7 6,5 7,2 7,4 7,6 7,6 7,1 8,0 7,9 8,8 7,9 8,3",
      1984: "6,0 8,9 -1,8 13,1 12,3 -0,5 4,2 3,7 8,7 6,0 7,0 9,1 12,0 12,4 15,5 13,2 10,7 6,0 6,5 6,5 7,9 7,9 7,3 3,4 4,8 5,7 5,3 5,8 6,6 7,2 7,4 7,6 7,6 7,1 8,0 7,9 8,8 7,9 8,3",
      1983: "33,9 15,7 13,3 3,7 14,2 13,3 2,0 5,7 4,9 9,1 6,7 7,5 9,3 12,0 12,3 15,2 13,1 10,7 6,4 6,8 6,8 8,1 8,1 7,5 3,8 5,1 6,0 5,5 6,0 6,7 7,4 7,5 7,7 7,7 7,2 8,1 8,0 8,8 8,0 8,4",
      1982: "34,0 27,9 18,3 15,6 7,3 15,2 14,2 4,2 7,0 6,1 9,7 7,4 8,0 9,6 12,1 12,4 15,1 13,1 10,9 6,8 7,1 7,1 8,3 8,3 7,7 4,2 5,4 6,2 5,8 6,2 6,9 7,5 7,7 7,8 7,8 7,4 8,2 8,1 8,9 8,1 8,4",
      1981: "30,4 36,4 29,9 21,8 18,5 11,0 16,9 15,8 6,6 8,8 7,6 10,7 8,5 8,9 10,3 12,5 12,8 15,2 13,4 11,3 7,4 7,7 7,6 8,8 8,7 8,1 4,7 5,9 6,6 6,2 6,6 7,2 7,8 7,9 8,1 8,1 7,6 8,4 8,3 9,0 8,2 8,6",
      1980: "-0,5 15,7 27,6 25,9 20,8 18,4 12,1 17,1 16,0 7,8 9,6 8,5 11,2 9,1 9,4 10,6 12,7 12,9 15,2 13,4 11,5 7,8 8,0 8,0 9,0 8,9 8,4 5,2 6,2 6,9 6,5 6,8 7,5 8,0 8,1 8,2 8,2 7,8 8,5 8,4 9,1 8,4 8,7",
      1979: "50,9 17,9 19,1 27,1 25,8 21,6 19,4 13,9 17,9 16,9 9,4 10,8 9,6 11,9 9,9 10,2 11,2 13,1 13,3 15,4 13,7 11,9 8,4 8,5 8,4 9,4 9,3 8,8 5,7 6,7 7,3 6,9 7,2 7,8 8,3 8,4 8,5 8,5 8,0 8,7 8,7 9,3 8,6 8,9",
      1978: "-0,3 32,4 19,4 19,4 25,8 25,0 21,6 19,8 14,9 18,3 17,3 10,5 11,7 10,5 12,5 10,6 10,8 11,7 13,4 13,6 15,5 13,9 12,2 8,8 9,0 8,9 9,8 9,7 9,1 6,2 7,1 7,7 7,2 7,5 8,1 8,5 8,6 8,7 8,7 8,3 8,9 8,9 9,5 8,8 9,1",
      1977: "-1,8 2,6 24,1 17,8 18,2 23,8 23,5 20,9 19,4 15,2 18,2 17,4 11,1 12,1 11,0 12,8 11,0 11,1 12,0 13,6 13,7 15,5 14,0 12,4 9,2 9,3 9,2 10,0 9,9 9,4 6,5 7,4 7,9 7,5 7,8 8,3 8,7 8,8 8,9 8,9 8,4 9,1 9,0 9,6 8,9 9,2",
      1976: "-11,1 -2,5 1,6 18,3 15,3 16,3 21,4 21,6 19,7 18,6 14,9 17,7 17,0 11,3 12,2 11,1 12,8 11,2 11,2 12,0 13,5 13,6 15,4 14,0 12,4 9,4 9,5 9,3 10,1 10,0 9,5 6,8 7,6 8,1 7,7 7,9 8,4 8,8 8,9 9,0 9,0 8,5 9,2 9,1 9,7 9,0 9,3",
      1975: "-1,5 -7,7 -2,8 0,7 14,5 13,1 14,4 19,2 19,8 18,3 17,5 14,3 16,9 16,4 11,2 12,0 11,0 12,7 11,1 11,2 11,9 13,3 13,5 15,1 13,8 12,3 9,4 9,5 9,4 10,1 10,0 9,5 6,9 7,7 8,2 7,8 8,0 8,5 8,9 9,0 9,0 9,0 8,6 9,2 9,1 9,7 9,0 9,3",
      1974: "29,1 8,5 -1,6 -0,3 1,8 13,0 12,2 13,5 17,9 18,6 17,5 16,8 14,0 16,4 16,0 11,2 12,0 11,1 12,6 11,1 11,2 11,9 13,2 13,4 15,0 13,7 12,3 9,5 9,6 9,5 10,2 10,1 9,6 7,1 7,8 8,3 7,9 8,1 8,6 9,0 9,0 9,1 9,1 8,7 9,3 9,2 9,7 9,1 9,4",
      1973: "-35,6 14,7 7,9 0,2 0,7 2,3 11,8 11,3 12,6 16,7 17,5 16,6 16,1 13,6 15,9 15,5 11,1 11,8 11,0 12,4 11,1 11,1 11,8 13,1 13,2 14,7 13,6 12,2 9,6 9,6 9,5 10,2 10,1 9,6 7,2 7,9 8,4 8,0 8,2 8,6 9,0 9,1 9,1 9,1 8,7 9,3 9,2 9,8 9,1 9,4",
    },
    krisen: [
      { von: 1973, bis: 1974, name: "Ölkrise 1973/74" },
      { von: 1987, bis: 1987, name: "Crash „Schwarzer Montag“ 1987" },
      { von: 1990, bis: 1990, name: "Golfkrieg & Japan-Blase 1990" },
      { von: 2000, bis: 2002, name: "Dotcom-Crash & 11. September 2000–2002" },
      { von: 2008, bis: 2009, name: "Globale Finanzkrise 2008/09" },
      { von: 2011, bis: 2011, name: "Eurokrise 2011" },
      { von: 2020, bis: 2020, name: "Corona-Crash 2020" },
      { von: 2022, bis: 2022, name: "Zinswende & Ukraine-Krieg 2022" },
    ],
  },

  /* ---------- Provinzial FondsRente Vario: Kosten laut Basisinformationsblatt ----------
     Quelle: Basisinformationsblätter "FondsRente Vario (FR Tarifwerk 2025)",
     Provinzial Lebensversicherung AG, Stand 14.03.2026, für die Haltedauern
     12 / 20 / 30 / 40 Jahre (Musterfall: 1.000 €/Jahr, monatlich gezahlt,
     kein zusätzlicher Todesfallschutz).

     WICHTIG – warum die ausgewiesenen Effektivkosten und keine eigene Mechanik:
     Die Kostenbestandteile stehen zwar im BIB (2,5 % Einstieg, 6,7 % vom Beitrag,
     9 €/Jahr, 0,64–3,00 % Guthaben, 0,01–0,91 % Transaktion), die Zillmerungs-
     verteilung aber nicht. Ein Nachbau lag beim Test 0,35–0,66 %-Punkte über den
     amtlichen Werten. Deshalb rechnen wir mit der ausgewiesenen "jährlichen
     Auswirkung der Kosten" (RIY) – exakt die Zahl, die der Kunde im BIB nachlesen
     kann. Zwischen den Stützstellen wird linear interpoliert.

     min = günstigste Anlageoption, max = teuerste Anlageoption. */
  provinzial: {
    produkt: "FondsRente Vario (FR Tarifwerk 2025)",
    versicherer: "Provinzial Lebensversicherung AG",
    standBib: "14.03.2026",
    musterfallJahresbeitrag: 1000,
    // Jährliche Auswirkung der Kosten (Effektivkosten/RIY) in % p. a. je Haltedauer
    effektivkosten: {
      12: { min: 1.80, max: 5.10 },
      20: { min: 1.30, max: 4.60 },
      30: { min: 1.00, max: 4.30 },
      40: { min: 0.90, max: 4.10 },
    },
    // Kosten insgesamt in € im Musterfall (1.000 €/Jahr) – für die Einordnung
    kostenGesamtMusterfall: {
      12: { min: 1880, max: 3584 },
      20: { min: 3436, max: 9569 },
      30: { min: 5688, max: 15549 },
      40: { min: 10607, max: 34765 },
    },
    /* PAUSCHALER Kostensatz, der in allen Hochrechnungen fest abgezogen wird
       (Festlegung Muratcan 07/2026): 0,44 % Effektivkosten p. a. über die
       Laufzeit. Herkunft: Provinzial-Tarifkalkulation für 40 Jahre Laufzeit;
       Abschlusskosten 2,5 % der Beitragssumme werden über die ersten 5 Jahre
       gezillmert und sind darin enthalten.
       Hinweis für spätere Anpassungen: Bei deutlich kürzeren Laufzeiten liegen
       die realen Effektivkosten höher (Modellrechnung: ca. 0,57 % bei 30 J.,
       0,85 % bei 20 J., 1,43 % bei 12 J.) – der Pauschalwert ist bewusst
       gewählt und gilt einheitlich. Zum Ändern nur diese Zeile anfassen. */
    effektivkostenPauschal: 0.44,
    kostenLabel: "Kosten auf Laufzeit mit eingerechnet",

    /* Referenz (wird nicht gerechnet): Kosten des Versicherungsmantels OHNE Fondskosten.
       Anker: 0,44 % Effektivkosten bei 40 Jahren Laufzeit (Angabe aus der
       Provinzial-Tarifkalkulation, Muratcan 07/2026). Abschlusskosten 2,5 %
       der Beitragssumme werden über die ersten 5 Jahre gezillmert.
       Die übrigen Laufzeiten sind mit derselben Mechanik hochgerechnet
       (Zillmerung 5 J. + 6,70 % vom Beitrag + 9 €/Jahr) und auf den
       40-Jahres-Anker kalibriert.
       Gegenprobe: 0,44 % Mantel + ca. 0,45 % günstigster Fonds inkl.
       Transaktionskosten = 0,89 % ≈ 0,90 % BIB-Ausweis für 40 Jahre. */
    mantelkosten: { 12: 1.43, 20: 0.85, 30: 0.57, 40: 0.44 },
    mantelAnker: { jahre: 40, riy: 0.44, quelle: "Provinzial-Tarifkalkulation" },
    zillmerungJahre: 5,
    // Fondskosten-Vorschläge (TER p. a.) für die Auswahl im Rechner
    fondsBeispiele: [
      { name: "Welt-ETF (z. B. MSCI World, thesaurierend)", ter: 0.20 },
      { name: "Aktienfonds aktiv gemanagt", ter: 1.50 },
      { name: "teuerste Anlageoption laut BIB", ter: 3.00 },
    ],
    // Kostenbestandteile laut BIB (in allen vier Laufzeiten identisch)
    bestandteile: [
      "Einstiegskosten: 2,50 % des kumulierten Anlagebetrags (in den Beiträgen enthalten)",
      "Ausstiegskosten: keine",
      "Verwaltung: 0,64–3,00 % des Anlagewerts p. a. + 6,70 % der eingezahlten Beiträge + 9,00 € pro Jahr",
      "Transaktionskosten: 0,01–0,91 % des Werts p. a.",
    ],
    // Vorteile der Police gegenüber dem reinen Depot – fachlich korrekt einordnen
    vorteile: [
      "Lebenslange Rentenzahlung – das Langlebigkeitsrisiko trägt der Versicherer, ein Depot kann aufgezehrt werden.",
      "Fondswechsel innerhalb des Vertrags ist steuerfrei möglich; im Depot löst jeder Wechsel Abgeltungsteuer aus.",
      "In der Ansparphase fällt keine laufende Abgeltungsteuer an (Steuerstundung).",
      "Kapitalauszahlung nach 12 Jahren Laufzeit und ab Alter 62: nur die Hälfte des Ertrags ist steuerpflichtig (§ 20 Abs. 1 Nr. 6 EStG).",
      "Optional Beitragsbefreiung bei Berufsunfähigkeit und zusätzlicher Todesfallschutz einschließbar.",
    ],
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

  /* ---------- Modus „Wissen“: durchsuchbare Karten (Stand 07/2026) ---------- */
  wissen: [
    /* ===== GRV ===== */
    {
      sparte: "grv", titel: "Kindererziehungszeiten & Mütterrente III", paragraf: "§ 70 Abs. 2 SGB VI",
      kernfakten: [
        "0,0833 EP je Monat Kindererziehung; ab 1992 geborene Kinder 36 Monate ≈ 3 EP, vor 1992 bisher 30 Monate ≈ 2,5 EP.",
        "Mütterrente III (Rentenpaket 2025, beschlossen 05.12.2025): ab 01.01.2027 einheitlich 36 Monate für alle; Auszahlung ab 2028, für 2027 gibt es eine Nachzahlung.",
        "3 EP × 42,52 € ≈ 128 €/Monat je Kind.",
        "Meist kein Extra-Antrag nötig. Antrag nötig, wenn im Versicherungsverlauf zum 30. Lebensmonat des Kindes keine Berücksichtigungszeit steht (z. B. Adoption, Ausland) – Formular V0800.",
        "Zuordnung auch an Väter/Großeltern/Pflegeeltern möglich (überwiegende Erziehung; gemeinsame Erklärung wirkt nur für die Zukunft).",
        "Kürzung: Der Zugangsfaktor wirkt auch auf KEZ – bei 63er-Rente z. B. 0,4278 statt 0,5 EP je Mütterrente-III-Aufschlag. Bei Gutverdienern Deckelung an der BBG.",
      ],
      beispiel: "Frau K. hat zwei Kinder (2014 und 2017). 2 × 36 Monate × 0,0833 EP = 6,0 EP → 6,0 × 42,52 € = 255,12 € mehr Rente im Monat. Fehlt die KEZ-Zeile im Versicherungsverlauf, fehlt dieser Betrag lebenslang.",
      beratungshinweis: "Bei jeder Mutter/jedem erziehenden Elternteil prüfen, ob die KEZ-Zeile im Verlauf steht – ca. 128 €/Monat je Kind sind sonst verschenkt. V0800 mitnehmen.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Familie-und-Kinder/familie-und-kinder_node.html",
    },
    {
      sparte: "grv", titel: "Berücksichtigungszeit bis zum 10. Geburtstag", paragraf: "§ 57 SGB VI",
      kernfakten: [
        "Geburt bis 10. Geburtstag, nur bei einem Elternteil; max. 10 Jahre auch bei mehreren Kindern (Ende: Tag vor dem 10. Geburtstag des jüngsten).",
        "Erhöht die Rente nicht direkt, ABER: zählt zur 35er- UND 45er-Wartezeit.",
        "Erhält die EM-Anwartschaft, wertet Teilzeitbeiträge um bis zu 50 % auf und verbessert die Bewertung beitragsfreier Zeiten.",
        "Antrag rückwirkend möglich, sinnvoll nach dem 10. Geburtstag des jüngsten Kindes – gleiches Formular V0800.",
      ],
      beispiel: "Frau S. war von 2008 bis 2018 in Teilzeit, jüngstes Kind Jahrgang 2008. Die zehn Berücksichtigungsjahre zählen voll zur 35er- und 45er-Wartezeit: Aus 28 Beitragsjahren werden 38 rentenrechtliche Jahre – und ihre Teilzeitbeiträge werden zusätzlich aufgewertet.",
      beratungshinweis: "Unsichtbarer Baustein: taucht als „Berücksichtigungszeit“ im Verlauf auf. Fehlt sie, gehen Wartezeit- und EM-Vorteile verloren – im Unterlagen-Check prüfen.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__57.html",
    },
    {
      sparte: "grv", titel: "Wartezeiten im Überblick (5 / 20 / 35 / 45 Jahre)", paragraf: "§§ 50–51 SGB VI",
      kernfakten: [
        "5 Jahre (allgemein): Regelaltersrente, EM-Rente, Hinterbliebenenrente. Zählen: Beiträge, Ersatzzeiten, Versorgungsausgleich, Minijob – NICHT Berücksichtigungszeiten.",
        "20 Jahre: volle EM-Rente auf dem Sonderweg für nie voll Erwerbsgeminderte.",
        "35 Jahre (langjährig Versicherte): Rente ab 63 mit Abschlag; es zählen ALLE rentenrechtlichen Zeiten.",
        "45 Jahre (besonders langjährig): abschlagsfrei 2 Jahre vor Regelalter. Zählen u. a.: Pflichtbeiträge, Pflege, Kindererziehung bis 10, ALG. NICHT: Schule/Studium, Bürgergeld, freiwillige Beiträge der letzten 2 Jahre bei Arbeitslosigkeit; freiwillige Beiträge nur bei ≥ 18 Jahren Pflichtbeiträgen.",
      ],
      beispiel: "Herr B., 63, kommt auf 44 Jahre und 7 Monate. Fünf Monate fehlen zur 45er-Wartezeit. Mit einem Minijob samt Opt-in erreicht er sie und geht zwei Jahre vor Regelalter abschlagsfrei – ohne sie kostet derselbe Rentenbeginn 7,2 % Abschlag, bei 1.800 € Rente rund 130 € im Monat, lebenslang.",
      beratungshinweis: "Wer knapp an 45 Jahren kratzt, kann mit Minijob-Opt-in oder Pflegezeiten noch Monate sammeln – im Check ab 61 gezielt ansprechen.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__51.html",
    },
    {
      sparte: "grv", titel: "Erwerbsminderungsrente (EM)", paragraf: "§ 43 SGB VI",
      kernfakten: [
        "Voraussetzungen: 3/5-Regel (36 Pflichtbeitragsmonate in den letzten 60), 5 Jahre Wartezeit, medizinisches Gutachten.",
        "Voll: unter 3 h/Tag (Faktor 1,0) · teilweise: 3 bis unter 6 h (Faktor 0,5) · Arbeitsmarktrente möglich, wenn Teilzeitjobs fehlen.",
        "Zurechnungszeit bis 66 J. 3 M. (2026, steigt bis 67 im Jahr 2031); Abschlag max. 10,8 %.",
        "Berufsanfänger-Sonderregel § 53 SGB VI: EM binnen 6 Jahren nach Ausbildung + 12 Pflichtmonate in den letzten 24 reichen.",
      ],
      beispiel: "Herr T., 41, verdient 45.000 € und hat rund 22 Entgeltpunkte. Bei voller Erwerbsminderung heute ergäbe die Näherung etwa 950 € brutto – bei 2.100 € Nettogehalt klafft eine Lücke von über 1.100 €. Genau diese Zeile steht in seiner Renteninformation, wird aber fast nie gelesen.",
      beratungshinweis: "Der EM-Schutz erlischt bei Selbstständigkeit oder Lücken schleichend – BU vorher abschließen. Die Zeile „Rente wegen voller Erwerbsminderung“ in der Renteninformation neben das Nettogehalt legen: das ist der Gesprächseinstieg.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Allgemeine-Informationen/Rentenarten-und-Leistungen/Erwerbsminderungsrente/erwerbsminderungsrente_node.html",
    },
    {
      sparte: "grv", titel: "Kontenklärung", paragraf: "§ 149 SGB VI · Formular V0100",
      kernfakten: [
        "Ab 43 sollte das Rentenkonto aktiv geklärt werden – Lücken (Schule ab 17, Ausland, Wehrdienst) sind Jahrzehnte später kaum noch nachweisbar.",
        "Nur eine Renteninformation zu haben heißt: das Konto ist womöglich ungeklärt. Erst Kontenklärung, dann stimmen die Zahlen.",
      ],
      beispiel: "Herr M., 47, legt seine Renteninformation vor. Im Versicherungsverlauf fehlen drei Studienjahre und ein Auslandsjahr. Nach der Kontenklärung mit V0100 stehen diese Zeiten im Konto – wichtig für die 35er-Wartezeit und die Bewertung der beitragsfreien Zeiten.",
      beratungshinweis: "Standard-Einstiegsfrage im Termin: „Haben Sie schon einmal eine Kontenklärung gemacht oder nur die jährliche Renteninformation?“",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Online-Dienste/online-dienste_node.html",
    },
    {
      sparte: "grv", titel: "Rentenauskunft ab 55", paragraf: "§ 109 SGB VI",
      kernfakten: [
        "Ab 55 gibt es statt der Renteninformation die ausführliche Rentenauskunft mit allen Rentenarten und Abschlagsvarianten.",
        "Auf Wunsch auch früher anforderbar; Basis für jede seriöse Ruhestandsplanung ab Mitte 50.",
      ],
      beispiel: "Frau P., 56, will mit 63 aufhören. Die Rentenauskunft zeigt schwarz auf weiß: 48 Monate vorzeitig = 14,4 % Abschlag, aus 1.500 € werden 1.284 € – dauerhaft. Die jährliche Renteninformation enthält diese Rechnung nicht.",
      beratungshinweis: "Bei 55+ immer die aktuelle Rentenauskunft (nicht nur -information) anfordern lassen – sie enthält die Abschlagstabellen für die Beratung.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__109.html",
    },
    {
      sparte: "grv", titel: "Ausgleichszahlung für Abschläge ab 50", paragraf: "§ 187a SGB VI",
      kernfakten: [
        "Ab 50 können Abschläge einer geplanten Frührente durch Sonderzahlungen ausgeglichen werden.",
        "Zahlungen sind als Altersvorsorgeaufwand steuerlich absetzbar – gestreckt über mehrere Jahre besonders wirksam.",
        "Wird die Rente doch nicht vorzeitig genommen, erhöhen die Zahlungen einfach die Rente.",
      ],
      beispiel: "Herr L., 58, will mit 63 aufhören. Für den Ausgleich von 14,4 % Abschlag auf 2.000 € Rente nennt ihm die DRV rund 65.000 €. Verteilt auf fünf Jahre sind das 13.000 € jährlich – als Altersvorsorgeaufwand absetzbar, bei hohem Grenzsteuersatz zahlt das Finanzamt spürbar mit.",
      beratungshinweis: "Spannend für Gutverdiener 50+ mit Steuerdruck: „Rentenabschläge zurückkaufen“ schlägt oft klassische Sparprodukte – Rentenauskunft mit § 187a-Berechnung anfordern.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__187a.html",
    },
    {
      sparte: "grv", titel: "Grundrentenzuschlag", paragraf: "§§ 76g, 307e SGB VI",
      kernfakten: [
        "Ab 33 Jahren Grundrentenzeiten automatischer Zuschlag bei unterdurchschnittlichem Verdienst (kein Antrag).",
        "Voll ab 35 Jahren; Einkommensprüfung erfolgt automatisch über die Finanzämter.",
      ],
      beispiel: "Frau H. hat 40 Jahre in der Pflege gearbeitet, überwiegend Teilzeit und immer unter dem Durchschnittsverdienst. Sie erfüllt die 35 Jahre Grundrentenzeiten – der Zuschlag kommt automatisch, aber nur, wenn alle Zeiten im geklärten Konto stehen.",
      beratungshinweis: "Kein Antrag nötig – aber: Grundrentenzeiten setzen geklärtes Konto voraus. Wieder ein Argument für die Kontenklärung.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Grundrente/grundrente_node.html",
    },
    {
      sparte: "grv", titel: "Minijob: Opt-in statt Befreiung", paragraf: "§ 6 Abs. 1b SGB VI",
      kernfakten: [
        "Eigenanteil 3,6 % (Arbeitgeber zahlt 15 %) macht den Minijob voll rentenwirksam.",
        "Bringt Pflichtbeitragsmonate für die 3/5-Regel (EM-Schutz!) und für alle Wartezeiten inkl. 45 Jahre.",
      ],
      beispiel: "Frau R. arbeitet im Minijob für 500 € im Monat. Ihr Eigenanteil von 3,6 % sind 18 € – dafür zählt jeder Monat als Pflichtbeitragsmonat. Nach 36 Monaten ist die 3/5-Belegung für die EM-Rente wieder erfüllt, und die Monate zählen zur 45er-Wartezeit.",
      beratungshinweis: "Fast alle Minijobber lassen sich befreien – für wenige Euro im Monat kaufen sie mit dem Opt-in EM-Schutz und Wartezeitmonate. Klassischer Quick-Win im Check.",
      quelleUrl: "https://www.minijob-zentrale.de",
    },
    {
      sparte: "grv", titel: "Hinterbliebenenrente", paragraf: "§ 46 SGB VI",
      kernfakten: [
        "Große Witwen-/Witwerrente: 55 % der Rente des Verstorbenen (altes Recht 60 %).",
        "Eigenes Einkommen wird oberhalb eines Freibetrags zu 40 % angerechnet.",
        "Sterbevierteljahr: 3 Monate volle Rente des Verstorbenen.",
      ],
      beispiel: "Ehepaar W., beide berufstätig. Stirbt er mit 2.000 € Rentenanspruch, stünden ihr 55 % = 1.100 € zu. Weil ihr eigenes Einkommen oberhalb des Freibetrags zu 40 % angerechnet wird, bleibt davon bei gutem Verdienst oft nur ein Bruchteil – manchmal gar nichts.",
      beratungshinweis: "Anrechnungslogik macht private Hinterbliebenenabsicherung (Risiko-LV) für Doppelverdiener fast immer nötig – mit konkreten Zahlen zeigen.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__46.html",
    },
    {
      sparte: "grv", titel: "Haltelinie 48 % bis 2031", paragraf: "Rentenpaket 2025",
      kernfakten: [
        "Das Rentenniveau ist bis 2031 bei 48 % des Durchschnittslohns gesetzlich fixiert (Haltelinie).",
        "48 % vom DURCHSCHNITT heißt: individuell ist es oft deutlich weniger – und nach 2031 ist die Fortschreibung offen.",
      ],
      beispiel: "Ein Durchschnittsverdiener mit 45 Beitragsjahren kommt auf 45 EP × 42,52 € = 1.913 € brutto, nach KV und PV rund 1.660 € netto. Das sind die vielzitierten 48 %. Wer heute 3.000 € netto verdient, sieht sofort: Der Lebensstandard ist damit nicht zu halten.",
      beratungshinweis: "Kernbotschaft: „48 % vom Durchschnitt reicht nicht.“ Die Haltelinie stabilisiert das System, ersetzt aber keine private Vorsorge.",
      quelleUrl: "https://www.bmas.de",
    },

    /* ===== ZVK / VBL ===== */
    {
      sparte: "zvk", titel: "Punktemodell: so entsteht die Betriebsrente", paragraf: "§§ 35–36 ATV",
      kernfakten: [
        "Versorgungspunkte = Jahresentgelt ÷ 12.000 € × Altersfaktor (jünger = höherer Faktor, „Verzinsung“).",
        "Monatsrente = Summe der Versorgungspunkte × 4 € Messbetrag.",
        "Abschlag bei vorzeitigem Bezug: 0,3 %/Monat, max. 10,8 %.",
        "Finanzierung West: Umlage 6,9 % (AG 5,49 % / AN 1,41 %) + AN-Zusatzbeitrag 0,4 %.",
      ],
      beispiel: "Frau D., 34, Erzieherin, 25.000 € zusatzversorgungspflichtiges Entgelt: 25.000 € ÷ 12.000 € × Altersfaktor 1,8 = 3,75 VP allein in diesem Jahr. Mal 4 € Messbetrag ergibt das 15 € Monatsrente – aus einem einzigen Arbeitsjahr.",
      beratungshinweis: "Faustformel fürs Gespräch: 25.000 € Entgelt mit Alter 34 = 3,75 VP = 15 €/Monat Rentenbaustein pro Jahr. Macht die Größenordnung sofort greifbar.",
      quelleUrl: "https://www.vbl.de",
    },
    {
      sparte: "zvk", titel: "Wartezeit 60 Monate – sonst Verfall", paragraf: "§ 34 ATV",
      kernfakten: [
        "Anspruch auf Betriebsrente erst nach 60 Umlage-/Beitragsmonaten.",
        "Ausscheiden vorher: Anwartschaft verfällt ersatzlos (keine Erstattung der Umlagen im Punktemodell).",
        "Nach Ausscheiden mit erfüllter Wartezeit: beitragsfreie Anwartschaft wächst praktisch nicht mehr weiter.",
      ],
      beispiel: "Herr F. arbeitet seit 4 Jahren und 8 Monaten in der Stadtverwaltung und hat zum Monatsende gekündigt. Vier Monate zu früh: Die komplette Anwartschaft verfällt ersatzlos. Vier Monate später wäre sie ihm erhalten geblieben.",
      beratungshinweis: "Warnkarte für Wechsler aus dem öD: kurz vor 60 Monaten kündigen kostet die komplette Anwartschaft – Wechseltermin ggf. schieben.",
      quelleUrl: "https://www.vbl.de",
    },
    {
      sparte: "zvk", titel: "Auszahlung & Besteuerung: das Splitting", paragraf: "§ 22 Nr. 5 EStG",
      kernfakten: [
        "Umlagefinanziert-steuerfreier Teil der Beiträge → Rente daraus voll steuerpflichtig.",
        "Aus versteuertem Entgelt finanzierter Teil → nur Ertragsanteil steuerpflichtig.",
        "Deshalb weist die Anwartschaftsmitteilung zwei Entgelt-/Rententeile aus – das ist kein Fehler.",
      ],
      beispiel: "Auf der Anwartschaftsmitteilung von Frau N. stehen zwei Beträge: 180 € aus umlagefinanzierten, steuerfreien Beiträgen – später voll steuerpflichtig – und 40 € aus versteuerten Eigenbeiträgen, die nur mit dem Ertragsanteil besteuert werden. Kein Fehler, sondern die Steuerlogik.",
      beratungshinweis: "Wer die zwei Zahlen auf der Mitteilung erklären kann, gewinnt sofort Kompetenzvertrauen. Aufteilung im Termin notieren.",
      quelleUrl: "https://www.vbl.de",
    },
    {
      sparte: "zvk", titel: "Dynamik-Falle: nur 1 % pro Jahr", paragraf: "§ 39 ATV",
      kernfakten: [
        "Laufende ZVK-Betriebsrenten steigen fix um 1 %/Jahr.",
        "Die GRV folgt den Löhnen: Anpassung zum 01.07.2026 z. B. +4,24 %.",
        "Nach 20 Rentenjahren ist die ZVK-Rente real deutlich entwertet (bei 2,5 % GRV-Dynamik ca. 25 % Rückstand).",
      ],
      beispiel: "Zwei Renten starten heute mit je 1.000 €. Nach 20 Jahren steht die ZVK-Rente bei rund 1.220 € (1 % p. a.), die gesetzliche bei etwa 1.640 € (Beispielannahme 2,5 % p. a.). Gleicher Start, 420 € Unterschied – allein durch die Dynamik.",
      beratungshinweis: "Kaufkraftvergleich im Rechner zeigen: Selbst wer heute „gut versorgt“ wirkt, verliert im Ruhestand Jahr für Jahr relativ an Boden – Argument für dynamische private Bausteine.",
      quelleUrl: "https://www.vbl.de",
    },
    {
      sparte: "zvk", titel: "Elternzeit: soziale Komponente", paragraf: "§ 37 ATV",
      kernfakten: [
        "Für Elternzeiten sieht der ATV eine Punktegutschrift vor (soziale Komponente): je vollem Kalendermonat Elternzeit werden Versorgungspunkte auf Basis eines fiktiven Entgelts von 500 € gutgeschrieben, je Kind bis zu 36 Monate.",
        "In Anwartschaftsmitteilungen tauchen Elternzeitjahre trotzdem oft mit 0 VP auf – dann beim Arbeitgeber/der Kasse reklamieren.",
      ],
      beispiel: "Frau G., 30, zwei Jahre Elternzeit: 24 Monate mit fiktiv 500 € ergeben 12.000 € ÷ 12.000 € × Altersfaktor 2,0 = 2,0 VP = 8 € Monatsrente. Steht in ihrer Mitteilung für diese Jahre eine Null, lohnt die Nachfrage bei der Kasse.",
      beratungshinweis: "Parameter im ATV verifiziert (500 €-Fiktion, max. 36 Monate je Kind); ob die Gutschrift tatsächlich im Konto gelandet ist, immer anhand der Anwartschaftsmitteilung der konkreten Kasse prüfen lassen.",
      quelleUrl: "https://www.versorgungskassen.de",
    },
    {
      sparte: "zvk", titel: "KVdR: Betriebsrente wird voll verbeitragt", paragraf: "§§ 226, 229 SGB V",
      kernfakten: [
        "Auf Betriebsrenten zahlt der Rentner den VOLLEN KV-Satz (14,6 % + Zusatzbeitrag) allein.",
        "Freibetrag 2026: 197,75 €/Monat (1/20 der Bezugsgröße) – gilt NUR für die KV, nicht für die PV.",
        "PV: voller Satz auf die gesamte Betriebsrente.",
      ],
      beispiel: "Betriebsrente 250 €: Nur 52,25 € liegen über dem Freibetrag von 197,75 €, KV darauf 9,14 €. Bei 800 € Betriebsrente sind es dagegen 105,39 € KV plus 28,80 € PV – zusammen rund 134 € weniger im Monat.",
      beratungshinweis: "Bei kleinen Betriebsrenten bleibt dank Freibetrag oft fast alles KV-frei – bei großen frisst die Verbeitragung ~20 %. In jeder Hochrechnung sauber trennen (GRV halber Satz, Betriebsrente voller Satz).",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_5/__226.html",
    },
    {
      sparte: "zvk", titel: "Zielgruppe: Teilzeit im öffentlichen Dienst", paragraf: "—",
      kernfakten: [
        "Erzieherinnen, Pflegekräfte, Verwaltung: oft jahrzehntelang Teilzeit → wenig Entgelt → wenige EP UND wenige VP.",
        "GRV + ZVK zusammen reichen bei Teilzeitbiografien regelmäßig nicht für den Lebensstandard.",
        "VBLextra / freiwillige Versicherung der Kassen ist die hauseigene Aufstockungsoption – als Vergleichsmaßstab einordnen.",
      ],
      beispiel: "Frau B. arbeitet 30 Jahre mit 30 statt 39 Wochenstunden – ihr Entgelt liegt bei rund 77 %. Entsprechend fallen die Entgeltpunkte in der GRV UND die Versorgungspunkte in der ZVK aus. Die Kürzung trifft beide Systeme gleichzeitig, deshalb reicht „GRV plus ZVK“ bei Teilzeitbiografien selten.",
      beratungshinweis: "„Sie sind doch im öffentlichen Dienst abgesichert“ ist der häufigste Irrglaube dieser Zielgruppe – Kombi-Balken mit realen Teilzeitzahlen zeigen.",
      quelleUrl: "https://www.vbl.de/de/produkte/vblextra",
    },

    /* ===== Beamte ===== */
    {
      sparte: "beamte", titel: "Kernwerte der Beamtenversorgung", paragraf: "§ 14 BeamtVG",
      kernfakten: [
        "1,79375 % je ruhegehaltfähigem Dienstjahr, Höchstsatz 71,75 % – erst nach 40 Vollzeit-Jahren.",
        "Real erreichten Neupensionäre des Bundes 2024 im Schnitt nur 66,9 %.",
        "Zwei-Jahres-Regel: Die letzte Besoldungsgruppe muss i. d. R. mindestens 2 Jahre innegehabt worden sein, sonst zählt die vorherige.",
        "Wartezeit: 5 Jahre Dienstzeit.",
      ],
      beispiel: "Herr A., A13, 7.945 € ruhegehaltfähige Bezüge, 25 Dienstjahre: 25 × 1,79375 % = 44,84 % → 3.562 € Pension. Für den Höchstsatz von 71,75 % bräuchte er 40 Vollzeitjahre – die erreichen die wenigsten, die erst nach Studium und Referendariat verbeamtet werden.",
      beratungshinweis: "Nie mit 71,75 % rechnen – mit den realen 66,9 % oder der individuellen Prognose. Bei anstehender Beförderung kurz vor Pension an die Zwei-Jahres-Regel denken.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__14.html",
    },
    {
      sparte: "beamte", titel: "Teilzeit: der Pensionskiller Nr. 1", paragraf: "§ 6 BeamtVG",
      kernfakten: [
        "Teilzeitjahre zählen nur anteilig als ruhegehaltfähige Dienstzeit (50 % Teilzeit = halbes Jahr pro Jahr).",
        "Typische Biografie Lehrerin: 15 Jahre Teilzeit 50 % kosten 7,5 Dienstjahre ≈ 13,5 Prozentpunkte Ruhegehaltssatz.",
      ],
      beispiel: "Frau E., Lehrerin, 40 Dienstjahre, davon 10 Jahre Teilzeit mit 50 %: Es zählen nur 35 ruhegehaltfähige Jahre → 62,78 % statt 71,75 %. Bei 5.000 € Bezügen sind das 449 € weniger Pension – jeden Monat, ein Leben lang.",
      beratungshinweis: "Zielgruppe Lehrerinnen/Beamtinnen mit Familienphase: Teilzeit-Slider im Rechner live zeigen – der Effekt überrascht fast immer.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__6.html",
    },
    {
      sparte: "beamte", titel: "Kindererziehung bei Beamten: Zuschlag statt EP", paragraf: "§ 50a BeamtVG / LBeamtVG NRW",
      kernfakten: [
        "Beamte bekommen KEINE GRV-Entgeltpunkte für Kindererziehung, sondern einen Kindererziehungszuschlag nach Versorgungsrecht (in NRW: LBeamtVG NRW).",
        "Höhe orientiert sich an der GRV-Logik, wird aber auf die Versorgung aufgeschlagen und unterliegt eigenen Grenzen.",
      ],
      beispiel: "Frau C., verbeamtete Lehrerin, zwei Kinder, sucht die Mütterrente in ihrem Rentenkonto – vergeblich. Ihr Kindererziehungszuschlag läuft über das Versorgungsrecht und taucht ausschließlich in der Versorgungsauskunft des Dienstherrn auf, nie in der DRV-Renteninformation.",
      beratungshinweis: "Häufiges Missverständnis („Ich bekomme doch Mütterrente“) aktiv ausräumen – der Zuschlag steht in der Versorgungsauskunft, nicht im Rentenkonto.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__50a.html",
    },
    {
      sparte: "beamte", titel: "Vordienstzeiten & Versorgungsauskunft", paragraf: "§§ 10–12 BeamtVG",
      kernfakten: [
        "Ausbildung, Wehrdienst und öD-Angestelltenjahre können auf Antrag ruhegehaltfähig sein – früh beantragen, Nachweise altern schlecht.",
        "Eine Versorgungsauskunft gibt es nur auf Antrag (NRW: beim LBV).",
      ],
      beispiel: "Herr J. war vor der Verbeamtung fünf Jahre Angestellter im öffentlichen Dienst. Auf Antrag werden diese Jahre ruhegehaltfähig: 5 × 1,79375 % = 8,97 % mehr Ruhegehaltssatz. Bei 4.500 € Bezügen sind das gut 400 € monatlich – für einen Antrag, den viele nie stellen.",
      beratungshinweis: "Zwei Standardfragen an jeden Beamten: „Sind Ihre Vordienstzeiten anerkannt?“ und „Haben Sie je eine Versorgungsauskunft beantragt?“ – beides oft nie passiert.",
      quelleUrl: "https://www.lbv.nrw.de",
    },
    {
      sparte: "beamte", titel: "Pension: Steuer, PKV & Beihilfe", paragraf: "§ 19 Abs. 2 EStG",
      kernfakten: [
        "Pension ist voll steuerpflichtig (Einkünfte aus nichtselbstständiger Arbeit); der Versorgungsfreibetrag schmilzt jahrgangsweise ab (Versorgungsbeginn 2026: 12,8 %, max. 960 € + 288 € Zuschlag; 2027: 12,4 %, max. 930 € + 279 €).",
        "PKV läuft im Ruhestand weiter; Beihilfesatz steigt i. d. R. auf 70 % – der PKV-Beitrag sinkt entsprechend, bleibt aber ein Kostenblock.",
      ],
      beispiel: "3.500 € Pension klingen nach mehr als 3.500 € Rente – sind es aber nicht zwingend. Die Pension ist voll steuerpflichtig (Versorgungsfreibetrag bei Beginn 2026 nur noch 12,8 %, höchstens 960 € im Jahr), und der PKV-Beitrag läuft weiter. Dafür entfallen die GKV-Beiträge komplett.",
      beratungshinweis: "Brutto-Pension nie mit Brutto-Rente gleichsetzen: volle Steuer + PKV-Restbeitrag einplanen, dafür keine GKV-Beiträge.",
      quelleUrl: "https://www.gesetze-im-internet.de/estg/__19.html",
    },
    {
      sparte: "beamte", titel: "Absenkungshistorie: 75 % → 71,75 %", paragraf: "Versorgungsänderungsgesetz 2001",
      kernfakten: [
        "Der Höchstsatz wurde ab 2003 schrittweise von 75 % auf 71,75 % abgesenkt (Faktor 0,95667).",
        "Zeigt: Auch Beamtenversorgung ist politisch kürzbar – Besitzstände gelten nicht ewig.",
      ],
      beispiel: "Ein Beamter, der 2001 mit 40 Dienstjahren plante, rechnete mit 75 % seiner Bezüge. Bekommen hat er 71,75 % – bei 5.000 € Bezügen 162,50 € weniger im Monat, ohne dass er selbst irgendetwas anders gemacht hätte.",
      beratungshinweis: "„Politik kann kürzen“-Argument: Wer 2001 auf 75 % geplant hat, bekam 71,75 %. Private Bausteine hedgen politisches Risiko.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/",
    },
    {
      sparte: "beamte", titel: "Dienstunfähigkeit: die wichtigste Karte", paragraf: "§§ 26–28 BeamtVG",
      kernfakten: [
        "Widerruf/Probe: Bei DU droht Entlassung statt Ruhegehalt (Ausnahme Dienstunfall) + Nachversicherung in der GRV.",
        "Der EM-Anspruch in der GRV scheitert dann meist an der 3/5-Regel – es klafft ein völliges Absicherungsloch.",
        "Lebenszeit: Frühe DU bedeutet oft nur Mindestversorgung ~2.100 € brutto.",
        "Unfallruhegehalt (Dienstunfall): mindestens 66 2/3 %.",
      ],
      beispiel: "Herr S., 26, Rechtsreferendar auf Widerruf, wird nach einem privaten Unfall dienstunfähig. Statt Ruhegehalt: Entlassung und Nachversicherung in der GRV. Selbst wenn dort ein Anspruch entsteht, liegt er auf dem Niveau weniger Beitragsjahre – von der erwarteten Beamtenversorgung bleibt nichts.",
      beratungshinweis: "Für Anwärter und junge Beamte ist die private DU-Klausel DAS Pflichtthema – vor der Verbeamtung auf Lebenszeit ist der Schutz am günstigsten zu bekommen.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__28.html",
    },

    /* ===== Versorgungswerk ===== */
    {
      sparte: "vw", titel: "Befreiung ist tätigkeitsbezogen!", paragraf: "§ 6 Abs. 1 Nr. 1, Abs. 4 SGB VI",
      kernfakten: [
        "Die Befreiung von der GRV gilt nur für die KONKRETE Tätigkeit – bei jedem Arbeitgeberwechsel oder wesentlichem Tätigkeitswechsel ist ein NEUER Antrag nötig.",
        "Frist: 3 Monate ab Aufnahme der Tätigkeit, Antrag elektronisch (§ 6 Abs. 4 SGB VI); sonst wirkt die Befreiung erst ab Antragseingang.",
        "Antrag ist schon vor Jobantritt möglich (Arbeitsvertrag beilegen).",
        "Ohne gültigen Befreiungsbescheid MUSS der Arbeitgeber in die GRV melden – es entstehen Doppelstrukturen.",
      ],
      beispiel: "Frau W., Apothekerin, wechselt zum 1. März die Apotheke. Ihr Befreiungsbescheid von 2019 gilt nur für die alte Stelle. Stellt sie den neuen Antrag erst im Juli, ist sie von März bis Juni in der GRV pflichtversichert – und zahlt in dieser Zeit doppelt.",
      beratungshinweis: "Checklisten-Frage Nr. 1 bei Ärzten, Anwälten, Apothekern: „Passt Ihr Befreiungsbescheid zur aktuellen Stelle?“ Nach jedem Jobwechsel prüfen.",
      quelleUrl: "https://www.abv.de",
    },
    {
      sparte: "vw", titel: "Die vergessene zweite Rente aus der GRV", paragraf: "§§ 56, 70 SGB VI",
      kernfakten: [
        "Kindererziehungszeiten laufen IMMER in die GRV – auch bei Befreiten.",
        "2 Kinder = 6 Jahre KEZ = allgemeine Wartezeit (5 J.) erfüllt = eigene kleine GRV-Rente zusätzlich zum Versorgungswerk.",
        "Auch alte Angestelltenjahre vor der Befreiung zählen mit.",
      ],
      beispiel: "Frau Dr. K., Ärztin, seit 2010 befreit, zwei Kinder (2012 und 2015): 2 × 36 Monate Kindererziehung ergeben 6 Jahre in der GRV. Die 5-Jahres-Wartezeit ist damit erfüllt – sie bekommt später rund 255 € gesetzliche Rente zusätzlich zur Versorgungswerksrente.",
      beratungshinweis: "Aha-Moment im Gespräch mit Ärztinnen/Anwältinnen: „Sie bekommen später ZWEI Renten.“ GRV-Kontenklärung anstoßen, sonst verfällt nichts, aber es weiß niemand davon.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de",
    },
    {
      sparte: "vw", titel: "BU im Versorgungswerk: hohe Hürden", paragraf: "je nach Satzung",
      kernfakten: [
        "BU-Rente meist erst bei VOLLSTÄNDIGER Aufgabe des Berufs (satzungsabhängig, teils inkl. Rückgabe der Zulassung/Approbation).",
        "Keine Teilrenten, keine Reha-Leistungen wie in der GRV.",
      ],
      beispiel: "Ein Zahnarzt mit Handtremor kann nicht mehr behandeln, aber noch gutachterlich arbeiten. In der GRV gäbe es in einer solchen Lage oft eine teilweise Erwerbsminderungsrente – das Versorgungswerk verlangt in der Regel die vollständige Berufsaufgabe und zahlt sonst gar nichts.",
      beratungshinweis: "Private BU ist für Kammerberufe noch wichtiger als für GRV-Versicherte – die Satzungshürde („Berufsaufgabe“) mit der konkreten Satzung des Kunden belegen.",
      quelleUrl: "https://www.abv.de",
    },
    {
      sparte: "vw", titel: "KVdR-Falle für Kammerberufe", paragraf: "§ 5 Abs. 1 Nr. 11 SGB V",
      kernfakten: [
        "Die Versorgungswerksrente zählt NICHT als GRV-Rente für den Zugang zur Krankenversicherung der Rentner (9/10-Belegung der zweiten Erwerbshälfte).",
        "Als Versorgungsbezug wird sie in der GKV voll verbeitragt; ohne KVdR-Zugang droht freiwillige Versicherung mit Beiträgen auf ALLE Einkünfte.",
      ],
      beispiel: "Herr Dr. B., Anwalt, war nie in der GRV. Ohne die 9/10-Belegung in der zweiten Erwerbshälfte kommt er nicht in die günstige Krankenversicherung der Rentner. Als freiwillig Versicherter zahlt er Beiträge auf ALLE Einkünfte – auch auf Mieteinnahmen und Kapitalerträge.",
      beratungshinweis: "KV im Alter aktiv planen: PKV vs. freiwillige GKV vs. KVdR-Zugang über Mini-GRV-Zeiten durchrechnen – hier entstehen vier­stellige Jahresunterschiede.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_5/__5.html",
    },
    {
      sparte: "vw", titel: "Kapitalgedeckt & satzungsautonom", paragraf: "Kammer-/Satzungsrecht",
      kernfakten: [
        "Versorgungswerke sind kapitalgedeckt und autonom: keine Haltelinie, keine Bundesgarantie.",
        "Rechnungszins-Senkungen und Leistungskürzungen einzelner Werke hat es bereits gegeben.",
        "Regelbeitrag ≈ GRV-Höchstbeitrag: 1.571,70 €/Monat (2026); Einstufung einkommensabhängig.",
      ],
      beispiel: "Der Regelbeitrag liegt 2026 bei 1.571,70 € im Monat – genauso hoch wie der GRV-Höchstbeitrag. Anders als die gesetzliche Rente hat das Werk aber keine Haltelinie: Sinkt der Rechnungszins, kann die Kammer die Anwartschaften kürzen. Das ist in der Vergangenheit mehrfach passiert.",
      beratungshinweis: "Diversifikationsargument: Wer alles auf ein Versorgungswerk setzt, trägt Zins- und Satzungsrisiko allein – private dritte Schicht dazustellen.",
      quelleUrl: "https://www.abv.de",
    },
  ],

  /* ---------- Modus „Unterlagen-Check“: Ampel-Checklisten ----------
     Ampel: Grün = in Ordnung · Gelb = offen/nicht geprüft · Rot = Problem
     Bei Rot erscheint der Textbaustein (rotDiagnose → aktionstext). */
  checklisten: {
    grv: {
      name: "GRV", dokument: "Versicherungsverlauf + Renteninformation",
      punkte: [
        { frage: "Liegt ein aktueller Versicherungsverlauf vor (nicht nur die Renteninformation)?",
          rotDiagnose: "Nur Renteninformation vorhanden – das Konto ist vermutlich ungeklärt.",
          aktionstext: "Kontenklärung mit Formular V0100 anstoßen, weil erst ein geklärtes Konto verlässliche Zahlen (und z. B. Grundrentenzeiten) liefert." },
        { frage: "Steht die Kindererziehungszeit (KEZ) trotz Kind im Verlauf?",
          rotDiagnose: "KEZ-Zeile fehlt trotz Kind.",
          aktionstext: "Antrag V0800 einreichen, weil sonst ca. 128 €/Monat je Kind (3 EP × 42,52 €) verschenkt werden." },
        { frage: "Ist die Berücksichtigungszeit bis zum 10. Geburtstag erfasst?",
          rotDiagnose: "Berücksichtigungszeit (§ 57 SGB VI) fehlt.",
          aktionstext: "Antrag V0800 einreichen, weil die Berücksichtigungszeit zur 35er-/45er-Wartezeit zählt, die EM-Anwartschaft erhält und Teilzeitbeiträge aufwertet." },
        { frage: "Ist die KEZ beim richtigen Elternteil zugeordnet?",
          rotDiagnose: "KEZ liegt beim „falschen“ Elternteil (z. B. beim besserverdienenden über der BBG).",
          aktionstext: "Gemeinsame Erklärung zur Neuzuordnung abgeben, weil die Zuordnung nur für die ZUKUNFT wirkt – je früher, desto mehr Monate lassen sich noch verlagern." },
        { frage: "Ist die Zeit ab dem 17. Lebensjahr lückenlos (Schule/Studium erfasst)?",
          rotDiagnose: "Lücke ab 17 – Schul-/Studienzeiten fehlen im Verlauf.",
          aktionstext: "Kontenklärung V0100 mit Nachweisen einreichen, weil Anrechnungszeiten die Bewertung beitragsfreier Zeiten und Wartezeiten verbessern." },
        { frage: "Sind alle Arbeitslosigkeitszeiten mit Bescheiden erfasst?",
          rotDiagnose: "ALG-Zeiten fehlen im Verlauf.",
          aktionstext: "Bescheide der Agentur für Arbeit nachreichen, weil ALG-Zeiten Pflichtbeitrags-/Anrechnungszeiten sind und u. a. für die 45er-Wartezeit zählen." },
        { frage: "Minijob: wird auf die Versicherungsfreiheit verzichtet (Opt-in)?",
          rotDiagnose: "Minijob läuft versicherungsfrei – keine Pflichtbeiträge.",
          aktionstext: "Ab sofort Opt-in (Eigenanteil 3,6 %) empfehlen, weil damit EM-Schutz (3/5-Regel) und Wartezeitmonate für kleines Geld gesichert werden." },
        { frage: "Wird häusliche Pflege mit Rentenbeiträgen der Pflegekasse honoriert?",
          rotDiagnose: "Pflege eines Angehörigen läuft ohne Rentenbeiträge.",
          aktionstext: "Antrag über die Pflegekasse stellen, weil ab Pflegegrad 2 (mind. 10 Std./Woche) die Kasse Pflichtbeiträge zahlt – rückwirkend nur begrenzt möglich." },
        { frage: "Sind Wehr-/Zivildienstzeiten erfasst?",
          rotDiagnose: "Wehr- oder Zivildienst fehlt im Verlauf.",
          aktionstext: "Dienstzeitbescheinigung nachreichen, weil dies Pflichtbeitragszeiten sind, die für Wartezeiten und Rentenhöhe zählen." },
        { frage: "Sind Auslandszeiten (EU/Abkommensstaaten) gemeldet?",
          rotDiagnose: "Beschäftigungszeiten im Ausland tauchen nicht auf.",
          aktionstext: "Zwischenstaatliche Kontenklärung anstoßen, weil EU-/Abkommenszeiten für Wartezeiten zusammengerechnet werden und sonst Rentenansprüche im Ausland verfallen können." },
        { frage: "Wurde die EM-Zeile der Renteninformation mit dem Nettoeinkommen verglichen?",
          rotDiagnose: "Die Absicherungslücke bei Erwerbsminderung ist nicht besprochen.",
          aktionstext: "Zeile „Rente wegen voller Erwerbsminderung“ neben das aktuelle Netto legen, weil die Differenz der Einstieg in die BU-Beratung ist." },
        { frage: "Bei 61+: Liegt eine Rentenauskunft vor und sind 45er-Wartezeit / § 187a geprüft?",
          rotDiagnose: "Kurz vor Rente ohne Rentenauskunft bzw. ungenutzte Gestaltungsmöglichkeiten.",
          aktionstext: "Rentenauskunft (§ 109) anfordern; fehlen wenige Monate zur 45er-Wartezeit, mit Minijob-Opt-in/freiwilligen Beiträgen gestalten; ab 50 zusätzlich Ausgleichszahlung § 187a prüfen, weil sie steuerlich absetzbar ist." },
      ],
    },
    zvk: {
      name: "ZVK / VBL", dokument: "Anwartschaftsmitteilung der Zusatzversorgungskasse",
      punkte: [
        { frage: "Sind die ausgewiesenen Versorgungspunkte plausibel (Entgelt ÷ 12.000 × Altersfaktor)?",
          rotDiagnose: "VP passen nicht zum gemeldeten Entgelt.",
          aktionstext: "Arbeitgeber-Meldung korrigieren lassen, weil falsch gemeldetes zusatzversorgungspflichtiges Entgelt die Betriebsrente dauerhaft mindert." },
        { frage: "Sind für Elternzeitjahre Versorgungspunkte gutgeschrieben (nicht 0 VP)?",
          rotDiagnose: "Elternzeitjahre stehen mit 0 VP in der Mitteilung.",
          aktionstext: "Soziale Komponente nach § 37 ATV bei der Kasse prüfen lassen, weil für Elternzeit je Kind Punktegutschriften vorgesehen sind." },
        { frage: "Sind 60 Pflichtversicherungsmonate erreicht bzw. vor einem Wechsel gesichert?",
          rotDiagnose: "Unter 60 Monaten und Arbeitgeberwechsel aus dem öD geplant.",
          aktionstext: "Wechseltermin überdenken bzw. Anschlussbeschäftigung im öD prüfen, weil die Anwartschaft bei Ausscheiden vor Wartezeiterfüllung ersatzlos verfällt (§ 34 ATV)." },
        { frage: "Sind Zeiten bei einer früheren anderen Zusatzversorgungskasse übergeleitet?",
          rotDiagnose: "Frühere Kassenzeiten (andere ZVK/VBL) stehen nicht im Konto.",
          aktionstext: "Überleitung beantragen, weil die Kassen ein Überleitungsabkommen haben und die Wartezeiten sonst getrennt laufen." },
        { frage: "Bei Beschäftigung vor 2002: Ist eine Startgutschrift ausgewiesen?",
          rotDiagnose: "Vor 2002 beschäftigt, aber keine Startgutschrift in der Mitteilung.",
          aktionstext: "Startgutschrift bei der Kasse reklamieren, weil Ansprüche aus dem alten Gesamtversorgungssystem sonst fehlen." },
        { frage: "Ist die Aufteilung steuerfrei/versteuert der Entgelte notiert?",
          rotDiagnose: "Splitting der Anwartschaft (steuerfrei/versteuert finanziert) unklar.",
          aktionstext: "Beide Entgeltteile aus der Mitteilung notieren, weil der steuerfrei finanzierte Teil später voll und der versteuerte nur mit dem Ertragsanteil besteuert wird – wichtig für die Netto-Prognose." },
      ],
    },
    beamte: {
      name: "Beamte", dokument: "Bezügemitteilung / Personalakte",
      punkte: [
        { frage: "Liegt eine aktuelle Versorgungsauskunft vor?",
          rotDiagnose: "Noch nie eine Versorgungsauskunft beantragt.",
          aktionstext: "Versorgungsauskunft beim Dienstherrn beantragen (NRW: LBV), weil es sie nur auf Antrag gibt und jede Planung sonst auf Schätzungen beruht." },
        { frage: "Sind Vordienstzeiten (Ausbildung, Wehrdienst, öD-Angestelltenjahre) anerkannt?",
          rotDiagnose: "Vordienstzeiten sind nicht als ruhegehaltfähig anerkannt.",
          aktionstext: "Anerkennungsantrag früh stellen, weil Nachweise mit den Jahren schwer zu beschaffen sind und jedes anerkannte Jahr 1,79375 % Ruhegehaltssatz bringt." },
        { frage: "Sind alle Teilzeitphasen mit korrekter Quote in der Personalakte erfasst?",
          rotDiagnose: "Teilzeitquoten fehlerhaft oder unvollständig erfasst.",
          aktionstext: "Korrektur über die Personalstelle veranlassen, weil Teilzeit nur anteilig ruhegehaltfähig ist und Fehler die Pension direkt verfälschen." },
        { frage: "Bei anstehender/kürzlicher Beförderung: Ist die Zwei-Jahres-Regel im Blick?",
          rotDiagnose: "Beförderung weniger als 2 Jahre vor geplanter Pensionierung.",
          aktionstext: "Pensionstermin bzw. Beförderungszeitpunkt planen, weil die letzte Besoldungsgruppe i. d. R. 2 Jahre innegehabt sein muss, sonst zählt die vorherige." },
        { frage: "Status Lebenszeit erreicht (nicht Probe/Widerruf)?",
          rotDiagnose: "Beamter auf Probe oder Widerruf – kein Ruhegehaltsanspruch bei DU.",
          aktionstext: "Direkt DU-Beratung führen, weil bei Dienstunfähigkeit Entlassung + Nachversicherung in der GRV droht und der EM-Schutz dort meist an der 3/5-Regel scheitert." },
      ],
    },
    vw: {
      name: "Versorgungswerk", dokument: "Kontoauszug der Kammer + Befreiungsbescheid",
      punkte: [
        { frage: "Passt der Befreiungsbescheid zur AKTUELLEN Stelle/Tätigkeit?",
          rotDiagnose: "Befreiungsbescheid stammt von einer früheren Stelle.",
          aktionstext: "Sofort neuen Befreiungsantrag stellen (elektronisch, 3-Monats-Frist ab Tätigkeitsbeginn!), weil die Befreiung tätigkeitsbezogen ist und sonst GRV-Pflicht ab Antragseingang statt rückwirkend gilt (§ 6 Abs. 4 SGB VI)." },
        { frage: "Wurde zusätzlich der GRV-Versicherungsverlauf angefordert?",
          rotDiagnose: "Nur das Kammer-Konto im Blick – GRV-Konto ungeklärt.",
          aktionstext: "GRV-Kontenklärung anstoßen, weil Kindererziehungszeiten und alte Angestelltenjahre in der GRV liegen und eine eigene „zweite Rente“ ergeben können." },
        { frage: "Sind Lücken (Elternzeit, Selbstständigkeit) beim Versorgungswerk geregelt?",
          rotDiagnose: "Beitragslücken ohne Regelung zu Mindestbeitrag/Befreiung.",
          aktionstext: "Mit der Kammer Mindestbeitrag bzw. Beitragsbefreiung klären, weil Lücken die Altersrente UND den BU-Schutz des Werks schwächen." },
        { frage: "Ist die BU-Klausel der Satzung bekannt (Berufsaufgabe erforderlich)?",
          rotDiagnose: "BU-Bedingungen des Versorgungswerks nie besprochen.",
          aktionstext: "Satzungsklausel zeigen und private BU ansprechen, weil das Werk meist erst bei vollständiger Berufsaufgabe (teils Zulassungsrückgabe) leistet – ohne Teilrenten und Reha." },
      ],
    },
  },
};
