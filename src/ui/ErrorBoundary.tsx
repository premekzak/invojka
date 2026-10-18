import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from './primitives'

/**
 * What a crashed screen shows instead of a blank page: what happened in plain words, that the data is safe, a way back,
 * and the error text to copy for a bug report. Saving only happens after a finished change (state/store.ts), so a
 * screen that failed to render has nothing half-done to write.
 */
function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const details = `${error.name}: ${error.message}\n${error.stack ?? ''}\n${location.hash} · ${navigator.userAgent}`
  return (
    <div className="grid place-items-center py-16">
      <Card className="max-w-lg space-y-4 p-8">
        <h1 className="font-display text-2xl font-bold">{t('crash.title')}</h1>
        <p className="text-sm">{t('crash.text')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry}>{t('crash.retry')}</Button>
          <Button variant="secondary" onClick={() => { location.hash = '#/'; onRetry() }}>{t('crash.home')}</Button>
          <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(details).then(() => setCopied(true), () => setCopied(false))}>
            {copied ? t('crash.copied') : t('crash.copy')}
          </Button>
        </div>
        <p className="font-mono text-xs break-words text-fg-muted">{error.message}</p>
      </Card>
    </div>
  )
}

/** Catches a render error below it (including dialogs rendered through portals) and shows the fallback. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Invojka screen crashed', error, info.componentStack)
  }

  render() {
    return this.state.error ? <Fallback error={this.state.error} onRetry={() => this.setState({ error: undefined })} /> : this.props.children
  }
}
