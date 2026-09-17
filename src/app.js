import { getOne, getAll } from "./db/idb.js";
import { STORES } from "./db/schema.js";
import { importDatasetFile } from "./import/importer.js";
import { exportWorkspace, importWorkspaceFile } from "./workspace/workspace.js";
import { pickFile, saveFile, rememberExchange, getLastExchange, pickDatasetFolder, buildFileMapFromSelection } from "./exchange/file-exchange.js";
import { renderShell, renderResults } from "./ui/render.js";
import { searchArticles } from "./search.js";
import { handleAssistantInput } from "./ai/ai-controller.js";
import { importSegmentedDataset } from "./import/segmented-importer.js";

const app = document.querySelector("#app");
const state = {
  dataset: null,
  aggregates: [],
  suppliers: [],
  lastDatasetExchange: null,
  lastWorkspaceExchange: null,
  route: "dashboard"
};

function renderCurrentView() {
  renderShell(app, state);
  bindUi();
}

async function refresh() {
  state.dataset = await getOne(STORES.meta, "dataset");
  state.aggregates = await getAll(STORES.aggregates);
  state.suppliers = await getAll(STORES.suppliers);
  state.lastDatasetExchange = await getLastExchange("dataset");
  state.lastWorkspaceExchange = await getLastExchange("workspace");
  renderCurrentView();
}

