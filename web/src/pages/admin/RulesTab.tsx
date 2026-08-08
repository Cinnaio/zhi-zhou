/**
 * 解析规则 tab —— TXT 章节识别规则（纯前端，全部状态在 localStorage）。
 * 由 Novel-KV js/admin-import.js 的 rules 部分平移。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '../../components/feedback'
import { useToast } from '../../components/feedback'
import {
  BUILTIN_PATTERNS,
  SEPARATOR_PATTERN,
  getRules,
  saveRules,
  getEffectivePatterns,
  parseTxtChapters,
  generateRuleId,
  MAX_RULE_REGEX_LENGTH,
  MAX_RULE_TEST_TEXT,
  MAX_CUSTOM_RULES,
  MAX_RULE_MATCHES,
  RULES_KEY,
  type CustomRule,
} from '../../lib/txtRules'

interface RuleDraft {
  id: string
  name: string
  regex: string
  flags: string
  weight: string
  captureGroup: string
}

interface TestMatch {
  text: string
}

export default function RulesTab(_props: { highlightNovelId?: string; onHighlightConsumed?: () => void }) {
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [customRules, setCustomRules] = useState<CustomRule[]>(() => getRules())
  const [modal, setModal] = useState<{ open: boolean; editing: string | null }>({ open: false, editing: null })
  const [draft, setDraft] = useState<RuleDraft>({ id: '', name: '', regex: '', flags: 'gm', weight: '5', captureGroup: '1' })
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; count: number; matches: TestMatch[]; error?: string } | null>(null)
  const [bulkInput, setBulkInput] = useState('')
  const [bulkResult, setBulkResult] = useState<{ count: number; lines: Array<{ pos: number; w: number; title: string }> } | null>(null)

  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function refresh() {
    setCustomRules(getRules())
  }

  function runLiveTest() {
    if (testTimer.current) clearTimeout(testTimer.current)
    testTimer.current = setTimeout(() => {
      const { regex, flags } = draft
      const text = testInput
      if (!regex.trim() || !text.trim()) {
        setTestResult(null)
        return
      }
      if (regex.length > MAX_RULE_REGEX_LENGTH) {
        setTestResult({ ok: false, count: 0, matches: [], error: '正则过长' })
        return
      }
      let re: RegExp
      try {
        re = new RegExp(regex, flags || 'gm')
      } catch {
        setTestResult({ ok: false, count: 0, matches: [], error: '正则错误' })
        return
      }
      const sample = text.slice(0, MAX_RULE_TEST_TEXT)
      const matches: TestMatch[] = []
      let m: RegExpExecArray | null
      while ((m = re.exec(sample)) !== null) {
        matches.push({ text: (m[0] || '').slice(0, 80) })
        if (m.index === re.lastIndex) re.lastIndex++
        if (matches.length >= MAX_RULE_MATCHES) break
      }
      setTestResult({ ok: matches.length > 0, count: matches.length, matches })
    }, 300)
  }

  useEffect(() => {
    runLiveTest()
    return () => {
      if (testTimer.current) clearTimeout(testTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.regex, draft.flags, testInput])

  function openModal(id: string | null) {
    if (id === null) {
      setDraft({ id: '', name: '', regex: '', flags: 'gm', weight: '5', captureGroup: '1' })
      setTestInput('')
      setTestResult(null)
      setModal({ open: true, editing: null })
    } else {
      const rule = getRules().find((r) => r.id === id)
      if (!rule) {
        toast('规则不存在', 'error')
        return
      }
      setDraft({
        id: rule.id,
        name: rule.name,
        regex: rule.regex,
        flags: rule.flags || 'gm',
        weight: String(rule.weight || 5),
        captureGroup: String(rule.captureGroup || 1),
      })
      setTestInput('')
      setTestResult(null)
      setModal({ open: true, editing: id })
    }
  }

  function closeModal() {
    setModal({ open: false, editing: null })
  }

  function saveRule() {
    if (!draft.name.trim()) {
      toast('请输入规则名称', 'error')
      return
    }
    if (!draft.regex.trim()) {
      toast('请输入正则表达式', 'error')
      return
    }
    if (draft.regex.length > MAX_RULE_REGEX_LENGTH) {
      toast('正则过长，请控制在 300 字以内', 'error')
      return
    }
    try {
      new RegExp(draft.regex, draft.flags || 'gm')
    } catch (err) {
      toast(`正则无效: ${(err as Error).message}`, 'error')
      return
    }
    const rules = getRules()
    const rule = {
      id: draft.id,
      name: draft.name.trim(),
      regex: draft.regex.trim(),
      flags: draft.flags || 'gm',
      weight: Math.min(20, Math.max(1, Number.parseInt(draft.weight, 10) || 5)),
      captureGroup: Math.min(9, Math.max(0, Number.parseInt(draft.captureGroup, 10) || 1)),
      enabled: true,
    }
    if (draft.id) {
      // 编辑态保留 enabled/createdAt
      const existing = rules.find((r) => r.id === draft.id)
      const merged = { ...existing, ...rule } as CustomRule
      saveRules(rules.map((r) => (r.id === draft.id ? merged : r)))
      toast('规则已更新', 'success')
    } else {
      if (rules.length >= MAX_CUSTOM_RULES) {
        toast(`自定义规则最多 ${MAX_CUSTOM_RULES} 条`, 'error')
        return
      }
      const fresh: CustomRule = { ...rule, id: generateRuleId(), createdAt: Date.now() }
      saveRules([...rules, fresh])
      toast('规则已添加', 'success')
    }
    closeModal()
    refresh()
  }

  async function deleteRule(id: string) {
    const rule = getRules().find((r) => r.id === id)
    const ok = await confirm({
      title: '删除规则',
      message: '确定删除该自定义规则？删除后将不再用于章节识别。',
      okText: '删除',
      danger: true,
      items: [rule?.name || '未命名'],
    })
    if (!ok) return
    saveRules(getRules().filter((r) => r.id !== id))
    refresh()
    toast('规则已删除', 'success')
  }

  function toggleRule(id: string, enabled: boolean) {
    saveRules(getRules().map((r) => (r.id === id ? { ...r, enabled } : r)))
  }

  async function resetRules() {
    const ok = await confirm({
      title: '恢复默认规则',
      message: '确定清除所有自定义规则并恢复默认广告清洗规则？',
      okText: '恢复默认',
      danger: true,
    })
    if (!ok) return
    localStorage.removeItem(RULES_KEY)
    refresh()
    toast('已恢复默认', 'success')
  }

  function runBulkTest() {
    const text = bulkInput.slice(0, MAX_RULE_TEST_TEXT)
    const parsed = parseTxtChapters(text)
    if (parsed.chapters.length < 2 || parsed.chapterPattern === 'none') {
      setBulkResult(null)
      toast('未检测到章节结构', 'error')
      return
    }
    const lines = parsed.chapters.map((c) => ({ pos: c.order, w: 0, title: c.title.slice(0, 60) }))
    setBulkResult({ count: parsed.chapters.length, lines })
    toast(`共识别 ${parsed.chapters.length} 章`, 'success')
  }

  const builtinRows = useMemo(() => {
    const sep: { n: string; source: string; flags: string; w: number } = {
      n: '分隔线',
      source: SEPARATOR_PATTERN.regex.source,
      flags: SEPARATOR_PATTERN.regex.flags,
      w: 0,
    }
    return [...BUILTIN_PATTERNS, sep]
  }, [])

  return (
    <section className="tab-content">
      <div className="section-header">
        <div className="section-header__titleblock">
          <h2 className="section-title">TXT 解析规则</h2>
        </div>
        <div className="admin-toolbar__group">
          <button className="btn btn--primary btn--sm" onClick={() => openModal(null)}>
            添加规则
          </button>
          <button className="btn btn--danger btn--sm" onClick={() => void resetRules()}>
            恢复默认
          </button>
        </div>
      </div>

      <details className="card rules-reference-card">
        <summary className="rules-reference-card__summary">内置规则参考（{BUILTIN_PATTERNS.length} 条，只读）</summary>
        <div className="rules-reference-card__body">
          {builtinRows.map((r, i) => (
            <div className="builtin-rule-row" key={i}>
              <span className="builtin-rule-row__index">{i + 1}</span>
              <span className="builtin-rule-row__regex">
                /{r.source.replace(/\//g, '\\/')}/{r.flags}
              </span>
              <span className="builtin-rule-row__weight">w={r.w}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="card rules-custom-card">
        <div className="card__head">
          <h3 className="card__title">自定义规则</h3>
          <span className="text-sm text-muted">
            {customRules.length}/{MAX_CUSTOM_RULES}
          </span>
        </div>
        <div className="rules-custom-list">
          {customRules.length === 0 ? (
            <p className="profile-empty-note">暂无自定义规则</p>
          ) : (
            customRules.map((r) => (
              <div className="rule-item" key={r.id}>
                <div className="rule-item__info">
                  <div className="rule-item__name">{r.name || '未命名'}</div>
                  <div className="rule-item__regex">
                    /{r.regex}/{r.flags || 'gm'}
                  </div>
                </div>
                <div className="rule-item__meta">
                  <span className="rule-item__weight">w={r.weight}</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      className="rule-toggle"
                      checked={r.enabled !== false}
                      onChange={(e) => toggleRule(r.id, e.target.checked)}
                    />
                    <span className="toggle-switch__slider"></span>
                  </label>
                  <button className="btn-table btn-table--edit btn-edit-rule" title="编辑" onClick={() => openModal(r.id)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5z" />
                    </svg>
                  </button>
                  <button className="btn-table btn-table--delete btn-delete-rule" title="删除" onClick={() => void deleteRule(r.id)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5h10M6.5 5V3.5h3V5M4.5 5l.5 7.5h6l.5-7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card rules-test-card">
        <div className="card__head">
          <h3 className="card__title">批量测试</h3>
          <span className="text-sm text-muted">粘贴包含多个章节标题的文本，测试当前规则能否识别章节结构</span>
        </div>
        <textarea
          className="form-input"
          rows={6}
          placeholder="粘贴包含多个章节标题的文本…"
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
        />
        <button className="btn btn--primary btn--sm" onClick={runBulkTest}>
          运行批量测试
        </button>
        {bulkResult && (
          <div className="rules-test-card__results">
            <div className="bulk-test-summary">共识别 {bulkResult.count} 章</div>
            {bulkResult.lines.map((l, i) => (
              <div className="bulk-match-line" key={i}>
                <span className="bulk-match-line__pos">#{l.pos}</span>
                <span className="bulk-match-line__w">w{l.w}</span>
                <span className="bulk-match-line__title">{l.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal rule-editor">
            <div className="modal__header">
              <h3 className="modal__title" id="ruleModalTitle">
                {draft.id ? '编辑规则' : '添加规则'}
              </h3>
              <button className="btn btn--icon btn--ghost" aria-label="关闭" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="modal__body">
              <label className="form-label">规则名称</label>
              <input
                className="form-input"
                placeholder="如：中文数字章节"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <label className="form-label">正则表达式</label>
              <input
                className="form-input"
                placeholder="如：^第\s*(\d+)\s*章.*$"
                value={draft.regex}
                onChange={(e) => setDraft({ ...draft, regex: e.target.value })}
              />
              <p className="form-hint">不包含首尾斜杠和 flags。</p>
              <div className="rule-editor__grid">
                <div>
                  <label className="form-label">flags</label>
                  <input className="form-input" value={draft.flags} onChange={(e) => setDraft({ ...draft, flags: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">权重</label>
                  <input className="form-input" type="number" min={1} max={20} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">捕获组</label>
                  <input className="form-input" type="number" min={0} max={9} value={draft.captureGroup} onChange={(e) => setDraft({ ...draft, captureGroup: e.target.value })} />
                </div>
              </div>
              <label className="form-label">实时测试</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="粘贴要测试的文本…"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />
              <div className="rule-editor__result">
                {testResult && (
                  <>
                    {testResult.error ? (
                      <span className="error-text">{testResult.error}</span>
                    ) : testResult.ok ? (
                      <>
                        <span className="success-text">{testResult.count} 处匹配</span>
                        <div className="rule-test-matches">
                          {testResult.matches.map((m, i) => (
                            <div className="rule-test-match" key={i}>
                              {m.text}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="error-text">无匹配</span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={closeModal}>
                取消
              </button>
              <button className="btn btn--primary" onClick={saveRule}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// 供「导入 TXT」复用的纯函数（规则 tab 与导入共享同一识别实现）
export { getEffectivePatterns, parseTxtChapters }
