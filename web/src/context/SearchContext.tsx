/**
 * 搜索上下文 —— Home 页与 SiteHeader 搜索框共享查询词。
 * 仅 / 路由消费；其他页面 setQuery 会触发导航到首页查询。
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const value = useMemo(() => ({ query, setQuery }), [query])
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}
