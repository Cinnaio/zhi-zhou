/**
 * HTML 转义：用户内容插入 innerHTML 前必须经过 escHtml。
 * 前后端共享的唯一实现（原 Novel-KV 前后端各有 6 份副本，此处收敛为一份）。
 */
export function escHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return ch
    }
  })
}