function navigate(route) {
  state.route = route || "dashboard";
  renderCurrentView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setExchangeProgress({ visible = true, title, detail, percent = 0 }) {
  const wrap = document.querySelector("#exchange-status");
  if (!wrap) return;
  wrap.classList.toggle("hidden", !visible);
  if (title) document.querySelector("#exchange-title").textContent = title;
  if (detail) document.querySelector("#exchange-detail").textContent = detail;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  document.querySelector("#progress-bar").style.width = `${pct}%`;
  document.querySelector("#progress-label").textContent = `${pct} %`;
}

function showExchangeError(error) {
  const code = error?.code || "EXCHANGE_UNKNOWN";
  setExchangeProgress({ visible: true, title: `Fehler · ${code}`, detail: error?.message || "Unbekannter Fehler.", percent: 0 });
}

async function handleSegmentedDataset(fileMap, manifestFile, sourceName = "Datenpaket") {
  try {
    setExchangeProgress({ title: "Segmentierter Datenimport", detail: `${sourceName} wird geprüft…`, percent: 1 });
    const result = await importSegmentedDataset(fileMap, manifestFile, progress => {
      setExchangeProgress({ title: "Segmentierter Datenimport", detail: progress.detail, percent: progress.percent });
    });
    await rememberExchange("dataset", { name: `${sourceName} · ${result.datasetVersion}`, size: [...fileMap.values()].reduce((sum, f) => sum + (f.size || 0), 0), lastModified: Date.now() });
    setExchangeProgress({ title: "Datenimport abgeschlossen", detail: `${result.totalRows.toLocaleString("de-DE")} Datensätze wurden aktiviert.`, percent: 100 });
    setTimeout(refresh, 500);
  } catch (error) { showExchangeError(error); }
}

async function handleDataset(file) {
  if (!file) return;
  try {
    setExchangeProgress({ title: "Datenimport", detail: `${file.name} wird geprüft…`, percent: 2 });
    await importDatasetFile(file, value => setExchangeProgress({ title: "Datenimport", detail: value < 100 ? "Daten werden lokal verarbeitet und sicher aufgebaut…" : "Neuer Datenstand wird aktiviert…", percent: value }));
    await rememberExchange("dataset", file);
    setExchangeProgress({ title: "Datenimport abgeschlossen", detail: "Der neue Datenstand ist lokal aktiv. Dein Arbeitsstand wurde nicht verändert.", percent: 100 });
    setTimeout(refresh, 450);
  } catch (error) { showExchangeError(error); }
}

async function handleWorkspace(file) {
  if (!file) return;
  try {
    setExchangeProgress({ title: "Arbeitsstand importieren", detail: `${file.name} wird validiert…`, percent: 15 });
    const result = await importWorkspaceFile(file);
    setExchangeProgress({ title: "Arbeitsstand importieren", detail: "Integrität geprüft. Arbeitsstand wird übernommen…", percent: 80 });
    await rememberExchange("workspace", file);
    setExchangeProgress({ title: "Arbeitsstand übernommen", detail: result.legacy ? "Älterer Arbeitsstand wurde erfolgreich migriert." : "Arbeitsstand wurde vollständig importiert.", percent: 100 });
    setTimeout(refresh, 550);
  } catch (error) { showExchangeError(error); }
}

function openAssistant() {
  const drawer = document.querySelector("#assistant-drawer");
  if (!drawer) return;
  drawer.hidden = false;
  setTimeout(() => document.querySelector("#assistant-input")?.focus(), 0);
}

function bindUi() {
  document.querySelectorAll("[data-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.route)));
  document.querySelectorAll("[data-supplier]").forEach(button => button.addEventListener("click", () => {
    const supplier = button.dataset.supplier;
    const input = document.querySelector("#assistant-input");
    openAssistant();
    if (input) input.value = `/lieferant ${supplier}`;
  }));

  document.querySelector("#assistant-open")?.addEventListener("click", openAssistant);
  document.querySelector("#assistant-open-mobile")?.addEventListener("click", openAssistant);
  document.querySelector("#assistant-close")?.addEventListener("click", () => { const drawer = document.querySelector("#assistant-drawer"); if (drawer) drawer.hidden = true; });

  const datasetInput = document.querySelector("#dataset-input");
  const datasetFolderInput = document.querySelector("#dataset-folder-input");
  const workspaceInput = document.querySelector("#workspace-input");

  document.querySelector("#pick-dataset")?.addEventListener("click", async () => {
    try {
      const folder = await pickDatasetFolder();
      if (folder) return handleSegmentedDataset(folder.fileMap, folder.manifestFile, folder.folderName);
      datasetFolderInput?.click();
    } catch (error) { if (error?.name !== "AbortError") showExchangeError(error); }
  });

  datasetFolderInput?.addEventListener("change", async event => {
    try {
      const selection = await buildFileMapFromSelection(event.target.files);
      await handleSegmentedDataset(selection.fileMap, selection.manifestFile, "ausgewählter Ordner");
    } catch (error) { showExchangeError(error); }
  });

  datasetInput?.addEventListener("change", event => handleDataset(event.target.files?.[0]));

  document.querySelector("#pick-workspace")?.addEventListener("click", async () => {
    try {
      const file = await pickFile("workspace");
      if (file) return handleWorkspace(file);
      workspaceInput?.click();
    } catch (error) { if (error?.name !== "AbortError") showExchangeError(error); }
  });

  workspaceInput?.addEventListener("change", event => handleWorkspace(event.target.files?.[0]));

  document.querySelector("#export-workspace")?.addEventListener("click", async () => {
    try {
      setExchangeProgress({ title: "Arbeitsstand exportieren", detail: "Arbeitsstand wird zusammengestellt und signiert…", percent: 35 });
      const blob = await exportWorkspace();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `LieferantenCheck_Arbeitsstand_${stamp}.lcworkspace`, { type: "application/json" });
      setExchangeProgress({ title: "Arbeitsstand exportieren", detail: "Datei ist bereit. Speicherziel auswählen…", percent: 80 });
      await saveFile(file, "LieferantenCheck Arbeitsstand");
      await rememberExchange("workspace", file);
      setExchangeProgress({ title: "Arbeitsstand exportiert", detail: "Die Datei kann in Dateien, OneDrive oder einem anderen freigegebenen Speicher abgelegt werden.", percent: 100 });
      setTimeout(refresh, 700);
    } catch (error) { if (error?.name !== "AbortError") showExchangeError(error); }
  });

  const assistantInput = document.querySelector("#assistant-input");
  const runAssistant = async () => {
    const input = assistantInput?.value?.trim();
    if (!input) return;
    const container = document.querySelector("#assistant-result");
    try {
      const result = await handleAssistantInput(input, { provider: "local", allowLocalFallback: true });
      if (result.execution?.type === "analysis") {
        container.innerHTML = `<div class="result"><div><strong>Analyse abgeschlossen</strong><span>${result.execution.data.length} Ergebnis(se)</span></div></div>` + result.execution.data.slice(0,10).map(row => `<div class="result"><div><strong>${row.supplierName || row.articleNumber || "Ergebnis"}</strong><span>${row.problemCapital != null ? `${Number(row.problemCapital).toLocaleString("de-DE")} € Problemkapital` : "lokal berechnet"}</span></div></div>`).join("");
      } else {
        container.innerHTML = `<div class="result"><div><strong>${result.execution?.ok ? "Ausgeführt" : "Nicht erkannt"}</strong><span>${result.execution?.message || result.execution?.target || ""}</span></div></div>`;
      }
    } catch (error) {
      container.innerHTML = `<div class="result"><div><strong>${error.code || "AI_ERROR"}</strong><span>${error.message}</span></div></div>`;
    }
  };
  document.querySelector("#assistant-button")?.addEventListener("click", runAssistant);
  assistantInput?.addEventListener("keydown", event => { if (event.key === "Enter") runAssistant(); });

  const searchInput = document.querySelector("#search-input");
  const runSearch = async () => {
    const query = (searchInput?.value || "").trim();
    const results = document.querySelector("#results");
    if (!query) return renderResults(results, []);
    const started = performance.now();
    const rows = await searchArticles(query, 50);
    renderResults(results, rows, performance.now() - started);
  };
  document.querySelector("#search-button")?.addEventListener("click", runSearch);
  searchInput?.addEventListener("keydown", event => { if (event.key === "Enter") runSearch(); });
  document.querySelector("#focus-search")?.addEventListener("click", () => document.querySelector("#search-input")?.focus());
}

async function boot() {
  if (!localStorage.getItem("lc-device-id")) localStorage.setItem("lc-device-id", crypto.randomUUID());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
  await refresh();
}

boot().catch(error => {
  console.error(error);
  app.innerHTML = `<pre>Startfehler: ${error.message}</pre>`;
});
