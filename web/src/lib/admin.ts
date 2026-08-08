/**
 * 管理后台共享工具 —— 任务状态文案、耗时格式化、运行态判定。
 * 由 Novel-KV js/admin-core.js 的 JOB_STATUS_LABELS / formatEta / formatJobSpeed / getJobDuration 平移。
 */

export const JOB_STATUS_LABELS: Record<string, string> = {
  starting: '启动中',
  fetching_list: '获取目录',
  extracting_links: '解析链接',
  preflight: '抓取前检查',
  saving: '保存中',
  scraping_chapters: '抓取中',
  partial: '部分完成',
  completed: '已完成',
  failed: '失败',
  cancelled: '已终止',
  queued: '排队中',
}

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] || status || '未知'
}

const RUNNING_STATUSES = new Set(['starting', 'fetching_list', 'extracting_links', 'preflight', 'scraping_chapters', 'saving'])

export function isJobRunning(status: string): boolean {
  return RUNNING_STATUSES.has(status)
}

export function isJobTerminal(status: string): boolean {
  return status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled'
}

export function formatEta(seconds: number | undefined | null): string {
  const s = Number(seconds) || 0
  if (s <= 0) return '—'
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}分${sec}秒`
}

export function formatJobSpeed(speed: number | undefined | null): string {
  const v = Number(speed) || 0
  return v <= 0 ? '—' : `${v}章/分`
}

export function getJobDuration(startedAt: number, terminalEndAt: number | null): string {
  const end = terminalEndAt || Date.now()
  const diff = Math.max(0, end - startedAt)
  const totalSec = Math.floor(diff / 1000)
  if (totalSec < 60) return `${totalSec}秒`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m < 60) return `${m}分${s}秒`
  const h = Math.floor(m / 60)
  return `${h}时${m % 60}分`
}

/** 复制到剪贴板，返回是否成功（原版失败兜底用 info toast）。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

export function truncateId(id: string, max = 12): string {
  const s = String(id || '')
  return s.length > max ? s.slice(0, max) + '…' : s
}
