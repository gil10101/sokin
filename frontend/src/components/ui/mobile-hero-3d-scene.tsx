"use client"

import dynamic from "next/dynamic"
import React, { Suspense, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { isWebGLAvailable } from "@/lib/webgl"

// Dynamically import the TwistedTorus to avoid SSR issues
const TwistedTorus = dynamic(() => import("./twisted-torus"), {
  ssr: false
})

function MobileHero3DScene() {
  /**
   * Resolved after mount, never during render: the server cannot know whether
   * the visitor's browser can make a WebGL context, so deciding during render
   * would produce a hydration mismatch. Until it resolves we render nothing
   * rather than mounting a Canvas that may throw.
   */
  const [webglAvailable, setWebglAvailable] = useState(false)
  useEffect(() => {
    setWebglAvailable(isWebGLAvailable())
  }, [])

  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    const updateDevice = () => {
      setViewportHeight(window.innerHeight)
    }

    updateDevice()
    window.addEventListener('resize', updateDevice)
    return () => window.removeEventListener('resize', updateDevice)
  }, [])

  // Responsive camera settings based on viewport
  const getCameraSettings = () => {
    if (!viewportHeight) {
      return {
        position: [0, 0, 10] as [number, number, number],
        fov: 85
      }
    }

    // Adjust camera distance based on screen height
    const cameraDistance = viewportHeight < 600 ? 8 : viewportHeight < 800 ? 9 : 10
    const fov = viewportHeight < 600 ? 90 : viewportHeight < 800 ? 87 : 85

    return {
      position: [0, 0, cameraDistance] as [number, number, number],
      fov
    }
  }

  const cameraSettings = getCameraSettings()

  /**
   * The slot in the hero owns the height, not this component.
   *
   * It used to measure the viewport and pick its own, which meant it rendered
   * at a placeholder 300px for one frame and then resized - and because the
   * canvas only mounts once WebGL has been checked and the dynamic import has
   * landed, the whole hero below it moved twice while the entry animation was
   * running. A slot that is already the right size cannot do that, and the
   * canvas simply fills whatever it is given.
   */
  return (
    <div
      className="relative w-full h-full pointer-events-none"
      style={{ overflow: "hidden" }}
    >
      {webglAvailable && (
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
          dpr={viewportHeight < 600 ? [1, 1.2] : [1, 1.5]} // Responsive DPR based on viewport height
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
                  >
          <Lights />
          <Suspense fallback={null}>
            <TwistedTorus isMobile={true} />
          </Suspense>
        </Canvas>
      </Suspense>
      )}
    </div>
  )
}

// Lights component using JSX declarations
function Lights() {
  return (
    <>
      <ambientLight args={[0xffffff, 0.5]} />
      <directionalLight 
        args={[0xffffff, 0.6]}
        position={[5, 5, 5]}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight 
        args={[0xffffff, 0.2]}
        position={[-5, -5, -5]}
      />
    </>
  )
}

export default MobileHero3DScene
