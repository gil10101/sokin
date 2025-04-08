import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-medium font-outfit">{title}</h1>
        {description && <p className="text-cream/60 text-sm mt-1 font-outfit">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  )
}

