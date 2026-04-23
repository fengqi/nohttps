import {
  loadConfigFromStorage,
  parseDomainLines,
  saveConfigToStorage,
} from "./shared.js";

const redirectDomainsInput = document.getElementById("redirectDomains");
const ignoreDomainsInput = document.getElementById("ignoreDomains");
const saveButton = document.getElementById("saveButton");
const clearButton = document.getElementById("clearButton");
const statusNode = document.getElementById("status");

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

function formatDomains(domains) {
  return domains.join("\n");
}

async function hydrateForm() {
  const config = await loadConfigFromStorage();
  redirectDomainsInput.value = formatDomains(config.redirectDomains);
  ignoreDomainsInput.value = formatDomains(config.ignoreDomains);
  setStatus("Loaded configuration.");
}

function buildInvalidMessage(listName, invalidRows) {
  const preview = invalidRows
    .slice(0, 3)
    .map((value) => value.trim() || "<empty>")
    .join(", ");
  const suffix = invalidRows.length > 3 ? ", ..." : "";
  return `${listName}: invalid lines -> ${preview}${suffix}`;
}

async function handleSave() {
  const redirectParsed = parseDomainLines(redirectDomainsInput.value);
  const ignoreParsed = parseDomainLines(ignoreDomainsInput.value);

  const invalidMessages = [];
  if (redirectParsed.invalid.length > 0) {
    invalidMessages.push(
      buildInvalidMessage("Redirect domains", redirectParsed.invalid),
    );
  }
  if (ignoreParsed.invalid.length > 0) {
    invalidMessages.push(
      buildInvalidMessage("Ignore domains", ignoreParsed.invalid),
    );
  }

  if (invalidMessages.length > 0) {
    setStatus(invalidMessages.join(" | "), "error");
    return;
  }

  await saveConfigToStorage({
    redirectDomains: redirectParsed.valid,
    ignoreDomains: ignoreParsed.valid,
  });

  setStatus("Saved. Redirect rules updated.", "ok");
}

function handleClear() {
  redirectDomainsInput.value = "";
  ignoreDomainsInput.value = "";
  setStatus("Cleared form. Click Save to apply.");
}

saveButton.addEventListener("click", () => {
  handleSave().catch((error) => {
    console.error("[NoHTTPS] Failed to save popup config:", error);
    setStatus("Failed to save. Check extension errors.", "error");
  });
});

clearButton.addEventListener("click", handleClear);

hydrateForm().catch((error) => {
  console.error("[NoHTTPS] Failed to load popup config:", error);
  setStatus("Failed to load configuration.", "error");
});
