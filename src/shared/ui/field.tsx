import { cloneElement, useId, type InputHTMLAttributes, type ReactElement } from 'react'
import { cn } from '@/shared/lib/cn'

export const inputClass =
  'h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive disabled:opacity-60'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  className?: string
  /** A single form control; Field wires id, aria-invalid and aria-describedby into it. */
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
}

/** Label + control + associated error message. */
export function Field({ label, required, error, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label htmlFor={id} className="text-sm">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} role="alert" className="-mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
