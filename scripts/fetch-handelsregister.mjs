// Holt die aktuellen Handelsregister-Neueintragungen fuer Nordrhein-Westfalen,
// filtert auf echte Firmen und legt JEDE WOCHE EINE NEUE LISTE an.
// Bestehende Listen werden nie ueberschrieben.
//
//   data/listen.json              Verzeichnis aller Listen, neueste zuerst
//   data/listen/JJJJ-MM-TT.json   eine Liste je Lauf
//
// Laeuft montags ueber GitHub Actions. Schickt bei Erfolg wie bei Fehlschlag eine Mail.

import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';

const QUELLE = 'https://www.online-handelsregister.de/neueintragungsliste?bundesland=nw';
const ORDNER = 'data/listen';
const INDEX = 'data/listen.json';
const TRACKER_URL = 'https://yaylacioglu.github.io/akquise-tracker/';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TARGET_EMAIL = process.env.TARGET_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Akquise-Tracker <onboarding@resend.dev>';

// Die 30 Registergerichte in NRW. Sie dienen als Abschnittsmarken im Seitentext.
const GERICHTE = [
  'Aachen', 'Arnsberg', 'Bad Oeynhausen', 'Bielefeld', 'Bochum', 'Bonn',
  'Coesfeld', 'Dortmund', 'Duisburg', 'Düren', 'Düsseldorf', 'Essen',
  'Gelsenkirchen', 'Gütersloh', 'Hagen', 'Hamm', 'Iserlohn', 'Kleve',
  'Köln', 'Krefeld', 'Lemgo', 'Mönchengladbach', 'Münster', 'Neuss',
  'Paderborn', 'Recklinghausen', 'Siegburg', 'Siegen', 'Steinfurt', 'Wuppertal',
];

// Registergerichte ausserhalb von NRW. Taucht eines davon als Abschnittsmarke auf,
// endet der NRW-Abschnitt — sonst wuerden fremde Firmen dem letzten NRW-Gericht
// zugeschlagen. Die Quelle wird zwar nach Bundesland gefiltert, aber darauf
// verlassen wir uns nicht.
const FREMDE_GERICHTE = [
  'Amberg', 'Ansbach', 'Apolda', 'Arnstadt', 'Aschaffenburg', 'Augsburg', 'Aurich',
  'Bad Hersfeld', 'Bad Homburg v.d.Höhe', 'Bad Kreuznach', 'Bamberg', 'Bayreuth',
  'Berlin (Charlottenburg)', 'Berlin', 'Bad Salzungen', 'Braunschweig', 'Bremen',
  'Chemnitz', 'Coburg', 'Cottbus', 'Darmstadt', 'Deggendorf', 'Dresden', 'Eschwege',
  'Flensburg', 'Frankfurt am Main', 'Frankfurt/Oder', 'Freiburg', 'Friedberg',
  'Fritzlar', 'Fulda', 'Fürth', 'Gera', 'Gießen', 'Görlitz', 'Göttingen', 'Greiz',
  'Hamburg', 'Hanau', 'Hannover', 'Heilbronn', 'Hildburghausen', 'Hildesheim',
  'Hof', 'Homburg', 'Ingolstadt', 'Jena', 'Kaiserslautern', 'Kassel', 'Kempten (Allgäu)',
  'Kiel', 'Koblenz', 'Konstanz', 'Landau', 'Landshut', 'Leipzig', 'Lübeck',
  'Ludwigshafen a.Rhein (Ludwigshafen)', 'Ludwigshafen', 'Lüneburg', 'Magdeburg',
  'Mainz', 'Mannheim', 'Marburg', 'Meiningen', 'Memmingen', 'Montabaur', 'München',
  'Neubrandenburg', 'Neuruppin', 'Nordhausen', 'Nürnberg', 'Offenbach am Main',
  'Oldenburg (Oldenburg)', 'Oldenburg', 'Osnabrück', 'Ottweiler', 'Passau', 'Pinneberg',
  'Potsdam', 'Regensburg', 'Rostock', 'Saarbrücken', 'Schweinfurt', 'Schwerin',
  'Stadthagen', 'Stendal', 'Straubing', 'Stuttgart', 'Sondershausen', 'Suhl',
  'Tostedt', 'Traunstein', 'Ulm', 'Wal', 'Walsrode', 'Weiden i. d. OPf.', 'Weimar',
  'Wiesbaden', 'Wittlich', 'Würzburg', 'Zweibrücken',
];

/* ---------- HTML zu Textzeilen ---------- */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

function htmlToLines(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, '\n')
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/* ---------- Rechtsform ---------- */

