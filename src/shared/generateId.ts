let fallbackCounter = 0

function formatUuid(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function pseudoRandomBytes(): Uint8Array {
  const bytes = new Uint8Array(16)
  const timestamp = Date.now()
  fallbackCounter = (fallbackCounter + 1) >>> 0

  for (let index = 0; index < bytes.length; index += 1) {
    const timestampByte = Math.floor(timestamp / 2 ** ((index % 6) * 8)) & 0xff
    const counterByte = (fallbackCounter >>> ((index % 4) * 8)) & 0xff
    bytes[index] = Math.floor(Math.random() * 256) ^ timestampByte ^ counterByte
  }

  return bytes
}

/**
 * Generates an application identifier without assuming a secure browser context.
 *
 * `randomUUID` is preferred when available. Plain-HTTP browser sessions can still
 * use `getRandomValues`; the timestamp/counter/Math.random path is a final fallback
 * for older browsers, SSR environments and constrained test runtimes.
 */
export function generateId(): string {
  const cryptoApi = typeof globalThis.crypto === 'undefined' ? undefined : globalThis.crypto

  if (typeof cryptoApi?.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID()
    } catch {
      // Continue to APIs that do not require randomUUID support.
    }
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    try {
      return formatUuid(cryptoApi.getRandomValues(new Uint8Array(16)))
    } catch {
      // Continue to the environment-independent last resort.
    }
  }

  return formatUuid(pseudoRandomBytes())
}
