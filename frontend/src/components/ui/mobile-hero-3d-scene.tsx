"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

// Dynamically import Canvas to avoid SSR issues
const Canvas = dynamic(() => import("@react-three/fiber").then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => null
})

// Dynamically import the TwistedTorus to avoid SSR issues
const TwistedTorus = dynamic(() => import("./twisted-torus"), {
  ssr: false
})

function MobileHero3DScene() {
  const cameraSettings = { 
    position: [0, 0, 10] as [number, number, number], // Moved camera closer for bigger model
    fov: 85 // Increased field of view for more dramatic effect
  }

  return (
    <div
      className="relative w-full pointer-events-none"
      style={{
        height: "300px", // Increased height for bigger scene
        overflow: "hidden"
      }}
    >
      <Suspense fallback={null}>
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
          dpr={[1, 1.5]} // Lower DPR for mobile performance
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={0.6}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          <pointLight position={[-5, -5, -5]} intensity={0.2} />
          
          <Suspense fallback={null}>
            <TwistedTorus isMobile={true} />
          </Suspense>
        </Canvas>
      </Suspense>
    </div>
  )
}

export default MobileHero3DScene
