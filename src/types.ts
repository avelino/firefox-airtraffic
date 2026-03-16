export type MatchType = "domain" | "domainContains" | "contains" | "startsWith" | "wildcard" | "regex";

export interface Rule {
  id: string;
  pattern: string;
  matchType: MatchType;
  cookieStoreId: string;
  negate?: boolean;
}

export interface Settings {
  mode: "route_matched" | "route_all";
  defaultContainer: string;
  useSync: boolean;
}

export interface MatchTypeConfig {
  placeholder: string;
  hint: string;
  label: string;
}

export interface RulesUIOptions {
  rulesList: HTMLUListElement;
  patternInput: HTMLInputElement;
  matchTypeSelect: HTMLSelectElement;
  containerSelect: HTMLSelectElement;
  submitBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  matchHint: HTMLElement;
  form: HTMLFormElement;
  negateCheckbox?: HTMLInputElement;
  onRulesChanged?: () => void;
}
