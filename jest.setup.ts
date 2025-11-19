// Setup for Jest tests
// Ensure Web Crypto API is available in Node.js test environment
import { webcrypto } from "crypto";
import { TextEncoder, TextDecoder } from "util";

// Polyfill crypto.subtle if not available
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

// Ensure TextEncoder/TextDecoder are available
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder;
}
