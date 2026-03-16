import type { Rule, Settings } from "./types";
import { isIgnoredUrl, resolveRoute } from "./route-resolver";

const TRANSIT_TIMEOUT_MS = 5000;
const BADGE_CLEAR_MS = 3000;

let cachedRules: Rule[] = [];
let cachedSettings: Settings = { mode: "route_matched", defaultContainer: "", useSync: false };
const tabsInTransit = new Set<number>();
let redirectCount = 0;

function getStorage() {
  return cachedSettings.useSync ? browser.storage.sync : browser.storage.local;
}

async function loadRules(): Promise<void> {
  const local = await browser.storage.local.get(["rules", "settings"]);
  cachedSettings = (local.settings as Settings) || cachedSettings;

  const storage = getStorage();
  const data = await storage.get("rules");
  cachedRules = (data.rules as Rule[]) || [];
}

async function containerExists(cookieStoreId: string): Promise<boolean> {
  try {
    await browser.contextualIdentities.get(cookieStoreId);
    return true;
  } catch {
    return false;
  }
}

function showBadge(text: string): void {
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color: "#2ecc71" });
  setTimeout(() => browser.browserAction.setBadgeText({ text: "" }), BADGE_CLEAR_MS);
}

async function redirectTab(tabId: number, url: string, cookieStoreId: string, tab: Tab): Promise<void> {
  const exists = await containerExists(cookieStoreId);
  if (!exists) {
    console.warn(`[Air Traffic] Container ${cookieStoreId} not found, skipping redirect`);
    return;
  }

  const newTab = await browser.tabs.create({
    url,
    cookieStoreId,
    active: tab.active,
    index: tab.index + 1,
    windowId: tab.windowId,
  });

  if (newTab.id != null) {
    tabsInTransit.add(newTab.id);
    setTimeout(() => tabsInTransit.delete(newTab.id!), TRANSIT_TIMEOUT_MS);
  }

  browser.tabs.remove(tabId);

  redirectCount++;
  showBadge(`${redirectCount}`);
}

async function handleTabUpdate(tabId: number, changeInfo: TabChangeInfo, tab: Tab): Promise<void> {
  if (!changeInfo.url) return;
  if (tabsInTransit.has(tabId)) return;

  const result = resolveRoute(changeInfo.url, cachedRules, cachedSettings, tab.cookieStoreId ?? "");
  if (result.action === "none") return;
  await redirectTab(tabId, changeInfo.url, result.cookieStoreId, tab);
}

// Context menu: "Open in Container" submenu
async function buildContextMenus(): Promise<void> {
  await browser.menus.removeAll();

  let containers: ContextualIdentity[];
  try {
    containers = await browser.contextualIdentities.query({});
  } catch {
    return;
  }

  for (const c of containers) {
    browser.menus.create({
      id: `open-in-${c.cookieStoreId}`,
      title: `Open in ${c.name}`,
      contexts: ["link"],
    });
  }
}

browser.menus.onClicked.addListener(async (info: MenuClickInfo, tab?: Tab) => {
  const prefix = "open-in-";
  if (!info.menuItemId.startsWith(prefix)) return;

  const cookieStoreId = info.menuItemId.slice(prefix.length);
  const url = info.linkUrl;
  if (!url || isIgnoredUrl(url)) return;

  const exists = await containerExists(cookieStoreId);
  if (!exists) return;

  browser.tabs.create({
    url,
    cookieStoreId,
    active: true,
    index: (tab?.index ?? 0) + 1,
    windowId: tab?.windowId,
  });
});

browser.contextualIdentities.onCreated.addListener(buildContextMenus);
browser.contextualIdentities.onRemoved.addListener(buildContextMenus);
browser.contextualIdentities.onUpdated.addListener(buildContextMenus);

browser.storage.onChanged.addListener((changes: Record<string, StorageChange>, area: string) => {
  if (area === "local" && changes.settings) {
    cachedSettings = (changes.settings.newValue as Settings) || cachedSettings;
    loadRules();
  }
  if (changes.rules) {
    cachedRules = (changes.rules.newValue as Rule[]) || [];
  }
});

browser.tabs.onUpdated.addListener(handleTabUpdate);

loadRules();
buildContextMenus();
