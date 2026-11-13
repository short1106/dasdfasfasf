/* Dulidan Web · error.js – liest Code/URL aus dem Hash (vom Main-Prozess gesetzt) */
try {
  const d = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  document.getElementById('code').textContent = d.code;
  document.getElementById('desc').textContent = ({ '-105': 'Adresse nicht gefunden. Tippfehler oder DNS im Urlaub?', '-106': 'Keine Internetverbindung.', '-102': 'Verbindung abgelehnt.', '-118': 'Zeitüberschreitung – der Server schläft.', '-501': 'Unsichere Verbindung.' })[d.code] || d.desc || 'Die Seite antwortet nicht.';
  document.getElementById('url').textContent = d.url;
} catch (e) {}
