/**
 * Auth 页 —— 登录 / 注册 / 首个管理员创建合一（由 Novel-KV auth.js 各模式合并）。
 * 干净路径下无需 DB 安装引导（DATABASE_URL 来自 .env），只保留 bootstrap-admin。
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi, getToken } from '../lib/api'
import { useSession } from '../context/SessionContext'

type Mode = 'login' | 'register'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, register, refresh } = useSession()

  const [mode, setMode] = useState<Mode>(() => {
    const state = (location.state as { mode?: Mode } | null)?.mode
    return state === 'register' ? 'register' : 'login'
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [msg, setMsg] = useState('')
  const [needsBootstrap, setNeedsBootstrap] = useState(false)
  const [registerMode, setRegisterMode] = useState<'invite' | 'open' | 'closed'>('invite')
  const [busy, setBusy] = useState(false)

  function next(): string {
    const state = (location.state as { next?: string } | null)?.next
    return state || sessionStorage.getItem('auth_next') || '/profile'
  }

  function finish() {
    sessionStorage.removeItem('auth_next')
    navigate(next(), { replace: true })
  }

  useEffect(() => {
    if (getToken() && user) {
      navigate('/profile', { replace: true })
      return
    }
    void authApi
      .bootstrapStatus()
      .then((r) => setNeedsBootstrap(r.needsBootstrap))
      .catch(() => {})
    if (mode === 'register') {
      void authApi
        .registerStatus()
        .then((r) => setRegisterMode(r.mode as 'invite' | 'open' | 'closed'))
        .catch(() => {})
    }
  }, [mode, user, navigate])

  async function doLogin() {
    setBusy(true)
    setMsg('')
    try {
      const u = await login(username.trim(), password, false)
      if (needsBootstrap && u.role !== 'admin') {
        await logoutSession()
        setMsg('这个账号不是管理员')
        return
      }
      finish()
    } catch (err) {
      setMsg((err as Error).message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  async function logoutSession() {
    await authApi.logout()
    await refresh()
  }

  async function doRegister() {
    setBusy(true)
    setMsg('')
    try {
      if (needsBootstrap) {
        await authApi.bootstrapAdmin(username.trim(), password)
      } else {
        await authApi.register(username.trim(), password, invite.trim())
      }
      await refresh()
      finish()
    } catch (err) {
      setMsg((err as Error).message || '注册失败')
    } finally {
      setBusy(false)
    }
  }

  const showInvite = mode === 'register' && !needsBootstrap && registerMode === 'invite'

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-card">
          <Link to="/" className="header__logo auth-brand" aria-label="返回首页">
            <span className="header__logo-icon"><span className="header__logo-emoji">📚</span></span>
            知舟
          </Link>
          <p className="auth-contact">
            {needsBootstrap ? '首次进入请创建管理员账号' : mode === 'register' ? '创建账号后继续阅读' : '请登录后继续阅读'}
          </p>
          <div className="auth-fields">
            <label className="auth-field">
              <input className="form-input" placeholder=" " autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <span>账号</span>
            </label>
            <label className="auth-field">
              <input className="form-input" type="password" placeholder=" " autoComplete={needsBootstrap ? 'new-password' : mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <span>密码</span>
            </label>
            {showInvite && (
              <label className="auth-field" id="authInviteField">
                <input className="form-input" placeholder=" " value={invite} onChange={(e) => setInvite(e.target.value)} />
                <span>邀请码（注册时填写）</span>
              </label>
            )}
            {mode === 'login' && !needsBootstrap && (
              <button className="auth-submit" disabled={busy} onClick={() => void doLogin()}>登录</button>
            )}
            {needsBootstrap ? (
              <button className="auth-submit" disabled={busy} onClick={() => void doRegister()}>创建管理员</button>
            ) : (
              <>
                <div className="auth-divider"><span>或</span></div>
                <button className="auth-register" disabled={busy || registerMode === 'closed'} onClick={() => void doRegister()}>
                  {mode === 'register' ? '创建账号' : '注册'}
                </button>
              </>
            )}
            {!needsBootstrap && (
              <button
                className="auth-link-toggle"
                onClick={() => {
                  setMsg('')
                  setMode((m) => (m === 'login' ? 'register' : 'login'))
                }}
              >
                {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
              </button>
            )}
            {registerMode === 'closed' && mode === 'register' && <p className="auth-message">注册已关闭，请联系管理员</p>}
            {msg && <p className="auth-message">{msg}</p>}
            <div className="auth-footer">
              <Link className="auth-home" to="/">返回首页</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
