import { CONTAINER_COLORS, CONTAINER_ICONS } from "../shared/constants";
import { loadContainerList, getContainers, getContainerName, populateContainerSelect } from "../shared/containers";
import { initRulesUI, setRules, getRules, renderRulesList } from "../shared/rules-ui";
import { loadSettingsFromStorage, saveSettingsToStorage, loadRulesFromStorage, saveRulesToStorage, migrateRulesStorage, getSettings } from "../shared/storage";

const containerSelect = document.getElementById("container-select") as HTMLSelectElement;
const defaultContainerSelect = document.getElementById("default-container-select") as HTMLSelectElement;
const rulesSearch = document.getElementById("rules-search") as HTMLInputElement;
const rulesEmpty = document.getElementById("rules-empty") as HTMLElement;

// Settings
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;
const defaultContainerRow = document.getElementById("default-container-row") as HTMLElement;
const syncToggle = document.getElementById("sync-toggle") as HTMLInputElement;

// Containers
const containerForm = document.getElementById("container-form") as HTMLFormElement;
const containerNameInput = document.getElementById("container-name-input") as HTMLInputElement;
const containerColorSelect = document.getElementById("container-color-select") as HTMLSelectElement;
const containerIconSelect = document.getElementById("container-icon-select") as HTMLSelectElement;
const containerSubmitBtn = document.getElementById("container-submit-btn") as HTMLButtonElement;
const containerCancelBtn = document.getElementById("container-cancel-btn") as HTMLButtonElement;
const containersList = document.getElementById("containers-list") as HTMLUListElement;

// Import/Export
const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const importFile = document.getElementById("import-file") as HTMLInputElement;

let editingContainerId: string | null = null;

// --- Init shared rules UI ---
initRulesUI({
  rulesList: document.getElementById("rules-list") as HTMLUListElement,
  patternInput: document.getElementById("pattern-input") as HTMLInputElement,
  matchTypeSelect: document.getElementById("match-type-select") as HTMLSelectElement,
  containerSelect,
  submitBtn: document.getElementById("submit-btn") as HTMLButtonElement,
  cancelBtn: document.getElementById("cancel-btn") as HTMLButtonElement,
  matchHint: document.getElementById("match-hint") as HTMLElement,
  form: document.getElementById("add-rule-form") as HTMLFormElement,
  negateCheckbox: document.getElementById("negate-checkbox") as HTMLInputElement,
  onRulesChanged: () => {
    rulesEmpty.hidden = getRules().length > 0;
  },
});

// --- Search / filter ---
rulesSearch.addEventListener("input", () => {
  const query = rulesSearch.value.toLowerCase().trim();
  const all = getRules();
  const filtered = query
    ? all.filter((r) => r.pattern.toLowerCase().includes(query) || getContainerName(r.cookieStoreId).toLowerCase().includes(query))
    : all;
  renderRulesList(filtered);
});

// --- Containers CRUD ---

function populateIconSelect(): void {
  containerIconSelect.replaceChildren();
  for (const [value, emoji] of Object.entries(CONTAINER_ICONS)) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = `${emoji} ${value}`;
    containerIconSelect.appendChild(opt);
  }
}

function renderContainers(): void {
  containersList.replaceChildren();
  for (const c of getContainers()) {
    const li = document.createElement("li");
    li.className = "container-item";

    const dot = document.createElement("span");
    dot.className = "container-color-dot";
    dot.style.backgroundColor = CONTAINER_COLORS[c.color] || "#555";

    const icon = document.createElement("span");
    icon.className = "container-item-icon";
    icon.textContent = CONTAINER_ICONS[c.icon] || "";

    const name = document.createElement("span");
    name.className = "container-item-name";
    name.textContent = c.name;

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "\u270E";
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => startContainerEdit(c));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", () => deleteContainer(c.cookieStoreId));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(dot);
    li.appendChild(icon);
    li.appendChild(name);
    li.appendChild(actions);
    containersList.appendChild(li);
  }
}

