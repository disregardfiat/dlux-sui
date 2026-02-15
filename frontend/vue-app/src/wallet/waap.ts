/**
 * WaaP (Wallet as a Protocol) initialization for Sui.
 * WaaP enables seedless login via email, phone, social (Google, Twitter, etc.), and Face ID.
 * It implements the Sui Wallet Standard, so it appears alongside Slush/Sui Wallet in the connect modal.
 *
 * Loaded lazily when the connect modal opens to avoid increasing the initial bundle.
 *
 * @see https://docs.waap.xyz/guides-sui/start
 * @see https://waap.xyz
 */
import { SUI_NETWORK, PRIVACY_POLICY_URL } from '@/config/links';

let initialized = false;

export async function initWaaP(): Promise<void> {
  if (typeof window === 'undefined' || initialized) return;

  try {
    const [{ initWaaPSui }, { registerWallet }] = await Promise.all([
      import('@human.tech/waap-sdk'),
      import('@mysten/wallet-standard'),
    ]);

    const isDark =
      document.documentElement.getAttribute('data-bs-theme') === 'dark' ||
      (document.documentElement.getAttribute('data-bs-theme') !== 'light' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    const wallet = initWaaPSui({
      config: {
        authenticationMethods: ['email', 'phone', 'social'],
        allowedSocials: ['google', 'twitter', 'discord'],
        styles: { darkMode: isDark },
        showSecured: true,
      },
      project: {
        privacyPolicyUrl: PRIVACY_POLICY_URL,
      },
      useStaging: SUI_NETWORK === 'testnet',
    });

    registerWallet(wallet as Parameters<typeof registerWallet>[0]);
    initialized = true;
  } catch (e) {
    console.warn('WaaP init failed (embedded wallet unavailable):', e);
  }
}
