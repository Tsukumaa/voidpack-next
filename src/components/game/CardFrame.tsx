'use client'
import React from 'react'

const RARITY: Record<string, {
  b1: string; b2: string; b3: string
  glow: string; bg1: string; bg2: string
  orb1: string; orb2: string; orb3: string
  fullart: boolean
}> = {
  common: {
    b1:'#6a7060', b2:'#9aaa88', b3:'#4a5040',
    glow:'#8a9a78', bg1:'#0a0e08', bg2:'#080c06',
    orb1:'#141a10', orb2:'#1c2418', orb3:'#141a10',
    fullart: false,
  },
  rare: {
    b1:'#2a6a8a', b2:'#5ab0d8', b3:'#1a4a6a',
    glow:'#4a9ac8', bg1:'#060c10', bg2:'#040a0e',
    orb1:'#081828', orb2:'#0a2035', orb3:'#101828',
    fullart: false,
  },
  epic: {
    b1:'#6a2a8a', b2:'#b06adc', b3:'#4a1a6a',
    glow:'#9050cc', bg1:'#0a0610', bg2:'#08040e',
    orb1:'#180a28', orb2:'#221038', orb3:'#1a0830',
    fullart: true,
  },
  legendary: {
    b1:'#c8a84b', b2:'#f0d070', b3:'#8b6914',
    glow:'#d4a843', bg1:'#0e0c04', bg2:'#0a0802',
    orb1:'#221800', orb2:'#2a1e00', orb3:'#1e1000',
    fullart: true,
  },
  void: {
    b1:'#1a5a30', b2:'#5ecf8a', b3:'#0e3a1e',
    glow:'#2d7a4f', bg1:'#020e06', bg2:'#010a04',
    orb1:'#051408', orb2:'#081c0c', orb3:'#061008',
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
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  glow?: boolean
  hideStats?: boolean
}

export function CardFrame({ rarity, children, name, cost, atk, def, size = 'sm', className = '', style = {}, glow = true, hideStats = false }: CardFrameProps) {
  const statSize  = size === 'lg' ? 42 : size === 'md' ? 34 : size === 'xs' ? 18 : 30
  const statFont  = size === 'lg' ? 16 : size === 'md' ? 14 : size === 'xs' ? 9  : 13
  const statInset = size === 'lg' ? 6  : size === 'md' ? 5  : size === 'xs' ? 2  : 4
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
