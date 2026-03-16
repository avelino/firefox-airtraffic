import type { Rule, Settings } from "./types";
import { findMatchingRule } from "./pattern-matcher";

const IGNORED_PROTOCOLS = ["about:", "moz-extension:", "chrome:", "resource:", "data:", "blob:"];

export type RouteResult =
  | { action: "redirect"; cookieStoreId: string }
  | { action: "none" };

export function isIgnoredUrl(url: string): boolean {
  return !url || IGNORED_PROTOCOLS.some((p) => url.startsWith(p));
}

export function resolveRoute(
  url: string,
  rules: Rule[],
  settings: Settings,
  currentContainer: string,
): RouteResult {
  if (isIgnoredUrl(url)) return { action: "none" };

  if (settings.mode === "route_all") {
    if (!settings.defaultContainer) return { action: "none" };
    const rule = findMatchingRule(url, rules);
    if (rule) return { action: "none" };
    if (currentContainer === settings.defaultContainer) return { action: "none" };
    return { action: "redirect", cookieStoreId: settings.defaultContainer };
  }

  const rule = findMatchingRule(url, rules);
  if (!rule) return { action: "none" };
  if (currentContainer === rule.cookieStoreId) return { action: "none" };
  return { action: "redirect", cookieStoreId: rule.cookieStoreId };
}
