'use client'

import Link from 'next/link'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbsProps = {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</span>
            )}
            {index < items.length - 1 && (
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