// Reihenfolge zaehlt: spezifischere Formen zuerst pruefen.
function rechtsform(name) {
  const s = name.toLowerCase();
  if (/\be\.\s?v\.|\be\.\s?v\b/.test(s)) return 'e.V. (Verein)';
  if (/\begbr\b/.test(s)) return 'eGbR (GbR)';
  if (/\beg\b/.test(s)) return 'eG (Genossenschaft)';
  if (/ggmbh/.test(s)) return 'gGmbH';
  if (/gmbh\s?&\s?co\.?\s?kg/.test(s)) return 'GmbH & Co. KG';
  if (/\(haftungsbeschränkt\)\s?&\s?co\.?\s?kg/.test(s)) return 'UG & Co. KG';
  if (/\bug\b|\(haftungsbeschränkt\)|unternehmergesellschaft/.test(s)) return 'UG (haftungsbeschränkt)';
  if (/\bag\b|vorrats-ag/.test(s)) return 'AG';
  if (/partnerschaft|\bpartg\b|\bmbb\b|steuerberatungsgesellschaft$|&\s?partners/.test(s)) return 'Partnerschaft (PartG/mbB)';
  if (/\bohg\b/.test(s)) return 'OHG';
  if (/gmbh|\bmbh\b/.test(s)) return 'GmbH';
  if (/\be\.\s?k\.|\be\.\s?k\b/.test(s)) return 'e.K. (Einzelkaufmann)';
  if (/\bkg\b/.test(s)) return 'KG';
  return null; // keine erkennbare Rechtsform -> keine Firmenzeile
}

const AUSGESCHLOSSEN = new Set(['e.V. (Verein)', 'eG (Genossenschaft)', 'eGbR (GbR)']);

/* ---------- Parsen ---------- */

function parse(html) {
  const lines = htmlToLines(html);
  const gerichtSet = new Set(GERICHTE);
  const fremdSet = new Set(FREMDE_GERICHTE);
  const treffer = [];
  let aktuell = null;

  for (const line of lines) {
    // Abschnittsmarke: die Zeile ist genau ein Registergerichtsname
    // (evtl. mit angehaengter Anzahl, z.B. "Koeln (21)").
    const bare = line.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (gerichtSet.has(bare)) { aktuell = bare; continue; }
    if (fremdSet.has(bare)) { aktuell = null; continue; }
    if (!aktuell) continue;
    if (line.length < 3 || line.length > 160) continue;
    const rf = rechtsform(line);
    if (!rf) continue;
    treffer.push({ firma: line, gericht: aktuell, rechtsform: rf });
  }

  const gesehen = new Set();
  const alle = treffer.filter((t) => {
    const k = t.gericht + '|' + t.firma.toLowerCase();
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });

  const firmen = alle
    .filter((t) => !AUSGESCHLOSSEN.has(t.rechtsform))
    .sort((a, b) => a.gericht.localeCompare(b.gericht, 'de') || a.firma.localeCompare(b.firma, 'de'));

  let stand = new Date().toISOString().slice(0, 10);
  for (const line of lines.slice(0, 200)) {
    const m = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) { stand = `${m[3]}-${m[2]}-${m[1]}`; break; }
  }

  return { firmen, roh: alle.length, stand };
}

/* ---------- Kalenderwoche ---------- */

function kalenderwoche(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - start) / 86400000 + 1) / 7);
}

/* ---------- Mail ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendEmail(subject, html) {
  if (!RESEND_API_KEY || !TARGET_EMAIL) { console.log('Kein Resend-Key oder Empfaenger — keine Mail.'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [TARGET_EMAIL], subject, html }),
  });
  if (!res.ok) console.error(`Resend-Versand fehlgeschlagen (${res.status}): ${await res.text()}`);
  else console.log('Mail verschickt.');
}

function erfolgsMail({ firmen, stand, kw, neu, listenAnzahl }) {
  const top = Object.entries(firmen.reduce((a, f) => ((a[f.gericht] = (a[f.gericht] || 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#F7F5F0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E3DFD5;border-radius:12px;overflow:hidden;">
      <div style="background:#1B2A41;color:#fff;padding:18px 24px;">
        <div style="font-size:17px;font-weight:700;">Neue Liste: KW ${kw}</div>
        <div style="font-size:13px;opacity:.8;margin-top:2px;">Stand ${esc(stand)} · ${firmen.length} Firmen${neu !== null ? ` · davon ${neu} nicht in der letzten Liste` : ''}</div>
      </div>
      <div style="padding:16px 24px 22px;">
        <div style="font-size:13px;color:#5B6472;margin-bottom:10px;">Die stärksten Registergerichte:</div>
        <table style="width:100%;border-collapse:collapse;">
          ${top.map(([g, n]) => `<tr>
            <td style="padding:7px 0;border-bottom:1px solid #E3DFD5;font-size:14px;color:#1B2A41;">${esc(g)}</td>
            <td style="padding:7px 0;border-bottom:1px solid #E3DFD5;font-size:14px;text-align:right;font-weight:600;">${n}</td>
          </tr>`).join('')}
        </table>
        <a href="${TRACKER_URL}" style="display:inline-block;margin-top:18px;background:#1B2A41;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Liste im Tracker öffnen</a>
        <div style="font-size:12px;color:#8B93A1;margin-top:16px;">Im Archiv liegen jetzt ${listenAnzahl} Listen. Vereine, Genossenschaften und eingetragene GbR sind herausgefiltert. Quelle: online-handelsregister.de</div>
      </div>
    </div>
  </div>`;
}

function fehlerMail(grund, probe) {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#F7F5F0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E3DFD5;border-radius:12px;overflow:hidden;">
      <div style="background:#7C332B;color:#fff;padding:18px 24px;">
        <div style="font-size:17px;font-weight:700;">Keine neue Liste angelegt</div>
      </div>
      <div style="padding:16px 24px 22px;">
        <div style="font-size:14px;color:#1B2A41;">${esc(grund)}</div>
        <div style="font-size:13px;color:#5B6472;margin-top:12px;">Alle bisherigen Listen bleiben unverändert. Vermutlich hat die Quelle ihren Seitenaufbau geändert — dann muss der Parser angepasst werden. Textprobe der Seite zum Weiterleiten:</div>
        <pre style="background:#F7F5F0;border:1px solid #E3DFD5;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap;word-break:break-word;color:#5B6472;margin-top:10px;">${esc(probe)}</pre>
      </div>
    </div>
  </div>`;
}

/* ---------- Hauptlauf ---------- */

