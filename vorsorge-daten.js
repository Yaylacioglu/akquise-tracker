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
      beratungshinweis: "Der EM-Schutz erlischt bei Selbstständigkeit oder Lücken schleichend – BU vorher abschließen. Die Zeile „Rente wegen voller Erwerbsminderung“ in der Renteninformation neben das Nettogehalt legen: das ist der Gesprächseinstieg.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Allgemeine-Informationen/Rentenarten-und-Leistungen/Erwerbsminderungsrente/erwerbsminderungsrente_node.html",
    },
    {
      sparte: "grv", titel: "Kontenklärung", paragraf: "§ 149 SGB VI · Formular V0100",
      kernfakten: [
        "Ab 43 sollte das Rentenkonto aktiv geklärt werden – Lücken (Schule ab 17, Ausland, Wehrdienst) sind Jahrzehnte später kaum noch nachweisbar.",
        "Nur eine Renteninformation zu haben heißt: das Konto ist womöglich ungeklärt. Erst Kontenklärung, dann stimmen die Zahlen.",
      ],
      beratungshinweis: "Standard-Einstiegsfrage im Termin: „Haben Sie schon einmal eine Kontenklärung gemacht oder nur die jährliche Renteninformation?“",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Online-Dienste/online-dienste_node.html",
    },
    {
      sparte: "grv", titel: "Rentenauskunft ab 55", paragraf: "§ 109 SGB VI",
      kernfakten: [
        "Ab 55 gibt es statt der Renteninformation die ausführliche Rentenauskunft mit allen Rentenarten und Abschlagsvarianten.",
        "Auf Wunsch auch früher anforderbar; Basis für jede seriöse Ruhestandsplanung ab Mitte 50.",
      ],
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
      beratungshinweis: "Spannend für Gutverdiener 50+ mit Steuerdruck: „Rentenabschläge zurückkaufen“ schlägt oft klassische Sparprodukte – Rentenauskunft mit § 187a-Berechnung anfordern.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__187a.html",
    },
    {
      sparte: "grv", titel: "Grundrentenzuschlag", paragraf: "§§ 76g, 307e SGB VI",
      kernfakten: [
        "Ab 33 Jahren Grundrentenzeiten automatischer Zuschlag bei unterdurchschnittlichem Verdienst (kein Antrag).",
        "Voll ab 35 Jahren; Einkommensprüfung erfolgt automatisch über die Finanzämter.",
      ],
      beratungshinweis: "Kein Antrag nötig – aber: Grundrentenzeiten setzen geklärtes Konto voraus. Wieder ein Argument für die Kontenklärung.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Grundrente/grundrente_node.html",
    },
    {
      sparte: "grv", titel: "Minijob: Opt-in statt Befreiung", paragraf: "§ 6 Abs. 1b SGB VI",
      kernfakten: [
        "Eigenanteil 3,6 % (Arbeitgeber zahlt 15 %) macht den Minijob voll rentenwirksam.",
        "Bringt Pflichtbeitragsmonate für die 3/5-Regel (EM-Schutz!) und für alle Wartezeiten inkl. 45 Jahre.",
      ],
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
      beratungshinweis: "Anrechnungslogik macht private Hinterbliebenenabsicherung (Risiko-LV) für Doppelverdiener fast immer nötig – mit konkreten Zahlen zeigen.",
      quelleUrl: "https://www.gesetze-im-internet.de/sgb_6/__46.html",
    },
    {
      sparte: "grv", titel: "Haltelinie 48 % bis 2031", paragraf: "Rentenpaket 2025",
      kernfakten: [
        "Das Rentenniveau ist bis 2031 bei 48 % des Durchschnittslohns gesetzlich fixiert (Haltelinie).",
        "48 % vom DURCHSCHNITT heißt: individuell ist es oft deutlich weniger – und nach 2031 ist die Fortschreibung offen.",
      ],
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
      beratungshinweis: "Kaufkraftvergleich im Rechner zeigen: Selbst wer heute „gut versorgt“ wirkt, verliert im Ruhestand Jahr für Jahr relativ an Boden – Argument für dynamische private Bausteine.",
      quelleUrl: "https://www.vbl.de",
    },
    {
      sparte: "zvk", titel: "Elternzeit: soziale Komponente", paragraf: "§ 37 ATV",
      kernfakten: [
        "Für Elternzeiten sieht der ATV eine Punktegutschrift vor (soziale Komponente): je vollem Kalendermonat Elternzeit werden Versorgungspunkte auf Basis eines fiktiven Entgelts von 500 € gutgeschrieben, je Kind bis zu 36 Monate.",
        "In Anwartschaftsmitteilungen tauchen Elternzeitjahre trotzdem oft mit 0 VP auf – dann beim Arbeitgeber/der Kasse reklamieren.",
      ],
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
      beratungshinweis: "Nie mit 71,75 % rechnen – mit den realen 66,9 % oder der individuellen Prognose. Bei anstehender Beförderung kurz vor Pension an die Zwei-Jahres-Regel denken.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__14.html",
    },
    {
      sparte: "beamte", titel: "Teilzeit: der Pensionskiller Nr. 1", paragraf: "§ 6 BeamtVG",
      kernfakten: [
        "Teilzeitjahre zählen nur anteilig als ruhegehaltfähige Dienstzeit (50 % Teilzeit = halbes Jahr pro Jahr).",
        "Typische Biografie Lehrerin: 15 Jahre Teilzeit 50 % kosten 7,5 Dienstjahre ≈ 13,5 Prozentpunkte Ruhegehaltssatz.",
      ],
      beratungshinweis: "Zielgruppe Lehrerinnen/Beamtinnen mit Familienphase: Teilzeit-Slider im Rechner live zeigen – der Effekt überrascht fast immer.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__6.html",
    },
    {
      sparte: "beamte", titel: "Kindererziehung bei Beamten: Zuschlag statt EP", paragraf: "§ 50a BeamtVG / LBeamtVG NRW",
      kernfakten: [
        "Beamte bekommen KEINE GRV-Entgeltpunkte für Kindererziehung, sondern einen Kindererziehungszuschlag nach Versorgungsrecht (in NRW: LBeamtVG NRW).",
        "Höhe orientiert sich an der GRV-Logik, wird aber auf die Versorgung aufgeschlagen und unterliegt eigenen Grenzen.",
      ],
      beratungshinweis: "Häufiges Missverständnis („Ich bekomme doch Mütterrente“) aktiv ausräumen – der Zuschlag steht in der Versorgungsauskunft, nicht im Rentenkonto.",
      quelleUrl: "https://www.gesetze-im-internet.de/beamtvg/__50a.html",
    },
    {
      sparte: "beamte", titel: "Vordienstzeiten & Versorgungsauskunft", paragraf: "§§ 10–12 BeamtVG",
      kernfakten: [
        "Ausbildung, Wehrdienst und öD-Angestelltenjahre können auf Antrag ruhegehaltfähig sein – früh beantragen, Nachweise altern schlecht.",
        "Eine Versorgungsauskunft gibt es nur auf Antrag (NRW: beim LBV).",
      ],
      beratungshinweis: "Zwei Standardfragen an jeden Beamten: „Sind Ihre Vordienstzeiten anerkannt?“ und „Haben Sie je eine Versorgungsauskunft beantragt?“ – beides oft nie passiert.",
      quelleUrl: "https://www.lbv.nrw.de",
    },
    {
      sparte: "beamte", titel: "Pension: Steuer, PKV & Beihilfe", paragraf: "§ 19 Abs. 2 EStG",
      kernfakten: [
        "Pension ist voll steuerpflichtig (Einkünfte aus nichtselbstständiger Arbeit); der Versorgungsfreibetrag schmilzt jahrgangsweise ab (Versorgungsbeginn 2026: 12,8 %, max. 960 € + 288 € Zuschlag; 2027: 12,4 %, max. 930 € + 279 €).",
        "PKV läuft im Ruhestand weiter; Beihilfesatz steigt i. d. R. auf 70 % – der PKV-Beitrag sinkt entsprechend, bleibt aber ein Kostenblock.",
      ],
      beratungshinweis: "Brutto-Pension nie mit Brutto-Rente gleichsetzen: volle Steuer + PKV-Restbeitrag einplanen, dafür keine GKV-Beiträge.",
      quelleUrl: "https://www.gesetze-im-internet.de/estg/__19.html",
    },
    {
      sparte: "beamte", titel: "Absenkungshistorie: 75 % → 71,75 %", paragraf: "Versorgungsänderungsgesetz 2001",
      kernfakten: [
        "Der Höchstsatz wurde ab 2003 schrittweise von 75 % auf 71,75 % abgesenkt (Faktor 0,95667).",
        "Zeigt: Auch Beamtenversorgung ist politisch kürzbar – Besitzstände gelten nicht ewig.",
      ],
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
      beratungshinweis: "Aha-Moment im Gespräch mit Ärztinnen/Anwältinnen: „Sie bekommen später ZWEI Renten.“ GRV-Kontenklärung anstoßen, sonst verfällt nichts, aber es weiß niemand davon.",
      quelleUrl: "https://www.deutsche-rentenversicherung.de",
    },
    {
      sparte: "vw", titel: "BU im Versorgungswerk: hohe Hürden", paragraf: "je nach Satzung",
      kernfakten: [
        "BU-Rente meist erst bei VOLLSTÄNDIGER Aufgabe des Berufs (satzungsabhängig, teils inkl. Rückgabe der Zulassung/Approbation).",
        "Keine Teilrenten, keine Reha-Leistungen wie in der GRV.",
      ],
      beratungshinweis: "Private BU ist für Kammerberufe noch wichtiger als für GRV-Versicherte – die Satzungshürde („Berufsaufgabe“) mit der konkreten Satzung des Kunden belegen.",
      quelleUrl: "https://www.abv.de",
    },
    {
      sparte: "vw", titel: "KVdR-Falle für Kammerberufe", paragraf: "§ 5 Abs. 1 Nr. 11 SGB V",
      kernfakten: [
        "Die Versorgungswerksrente zählt NICHT als GRV-Rente für den Zugang zur Krankenversicherung der Rentner (9/10-Belegung der zweiten Erwerbshälfte).",
        "Als Versorgungsbezug wird sie in der GKV voll verbeitragt; ohne KVdR-Zugang droht freiwillige Versicherung mit Beiträgen auf ALLE Einkünfte.",
      ],
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
