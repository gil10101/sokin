"use client"

import dynamic from "next/dynamic"
import React, { Suspense, useEffect, useState } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"

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

  // Responsive height calculation
  const getResponsiveHeight = () => {
    if (!viewportHeight) return "300px"

    const heightPercent = viewportHeight < 600 ? 35 : viewportHeight < 800 ? 32 : 30
    const minHeight = viewportHeight < 600 ? 250 : viewportHeight < 800 ? 280 : 300
    const maxHeight = viewportHeight < 600 ? 320 : viewportHeight < 800 ? 350 : 380

    return `clamp(${minHeight}px, ${heightPercent}vh, ${maxHeight}px)`
  }

  return (
    <div
      className="relative w-full pointer-events-none"
      style={{
        height: getResponsiveHeight(),
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
          dpr={viewportHeight < 600 ? [1, 1.2] : [1, 1.5]} // Responsive DPR based on viewport height
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
                  >
          <Lights />
          <Suspense fallback={null}>
            <TwistedTorus isMobile={true} />
          </Suspense>
        </Canvas>
      </Suspense>
    </div>
  )
}

// Lights component to avoid JSX type issues
function Lights() {
  const { scene } = useThree()

  useEffect(() => {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 512
    directionalLight.shadow.mapSize.height = 512
    scene.add(directionalLight)

    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 0.2)
    pointLight.position.set(-5, -5, -5)
    scene.add(pointLight)

    return () => {
      scene.remove(ambientLight)
      scene.remove(directionalLight)
      scene.remove(pointLight)
    }
  }, [scene])

  return null
}

export default MobileHero3DScene
