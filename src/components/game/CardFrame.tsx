'use client'
import React from 'react'

const RARITY: Record<string, {
  b1: string; b2: string; b3: string
  glow: string; bg1: string; bg2: string
  orb1: string; orb2: string; orb3: string
  fullart: boolean
}> = {
  common: {
    b1:'#8a8f9e', b2:'#b0b5c2', b3:'#6a6f7e',
    glow:'#9ca3af', bg1:'#0e0f14', bg2:'#0a0b10',
    orb1:'#1e2030', orb2:'#2a2d3a', orb3:'#1e2030',
    fullart: false,
  },
  rare: {
    b1:'#1a4a9e', b2:'#60a5fa', b3:'#0f2d7a',
    glow:'#3b82f6', bg1:'#080c1a', bg2:'#060a14',
    orb1:'#0a1a40', orb2:'#0f2255', orb3:'#200a30',
    fullart: false,
  },
  epic: {
    b1:'#7a2ab5', b2:'#d580ff', b3:'#5a1a8a',
    glow:'#a855f7', bg1:'#0c080f', bg2:'#08060c',
    orb1:'#2a0a50', orb2:'#3a1265', orb3:'#300a40',
    fullart: true,
  },
  legendary: {
    b1:'#c8a84b', b2:'#f5d97a', b3:'#8b6914',
    glow:'#f59e0b', bg1:'#0f0c06', bg2:'#0a0804',
    orb1:'#2a1a00', orb2:'#1a2060', orb3:'#3d0a0a',
    fullart: true,
  },
  void: {
    b1:'#5a1aee', b2:'#c084fc', b3:'#3a0acc',
    glow:'#7b2bff', bg1:'#06020f', bg2:'#04010c',
    orb1:'#1a0050', orb2:'#0a003a', orb3:'#2a0060',
    fullart: true,
  },
}

interface CardFrameProps {
  rarity: string
  children?: React.ReactNode
  cost?: number | null
  atk?: number | null
  def?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

export function CardFrame({ rarity, children, cost, atk, def, size = 'sm', className = '', style = {} }: CardFrameProps) {
  const statSize  = size === 'lg' ? 42 : size === 'md' ? 34 : 30
  const statFont  = size === 'lg' ? 16 : size === 'md' ? 14 : 13
  const statInset = size === 'lg' ? 6  : size === 'md' ? 5  : 4
  const r = RARITY[rarity] ?? RARITY.common
  const showStats = cost != null || atk != null || def != null

  const borderGrad = `linear-gradient(145deg, ${r.b1} 0%, ${r.b2} 25%, ${r.b3} 50%, ${r.b2} 75%, ${r.b1} 100%)`

  return (
    <div
      className={className}
      style={{
        padding: '2.5px',
        borderRadius: 12,
        background: borderGrad,
        boxShadow: `0 0 16px ${r.glow}44`,
        ...style,
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 10,
        background: r.fullart
          ? `linear-gradient(160deg, ${r.orb1} 0%, ${r.orb2} 50%, ${r.bg1} 100%)`
          : `linear-gradient(135deg, ${r.bg1} 0%, ${r.bg2} 100%)`,
        overflow: 'hidden',
      }}>

        {/* Artwork */}
        {children}

        {/* Overlay dégradé bas (full art) */}
        {r.fullart && (
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(to bottom, transparent 40%, ${r.bg1}cc 100%)`, pointerEvents:'none' }} />
        )}

        {/* Ambient glow */}
        {r.fullart && (
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 30%, ${r.glow}1a 0%, transparent 65%)`, pointerEvents:'none' }} />
        )}

        {/* Void grid */}
        {rarity === 'void' && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none',
            background:`repeating-linear-gradient(45deg, ${r.glow}08 0px, ${r.glow}08 1px, transparent 1px, transparent 8px)` }} />
        )}

        {/* Point lumineux haut centre */}
        <div style={{ position:'absolute', top:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:r.glow, boxShadow:`0 0 6px ${r.glow}`, pointerEvents:'none' }} />

        {/* Étoile haut droite */}
        <div style={{ position:'absolute', top:4, right:5, width:11, height:11, background:r.b2, clipPath:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', opacity:.9, pointerEvents:'none' }} />

        {/* Coins haut */}
        <div style={{ position:'absolute', top:4, left:4, width:1.5, height:22, background:`linear-gradient(to bottom, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:4, left:4, width:22, height:1.5, background:`linear-gradient(to right, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:4, right:4, width:1.5, height:22, background:`linear-gradient(to bottom, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:4, right:4, width:22, height:1.5, background:`linear-gradient(to left, ${r.b2}, transparent)`, pointerEvents:'none' }} />

        {/* Coins bas */}
        <div style={{ position:'absolute', bottom:4, left:4, width:1.5, height:20, background:`linear-gradient(to top, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:4, left:4, width:20, height:1.5, background:`linear-gradient(to right, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:4, right:4, width:1.5, height:20, background:`linear-gradient(to top, ${r.b2}, transparent)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:4, right:4, width:20, height:1.5, background:`linear-gradient(to left, ${r.b2}, transparent)`, pointerEvents:'none' }} />

        {/* Losange bas centre */}
        <div style={{ position:'absolute', bottom:9, left:'50%', width:10, height:10, background:r.bg1, border:`1.5px solid ${r.b2}`, transform:'translateX(-50%) rotate(45deg)', pointerEvents:'none' }} />

        {/* Orbes coins (standard) */}
        {!r.fullart && <>
          <div style={{ position:'absolute', top:5, left:5, width:26, height:26, borderRadius:'50%', background:`linear-gradient(135deg, ${r.orb1}, ${r.orb2})`, border:`1.5px solid ${r.b2}`, boxShadow:`0 0 6px ${r.glow}55`, pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:5, left:5, width:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg, ${r.orb2}, ${r.orb1})`, border:`1.5px solid ${r.b2}`, pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:5, right:5, width:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg, ${r.orb3}, ${r.orb1})`, border:`1.5px solid ${r.b2}`, pointerEvents:'none' }} />
        </>}

        {/* Stats */}
        {showStats && <>
          {cost != null && (
            <div style={{ position:'absolute', top:statInset, left:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`${r.bg1}f0`, border:`2px solid ${r.b2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:r.b2, fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:`0 0 6px ${r.glow}66` }}>
              {cost}
            </div>
          )}
          {atk != null && (
            <div style={{ position:'absolute', bottom:statInset, left:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`${r.bg1}f0`, border:'2px solid #ff6b4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:'#ff9a7a', fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:'0 0 6px #ff6b4a55' }}>
              {atk}
            </div>
          )}
          {def != null && (
            <div style={{ position:'absolute', bottom:statInset, right:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`${r.bg1}f0`, border:'2px solid #60a5fa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:'#93c5fd', fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:'0 0 6px #60a5fa55' }}>
              {def}
            </div>
          )}
        </>}
      </div>
    </div>
  )
}
