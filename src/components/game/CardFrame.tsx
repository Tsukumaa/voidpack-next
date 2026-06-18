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
    b1:'#8a1a4a', b2:'#ec4899', b3:'#5a0f2e',
    glow:'#ec4899', bg1:'#0f0608', bg2:'#0a0406',
    orb1:'#2a0a18', orb2:'#3a1228', orb3:'#300a20',
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
  name?: string | null
  cost?: number | null
  atk?: number | null
  def?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  glow?: boolean
  hideStats?: boolean
}

export function CardFrame({ rarity, children, name, cost, atk, def, size = 'sm', className = '', style = {}, glow = true, hideStats = false }: CardFrameProps) {
  const statSize  = size === 'lg' ? 42 : size === 'md' ? 34 : 30
  const statFont  = size === 'lg' ? 16 : size === 'md' ? 14 : 13
  const statInset = size === 'lg' ? 6  : size === 'md' ? 5  : 4
  const r = RARITY[rarity] ?? RARITY.common
  const showStats = !hideStats && (cost != null || atk != null || def != null)

  const borderGrad = `linear-gradient(145deg, ${r.b1} 0%, ${r.b2} 25%, ${r.b3} 50%, ${r.b2} 75%, ${r.b1} 100%)`

  return (
    <div
      className={className}
      style={{
        padding: '2.5px',
        borderRadius: 12,
        background: borderGrad,
        boxShadow: glow ? `0 0 16px ${r.glow}44` : 'none',
        overflow: 'hidden',
        transform: 'translateZ(0)',
        isolation: 'isolate',
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
        transform: 'translateZ(0)',
      }}>

        {/* Artwork clippé aux coins */}
        <div style={{ position:'absolute', inset:0, borderRadius:8, overflow:'hidden', background:'#000', transform:'translateZ(0)', isolation:'isolate' }}>
          {children}
        </div>

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

        {/* Dégradé sombre haut — backdrop du nom */}
        {name && (
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'30%', zIndex:5, pointerEvents:'none',
            background:'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 40%, transparent 100%)' }} />
        )}

        {/* Nom centré en haut */}
        {name && (
          <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, pointerEvents:'none', display:'flex', justifyContent:'center', padding:'6px 28px 4px' }}>
            <span style={{ fontSize: size === 'lg' ? 13 : 9, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'.06em', textShadow:'0 1px 3px #000, 0 0 3px rgba(0,0,0,.85)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%', padding:'0 6px' }}>
              {name}
            </span>
          </div>
        )}

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

        {/* Icône VoidPack bas centre */}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:16, height:16, pointerEvents:'none', opacity:.9 }}>
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%', filter:`drop-shadow(0 0 3px ${r.glow})` }}>
            <circle cx="50" cy="50" r="22" fill={r.b2} />
            <circle cx="50" cy="50" r="13" fill={r.bg1} />
            <polygon points="50,2 58,42 98,50 58,58 50,98 42,58 2,50 42,42" fill={r.b2} />
          </svg>
        </div>

        {/* Stats */}
        {showStats && <>
          {cost != null && (
            <div style={{ position:'absolute', top:statInset, left:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, ${r.b2}cc, ${r.bg1}ee)`, border:`2px solid ${r.b2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:'#fff', fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:`0 0 8px ${r.glow}88, inset 0 1px 2px ${r.b2}66`, textShadow:'0 1px 3px #000' }}>
              {cost}
            </div>
          )}
          {atk != null && (
            <div style={{ position:'absolute', bottom:statInset, left:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, ${r.b2}cc, ${r.bg1}ee)`, border:`2px solid ${r.b2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:'#fff', fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:`0 0 8px ${r.glow}88, inset 0 1px 2px ${r.b2}66`, textShadow:'0 1px 3px #000' }}>
              {atk}
            </div>
          )}
          {def != null && (
            <div style={{ position:'absolute', bottom:statInset, right:statInset, width:statSize, height:statSize, borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, ${r.b2}cc, ${r.bg1}ee)`, border:`2px solid ${r.b2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:statFont, fontWeight:800, color:'#fff', fontFamily:'monospace', zIndex:10, pointerEvents:'none', boxShadow:`0 0 8px ${r.glow}88, inset 0 1px 2px ${r.b2}66`, textShadow:'0 1px 3px #000' }}>
              {def}
            </div>
          )}
        </>}
      </div>
    </div>
  )
}
