/**
 * TXT 解析规则 —— 单一事实来源：内置规则、localStorage 自定义规则、章节识别。
 * 由 Novel-KV js/admin-import.js 的 BUILTIN_PATTERNS / getEffectivePatterns / parseTxtChapters 平移。
 * RulesTab 与「导入 TXT」共用；自定义规则存储沿用 key `novel_txt_patterns`。
 */

export const RULES_KEY = 'novel_txt_patterns'
export const MAX_RULE_REGEX_LENGTH = 300
export const MAX_RULE_TEST_TEXT = 50000
export const MAX_CUSTOM_RULES = 20
export const MAX_RULE_MATCHES = 500

export interface CustomRule {
  id: string
  name: string
  regex: string
  flags: string
  weight: number
  captureGroup: number
  enabled: boolean
  createdAt?: number
}

export interface CompiledPattern {
  regex: RegExp
  w: number
  captureGroup: number
}

/** 内置规则（source 不含首尾斜杠）。 */
export const BUILTIN_PATTERNS: Array<{ n: string; source: string; flags: string; w: number }> = [
  { n: '数字+空格+标题', source: '^(\\d+)\\s+(.+)$', flags: 'gm', w: 14 },
  { n: '书名(H) 作者', source: '^(.+?) < [^\\n]*[（(]H[）)][^\\n<]*$', flags: 'gm', w: 13 },
  { n: '重复短标题行', source: '^([^\\n]{2,25})\\n[ 　\\t]+\\1$', flags: 'gm', w: 12 },
  { n: '【主题·子标题】', source: '^\\s*【[^】]*·[^】]*】.+$', flags: 'gm', w: 11 },
  { n: '第\\d+章', source: '^第\\s*(\\d+)\\s*章[．.\\s]*(.*)$', flags: 'gm', w: 10 },
  { n: '第中文数章', source: '^第([一二三四五六七八九十百千万〇]+)章[．.\\s]*(.*)$', flags: 'gm', w: 9 },
  { n: 'Chapter X:Title', source: '^chapter\\s+(\\d+)[\\s.：:，,]+(.+)$', flags: 'gim', w: 8 },
  { n: 'Chapter X', source: '^chapter\\s+(\\d+)\\s*$', flags: 'gim', w: 7 },
  { n: '第\\d+节', source: '^第\\s*(\\d+)\\s*节[．.\\s]*(.*)$', flags: 'gm', w: 6 },
  { n: '【\\d+】标题', source: '^[\\[【〔]\\s*(\\d+)\\s*[\\]】〕]\\s*(.*)$', flags: 'gm', w: 5 },
  { n: '\\d+.标题', source: '^(\\d+)[.、．｜]\\s*(.+)$', flags: 'gm', w: 4 },
  { n: '第\\d+卷', source: '^第\\s*(\\d+)\\s*卷[．.\\s]*(.*)$', flags: 'gm', w: 3 },
  { n: '行末H标记', source: '^([^\\n]{2,40})\\s+[Hh]{1,3}\\s*$', flags: 'gm', w: 2 },
  { n: '作者菌后章名', source: '作者菌[^\\n]*\\n([^\\n]{2,35})$', flags: 'gm', w: 1 },
]

export const SEPARATOR_PATTERN: CompiledPattern = { regex: /^[=\-*]{5,}\s*$/gm, w: 0, captureGroup: 1 }

export function getRules(): CustomRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? (arr as CustomRule[]) : []
  } catch {
    return []
  }
}

