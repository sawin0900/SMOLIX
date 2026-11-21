export type AccountNotice = {
  id: string
  level: 'info' | 'warning' | 'critical'
  title: string
  text: string
  href?: string
}