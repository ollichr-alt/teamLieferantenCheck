function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const money = value => Number.isFinite(Number(value))
  ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value))
  : "—";

const number = value => Number.isFinite(Number(value))
  ? new Intl.NumberFormat("de-DE").format(Number(value))
  : "—";

function exchangeInfo(info) {
  if (!info) return "Noch kein Austausch auf diesem Gerät.";
  return `${esc(info.name)} · ${new Date(info.at).toLocaleString("de-DE")}`;
}

function navItem(route, label, icon, active) {
  return `<button class="nav-item ${active === route ? "active" : ""}" data-route="${route}">
    <span class="nav-icon">${icon}</span><span>${label}</span>
  </button>`;
}

function emptyAnalysis(text = "Für diese Analyse fehlen Daten.") {
  return `<div class="analysis-empty"><strong>${esc(text)}</strong><span>Importiere einen vollständigen Datenstand, damit diese Auswertung belastbar berechnet werden kann.</span></div>`;
}

function kpi(label, value, hint = "", tone = "") {
  return `<article class="kpi ${tone}"><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${esc(hint)}</small>` : ""}</article>`;
}

function supplierTable(state) {
  const rows = (state.aggregates || []).filter(row => row?.type === "supplier");
  if (!rows.length) return emptyAnalysis("Noch keine Lieferanten-Auswertung verfügbar.");

  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Lieferant</th><th>Umsatz</th><th>Bestand</th><th>Problemkapital</th><th>DB %</th><th>Maßnahmen</th><th></th></tr></thead>
    <tbody>${rows
      .sort((a,b) => Number(b.problemCapital || 0) - Number(a.problemCapital || 0))
      .map(row => `<tr>
        <td><button class="table-link" data-supplier="${esc(row.supplierId || "")}"><strong>${esc(row.supplierName || row.supplierId || "—")}</strong><small>${esc(row.supplierId || "")}</small></button></td>
        <td>${money(row.revenue)}</td>
        <td>${money(row.stockValue)}</td>
        <td class="warn-value">${money(row.problemCapital)}</td>
        <td>${Number.isFinite(Number(row.marginPct)) ? `${Number(row.marginPct).toFixed(1)} %` : "—"}</td>
        <td>${number(row.openActions)}</td>
        <td><button class="row-action" data-supplier="${esc(row.supplierId || "")}">Öffnen</button></td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

function dashboardView(state) {
  const global = (state.aggregates || []).find(row => row?.type === "global") || {};
  const counts = state.dataset?.value?.counts || {};
  const hasData = Boolean(state.dataset?.value);

  return `<section class="view">
    <div class="page-head">
      <div><div class="eyebrow">Übersicht</div><h1>LieferantenCheck</h1><p>Lieferanten zuerst. Danach Standorte, Artikel und konkrete Maßnahmen.</p></div>
      <div class="head-actions"><button class="button secondary" data-route="data">Datenstand</button><button class="button primary" id="focus-search">Artikel suchen</button></div>
    </div>

    <div class="kpi-strip">
      ${kpi("Gesamtumsatz", hasData ? money(global.revenue) : "—", "analysierter Datenstand")}
      ${kpi("Gesamtbestand", hasData ? money(global.stockValue) : "—", "aktueller Tagesbestand")}
      ${kpi("Problemkapital", hasData ? money(global.problemCapital) : "—", "wirtschaftlicher Handlungsbedarf", "warning")}
      ${kpi("Penner", hasData ? number(global.slowMovers) : "—", "erkannte Langsamdreher")}
      ${kpi("Lieferanten", hasData ? number(counts.suppliers) : "—", "im aktiven Datenstand")}
    </div>

    <div class="workspace-grid">
      <section class="panel panel-main">
        <div class="panel-head"><div><span class="section-kicker">Priorisierung</span><h2>Lieferanten mit Handlungsbedarf</h2><p>Nach wirtschaftlicher Relevanz sortiert.</p></div><button class="text-button" data-route="opportunities">Top Chancen →</button></div>
        ${supplierTable(state)}
      </section>

      <aside class="panel insight-panel">
        <span class="section-kicker">Was ist jetzt wichtig?</span>
        <h2>Entscheidung statt Zahlenfriedhof</h2>
        <p>Der LieferantenCheck führt von der Auffälligkeit direkt zur Maßnahme.</p>
        <div class="decision-flow"><span>Daten</span><i>→</i><span>Erkenntnis</span><i>→</i><span>Maßnahme</span><i>→</i><span>Wirkung</span></div>
        <button class="button primary full" data-route="opportunities">Chancen priorisieren</button>
      </aside>
    </div>

    <section class="panel search-panel">
      <div class="panel-head"><div><span class="section-kicker">Globale Suche</span><h2>Artikel sofort prüfen</h2><p>Artikelnummer, Beschreibung, Modell oder EAN.</p></div></div>
      <div class="search-row"><input id="search-input" type="search" placeholder="z. B. BL1850B oder Artikelnummer" autocomplete="off"><button id="search-button" class="button primary">Suchen</button></div>
      <div id="results" class="results"></div>
    </section>
  </section>`;
}

