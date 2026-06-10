import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'

export type TableActionTone = 'default' | 'primary' | 'muted' | 'danger'

interface TableActionsProps {
  children: ReactNode
}

interface TableActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: TableActionTone
  icon?: TableActionIcon
}

export type TableActionIcon = 'edit' | 'delete' | 'view' | 'pay' | 'toggle' | 'receive' | 'cancel'

function ActionIcon({ name }: { name: TableActionIcon }) {
  const common: SVGProps<SVGSVGElement> = {
    className: 'table-action-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'edit':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
      )
    case 'delete':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
        </svg>
      )
    case 'view':
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'pay':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'toggle':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="4" />
          <circle cx="9" cy="12" r="2.5" />
        </svg>
      )
    case 'receive':
      return (
        <svg {...common}>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 20h14" />
        </svg>
      )
    case 'cancel':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 8 8 8" />
          <path d="m16 8-8 8" />
        </svg>
      )
    default:
      return null
  }
}

export function TableActions({ children }: TableActionsProps) {
  return <div className="table-action-group">{children}</div>
}

export function TableAction({
  tone = 'default',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: TableActionProps) {
  return (
    <button
      type={type}
      className={['table-action', `table-action--${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {icon && <ActionIcon name={icon} />}
      <span>{children}</span>
    </button>
  )
}
