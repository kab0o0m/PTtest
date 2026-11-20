import axios from "axios";

// OneMap access tokens expire after ~3 days. We fetch one with the account
// credentials, cache it in localStorage, and fetch a new one when it expires.
const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const STORAGE_KEY = "onemap_token";
// Refresh a little before the real expiry so a request never uses a dying token.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

let pendingTokenRequest = null;

const readCachedToken = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (cached?.token && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return cached.token;
    }
  } catch {
    // Ignore unreadable cache and fetch a new token
  }
  return null;
};

const fetchNewToken = async () => {
  const email = import.meta.env.VITE_ONEMAP_EMAIL;
  const password = import.meta.env.VITE_ONEMAP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "OneMap credentials missing: set VITE_ONEMAP_EMAIL and VITE_ONEMAP_PASSWORD"
    );
  }

  const { data } = await axios.post(TOKEN_URL, { email, password });
  if (!data?.access_token) {
    throw new Error("OneMap did not return an access token");
  }

  // expiry_timestamp is in seconds; fall back to 3 days if missing
  const expiresAt = data.expiry_timestamp
    ? Number(data.expiry_timestamp) * 1000
    : Date.now() + 3 * 24 * 60 * 60 * 1000;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token: data.access_token, expiresAt })
  );
  return data.access_token;
};

// Returns a valid token, fetching a new one if the cached one is missing or
// expired. Pass forceRefresh after a 401 to discard the cached token.
export const getOneMapToken = async (forceRefresh = false) => {
  if (forceRefresh) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const cached = readCachedToken();
    if (cached) return cached;
  }

  // Share one in-flight request if several lookups need a token at once
  if (!pendingTokenRequest) {
    pendingTokenRequest = fetchNewToken().finally(() => {
      pendingTokenRequest = null;
    });
  }
  return pendingTokenRequest;
};
