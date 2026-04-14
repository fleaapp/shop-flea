/// <reference types="vite/client" />
declare const __BUILD_TIMESTAMP__: string;

declare module '*.mov' {
  const src: string;
  export default src;
}
