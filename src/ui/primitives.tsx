import { cva, type VariantProps } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { CircleAlert } from 'lucide-react'
import {
  cloneElement, forwardRef, useId,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { twMerge } from 'tailwind-merge'

export const cn = (...c: ClassValue[]) => twMerge(clsx(c))

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-deep',
        secondary: 'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        danger: 'bg-danger text-danger-fg hover:bg-danger/90',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-12 px-6' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>>(
  ({ className, variant, size, ...p }, ref) => <button ref={ref} className={cn(button({ variant, size }), className)} {...p} />,
)

// Field boxes share the `.control` class from index.css (border, hover, focus, error, disabled).
const controlCls = 'control h-10 w-full px-3 text-sm placeholder:text-fg-subtle'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(controlCls, className)} {...p} />
))

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(controlCls, 'control-select pr-8', className)} {...p} />
))

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('control min-h-20 w-full px-3 py-2.5 text-sm placeholder:text-fg-subtle', className)} {...p} />
))

/** A number field with its unit inside the border ("14 dní", "21 %"). */
export const InputAffix = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unit: string }>(({ unit, className, ...p }, ref) => (
  <div className={cn('control flex h-10 w-full items-stretch', className)}>
    <input ref={ref} className="min-w-0 flex-1 bg-transparent px-3 text-right text-sm tabular-nums outline-none" {...p} />
    <span className="flex items-center rounded-r-[3px] border-l border-line bg-surface-2 px-3 text-sm text-fg-muted">{unit}</span>
  </div>
))

type ControlProps = { id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: boolean }

/**
 * Label above, control, then a hint or an error under it. Wires the label, hint and error to the control,
 * so the child must be one element that passes `id` and `aria-*` on to its input.
 */
export function Labeled({ label, hint, error, required, className, children }: {
  label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string; children: ReactElement<ControlProps>
}) {
  const id = useId()
  const controlId = children.props.id ?? `${id}-control`
  const noteId = `${id}-note`
  const note = error || hint
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-fg">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 font-normal text-fg-muted">*</span>}
      </label>
      {cloneElement(children, {
        id: controlId,
        required: required || undefined,
        'aria-describedby': note ? noteId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={noteId} className="flex items-start gap-1 text-xs font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="max-w-prose text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Field({ label, hint, error, required, className, inputClassName, ...p }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; hint?: ReactNode; error?: string; inputClassName?: string
}) {
  return (
    <Labeled label={label} hint={hint} error={error} required={required} className={className}>
      <Input className={inputClassName} {...p} />
    </Labeled>
  )
}

export function Checkbox({ label, hint, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-start gap-2 text-sm', className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {...p} />
      <span className="flex flex-col gap-0.5">
        {label}
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </span>
    </label>
  )
}

/** Pale warning box above a form that lists every mistake; each item moves focus to its field. */
export function ErrorSummary({ title, errors }: { title: string; errors: { id: string; message: string }[] }) {
  if (errors.length === 0) return null
  return (
    <div role="alert" className="rounded-lg bg-warning-chip px-4 py-3 text-sm text-warning-chip-fg">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-inside list-disc">
        {errors.map((e) => (
          <li key={e.id}>
            {/* A button, not a #link: the app uses the hash for routing. */}
            <button type="button" className="underline underline-offset-2" onClick={() => document.getElementById(e.id)?.focus()}>{e.message}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-surface', className)}>{children}</div>
}

/** One radio option as a card. Wrap a set in `role="radiogroup"` with an `aria-label`. */
export function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? 'border-accent bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="text-sm font-medium text-fg">{title}</div>
      <div className="mt-0.5 text-xs text-fg-muted">{hint}</div>
    </button>
  )
}

/** One setting as a row: title and description on the left, the control on the right. Rows go in one Card. */
export function SettingRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0 max-w-prose flex-1 space-y-0.5">
        <div className="text-sm font-medium text-fg">{title}</div>
        {hint && <div className="text-xs text-fg-muted">{hint}</div>}
      </div>
      <div className="w-full sm:w-56">{children}</div>
    </div>
  )
}
