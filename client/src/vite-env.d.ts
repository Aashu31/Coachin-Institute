/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_INSTITUTE_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
