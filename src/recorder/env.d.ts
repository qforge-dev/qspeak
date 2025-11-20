/// <reference types="vite/client" />

import type { Api } from "@/preload";

declare global {
  interface Window {
    api: Api;
  }
}