function startContainerEdit(c: ContextualIdentity): void {
  editingContainerId = c.cookieStoreId;
  containerNameInput.value = c.name;
  containerColorSelect.value = c.color;
  containerIconSelect.value = c.icon;
  containerSubmitBtn.textContent = "Save";
  containerCancelBtn.hidden = false;
  containerNameInput.focus();
}

function cancelContainerEdit(): void {
  editingContainerId = null;
  containerNameInput.value = "";
  containerColorSelect.value = "blue";
  containerIconSelect.value = "fingerprint";
  containerSubmitBtn.textContent = "Create";
  containerCancelBtn.hidden = true;
}

containerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = containerNameInput.value.trim();
  if (!name) return;

  const color = containerColorSelect.value;
  const icon = containerIconSelect.value;

  if (editingContainerId) {
    await browser.contextualIdentities.update(editingContainerId, { name, color, icon });
    cancelContainerEdit();
  } else {
    await browser.contextualIdentities.create({ name, color, icon });
    containerNameInput.value = "";
  }

  await refreshContainers();
});

containerCancelBtn.addEventListener("click", cancelContainerEdit);

async function deleteContainer(cookieStoreId: string): Promise<void> {
  if (!confirm("Delete this container? Tabs in it will be closed.")) return;
  await browser.contextualIdentities.remove(cookieStoreId);
  if (editingContainerId === cookieStoreId) cancelContainerEdit();
  await refreshContainers();
}

async function refreshContainers(): Promise<void> {
  await loadContainerList();
  populateContainerSelect(containerSelect, "Container...");
  populateContainerSelect(defaultContainerSelect, "Select...");
  renderContainers();
  renderRulesList(getRules());
}

// --- Settings ---

async function applySettings(): Promise<void> {
  const s = await loadSettingsFromStorage();
  modeSelect.value = s.mode;
  syncToggle.checked = s.useSync;
  defaultContainerSelect.value = s.defaultContainer;
  defaultContainerRow.hidden = s.mode !== "route_all";
}

modeSelect.addEventListener("change", () => {
  defaultContainerRow.hidden = modeSelect.value !== "route_all";
  saveSettingsToStorage({ mode: modeSelect.value as "route_matched" | "route_all" });
});

defaultContainerSelect.addEventListener("change", () => {
  saveSettingsToStorage({ defaultContainer: defaultContainerSelect.value });
});

syncToggle.addEventListener("change", async () => {
  const wasSync = getSettings().useSync;
  const nowSync = syncToggle.checked;
  if (wasSync !== nowSync) await migrateRulesStorage(wasSync, nowSync);
  await saveSettingsToStorage({ useSync: nowSync });
  const rules = await loadRulesFromStorage();
  setRules(rules);
  renderRulesList(rules);
});

// --- Import / Export ---

exportBtn.addEventListener("click", async () => {
  const rules = await loadRulesFromStorage();
  const s = await loadSettingsFromStorage();

  const blob = new Blob([JSON.stringify({ version: 1, rules, settings: s }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "air-traffic-rules.json";
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data.rules)) {
      alert("Invalid file: no rules found.");
      return;
    }

    for (const rule of data.rules) {
      if (!rule.pattern || !rule.matchType || !rule.cookieStoreId) {
        alert("Invalid file: rules are missing required fields.");
        return;
      }
      if (!rule.id) rule.id = crypto.randomUUID();
    }

    await saveRulesToStorage(data.rules);
    if (data.settings) {
      await saveSettingsToStorage(data.settings);
      await applySettings();
    }

    setRules(data.rules);
    renderRulesList(data.rules);
    rulesEmpty.hidden = data.rules.length > 0;
  } catch {
    alert("Failed to import: invalid JSON file.");
  }

  importFile.value = "";
});

// --- Init ---
populateIconSelect();
(async () => {
  await loadContainerList();
  populateContainerSelect(containerSelect, "Container...");
  populateContainerSelect(defaultContainerSelect, "Select...");
  renderContainers();
  await applySettings();
  const rules = await loadRulesFromStorage();
  setRules(rules);
  renderRulesList(rules);
  rulesEmpty.hidden = rules.length > 0;
})();
