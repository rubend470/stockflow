import type { ReactElement } from 'react'

interface NavIconProps {
  name: string
}

export function NavIcon({ name }: NavIconProps) {
  const icons: Record<string, ReactElement> = {
    home: (
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
    ),
    sales: (
      <path d="M6 7h12l-1.5 10.5a1 1 0 0 1-1 .85H8.5a1 1 0 0 1-1-.85L6 7Zm2-3h8l1 2H7l1-2Z" />
    ),
    pos: (
      <path d="M7 8h10v2H7V8Zm0 4h7v2H7v-2Zm-2 8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5Z" />
    ),
    invoice: (
      <path d="M8 4h8l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 8h4v2h-4v-2Zm0-4h6v2h-6V8Z" />
    ),
    cash: (
      <path d="M4 7h16v10H4V7Zm2 2v6h12V9H6Zm2 1h8v4H8v-4Z" />
    ),
    inventory: (
      <path d="M4 8 12 3l8 5v9l-8 5-8-5V8Zm8 2.2 6-3.75V14l-6 3.75V10.2ZM6 8.45 10 10.8v6.95l-4-2.5V8.45Z" />
    ),
    products: (
      <path d="M5 6h14v12H5V6Zm2 2v8h10V8H7Zm2 2h6v2H9v-2Z" />
    ),
    stock: (
      <path d="M6 5h12v14H6V5Zm2 2v10h8V7H8Zm1 2h6v2H9V9Zm0 4h4v2H9v-2Z" />
    ),
    movements: (
      <path d="M7 7h10v2H7V7Zm0 4h7v2H7v-2Zm-2 6 3-3h10l3 3H5Z" />
    ),
    clients: (
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 7a8 8 0 0 1 16 0H4Z" />
    ),
    debts: (
      <path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 4v4.59l3.3 3.3 1.4-1.42L14 10.17V7h-1Z" />
    ),
    finance: (
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 2.2 5.5 2.75L12 10.7 6.5 7.95 12 5.2ZM6 9.8l6 3 6-3v6.9l-6 3-6-3V9.8Z" />
    ),
    currency: (
      <path d="M12 3a9 9 0 1 0 9 9A9 9 0 0 0 12 3Zm1 4v1.1A3 3 0 0 1 15 11h-2a1 1 0 0 0 0 2h1v1h-2v1h2v1h-2a1 1 0 0 0 0 2h1.1A3 3 0 0 1 11 15v-1.1A3 3 0 0 1 8 11h2a1 1 0 0 0 0-2H9V8h2V7h-2V6h2Z" />
    ),
    payments: (
      <path d="M4 8h16v8H4V8Zm2 2v4h12v-4H6Zm3 1h6v2H9v-2Z" />
    ),
    reports: (
      <path d="M6 18V8h2v10H6Zm4-4v4h2v-4h-2Zm4-3v7h2v-7h-2Zm4 5v2h2v-2h-2Z" />
    ),
    admin: (
      <path d="M12 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-7 9a7 7 0 0 1 14 0H5Z" />
    ),
    users: (
      <path d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM2 19a6 6 0 0 1 12 0H2Zm14 0a6 6 0 0 1 9 0H16Z" />
    ),
    settings: (
      <path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm8.5 4a7.5 7.5 0 0 1-.2 1.8l2 1.5-2 3.5-2.4-1a7.7 7.7 0 0 1-1.6.9l-.4 2.6H9.1l-.4-2.6a7.7 7.7 0 0 1-1.6-.9l-2.4 1-2-3.5 2-1.5a7.5 7.5 0 0 1 0-3.6l-2-1.5 2-3.5 2.4 1a7.7 7.7 0 0 1 1.6-.9l.4-2.6h5.8l.4 2.6a7.7 7.7 0 0 1 1.6.9l2.4-1 2 3.5-2 1.5c.1.6.2 1.2.2 1.8Z" />
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      {icons[name] ?? icons.home}
    </svg>
  )
}
