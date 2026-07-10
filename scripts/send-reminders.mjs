// Prüft täglich fällige Wiedervorlagen in Supabase und schickt eine
// Erinnerungs-Mail über Resend. Läuft automatisch über GitHub Actions.

const SUPABASE_URL = 'https://vkbwselauubbmqadmiud.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TARGET_EMAIL = process.env.TARGET_EMAIL;
// Solange bei Resend keine eigene Domain verifiziert ist, muss die
// Absenderadresse "onboarding@resend.dev" bleiben.
const FROM_EMAIL = process.env.FROM_EMAIL || 'Akquise-Tracker <onboarding@resend.dev>';
const TRACKER_URL = 'https://yaylacioglu.github.io/akquise-tracker/';

if (!SUPABASE_SERVICE_KEY || !RESEND_API_KEY || !TARGET_EMAIL) {
  console.error('Fehlende Umgebungsvariable(n). Prüfe die GitHub Secrets/Variables.');
  process.exit(1);
}

const STATUS_LABELS = {
  kalt: 'Kalt',
  erstkontakt: 'Erstkontakt versucht',
  interesse: 'Erreicht / Interesse',
  termin: 'Termin vereinbart',
  angebot: 'Angebot raus',
  verhandlung: 'Verhandlung',
  gewonnen: 'Gewonnen',
  abgelehnt: 'Abgelehnt',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

async function fetchDueContacts() {
  const today = todayStr();
  const url = `${SUPABASE_URL}/rest/v1/contacts?select=*&reminder=lte.${today}&status=not.in.(gewonnen,abgelehnt)&order=reminder.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase-Abfrage fehlgeschlagen (${res.status}): ${text}`);
  }
  return res.json();
}

function buildEmailHtml(contacts) {
  const today = todayStr();
  const rows = contacts
    .map((c) => {
      const overdue = c.reminder < today;
      const statusLabel = STATUS_LABELS[c.status] || c.status;
      const tag = overdue
        ? `<span style="color:#7C332B;font-weight:600;">Überfällig seit ${fmtDate(c.reminder)}</span>`
        : `<span style="color:#8A5A16;font-weight:600;">Heute fällig</span>`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E3DFD5;">
            <div style="font-weight:600;color:#1B2A41;">${escapeHtml(c.firma || 'Unbenannt')}</div>
            <div style="font-size:13px;color:#5B6472;">${escapeHtml(c.telefon || '')}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E3DFD5;font-size:13px;color:#5B6472;">${escapeHtml(statusLabel)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E3DFD5;font-size:13px;">${tag}</td>
        </tr>`;
    })
    .join('');

  const overdueCount = contacts.filter((c) => c.reminder < today).length;
  const todayCount = contacts.length - overdueCount;

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#F7F5F0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #E3DFD5;border-radius:12px;overflow:hidden;">
      <div style="background:#1B2A41;color:#ffffff;padding:18px 24px;">
        <div style="font-size:17px;font-weight:700;">Akquise-Tracker — Wiedervorlagen</div>
        <div style="font-size:13px;opacity:.8;margin-top:2px;">${fmtDate(today)} · ${todayCount} heute fällig · ${overdueCount} überfällig</div>
      </div>
      <div style="padding:8px 24px 20px;">
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#5B6472;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #E3DFD5;">Firma</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#5B6472;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #E3DFD5;">Status</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#5B6472;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #E3DFD5;">Wiedervorlage</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <a href="${TRACKER_URL}" style="display:inline-block;margin-top:18px;background:#1B2A41;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Zum Akquise-Tracker</a>
      </div>
    </div>
  </div>`;
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TARGET_EMAIL],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend-Versand fehlgeschlagen (${res.status}): ${text}`);
  }
  return res.json();
}

async function main() {
  const contacts = await fetchDueContacts();
  console.log(`${contacts.length} fällige Wiedervorlage(n) gefunden.`);

  if (contacts.length === 0) {
    console.log('Nichts fällig — es wird keine Mail verschickt.');
    return;
  }

  const subject = `${contacts.length} Wiedervorlage${contacts.length === 1 ? '' : 'n'} fällig — Akquise-Tracker`;
  const result = await sendEmail(subject, buildEmailHtml(contacts));
  console.log(`Erinnerungs-Mail verschickt an ${TARGET_EMAIL} (Resend-ID: ${result.id}).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
