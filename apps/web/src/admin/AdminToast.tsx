import { useEffect } from 'react'

export function AdminToast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(id)
  }, [onClose, message])

  return (
    <div className={`admin-toast ${type === 'success' ? 'success' : 'error'}`} role="status">
      {message}
    </div>
  )
}