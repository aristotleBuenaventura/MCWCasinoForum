import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { Link, useLocation, type LinkProps } from 'react-router-dom'
import {
  DEFAULT_LANG,
  LANG_LABELS,
  LANGS,
  messages,
  type Lang,
  type MessageKey,
} from './messages'
import { getActiveThreadTranslations } from './threadTranslations'

type LocaleContextValue = {
  lang: Lang
  t: (key: MessageKey) => string
  localizePath: (path: string) => string
  switchLangPath: (next: Lang) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function detectLangFromPath(pathname: string): Lang {
  return pathname === '/bn' || pathname.startsWith('/bn/') ? 'bn' : 'en'
}

export function stripLangPrefix(pathname: string): string {
  if (pathname === '/bn') return '/'
  if (pathname.startsWith('/bn/')) {
    const rest = pathname.slice(3)
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  return pathname || '/'
}

export function withLangPrefix(path: string, lang: Lang): string {
  const [rawPath, qs] = path.split('?')
  let p = rawPath || '/'
  if (!p.startsWith('/')) p = `/${p}`
  p = stripLangPrefix(p)
  const prefixed = lang === 'bn' ? (p === '/' ? '/bn' : `/bn${p}`) : p
  return qs ? `${prefixed}?${qs}` : prefixed
}

export function LocaleProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const location = useLocation()

  const t = useCallback(
    (key: MessageKey) => messages[lang][key] ?? messages.en[key] ?? key,
    [lang],
  )

  const localizePath = useCallback((path: string) => withLangPrefix(path, lang), [lang])

  const switchLangPath = useCallback(
    (next: Lang) => {
      const base = stripLangPrefix(location.pathname)
      return withLangPrefix(`${base}${location.search}`, next)
    },
    [location.pathname, location.search],
  )

  const value = useMemo(
    () => ({ lang, t, localizePath, switchLangPath }),
    [lang, t, localizePath, switchLangPath],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

/** Link that keeps the current language prefix. Absolute paths like /communities become /bn/communities. */
export function LocaleLink({ to, ...rest }: LinkProps) {
  const { localizePath } = useLocale()
  const next =
    typeof to === 'string'
      ? localizePath(to)
      : { ...to, pathname: to.pathname != null ? localizePath(to.pathname) : to.pathname }
  return <Link to={next} {...rest} />
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, switchLangPath, t } = useLocale()
  const location = useLocation()

  const hrefFor = (code: Lang) => {
    // On a thread page, jump to the WPML translation id when available
    const bare = stripLangPrefix(location.pathname)
    const m = bare.match(/^\/thread\/([^/]+)/)
    if (m) {
      const map = getActiveThreadTranslations()
      const translatedId = map?.[code]
      if (translatedId) {
        return withLangPrefix(`/thread/${translatedId}${location.search}`, code)
      }
    }
    return switchLangPath(code)
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role="group" aria-label={t('lang.label')}>
      {LANGS.map((code) => {
        const active = code === lang
        return (
          <a
            key={code}
            href={hrefFor(code)}
            className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
              active
                ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[color-mix(in_oklab,var(--color-gold)_12%,transparent)]'
                : 'border-[var(--color-border)] prose-muted hover:text-[var(--color-gold)]'
            }`}
            aria-current={active ? 'true' : undefined}
            hrefLang={code}
          >
            {LANG_LABELS[code]}
          </a>
        )
      })}
    </div>
  )
}

export { DEFAULT_LANG, LANGS, LANG_LABELS }
export type { Lang, MessageKey }
