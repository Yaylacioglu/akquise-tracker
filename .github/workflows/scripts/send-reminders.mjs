// Prüft täglich fällige Wiedervorlagen in Supabase und schickt eine
// Erinnerungs-Mail über Resend. Läuft automatisch über GitHub Actions.

const SUPABASE_URL = 'https://vkbwselauubbmqadmiud.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TARGET_EMAIL = process.env.TARGET_EMAIL;

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
