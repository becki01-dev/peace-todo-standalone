import "@testing-library/jest-dom";

// jsdom 20 不保证提供 crypto.randomUUID(组件里用到了),守卫式补丁
if (typeof globalThis.crypto?.randomUUID !== "function") {
  const cryptoShim = globalThis.crypto ?? {};
  Object.defineProperty(globalThis, "crypto", { writable: true, value: cryptoShim });
  Object.defineProperty(cryptoShim, "randomUUID", {
    value: () => `test-${Math.random().toString(36).slice(2)}`,
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
