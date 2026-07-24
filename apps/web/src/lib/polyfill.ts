// biome-ignore lint/style/useNodejsImportProtocol: this is the npm `buffer` polyfill package, not the node: builtin — the browser has neither
import { Buffer } from 'buffer'

// @solana/web3.js and the register_verse encoders use Node's Buffer, absent in
// the browser. Install it on globalThis before any of that code runs.
const globalObject = globalThis as unknown as Record<string, unknown>
if (globalObject.Buffer === undefined) {
  globalObject.Buffer = Buffer
}