async function main() {
  const res = await fetch(QUELLE, {
    headers: { 'User-Agent': 'akquise-tracker/1.0 (+https://yaylacioglu.github.io/akquise-tracker)' },
  });
  if (!res.ok) {
    await sendEmail('Neueintragungen: Quelle nicht erreichbar', fehlerMail(`Die Quelle antwortete mit HTTP ${res.status}.`, ''));
    process.exit(1);
  }
  const html = await res.text();
  const { firmen, roh, stand } = parse(html);
  const gerichte = new Set(firmen.map((f) => f.gericht)).size;
  console.log(`${roh} Rohtreffer, ${firmen.length} Firmen aus ${gerichte} Gerichten, Stand ${stand}.`);

  // Plausibilitaet: NRW liefert normalerweise weit ueber 100 Firmen aus vielen Gerichten.
  if (firmen.length < 40 || gerichte < 8) {
    const probe = htmlToLines(html).slice(0, 60).join('\n').slice(0, 2500);
    await sendEmail('Neueintragungen: Liste sieht falsch aus',
      fehlerMail(`Nur ${firmen.length} Firmen aus ${gerichte} Registergerichten erkannt — zu wenig, deshalb wurde keine neue Liste angelegt.`, probe));
    process.exit(1);
  }

  // Bisheriges Verzeichnis laden
  await mkdir(ORDNER, { recursive: true });
  let index = { listen: [] };
  try { index = JSON.parse(await readFile(INDEX, 'utf8')); } catch { /* erster Lauf */ }
  if (!Array.isArray(index.listen)) index.listen = [];

  // Vergleich mit der zuletzt angelegten Liste
  let neu = null;
  const letzte = index.listen[0];
  if (letzte) {
    try {
      const alt = JSON.parse(await readFile(`${ORDNER}/${letzte.datei}`, 'utf8'));
      const bekannt = new Set((alt.firmen || []).map((f) => f.firma.toLowerCase()));
      neu = firmen.filter((f) => !bekannt.has(f.firma.toLowerCase())).length;
    } catch { /* alte Liste unlesbar, dann eben ohne Vergleich */ }
  }

  const heute = new Date();
  const datum = heute.toISOString().slice(0, 10);
  const kw = kalenderwoche(heute);
  const datei = `${datum}.json`;

  // Niemals eine bestehende Liste ueberschreiben.
  const vorhanden = new Set(await readdir(ORDNER).catch(() => []));
  if (vorhanden.has(datei)) {
    console.log(`${datei} existiert bereits — es wird nichts überschrieben.`);
    return;
  }

  await writeFile(`${ORDNER}/${datei}`, JSON.stringify({
    bundesland: 'Nordrhein-Westfalen',
    kw, stand, erstellt: datum,
    quelle: 'online-handelsregister.de/neueintragungsliste',
    hinweis: 'Nur Kapital- und Personenhandelsgesellschaften. Vereine (e.V.), Genossenschaften (eG) und eingetragene GbR (eGbR) sind herausgefiltert.',
    firmen,
  }, null, 1) + '\n', 'utf8');
  console.log(`${ORDNER}/${datei} angelegt.`);

  index.listen.unshift({ datei, kw, jahr: heute.getUTCFullYear(), stand, erstellt: datum, anzahl: firmen.length, neu });
  index.listen.sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  index.aktualisiert = datum;
  await writeFile(INDEX, JSON.stringify(index, null, 1) + '\n', 'utf8');
  console.log(`${INDEX} enthält jetzt ${index.listen.length} Liste(n).`);

  await sendEmail(`KW ${kw}: ${firmen.length} neu eingetragene Firmen in NRW`,
    erfolgsMail({ firmen, stand, kw, neu, listenAnzahl: index.listen.length }));
}

main().catch(async (err) => {
  console.error(err);
  await sendEmail('Neueintragungen: Lauf abgebrochen', fehlerMail(String(err.message || err), ''));
  process.exit(1);
});
