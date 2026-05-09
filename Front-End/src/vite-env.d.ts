/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEFAULT_CLINIC_ID: string;
  readonly VITE_ADMIN_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
