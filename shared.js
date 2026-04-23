export const STORAGE_KEYS = {
  redirectDomains: "redirectDomains",
  ignoreDomains: "ignoreDomains",
  updatedAt: "updatedAt",
};

const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const MAX_DYNAMIC_RULES = 5000;
const WILDCARD_PREFIX = "*.";

function isValidIPv4(hostname) {
  if (!IPV4_PATTERN.test(hostname)) {
    return false;
  }

  return hostname
    .split(".")
    .every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
}

function isValidHostname(hostname) {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  if (hostname === "localhost") {
    return true;
  }

  if (isValidIPv4(hostname)) {
    return true;
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => HOST_LABEL_PATTERN.test(label));
}

export function normalizeDomain(input) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  const normalizedInput = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const parsed = new URL(normalizedInput);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    if (!isValidHostname(hostname)) {
      return null;
    }

    return hostname;
  } catch {
    return null;
  }
}

export function normalizePattern(input) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(WILDCARD_PREFIX)) {
    const baseDomain = normalizeDomain(trimmed.slice(WILDCARD_PREFIX.length));
    if (!baseDomain) {
      return null;
    }

    // Wildcard only makes sense for DNS names, not localhost/IP literals.
    if (baseDomain === "localhost" || isValidIPv4(baseDomain)) {
      return null;
    }

    return `${WILDCARD_PREFIX}${baseDomain}`;
  }

  return normalizeDomain(trimmed);
}

export function parseDomainLines(text) {
  const valid = [];
  const invalid = [];
  const seen = new Set();

  const lines = String(text ?? "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const pattern = normalizePattern(line);
    if (!pattern) {
      invalid.push(rawLine);
      continue;
    }

    if (!seen.has(pattern)) {
      seen.add(pattern);
      valid.push(pattern);
    }
  }

  return { valid, invalid };
}

function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHttpsHostRegex(domain) {
  if (domain.startsWith(WILDCARD_PREFIX)) {
    const baseDomain = domain.slice(WILDCARD_PREFIX.length);
    const escapedBaseDomain = escapeRegexLiteral(baseDomain);
    return `^https://(?:[^./]+\\.)+${escapedBaseDomain}(?::\\d+)?(?:/|$)`;
  }

  const escapedDomain = escapeRegexLiteral(domain);
  return `^https://${escapedDomain}(?::\\d+)?(?:/|$)`;
}

function normalizePatternArray(values) {
  const normalized = [];
  const seen = new Set();

  if (!Array.isArray(values)) {
    return normalized;
  }

  for (const item of values) {
    const pattern = normalizePattern(item);
    if (!pattern || seen.has(pattern)) {
      continue;
    }

    seen.add(pattern);
    normalized.push(pattern);
  }

  return normalized;
}

export function buildRules(redirectPatterns, ignorePatterns = []) {
  const normalizedIgnore = normalizePatternArray(ignorePatterns);
  const normalizedRedirect = normalizePatternArray(redirectPatterns);

  const rules = [];
  let nextRuleId = 1;

  for (const pattern of normalizedIgnore) {
    if (nextRuleId > MAX_DYNAMIC_RULES) {
      break;
    }

    rules.push({
      id: nextRuleId,
      priority: 2,
      action: {
        type: "allow",
      },
      condition: {
        resourceTypes: ["main_frame"],
        regexFilter: buildHttpsHostRegex(pattern),
      },
    });
    nextRuleId += 1;
  }

  for (const pattern of normalizedRedirect) {
    if (nextRuleId > MAX_DYNAMIC_RULES) {
      break;
    }

    rules.push({
      id: nextRuleId,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          transform: {
            scheme: "http",
          },
        },
      },
      condition: {
        resourceTypes: ["main_frame"],
        regexFilter: buildHttpsHostRegex(pattern),
      },
    });
    nextRuleId += 1;
  }

  return rules;
}

export async function loadConfigFromStorage() {
  const data = await chrome.storage.sync.get({
    [STORAGE_KEYS.redirectDomains]: [],
    [STORAGE_KEYS.ignoreDomains]: [],
    [STORAGE_KEYS.updatedAt]: 0,
  });

  return {
    redirectDomains: normalizePatternArray(data[STORAGE_KEYS.redirectDomains]),
    ignoreDomains: normalizePatternArray(data[STORAGE_KEYS.ignoreDomains]),
    updatedAt: Number(data[STORAGE_KEYS.updatedAt]) || 0,
  };
}

export async function saveConfigToStorage(config) {
  const redirectDomains = normalizePatternArray(config?.redirectDomains);
  const ignoreDomains = normalizePatternArray(config?.ignoreDomains);

  await chrome.storage.sync.set({
    [STORAGE_KEYS.redirectDomains]: redirectDomains,
    [STORAGE_KEYS.ignoreDomains]: ignoreDomains,
    [STORAGE_KEYS.updatedAt]: Date.now(),
  });
}

async function getDynamicRuleIds() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map((rule) => rule.id);
}

export async function syncDynamicRules(config) {
  const addRules = buildRules(config?.redirectDomains, config?.ignoreDomains);
  const removeRuleIds = await getDynamicRuleIds();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}
