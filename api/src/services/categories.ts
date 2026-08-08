/**
 * 分类规范化 —— 由 Novel-KV _scrape-meta.js 的 normalizeCategories 平移。
 * 分类进入 DB 前必须走这里，保证标签一致。
 */

const CATEGORY_NORMALIZE: Record<string, string> = {
  H: 'h',
  h: 'h',
  甜H: '甜',
  甜h: '甜',
  純H: 'h',
  純h: 'h',
  纯H: 'h',
  纯h: 'h',
  高H: 'h',
  高h: 'h',
  NP: 'np',
  np: 'np',
  NPH: 'np',
  nph: 'np',
  '1V1': '1v1',
  '1v1': '1v1',
  SM: 'sm',
  sm: 'sm',
  ABO: 'abo',
  abo: 'abo',
  GB: 'gb',
  gb: 'gb',
  骨科: '兄妹',
  兄妹骨科: '兄妹',
  姐弟: '兄妹',
  兄妹恋: '兄妹',
  姐弟恋: '兄妹',
  純愛: '纯爱',
  甜宠: '甜',
  双洁: '双处',
  男洁: '男处',
  SC: '双处',
  sc: '双处',
}

const KNOWN_TAGS = [
  '青梅竹马', '破镜重圆', '先婚后爱', '追妻火葬场', '哨兵向导',
  '强取豪夺', '兄妹骨科',
  '穿越', '重生', '玄幻', '仙侠', '都市', '校园', '民国', '星际', '末世', '奇幻', '武侠', '悬疑', '惊悚', '恐怖', '推理', '科幻',
  '剧情流',
  '古言', '现言', '种田', '宫斗', '宅斗', '权谋', '女尊', '兽人', '人兽', '强强', '双强', '生子', '甜文', '甜宠', '虐文', '爽文', '系统', '快穿', '慢穿', '女配', '反派', '马甲', '掉马', '替身', '暗恋', '追妻', '破镜', '带球',
  '年下', '男处', '男洁', '女强', '双处', '双洁', '百合', '强制', '调教', '父女',
  '兄妹恋', '姐弟恋', '骨科', '兄妹', '姐弟', '純愛',
  'NPH', 'ABO',
  'NP', 'SM', 'GB',
  '1v1', '高H', '高h', '甜H', '甜h', '純H', '純h', '纯H', '纯h',
  'H',
  '虐',
].sort((a, b) => b.length - a.length)

export function tokenizeConcatenatedTags(raw: string): string[] {
  if (!raw) return []
  const result: string[] = []
  let pos = 0
  while (pos < raw.length) {
    let matched = false
    for (const tag of KNOWN_TAGS) {
      const slice = raw.slice(pos, pos + tag.length)
      if (slice.toLowerCase() === tag.toLowerCase()) {
        result.push(CATEGORY_NORMALIZE[slice] || CATEGORY_NORMALIZE[tag] || slice)
        pos += tag.length
        matched = true
        break
      }
    }
    if (!matched) pos++
  }
  return result
}

export function normalizeCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of categories) {
    if (typeof c !== 'string') continue
    const t = c.trim()
    if (!t) continue
    const mapped = CATEGORY_NORMALIZE[t] || t
    const tokens = tokenizeConcatenatedTags(mapped)
    if (tokens.length === 0) {
      const key = mapped.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(mapped)
      }
      continue
    }
    for (const tok of tokens) {
      const key = tok.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(tok)
      }
    }
  }
  return out
}
