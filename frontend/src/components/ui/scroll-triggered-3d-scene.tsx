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
  const [isLoaded, setIsLoaded] = useState(false)

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
    if (!isLoaded) return

    const canvas = canvasRef.current

    // Set initial position
    gsap.set(canvas, {
      x: "25%",
      y: "-15%",
      scale: 1,
      rotation: 0,
      opacity: 1
    })

    // Create scroll-triggered animations
    const scrollTriggers: ScrollTrigger[] = []

    // Single animation function that handles all transitions
    const animateToPosition = (animationProps: any) => {
      return gsap.to(canvas, {
        ...animationProps,
        duration: 1.5,
        ease: "power2.out"
      })
    }

    // Hero section animation
    const heroTrigger = ScrollTrigger.create({
      trigger: "#hero",
      start: "top top",
      end: "bottom center",
      onEnter: () => {
        animateToPosition({
          x: "25%",
          y: "-15%",
          scale: 1,
          rotation: 0,
          opacity: 1
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "25%",
          y: "-15%",
          scale: 1,
          rotation: 0,
          opacity: 1
        })
      }
    })

    // About section animation
    const aboutTrigger = ScrollTrigger.create({
      trigger: "#about",
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        animateToPosition({
          x: "-25%",
          y: "-20%",
          scale: 0.8,
          rotation: 15,
          opacity: 0.9
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "-25%",
          y: "-20%",
          scale: 0.8,
          rotation: 15,
          opacity: 0.9
        })
      }
    })

    // Features section animation
    const featuresTrigger = ScrollTrigger.create({
      trigger: "#features",
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        animateToPosition({
          x: "25%",
          y: "-5%",
          scale: 0.6,
          rotation: -10,
          opacity: 0.7
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "25%",
          y: "-5%",
          scale: 0.6,
          rotation: -10,
          opacity: 0.7
        })
      }
    })

    // Contact section animation
    const contactTrigger = ScrollTrigger.create({
      trigger: "#contact",
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        animateToPosition({
          x: "15%",
          y: "5%",
          scale: 0.5,
          rotation: 25,
          opacity: 0.5
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "15%",
          y: "5%",
          scale: 0.5,
          rotation: 25,
          opacity: 0.5
        })
      }
    })

    // Footer section animation - dramatic close-up effect (triggers at end of contact section)
    const contactElement = document.getElementById("contact")
    
    const footerTrigger = ScrollTrigger.create({
      trigger: "#contact",
      start: "bottom 80%",
      end: "bottom 20%",
      onEnter: () => {
        animateToPosition({
          x: "0%",
          y: "55%",
          scale: isMobile ? 2.2 : 2.8,
          rotation: 0,
          opacity: 0.9,
          duration: 2.0,
          ease: "power3.out"
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "0%",
          y: "55%",
          scale: isMobile ? 2.2 : 2.8,
          rotation: 0,
          opacity: 0.9,
          duration: 2.0,
          ease: "power3.out"
        })
      }
    })

    scrollTriggers.push(heroTrigger, aboutTrigger, featuresTrigger, contactTrigger, footerTrigger)


    // Add fallback scroll listener for footer animation
    const handleFooterScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollProgress = scrollY / (documentHeight - windowHeight)
      
      // Trigger footer animation when scroll progress is > 0.85 (near the end)
      if (scrollProgress > 0.85) {
        animateToPosition({
          x: "0%",
          y: "55%",
          scale: isMobile ? 1.4 : 1.6,
          rotation: 0,
          opacity: 0.9,
          duration: 2.0,
          ease: "power3.out"
        })
      }
    }
    
    window.addEventListener('scroll', handleFooterScroll)

    // Refresh ScrollTrigger after setup with longer delay to ensure footer is available
    setTimeout(() => {
      ScrollTrigger.refresh()
    }, 500)

    return () => {
      scrollTriggers.forEach(trigger => trigger.kill())
      window.removeEventListener('scroll', handleFooterScroll)
      ScrollTrigger.refresh()
    }
  }, [isMobile, isLoaded])

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
      className="fixed z-10 pointer-events-none"
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
            onCreated={() => {
              // Mark as loaded when canvas is created
              setTimeout(() => setIsLoaded(true), 100)
            }}
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
