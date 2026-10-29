'use strict';
/* Dulidan Web · Rechtsklick-Menü für Webseiten (und Eingabefelder der Oberfläche) */
const { Menu, clipboard } = require('electron');

const short = s => (s.length > 32 ? s.slice(0, 30) + '…' : s);

/* actions: openTab(url), search(text), passwords() */
function pageMenu(wc, p, actions) {
  const T = [];
  const sep = () => { if (T.length && T[T.length - 1].type !== 'separator') T.push({ type: 'separator' }); };

  if (p.misspelledWord && p.dictionarySuggestions.length) {
    for (const s of p.dictionarySuggestions.slice(0, 4)) T.push({ label: s, click: () => wc.replaceMisspelling(s) });
    T.push({ label: 'Zum Wörterbuch hinzufügen', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    sep();
  }
  if (p.linkURL) {
    T.push({ label: 'Link in neuem Tab öffnen', click: () => actions.openTab(p.linkURL) });
    T.push({ label: 'Link-Adresse kopieren', click: () => clipboard.writeText(p.linkURL) });
    T.push({ label: 'Link speichern unter …', click: () => wc.downloadURL(p.linkURL) });
    sep();
  }
  if (p.mediaType === 'image' && p.srcURL) {
    T.push({ label: 'Bild in neuem Tab öffnen', click: () => actions.openTab(p.srcURL) });
    T.push({ label: 'Bild speichern', click: () => wc.downloadURL(p.srcURL) });
    T.push({ label: 'Bild kopieren', click: () => wc.copyImageAt(p.x, p.y) });
    T.push({ label: 'Bildadresse kopieren', click: () => clipboard.writeText(p.srcURL) });
    sep();
  }
  const f = p.editFlags;
  if (p.isEditable) {
    T.push({ label: 'Rückgängig', role: 'undo', enabled: f.canUndo }, { label: 'Wiederholen', role: 'redo', enabled: f.canRedo });
    sep();
    T.push({ label: 'Ausschneiden', role: 'cut', enabled: f.canCut }, { label: 'Kopieren', role: 'copy', enabled: f.canCopy },
      { label: 'Einfügen', role: 'paste', enabled: f.canPaste }, { label: 'Alles auswählen', role: 'selectAll' });
    if (p.formControlType === 'input-password' && actions.passwords) { sep(); T.push({ label: 'Passwörter verwalten …', click: actions.passwords }); }
    sep();
  } else if (p.selectionText.trim()) {
    T.push({ label: 'Kopieren', role: 'copy' });
    if (actions.search) T.push({ label: `Im Web suchen: „${short(p.selectionText.trim())}“`, click: () => actions.search(p.selectionText.trim()) });
    sep();
  }
  if (!p.isEditable && !p.linkURL && p.mediaType === 'none' && actions.nav) {
    const h = wc.navigationHistory;
    T.push({ label: 'Zurück', enabled: h.canGoBack(), click: () => h.goBack() },
      { label: 'Vor', enabled: h.canGoForward(), click: () => h.goForward() },
      { label: 'Neu laden', click: () => wc.reload() });
    sep();
  }
  if (actions.inspect) T.push({ label: 'Untersuchen', click: () => wc.inspectElement(p.x, p.y) });
  while (T.length && T[T.length - 1].type === 'separator') T.pop();
  return T.length ? Menu.buildFromTemplate(T) : null;
}

module.exports = { pageMenu };
