"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-[3px] h-5 rounded-full bg-brand-gold flex-shrink-0" />
          <h2 className="text-[18px] font-semibold text-foreground tracking-tight">{title}</h2>
        </div>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground ml-[19px]">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
