'use client'
import React from 'react'
import Image from 'next/image'

function isVideo(url: string) {
  return /\.(webm|mp4|ogg|mov)(\?.*)?$/i.test(url)
}

interface CardMediaProps {
  src: string
  alt: string
  className?: string
  /** Tailles d'affichage pour que Next serve la bonne résolution. */
  sizes?: string
  /** Chargement prioritaire (carte focale : modale, reveal). */
  priority?: boolean
}

const GPU: React.CSSProperties = {
  transform: 'translateZ(0)',
  willChange: 'transform',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
}

export function CardMedia({
  src,
  alt,
  className = 'absolute inset-0 w-full h-full object-cover',
  sizes = '(max-width: 768px) 50vw, 240px',
  priority = false,
}: CardMediaProps) {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className={className}
        style={{ objectFit: 'cover', ...GPU }}
      />
    )
  }

  // next/image : redimensionnement automatique + AVIF/WebP + lazy par défaut.
  // `fill` remplit le parent positionné (les cadres de carte le sont déjà).
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
    />
  )
}
