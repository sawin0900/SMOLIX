import { useEffect } from 'react'

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 2800)
    return () => window.clearTimeout(id)
  }, [onClose])

  return (
    <div className={`cabinet-toast ${type === 'success' ? 'success' : 'error'}`} role="status">
      {message}
    </div>
  )
}