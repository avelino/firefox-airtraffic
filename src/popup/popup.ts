import { loadContainerList, populateContainerSelect } from "../shared/containers";
import { initRulesUI, setRules, renderRulesList } from "../shared/rules-ui";
import { loadSettingsFromStorage, loadRulesFromStorage } from "../shared/storage";

initRulesUI({
  rulesList: document.getElementById("rules-list") as HTMLUListElement,
  patternInput: document.getElementById("pattern-input") as HTMLInputElement,
  matchTypeSelect: document.getElementById("match-type-select") as HTMLSelectElement,
  containerSelect: document.getElementById("container-select") as HTMLSelectElement,
  submitBtn: document.getElementById("submit-btn") as HTMLButtonElement,
  cancelBtn: document.getElementById("cancel-btn") as HTMLButtonElement,
  matchHint: document.getElementById("match-hint") as HTMLElement,
  form: document.getElementById("add-rule-form") as HTMLFormElement,
  negateCheckbox: document.getElementById("negate-checkbox") as HTMLInputElement,
});

document.getElementById("open-settings")!.addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

(async () => {
  await loadContainerList();
  populateContainerSelect(document.getElementById("container-select") as HTMLSelectElement);
  await loadSettingsFromStorage();
  const rules = await loadRulesFromStorage();
  setRules(rules);
  renderRulesList(rules);
})();
