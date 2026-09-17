function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function exchangeInfo(info) {
  if (!info) return "Noch kein Austausch auf diesem Gerät.";
  return `${esc(info.name)} · ${new Date(info.at).toLocaleString("de-DE")}`;
}

export function renderShell(root, state) {
  const dataset = state.dataset?.value;
  const counts = dataset?.counts;

  root.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div>
          <div class="eyebrow">team baucenter</div>
          <h1>LieferantenCheck</h1>
          <p>Local-First Mobile Core 0.5</p>
        </div>
        <span class="status ${dataset ? "ok" : "empty"}">
          ${dataset ? "Daten bereit" : "Keine Daten"}
        </span>
      </header>

      <section class="card exchange-card">
        <div class="section-head">
          <div>
            <h2>Daten & Arbeitsstand</h2>
            <p>Import und Export über die Dateien-App. Auf iPhone/iPad kannst du damit auch freigegebene OneDrive-Ordner verwenden.</p>
          </div>
          <span class="pill">Local First</span>
        </div>

        <div class="exchange-grid">
          <article class="exchange-panel">
            <div class="exchange-kicker">Unternehmensdaten</div>
            <h3>Datenbasis importieren</h3>
            <p>Artikel, Lieferanten, Standorte, Bestände und Auswertungsdaten. Der bestehende Arbeitsstand bleibt erhalten.</p>
            <div class="actions">
              <button id="pick-dataset" class="button primary">Datenpaket wählen</button>
              <label class="button secondary">
                Ordner auswählen
                <input id="dataset-folder-input" type="file" webkitdirectory multiple hidden />
              </label>
              <label class="button secondary">
                Legacy-Datei
                <input id="dataset-input" type="file" accept=".json,.lcdata,application/json" hidden />
              </label>
            </div>
            <small>${exchangeInfo(state.lastDatasetExchange)}</small>
          </article>

          <article class="exchange-panel">
            <div class="exchange-kicker">Persönlicher Arbeitsstand</div>
            <h3>Arbeitsstand sichern & übernehmen</h3>
            <p>CRM, Maßnahmen, Notizen, Einstellungen und lokale Präferenzen bleiben unabhängig vom Datenbestand transportierbar.</p>
            <div class="actions">
              <button id="export-workspace" class="button primary">Arbeitsstand exportieren</button>
              <button id="pick-workspace" class="button">Arbeitsstand importieren</button>
              <label class="button secondary">
                Datei auswählen
                <input id="workspace-input" type="file" accept=".json,.lcworkspace,application/json" hidden />
              </label>
            </div>
            <small>${exchangeInfo(state.lastWorkspaceExchange)}</small>
          </article>
        </div>

        <div id="exchange-status" class="exchange-status hidden">
          <div class="exchange-status-top">
            <strong id="exchange-title">Import läuft</strong>
            <span id="progress-label">0 %</span>
          </div>
          <div class="progress-track"><div id="progress-bar" class="progress-bar"></div></div>
          <div id="exchange-detail" class="exchange-detail">Datei wird vorbereitet…</div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h2>Aktive Datenbasis</h2>
            <p>${dataset ? `Importiert ${new Date(dataset.importedAt).toLocaleString("de-DE")}` : "Noch kein lokaler Datenbestand."}</p>
          </div>
          ${dataset?.datasetVersion ? `<span class="pill">${esc(dataset.datasetVersion)}</span>` : ""}
        </div>

        <div class="metrics">
          <div><strong>${counts?.articles?.toLocaleString("de-DE") ?? "—"}</strong><span>Artikel</span></div>
          <div><strong>${counts?.suppliers?.toLocaleString("de-DE") ?? "—"}</strong><span>Lieferanten</span></div>
          <div><strong>${counts?.locations?.toLocaleString("de-DE") ?? "—"}</strong><span>Standorte</span></div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h2>Assistant Core</h2>
            <p>Lokaler Befehls- und Analysemodus. Cloudflare AI kann später zugeschaltet werden, ohne die Analyse-Engine umzubauen.</p>
          </div>
          <span class="pill">LOCAL</span>
        </div>
        <div class="search-row">
          <input id="assistant-input" type="text" placeholder="/lieferant makita · /standort eggebek · problemkapital" autocomplete="off" />
          <button id="assistant-button" class="button primary">Ausführen</button>
        </div>
        <div id="assistant-result" class="results"></div>
      </section>

      <section class="card">
        <h2>Lokale Artikelsuche</h2>
        <div class="search-row">
          <input id="search-input" type="search" placeholder="Artikelnummer, Beschreibung oder Modell" autocomplete="off" />
          <button id="search-button" class="button">Suchen</button>
        </div>
        <div id="results" class="results"></div>
      </section>
    </main>
  `;
}

export function renderResults(container, rows, durationMs = null) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Keine Treffer.</div>`;
    return;
  }

  const timing = durationMs == null ? "" : `<div class="search-timing">${durationMs.toFixed(1)} ms · ${rows.length} Treffer</div>`;
  container.innerHTML = timing + rows.map(row => `
    <article class="result">
      <strong>${esc(row.articleNumber)}</strong>
      <div>${esc(row.description)}</div>
      <small>Modell ${esc(row.model || "—")} · Lieferant ${esc(row.supplierId || "—")}</small>
    </article>
  `).join("");
}
