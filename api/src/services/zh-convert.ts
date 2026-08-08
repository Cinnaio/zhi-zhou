/**
 * 繁简转换 —— 由 Novel-KV _zh-convert.js 平移。
 * 仅对 czbooks 源做繁体→简体（源站为繁体站）。
 */
import OpenCC from 'opencc-js'

const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' })

const FIXES: Array<[string, string]> = [['情色□□', '情色工口']]

function fixConversion(value: string): string {
  let out = value
  for (const [from, to] of FIXES) out = out.replaceAll(from, to)
  return out
}

export function isCzbooksUrl(url: string): boolean {
  if (!url) return false
  try {
    return new URL(url).hostname.includes('czbooks.net')
  } catch {
    return /czbooks\.net/i.test(url)
  }
}

/** 仅对 czbooks 源的字符串值做繁体→简体转换；其余原样返回。 */
export function toSimplifiedForSource<T>(value: T, sourceUrl: string | undefined): T {
  if (!isCzbooksUrl(sourceUrl || '') || typeof value !== 'string' || !value) return value
  return fixConversion(t2s(value as string)) as T
}

export function simplifyNovelForSource<T>(novel: T, sourceUrl?: string): T {
  if (!isCzbooksUrl(sourceUrl || '') || !novel) return novel
  const n = novel as Record<string, unknown>
  return {
    ...novel,
    title: toSimplifiedForSource(n.title, sourceUrl),
    author: toSimplifiedForSource(n.author, sourceUrl),
    category: toSimplifiedForSource(n.category, sourceUrl),
    categories: Array.isArray(n.categories)
      ? (n.categories as string[]).map((c) => toSimplifiedForSource(c, sourceUrl))
      : n.categories,
    description: toSimplifiedForSource(n.description, sourceUrl),
  } as unknown as T
}

export function simplifyChapterForSource<T>(chapter: T, sourceUrl?: string): T {
  if (!isCzbooksUrl(sourceUrl || '') || !chapter) return chapter
  const c = chapter as Record<string, unknown>
  return {
    ...chapter,
    title: toSimplifiedForSource(c.title, sourceUrl),
    content: toSimplifiedForSource(c.content, sourceUrl),
  } as unknown as T
}
