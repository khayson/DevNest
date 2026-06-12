import type { ReactNode } from "react"
import { Reorder, useDragControls } from "framer-motion"
import { GripVertical } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface ReorderableCardListProps<T extends string> {
  values: T[]
  onReorder: (next: T[]) => void
  children: ReactNode
  className?: string
}

export function ReorderableCardList<T extends string>({
  values,
  onReorder,
  children,
  className,
}: ReorderableCardListProps<T>) {
  return (
    <Reorder.Group
      axis="y"
      values={values}
      onReorder={onReorder}
      className={cn("flex flex-col gap-4 sm:gap-5", className)}
    >
      {children}
    </Reorder.Group>
  )
}

interface ReorderableCardProps<T extends string> {
  value: T
  label: string
  children: ReactNode
  className?: string
}

export function ReorderableCard<T extends string>({
  value,
  label,
  children,
  className,
}: ReorderableCardProps<T>) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "relative list-none rounded-xl",
        "focus-within:ring-2 focus-within:ring-primary/30",
        className
      )}
      whileDrag={{
        scale: 1.01,
        boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        zIndex: 50,
      }}
    >
      <div className="group/card relative">
        <button
          type="button"
          aria-label={`Drag to reorder ${label}`}
          title="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className={cn(
            "absolute left-2 top-3 z-10 flex h-8 w-8 cursor-grab items-center justify-center rounded-md",
            "border border-border/80 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm",
            "opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100",
            "transition-opacity hover:text-foreground active:cursor-grabbing"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="pl-10 sm:pl-6">{children}</div>
      </div>
    </Reorder.Item>
  )
}
