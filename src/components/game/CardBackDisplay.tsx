'use client'

interface CardBackDisplayProps {
  gradient?: string | null
  pattern?: string | null
  imageUrl?: string | null
  className?: string
}

export function CardBackDisplay({ gradient, pattern, imageUrl, className = 'absolute inset-0' }: CardBackDisplayProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className={`${className} w-full h-full object-cover`} draggable={false} />
    )
  }
  return (
    <>
      {gradient && <div className={className} style={{ background: gradient }} />}
      {pattern  && <div className={className} style={{ background: pattern }} />}
    </>
  )
}
