'use client'

import { useEffect } from 'react'

export default function FontLoader() {
  useEffect(() => {
    const handleFontLoad = () => {
      const link = document.querySelector('link[rel="stylesheet"][media="print"]') as HTMLLinkElement
      if (link) {
        link.media = 'all'
      }
    }

    // Check if font is already loaded
    const link = document.querySelector('link[rel="stylesheet"][media="print"]') as HTMLLinkElement
    if (link && link.sheet) {
      handleFontLoad()
      return // No cleanup needed
    }

    // Add event listener for when font loads
    const fontLink = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]') as HTMLLinkElement
    if (fontLink) {
      fontLink.addEventListener('load', handleFontLoad)
      return () => fontLink.removeEventListener('load', handleFontLoad)
    }

    // Explicitly return undefined if no cleanup needed
    return undefined
  }, [])

  return null
}