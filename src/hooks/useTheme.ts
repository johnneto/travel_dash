import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

const VARS = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'text',
  'text-2',
  'text-3',
  'accent',
  'accent-soft',
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  'good',
  'bad',
  'globe-ocean',
  'globe-land',
] as const
export type ThemeColors = Record<(typeof VARS)[number], string> & { dark: boolean }

function read(dark: boolean): ThemeColors {
  const cs = getComputedStyle(document.documentElement)
  const out = { dark } as ThemeColors
  for (const v of VARS)
    (out as Record<string, string | boolean>)[v] = cs.getPropertyValue(`--${v}`).trim()
  return out
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Resolves the theme preference, toggles the `dark` class and returns concrete colours (for SVG/WebGL). */
export function useApplyTheme(): ThemeColors {
  const theme = useStore((s) => s.theme)
  const [systemDark, setSystemDark] = useState(() => media().matches)
  useEffect(() => {
    const m = media()
    const on = () => setSystemDark(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  const [colors, setColors] = useState<ThemeColors>(() => read(dark))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    setColors(read(dark))
  }, [dark])
  return colors
}