export function saveRules(rules: CustomRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

export function getBuiltinPatterns(): CompiledPattern[] {
  return BUILTIN_PATTERNS.map((p) => ({ regex: new RegExp(p.source, p.flags), w: p.w, captureGroup: 1 }))
}

/** 内置 + 启用中的自定义规则（最多 20 条，compile 失败静默跳过）。 */
export function getEffectivePatterns(): CompiledPattern[] {
  const result = getBuiltinPatterns()
  for (const r of getRules().slice(0, MAX_CUSTOM_RULES)) {
    if (r.enabled === false) continue
    try {
      result.push({ regex: new RegExp(r.regex, r.flags || 'gm'), w: r.weight || 5, captureGroup: r.captureGroup || 1 })
    } catch {
      /* ignore invalid regex */
    }
  }
  return result
}

export interface ParsedTxtChapter {
  title: string
  content: string
  order: number
}

export interface ParsedTxt {
  title: string
  author: string
  chapters: ParsedTxtChapter[]
  totalLines: number
  chapterPattern: 'chapter' | 'default' | 'separator' | 'none'
  description: string
}

export function parseTxtChapters(text: string): ParsedTxt {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const totalLines = text.split('\n').length

  let title = ''
  let author = ''
  const authorMatch = text.match(/^作者[：:]\s*(.+)$/m)
  if (authorMatch) author = authorMatch[1]!.trim()
  const titleMatch = text.match(/^(?:书名|标题|作品)[：:]\s*(.+)$/m)
  if (titleMatch) title = titleMatch[1]!.trim()

  if (!title) {
    const firstLines = text.split('\n').slice(0, 15).filter((l) => l.trim())
    for (const line of firstLines) {
      const t = line.trim()
      if (t && t.length < 30 && !/^第/i.test(t) && !/^chapter/i.test(t) && !/^作者/.test(t) && !/^作[　 ]/.test(t) && !/^==/.test(t) && !/^作 者/.test(t) && !/^內容簡介/.test(t)) {
        title = t
        break
      }
    }
  }

  const patterns = getEffectivePatterns()
  const allMatches: Array<{ idx: number; match: RegExpExecArray; weight: number }> = []
  for (const pat of patterns) {
    pat.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pat.regex.exec(text)) !== null) {
      allMatches.push({ idx: m.index, match: m, weight: pat.w })
      if (m.index === pat.regex.lastIndex) pat.regex.lastIndex++
    }
  }
  allMatches.sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : b.weight - a.weight))
  const merged: Array<{ idx: number; match: RegExpExecArray; weight: number }> = []
  for (const cur of allMatches) {
    if (merged.length === 0) {
      merged.push(cur)
    } else if (cur.idx - merged[merged.length - 1]!.idx >= 50) {
      merged.push(cur)
    } else if (cur.weight > merged[merged.length - 1]!.weight) {
      merged[merged.length - 1] = cur
    }
  }

  if (merged.length < 2) {
    const sep = new RegExp(SEPARATOR_PATTERN.regex.source, SEPARATOR_PATTERN.regex.flags)
    const seps: number[] = []
    let sp: RegExpExecArray | null
    while ((sp = sep.exec(text)) !== null) seps.push(sp.index)
    if (seps.length >= 2) {
      const sepChs: ParsedTxtChapter[] = []
      let segStart = seps[0]! + text.slice(seps[0]).indexOf('\n') + 1
      for (let si = 1; si < seps.length; si++) {
        const segEnd = seps[si]!
        const seg = text.slice(segStart, segEnd).trim()
        if (seg.length > 50) {
          const segLs = seg.split('\n').filter((l) => l.trim())
          const ct = segLs[0] ? segLs[0].trim() : '第' + si + '章'
          sepChs.push({ title: ct, content: segLs.slice(1).join('\n').trim() || seg, order: si })
        }
        segStart = seps[si]! + text.slice(seps[si]!).indexOf('\n') + 1
      }
      return { title, author, chapters: sepChs, totalLines, chapterPattern: 'separator', description: '' }
    }
  }

  const deduped: Array<{ idx: number; match: RegExpExecArray; weight: number }> = []
  for (let di = 0; di < merged.length; di++) {
    const cur = merged[di]!
    if (cur.weight !== 13) {
      deduped.push(cur)
      continue
    }
    const curTitle = cur.match[1]!.trim()
    const nextTitle = di + 1 < merged.length && merged[di + 1]!.weight === 13 ? merged[di + 1]!.match[1]!.trim() : null
    if (curTitle !== nextTitle) deduped.push(cur)
  }
  const finalMerged = deduped

  if (finalMerged.length < 2) {
    return { title, author, chapters: [], totalLines, chapterPattern: 'none', description: '' }
  }

  const wc: Record<number, number> = {}
  for (const e of finalMerged) wc[e.weight] = (wc[e.weight] || 0) + 1
  let bestWeight = 0
  let bestWc = 0
  for (const w in wc) {
    if (wc[w]! > bestWc) {
      bestWc = wc[w]!
      bestWeight = Number.parseInt(w, 10)
    }
  }

  let chapters: ParsedTxtChapter[] = []
  for (let mi3 = 0; mi3 < finalMerged.length; mi3++) {
    const e = finalMerged[mi3]!
    const match = e.match
    const start = match.index
    const end = mi3 + 1 < finalMerged.length ? finalMerged[mi3 + 1]!.idx : text.length
    let rawContent = text.slice(start + match[0].length, end)
    let chTitle: string

    if (e.weight === 13) {
      chTitle = match[1]!.trim()
      const cls = rawContent.split('\n')
      let cs = 0
      for (let sk = 0; sk < Math.min(5, cls.length); sk++) {
        if (!cls[sk]!.trim() || cls[sk]!.trim() === chTitle || cls[sk]!.trim().indexOf(chTitle + ' < ') === 0) cs = sk + 1
        else break
      }
      rawContent = cls.slice(cs).join('\n')
    } else if (e.weight === 2) {
      chTitle = match[0].trim()
    } else if (e.weight === 12) {
      chTitle = match[0].trim().split('\n')[0]!.trim()
    } else {
      chTitle = match[2] && match[2].trim() ? match[2].trim() : match[1] ? match[1].trim() : match[0].trim()
    }

    let content = rawContent.trim()
    content = content.replace(/\n{3,}/g, '\n\n')
    chapters.push({ title: chTitle, content, order: mi3 + 1 })
  }

  if (bestWeight === 11 || bestWeight === 13) {
    const cleaned: ParsedTxtChapter[] = []
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci]!
      ch.title = ch.title.replace(/\s*<.*$/, '').trim()
      if (ci > 0 && ch.title === chapters[ci - 1]!.title) {
        cleaned[cleaned.length - 1] = ch
      } else {
        cleaned.push(ch)
      }
    }
    const finalChapters: ParsedTxtChapter[] = []
    const seen: Record<string, boolean> = {}
    for (const ch of cleaned) {
      const key = ch.title
      if (seen[key]) {
        const idx = finalChapters.findIndex((f) => f.title === key)
        if (idx >= 0) finalChapters[idx] = ch
      } else {
        seen[key] = true
        finalChapters.push(ch)
      }
    }
    finalChapters.forEach((ch, i) => {
      ch.order = i + 1
    })
    chapters = finalChapters
  }

  return {
    title,
    author,
    chapters,
    totalLines,
    chapterPattern: bestWeight >= 5 ? 'chapter' : 'default',
    description: extractDescription(text, finalMerged[0]!.idx, title),
  }
}

function extractDescription(text: string, firstChapterIdx: number, detectedTitle: string): string {
  const preamble = text.slice(0, firstChapterIdx).trim()
  const lines = preamble
    .split('\n')
    .map((l) => {
      const t = l.trim()
      if (!t) return ''
      if (/^(书名|标题|作品)[：:]/.test(t)) return null
      if (/^作者[：:]/.test(t)) return null
      if (/^內容簡介/.test(t)) return null
      if (/^食用指南/.test(t)) return null
      if (detectedTitle && t === detectedTitle) return null
      if (/ < [^\n]*[（(]H[）)]/.test(t)) return null
      return t
    })
    .filter((l): l is string => !!l)
  return lines.slice(0, 8).join('\n').slice(0, 400)
}

export function generateRuleId(): string {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}
