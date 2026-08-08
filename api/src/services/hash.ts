/** SHA-256 带盐摘要（十六进制）。用于 token 摘要与客户端/IP 匿名哈希。 */
import { webcrypto } from 'node:crypto'

export async function sha256Hex(salt: string, value: string): Promise<string> {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + String(value || '')))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
