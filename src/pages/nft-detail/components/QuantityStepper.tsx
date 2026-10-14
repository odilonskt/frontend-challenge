import { MinusIcon, PlusIcon } from '@/shared/icons'
import { Button } from '@/shared/ui/button'

export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Diminuir quantidade"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <MinusIcon aria-hidden="true" />
      </Button>
      <span aria-live="polite" className="w-6 text-center text-title font-bold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Aumentar quantidade"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
      <span className="text-caption text-muted-foreground">máx. {max}</span>
    </div>
  )
}
