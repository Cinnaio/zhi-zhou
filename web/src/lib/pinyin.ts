/**
 * 拼音工具 —— 懒加载 PINYIN_MAP（219KB 数据不进入主包）。
 * 移植自 Novel-KV js/pinyin-data.js 的 Pinyin.match / pinyinMatch。
 */
import type { PinyinMap } from './pinyin-data'

let mapPromise: Promise<PinyinMap> | null = null

function loadMap(): Promise<PinyinMap> {
  if (!mapPromise) {
    mapPromise = import('./pinyin-data').then((mod) => mod.PINYIN_MAP)
  }
  return mapPromise
}

export function toPinyin(str: string, map: PinyinMap): string {
  if (!str) return ''
  const r: string[] = []
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!
    r.push(map[ch] || ch.toLowerCase())
  }
  return r.join(' ')
}

export function toInitials(str: string, map: PinyinMap): string {
  if (!str) return ''
  const r: string[] = []
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!
    const py = map[ch]
    if (py) r.push(py[0]!)
    else if (/[a-zA-Z0-9]/.test(ch)) r.push(ch.toLowerCase())
  }
  return r.join('')
}

/** 匹配文本是否命中查询（支持中文子串、全拼、拼音首字母）。 */
export async function pinyinMatch(text: string, query: string): Promise<boolean> {
  if (!text || !query) return false
  const q = query.toLowerCase().replace(/\s/g, '')
  if (text.toLowerCase().includes(q)) return true
  const map = await loadMap()
  if (toPinyin(text, map).replace(/\s/g, '').includes(q)) return true
  if (toInitials(text, map).includes(q)) return true
  return false
}

/** 服务端无法处理拼音查询时的客户端过滤：先等映射就绪。 */
export function warmPinyin(): Promise<PinyinMap> {
  return loadMap()
}
