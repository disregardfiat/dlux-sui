type StoredAuth = {
  token: string;
  user: {
    suiAddress: string;
    suinsName?: string;
  };
  walletName?: string;
  walletIcon?: string;
};

const LOCAL_STORAGE_KEY = 'dlux_auth_local';
const SHARED_COOKIE_KEY = 'dlux_auth_shared';
const JWT_COOKIE_KEY = 'dlux_jwt';
const COOKIE_DOMAIN_OVERRIDE = (import.meta as any)?.env?.VITE_AUTH_COOKIE_DOMAIN as string | undefined;

const getRootDomain = (): string | null => {
  if (COOKIE_DOMAIN_OVERRIDE && COOKIE_DOMAIN_OVERRIDE.trim()) {
    return COOKIE_DOMAIN_OVERRIDE.trim();
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  if (host.endsWith('.test.dlux.io')) {
    return '.test.dlux.io';
  }
  if (host.endsWith('.dlux.io')) {
    return '.dlux.io';
  }
  const parts = host.split('.');
  if (parts.length < 2) return null;
  return `.${parts.slice(-2).join('.')}`;
};

const setCookie = (name: string, value: string, days = 7, domain?: string | null) => {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  let cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  if (domain) {
    cookie += `; domain=${domain}`;
  }
  if (window.location.protocol === 'https:') {
    cookie += '; Secure';
  }
  document.cookie = cookie;
};

const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const deleteCookie = (name: string, domain?: string | null) => {
  setCookie(name, '', -1, domain);
};

export const authStorage = {
  save(auth: StoredAuth) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(auth));
    const rootDomain = getRootDomain();
    setCookie(SHARED_COOKIE_KEY, JSON.stringify(auth), 7, rootDomain);
    setCookie(JWT_COOKIE_KEY, auth.token, 7, rootDomain);
  },
  load(): StoredAuth | null {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        return JSON.parse(local) as StoredAuth;
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
    const shared = getCookie(SHARED_COOKIE_KEY);
    if (shared) {
      try {
        return JSON.parse(shared) as StoredAuth;
      } catch {
        const rootDomain = getRootDomain();
        deleteCookie(SHARED_COOKIE_KEY, rootDomain);
      }
    }
    return null;
  },
  clear() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    const rootDomain = getRootDomain();
    deleteCookie(SHARED_COOKIE_KEY, rootDomain);
    deleteCookie(JWT_COOKIE_KEY, rootDomain);
  }
};
