"use client"

import dynamic from "next/dynamic"
import React, { Suspense, useEffect, useRef, useState } from "react"
import { useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import * as THREE from "three"

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

// Dynamically import Canvas to avoid SSR issues
const Canvas = dynamic(() => import("@react-three/fiber").then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => null
})

// Dynamically import the TwistedTorus to avoid SSR issues
const TwistedTorus = dynamic(() => import("./twisted-torus"), {
  ssr: false
})

function ScrollTriggered3DScene() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setIsMobile(width < 768)
      setViewportSize({ width, height })
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  useEffect(() => {
    // Don't run desktop animations on mobile
    if (isMobile) return
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    // Desktop only - initial positioning (relative to the 65% top position)
    gsap.set(canvas, {
      x: "25%", // Move right from center
      y: "-15%", // Adjust relative to new base position (65% - 15% = 50% from top)
      scale: 1,
      rotation: 0,
      opacity: 1
    })

    // Desktop only - section-based animations (relative to 65% base position)
    const desktopSections = [
      {
        trigger: "#hero",
        x: "25%",
        y: "-15%", // Maintains the same effective position (65% - 15% = 50%)
        scale: 1,
        rotation: 0,
        opacity: 1
      },
      {
        trigger: "#about",
        x: "-25%", // Balanced positioning for 50/50 layout
        y: "-20%", // Slightly higher than before for better flow
        scale: 0.8,
        rotation: 15,
        opacity: 0.9
      },
      {
        trigger: "#features",
        x: "25%",
        y: "-5%", // Adjusted for new base position
        scale: 0.6,
        rotation: -10,
        opacity: 0.7
      },
      {
        trigger: "#contact",
        x: "15%",
        y: "5%", // Adjusted for new base position
        scale: 0.5,
        rotation: 25,
        opacity: 0.5
      }
    ]

    const scrollTriggers: ScrollTrigger[] = []

    // Immediately position for hero section on load
    const heroSection = desktopSections[0]
    gsap.to(canvas, {
      x: heroSection.x,
      y: heroSection.y,
      scale: heroSection.scale,
      rotation: heroSection.rotation,
      opacity: heroSection.opacity,
      duration: 0.5,
      ease: "power2.out"
    })

    // DESKTOP: Section-based animations
    desktopSections.forEach((section, index) => {
      const trigger = ScrollTrigger.create({
        trigger: section.trigger,
        start: index === 0 ? "top top" : "top center",
        end: "bottom center",
        onEnter: () => {
          gsap.to(canvas, {
            x: section.x,
            y: section.y,
            scale: section.scale,
            rotation: section.rotation,
            opacity: section.opacity,
            duration: 1.2,
            ease: "power2.out"
          })
        },
        onEnterBack: () => {
          gsap.to(canvas, {
            x: section.x,
            y: section.y,
            scale: section.scale,
            rotation: section.rotation,
            opacity: section.opacity,
            duration: 1.2,
            ease: "power2.out"
          })
        }
      })

      scrollTriggers.push(trigger)
    })

    // Bottom of page effect for desktop (adjusted for 65% base position)
    const bottomPageEffect = ScrollTrigger.create({
      trigger: "footer",
      start: "top bottom-=100px",
      end: "bottom bottom",
      onEnter: () => {
        gsap.to(canvas, {
          x: "0%",
          y: "70%", // Adjusted relative to 65% base position
          scale: 1.6,
          rotation: 0,
          opacity: 0.9,
          duration: 1.8,
          ease: "power3.out"
        })
      },
      onLeaveBack: () => {
        const contactSection = desktopSections[3]
        gsap.to(canvas, {
          x: contactSection.x,
          y: contactSection.y,
          scale: contactSection.scale,
          rotation: contactSection.rotation,
          opacity: contactSection.opacity,
          duration: 1.2,
          ease: "power2.out"
        })
      }
    })

    scrollTriggers.push(bottomPageEffect)

    // Refresh ScrollTrigger on window resize
    const handleResize = () => {
      ScrollTrigger.refresh()
    }

    window.addEventListener('resize', handleResize)

    // Refresh ScrollTrigger after initial setup
    setTimeout(() => {
      ScrollTrigger.refresh()
    }, 100)

    return () => {
      scrollTriggers.forEach(trigger => trigger.kill())
      window.removeEventListener('resize', handleResize)
      ScrollTrigger.refresh()
    }
  }, [isMobile])

  // Calculate responsive dimensions based on viewport
  const getResponsiveSize = () => {
    if (!viewportSize.width) return { width: "70vw", height: "70vh" }

    const { width, height } = viewportSize
    const aspectRatio = width / height

    // Responsive sizing based on viewport dimensions
    let sizeFactor = 0.7 // Base factor

    // Adjust for very wide screens (ultra-wide monitors)
    if (aspectRatio > 2.5) {
      sizeFactor = 0.6
    }
    // Adjust for very tall screens (mobile landscape, tablets)
    else if (aspectRatio < 1.2) {
      sizeFactor = 0.65
    }
    // Adjust for standard desktop screens
    else if (width > 1920) {
      sizeFactor = 0.65
    }
    // Adjust for smaller desktop screens
    else if (width < 1200) {
      sizeFactor = 0.75
    }

    return {
      width: `${Math.min(sizeFactor * 100, 85)}vw`,
      height: `${Math.min(sizeFactor * 100, 85)}vh`
    }
  }

  const cameraSettings = {
    position: [0, 0, viewportSize.width > 1920 ? 20 : viewportSize.width < 1200 ? 16 : 18] as [number, number, number],
    fov: viewportSize.width < 1200 ? 60 : 55
  }

  // On mobile/tablet, render nothing here - we'll handle mobile canvas separately
  // Use consistent breakpoint with main component (768px)
  if (viewportSize.width < 768) {
    return null
  }

  const responsiveSize = getResponsiveSize()

  // Position 30% lower than center for better visual balance
  const initialPosition = {
    top: "65%", // 50% + 15% lower for better positioning
    left: "50%",
    transform: "translate(-50%, -50%)"
  }

  return (
    <div
      ref={canvasRef}
      className="fixed z-0 pointer-events-none"
      style={{
        width: responsiveSize.width,
        height: responsiveSize.height,
        top: initialPosition.top,
        left: initialPosition.left,
        transform: initialPosition.transform,
        transformOrigin: "center center",
        maxWidth: "1200px",
        maxHeight: "800px",
        overflow: "visible"
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
            dpr={viewportSize.width < 1200 ? [1, 1.5] : [1, 2]}
            resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
          >
            <Lights />
            <Suspense fallback={null}>
              <TwistedTorus isMobile={false} />
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    scene.add(directionalLight)

    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 0.3)
    pointLight.position.set(-10, -10, -10)
    scene.add(pointLight)

    return () => {
      scene.remove(ambientLight)
      scene.remove(directionalLight)
      scene.remove(pointLight)
    }
  }, [scene])

  return null
}

export default ScrollTriggered3DScene
