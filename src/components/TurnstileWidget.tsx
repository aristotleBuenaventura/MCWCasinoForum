import { useEffect, useRef } from 'react'

/** Cloudflare test sitekey. The API verifies tokens with siteverify. */
const SITEKEY = '1x00000000000000000000AA'

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  const existing = document.querySelector<HTMLScriptElement>('script[data-cf-turnstile]')
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile)
        else reject(new Error('Turnstile failed to load'))
      })
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')))
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.cfTurnstile = '1'
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile failed to load'))
    }
    script.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let widgetId: string | undefined
    let cancelled = false

    void loadScript()
      .then((api) => {
        if (cancelled || !hostRef.current) return
        widgetId = api.render(hostRef.current, {
          sitekey: SITEKEY,
          theme: 'dark',
          appearance: 'always',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current('')
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  return <div ref={hostRef} className="cf-turnstile-host" />
}
