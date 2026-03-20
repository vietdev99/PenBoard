import { FileText } from 'lucide-react'

interface FlowTOCProps {
  items: { name: string; title: string }[]
}

export default function FlowTOC({ items }: FlowTOCProps) {
  if (items.length === 0) return null

  return (
    <nav className="bg-card border border-border rounded-lg p-4 mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3">Table of Contents</h2>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.name}>
            <a
              href={`#flow-${item.name}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(`flow-${item.name}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
