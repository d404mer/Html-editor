import { useEffect, useState } from 'react'

export function useImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = src

    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setImage(null)
    }

    return () => {
      cancelled = true
    }
  }, [src])

  return image
}
