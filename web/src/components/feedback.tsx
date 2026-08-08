/**
 * 反馈组件 —— Toast 轻提示 + Confirm 确认弹窗。
 * 由 theme.js showToast / ensureConfirmModal + showConfirmModal 平移为 React。
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ---------- Toast ----------

type ToastType = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, type: ToastType = 'default') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius, 8px)',
              fontSize: 14,
              maxWidth: '80vw',
              background: 'var(--bg-card, #fff)',
              color: 'var(--text-primary, #211E1A)',
              border: `1px solid ${t.type === 'error' ? 'var(--color-danger, #BE123C)' : t.type === 'success' ? 'var(--color-success, #4F7A52)' : 'var(--border, #ECE8E2)'}`,
              boxShadow: 'var(--shadow-popover, 0 8px 28px rgba(40,32,24,0.12))',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ---------- Confirm ----------

export interface ConfirmOptions {
  title?: string
  message?: string
  okText?: string
  cancelText?: string
  danger?: boolean
  items?: string[]
}

interface ConfirmContextValue {
  confirm: (opts?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { visible: boolean }) | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({ visible: true, ...opts })
    })
  }, [])

  function close(result: boolean) {
    setState((s) => (s ? { ...s, visible: false } : s))
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  // Esc 取消
  useEffect(() => {
    if (!state?.visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const danger = state?.danger !== false
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.visible && (
        <div
          className={`modal-overlay confirm-overlay confirm-overlay--${danger ? 'danger' : 'safe'}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false)
          }}
        >
          <div className="modal confirm-modal">
            <div className="confirm-modal__glow" aria-hidden="true"></div>
            <div className="modal__header confirm-modal__header">
              <div className="confirm-modal__mark" aria-hidden="true">{danger ? '!' : '✓'}</div>
              <div>
                <div className="confirm-modal__eyebrow">{danger ? '危险操作' : '确认操作'}</div>
                <h3 className="modal__title confirm-modal__title">{state?.title || '确认操作'}</h3>
              </div>
              <button className="btn btn--icon btn--ghost confirm-modal__close" aria-label="关闭" onClick={() => close(false)}>
                &times;
              </button>
            </div>
            <div className="modal__body confirm-modal__body">
              {state?.message && <p className="confirm-modal__message">{state.message}</p>}
              {state?.items && state.items.length > 0 && (
                <div className="confirm-modal__list">
                  {state.items.map((item, i) => (
                    <div className="confirm-modal__item" key={i}>{item}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal__footer confirm-modal__footer">
              <button className="btn btn--secondary" onClick={() => close(false)}>
                {state?.cancelText || '取消'}
              </button>
              <button className={`btn btn--${danger ? 'danger' : 'primary'} confirm-modal__ok`} onClick={() => close(true)}>
                {state?.okText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
