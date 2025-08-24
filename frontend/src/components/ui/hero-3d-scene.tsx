"use client"

import dynamic from "next/dynamic"
import { Suspense, useEffect, useState } from "react"

// Dynamically import Canvas to avoid SSR issues
const Canvas = dynamic(() => import("@react-three/fiber").then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cream/30"></div>
    </div>
  )
})

// Dynamically import the TwistedTorus to avoid SSR issues
const TwistedTorus = dynamic(() => import("./twisted-torus").then(mod => ({ default: mod.TwistedTorus })), {
  ssr: false
})

export function Hero3DScene() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const cameraSettings = isMobile 
    ? { position: [0, 0, 22] as [number, number, number], fov: 65 }
    : { position: [0, 0, 18] as [number, number, number], fov: 55 }

  return (
    <div className="relative w-full h-full">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cream/30"></div>
        </div>
      }>
        <Canvas
          camera={{ 
            position: cameraSettings.position, 
            fov: cameraSettings.fov,
            near: 0.1,
            far: 1000
          }}
          style={{ 
            background: 'transparent',
            width: '100%',
            height: '100%'
          }}
          gl={{ 
            antialias: true, 
            alpha: true,
            preserveDrawingBuffer: true
          }}
          dpr={[1, 2]}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={0.8}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          
          <Suspense fallback={null}>
            <TwistedTorus isMobile={isMobile} />
          </Suspense>
        </Canvas>
      </Suspense>
    </div>
  )
}
