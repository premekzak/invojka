import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, cn } from './primitives'

/**
 * Back to the previous screen, before a detail screen's title (the owner, 2026-10-19: the title lines up with the box below,
 * the arrow may stick out, and it should stand out more). On wide screens it hangs in the margin left of the title; on
 * narrower ones, where there's no margin, it sits in the row. Put it in a `relative` wrapper together with the h1.
 */
export function BackButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Button variant="secondary" aria-label={t('common.back')} title={t('common.back')} onClick={() => history.back()}
      className={cn('size-10 px-0 xl:absolute xl:right-full xl:mr-4', className)}>
      <ArrowLeft className="size-5" strokeWidth={2.25} />
    </Button>
  )
}
