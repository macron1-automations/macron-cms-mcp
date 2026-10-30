export interface MacronCmsConfig {
  originUrl: string;
  apiBaseUrl: string;
  apiKey?: string;
  readOnly: boolean;
  timeoutMs: number;
}

export function parseConfig(env: NodeJS.ProcessEnv = process.env): MacronCmsConfig {
  const rawUrl = env.MACRON_CMS_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "Missing required environment variable: MACRON_CMS_URL (e.g. http://localhost:3000 or http://localhost:3000/cms)"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL format in MACRON_CMS_URL: "${rawUrl}"`);
  }

  const originUrl = parsed.origin;
  const mountPath = env.MACRON_CMS_MOUNT_PATH?.trim().replace(/\/+$/, "") || "/cms";

  // Normalize path to always end at /api/v1
  let path = parsed.pathname.replace(/\/+$/, "");
  if (path.endsWith("/api/v1")) {
    // already includes full API path
  } else if (path.endsWith("/cms")) {
    path = `${path}/api/v1`;
  } else if (path === "" || path === "/") {
    path = `${mountPath}/api/v1`;
  } else {
    path = `${path}/api/v1`;
  }

  const apiBaseUrl = `${originUrl}${path}`;

  const apiKey = env.MACRON_CMS_API_KEY?.trim() || undefined;
  const readOnly = env.MACRON_CMS_READ_ONLY === "true" || env.MACRON_CMS_READ_ONLY === "1";
  const timeoutMs = env.MACRON_CMS_TIMEOUT_MS ? parseInt(env.MACRON_CMS_TIMEOUT_MS, 10) : 30000;

  return {
    originUrl,
    apiBaseUrl,
    apiKey,
    readOnly,
    timeoutMs: isNaN(timeoutMs) || timeoutMs <= 0 ? 30000 : timeoutMs,
  };
}
