/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_SUBSCRIPTION_PRICE_SUI: string;
  readonly VITE_FOUNDATION_ADDRESS: string;
  readonly VITE_WALRUS_PUBLISHER: string;
  readonly VITE_GRAPHQL_ENDPOINT: string;
  readonly VITE_SUI_NETWORK: string;
  readonly VITE_SUI_SERVICE_URL: string;
  readonly VITE_DGRAPH_SERVICE_URL: string;
  readonly VITE_WALRUS_SERVICE_URL: string;
  readonly VITE_SANDBOX_SERVICE_URL: string;
  readonly VITE_ZK_SERVICE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}