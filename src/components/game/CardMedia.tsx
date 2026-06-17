'use client'
import React from 'react'

function isVideo(url: string) {
  return /\.(webm|mp4|ogg|mov)(\?.*)?$/i.test(url)
}

interface CardMediaProps {
  src: string
  alt: string
  className?: string
}

const GPU: React.CSSProperties = {
  transform: 'translateZ(0)',
  willChange: 'transform',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
}

export function CardMedia({ src, alt, className = 'absolute inset-0 w-full h-full object-cover' }: CardMediaProps) {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className={className}
        style={{ objectFit: 'cover', ...GPU }}
      />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={GPU} />
}