function opportunitiesView(state) {
  const suppliers = (state.aggregates || []).filter(row => row?.type === "supplier").sort((a,b) => Number(b.problemCapital || 0) - Number(a.problemCapital || 0));
  return `<section class="view">
    <div class="page-head"><div><div class="eyebrow">Operative Arbeitsliste</div><h1>Top Chancen</h1><p>Die wirtschaftlich relevantesten Hebel zuerst.</p></div></div>
    <div class="opportunity-list">${suppliers.length ? suppliers.slice(0,20).map((row,index) => `<article class="opportunity-row">
      <div class="rank">${String(index + 1).padStart(2,"0")}</div>
      <div class="opp-copy"><strong>${esc(row.supplierName || row.supplierId || "Lieferant")}</strong><span>${money(row.problemCapital)} Problemkapital identifiziert</span></div>
      <div class="opp-effect"><small>Umsatz</small><strong>${money(row.revenue)}</strong></div>
      <button class="row-action" data-supplier="${esc(row.supplierId || "")}">Prüfen</button>
    </article>`).join("") : emptyAnalysis("Noch keine priorisierbaren Chancen vorhanden.")}</div>
  </section>`;
}

function actionsView() {
  return `<section class="view"><div class="page-head"><div><div class="eyebrow">Umsetzung</div><h1>Maßnahmen</h1><p>Von der Analyse zur nachvollziehbaren Aufgabe.</p></div></div>
  <section class="panel">${emptyAnalysis("Noch keine Maßnahmen im Arbeitsstand vorhanden.")}<div class="status-legend"><span>Neu</span><span>Geprüft</span><span>Freigegeben</span><span>In Bearbeitung</span><span>Erledigt</span></div></section></section>`;
}

function qualityView(state) {
  const dataset = state.dataset?.value;
  return `<section class="view"><div class="page-head"><div><div class="eyebrow">Vertrauen in die Analyse</div><h1>Datenqualität</h1><p>Keine scheinpräzisen Empfehlungen auf unvollständiger Datenbasis.</p></div></div>
  <div class="quality-grid">
    <article class="panel quality-card"><span>Status</span><strong>${dataset ? "Datenstand aktiv" : "Keine Daten"}</strong><small>${dataset?.datasetVersion ? esc(dataset.datasetVersion) : "Bitte Datenpaket importieren"}</small></article>
    <article class="panel quality-card"><span>Prüfregeln</span><strong>9</strong><small>EK · VK · EAN · Artikelnummer · Bestand · DB · Preis · Zuordnung · Standort</small></article>
    <article class="panel quality-card"><span>Integrität</span><strong>${dataset ? "Import geprüft" : "—"}</strong><small>Segment- und Hash-Prüfung vor Aktivierung</small></article>
  </div></section>`;
}

