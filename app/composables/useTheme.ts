// 主题管理：light / dark / system，持久化到 localStorage
export const useTheme = () => {
  const theme = useState<'light' | 'dark' | 'system'>('theme', () => 'dark')

  const isDark = (t: string) =>
    t === 'dark' || (t === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const apply = (t: string) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('light', !isDark(t))
  }

  const init = () => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
    if (saved) theme.value = saved
    apply(theme.value)
  }

  const set = (t: 'light' | 'dark' | 'system') => {
    theme.value = t
    if (typeof window !== 'undefined') localStorage.setItem('theme', t)
    apply(t)
  }

  const toggle = () => set(theme.value === 'dark' ? 'light' : 'dark')

  return { theme, init, set, toggle, isDark }
}
