/**
 * 广告清洗 —— 由 Novel-KV _ad-cleaner.js 平移。
 * 单一事实来源：前端（清洗阅读文本）与服务端（清洗抓取内容）共用此实现，
 * 不再需要两端镜像同步。规则以正则内联（未来可改为"规则即数据"表）。
 */

const AD_TLDS = /^(?:com|net|org|xyz|cc|vip|biz|us|in|co|info|me|top|icu|site|work)$/i

function normalizeDomainToken(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining diacritical marks
    .replace(/[οо]/gi, 'o')
    .replace(/[ρр]/gi, 'p')
    .replace(/[с]/gi, 'c')
    .replace(/[м]/gi, 'm')
    .replace(/[г]/gi, 'r')
    .replace(/\s/g, '')
    .toLowerCase()
}

export function removeAdPatterns(text: string | null | undefined): string {
  if (!text) return ''
  return text
    // Mixed-script homoglyph domains: ρó18ρóг.ｃóм
    .replace(/(?:\s*[a-zA-Z0-9À-ɏͰ-ϿЀ-ӿＡ-Ｚａ-ｚ]\s*){2,}[.。．](?:\s*[a-zA-ZÀ-ɏͰ-ϿЀ-ӿＡ-Ｚａ-ｚ]\s*){2,}/giu, (m) => {
      const tld = normalizeDomainToken(m.slice(Math.max(m.lastIndexOf('.'), m.lastIndexOf('。'), m.lastIndexOf('．')) + 1))
      return AD_TLDS.test(tld) ? '' : m
    })
    // Generic: strip "xxxx . com/net/org" with inserted spaces
    .replace(/(?:\s*[a-zA-Z0-9À-ɏ]\s*){3,}\.(?:\s*[a-zA-Z]\s*){2,}(?:\s*[a-zA-Z]\s*)?/gi, (m) => {
      const tld = normalizeDomainToken(m.slice(m.lastIndexOf('.') + 1))
      return AD_TLDS.test(tld) ? '' : m
    })
    // PO18 specific
    .replace(/免费精彩在线[：:]?\s*[「『【\[〔【]?\s*po1[⒏8]homes?\s*[」』】\]〕】]?/gi, '')
    .replace(/po18\s*[.·]?\s*co\s*m?\b/gi, '')
    .replace(/首[-\s]?发\s*[：:]\s*po18(?:vip|p)?\s*[.·]?\s*(?:biz|org|com|vip|net|cc|xyz)\s*[\(（][^\)）]*[\)）]/gi, '')
    .replace(/首\s*[-－—]\s*发\s*[：:]?/gi, '')
    .replace(/(?:[\[「『【(])?\s*[РрPp][oо0σ][1⒈ⅠⅠlℓ][8⒏][Rr][eе][dԁ](?:\.(?:com|net|org))?\s*[\]」』】)]?/gi, '')
    .replace(/(?:po1[⒏8]\s*[υv]ip|po18\.us|ωoо1⒏\s*υip|「?Рo1⒏[аa]rt」?|「?Рo1⒏run」?|po1\s*8rn\.co\s*m|p\s*o1\s*8ar\s*t\.co\s*m|po1\s*8ai\.c\s*o\s*m|po1\s*8qb\.c\s*om)\s*/gi, '')
    .replace(/(?:hpo18|woo(?:1[4-8])?)\s*/gi, '')
    .replace(/like\s*[.·]\s*xi/gi, '')
    // Spaced domains
    .replace(/\s*yuwang\s*kongjian\.c\s*om\s*/gi, '')
    .replace(/\s*2\s*bx\s*x\.c\s*om\s*/gi, '')
    .replace(/\s*4\s*7\s*5x\.c\s*om\s*/gi, '')
    .replace(/\s*2w8\s*9\.c\s*o\s*m\s*/gi, '')
    .replace(/\s*zui\s*jile\.c\s*om\s*/gi, '')
    .replace(/\s*powenxu\s*e1\s*6\.c\s*om\s*/gi, '')
    .replace(/\s*jizai9\.com\s*/gi, '')
    .replace(/\s*myushuwu\.com\s*/gi, '')
    .replace(/\s*yut\s*i8\.c\s*om\s*/gi, '')
    .replace(/\s*hehuan8\s*/gi, '')
    .replace(/\s*2ha\s*it\s*an\s*g\s*\.c\s*om\s*/gi, '')
    .replace(/\s*yanyushu\s*8\.c\s*om\s*/gi, '')
    .replace(/\s*y\s*uw\s*angsh\s*e\.i\s*n\s*/gi, '')
    .replace(/\s*rir\s*iwen\.c\s*om\s*/gi, '')
    .replace(/\s*ye\s*hu\s*a\s*4\.c\s*om\s*/gi, '')
    // Text garbage
    .replace(/\s*p\s*o\s*wen\s*xu\s*/gi, '')
    .replace(/\s*ta\s*ose\s*sh\s*/gi, '')
    .replace(/\s*y[ūü]\s*wan\s*/gi, '')
    // Post-cleanup: orphaned TLDs and brackets
    .replace(/\s*\.\s*(?:com|net|org|xyz|cc|vip|biz|us|in|co|info|me|top|icu|site)\s*/gi, '')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/[（(]\s*[,，、•·\s]+[）)]/g, '')
    .replace(/[（(][^）)]*?[,，、•·]+\s*[）)]/g, (m) => {
      const inner = m.slice(1, -1).replace(/[,，、•·\s]+$/, '').trim()
      return inner ? '（' + inner + '）' : ''
    })
    .replace(/[（(]\s*[^）)]*$/g, '')
}