function dataView(state) {
  const dataset = state.dataset?.value;
  const counts = dataset?.counts;
  return `<section class="view"><div class="page-head"><div><div class="eyebrow">Local First</div><h1>Daten & Arbeitsstand</h1><p>Unternehmensdaten bleiben lokal. OneDrive dient als Dateiablage über die Dateien-App.</p></div></div>
  <section class="panel exchange-card">
    <div class="exchange-grid">
      <article class="exchange-panel"><span class="section-kicker">Unternehmensdaten</span><h2>Datenbasis importieren</h2><p>Artikel, Lieferanten, Standorte, Bestände und Analysen.</p><div class="actions"><button id="pick-dataset" class="button primary">Datenpaket wählen</button><label class="button secondary">Ordner auswählen<input id="dataset-folder-input" type="file" webkitdirectory multiple hidden></label><label class="button tertiary">Legacy-Datei<input id="dataset-input" type="file" accept=".json,.lcdata,application/json" hidden></label></div><small>${exchangeInfo(state.lastDatasetExchange)}</small></article>
      <article class="exchange-panel"><span class="section-kicker">Arbeitsstand</span><h2>Sichern & übernehmen</h2><p>Maßnahmen, CRM, Notizen und Präferenzen unabhängig vom Datenstand.</p><div class="actions"><button id="export-workspace" class="button primary">Exportieren</button><button id="pick-workspace" class="button secondary">Importieren</button><label class="button tertiary">Datei wählen<input id="workspace-input" type="file" accept=".json,.lcworkspace,application/json" hidden></label></div><small>${exchangeInfo(state.lastWorkspaceExchange)}</small></article>
    </div>
    <div id="exchange-status" class="exchange-status hidden"><div class="exchange-status-top"><strong id="exchange-title">Import läuft</strong><span id="progress-label">0 %</span></div><div class="progress-track"><div id="progress-bar" class="progress-bar"></div></div><div id="exchange-detail" class="exchange-detail">Datei wird vorbereitet…</div></div>
  </section>
  <section class="panel"><div class="panel-head"><div><span class="section-kicker">Aktiver Datenstand</span><h2>${dataset?.datasetVersion ? esc(dataset.datasetVersion) : "Noch kein Datenbestand"}</h2></div><span class="dataset-status ${dataset ? "ok" : "empty"}">${dataset ? "aktiv" : "leer"}</span></div><div class="kpi-strip compact">${kpi("Artikel", number(counts?.articles))}${kpi("Lieferanten", number(counts?.suppliers))}${kpi("Standorte", number(counts?.locations))}</div></section>
  </section>`;
}

function assistantPanel() {
  return `<div class="assistant-drawer" id="assistant-drawer" hidden><div class="assistant-head"><div><span>Assistant</span><strong>LieferantenCheck Intelligence</strong></div><button id="assistant-close" class="icon-button">×</button></div><p>Steuert die App und stößt lokale, deterministische Analysen an.</p><div class="search-row"><input id="assistant-input" type="text" placeholder="z. B. problemkapital oder /lieferant makita" autocomplete="off"><button id="assistant-button" class="button primary">Ausführen</button></div><div id="assistant-result" class="results"></div></div>`;
}

export function renderShell(root, state) {
  const route = state.route || "dashboard";
  const dataset = state.dataset?.value;
  let content = dashboardView(state);
  if (route === "opportunities") content = opportunitiesView(state);
  if (route === "actions") content = actionsView(state);
  if (route === "quality") content = qualityView(state);
  if (route === "data") content = dataView(state);

  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="team-mark">team</div><div><strong>LieferantenCheck</strong><small>Lieferanten analysieren.<br>Potenziale heben.</small></div></div>
      <nav class="side-nav">
        ${navItem("dashboard","Dashboard","01",route)}
        ${navItem("opportunities","Top Chancen","02",route)}
        ${navItem("actions","Maßnahmen","03",route)}
        ${navItem("quality","Datenqualität","04",route)}
      </nav>
      <div class="sidebar-spacer"></div>
      <button class="nav-item utility ${route === "data" ? "active" : ""}" data-route="data"><span class="nav-icon">↕</span><span>Daten & Import</span></button>
      <div class="dataset-mini"><span class="live-dot ${dataset ? "on" : ""}"></span><div><strong>${dataset ? "Daten aktiv" : "Keine Daten"}</strong><small>${dataset?.datasetVersion ? esc(dataset.datasetVersion) : "lokaler Import erforderlich"}</small></div></div>
    </aside>

    <main class="content-shell"><header class="mobile-top"><div class="team-mark">team</div><strong>LieferantenCheck</strong><button id="assistant-open-mobile" class="icon-button">AI</button></header>${content}</main>

    <button id="assistant-open" class="assistant-fab"><span>AI</span><strong>Assistant</strong></button>
    ${assistantPanel()}

    <nav class="mobile-nav">${navItem("dashboard","Dashboard","01",route)}${navItem("opportunities","Chancen","02",route)}${navItem("actions","Maßnahmen","03",route)}${navItem("data","Daten","↕",route)}</nav>
  </div>`;
}

export function renderResults(container, rows, durationMs = null) {
  if (!container) return;
  if (!rows.length) { container.innerHTML = `<div class="analysis-empty"><strong>Keine Treffer.</strong><span>Prüfe Artikelnummer, Modell oder Beschreibung.</span></div>`; return; }
  const timing = durationMs == null ? "" : `<div class="search-timing">${durationMs.toFixed(1)} ms · ${rows.length} Treffer</div>`;
  container.innerHTML = timing + `<div class="result-list">` + rows.map(row => `<article class="result"><div><strong>${esc(row.articleNumber)}</strong><span>${esc(row.description)}</span></div><small>Modell ${esc(row.model || "—")} · Lieferant ${esc(row.supplierId || "—")}</small></article>`).join("") + `</div>`;
}
