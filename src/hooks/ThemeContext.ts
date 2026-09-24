import { createContext, useContext } from 'react'
import type { ThemeColors } from './useTheme'

export const ThemeContext = createContext<ThemeColors | null>(null)
export const useColors = () => useContext(ThemeContext)!
