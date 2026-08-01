"use client"

import dynamic from "next/dynamic"
import React, { Suspense, useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { isWebGLAvailable } from "@/lib/webgl"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

// Dynamically import the TwistedTorus to avoid SSR issues
const TwistedTorus = dynamic(() => import("./twisted-torus"), {
  ssr: false
})

function ScrollTriggered3DScene() {
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
      // The carousel panel is vertically centred in the viewport, but this
      // element's box is anchored at top:65%, so an offset of -21% of its own
      // height is what lands the object on the panel's centre line rather than
      // below it. x:31% puts it on the centre of the empty right-hand column.
      onEnter: () => {
        animateToPosition({
          x: "31%",
          y: "-21%",
          scale: 0.6,
          rotation: -10,
          opacity: 0.7
        })
      },
      onEnterBack: () => {
        animateToPosition({
          x: "31%",
          y: "-21%",
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

    // Footer section animation - dramatic close-up effect.
    //
    // This has to hang off the footer, not off the bottom of #contact. The
    // contact section is the last full-height block on the page and the footer
    // below it is only ~120px tall, so "#contact bottom 80%" resolves to a
    // scroll position past the end of the document - the page physically
    // cannot scroll far enough to reach it and the trigger never fired. The
    // object was left parked in its contact pose, which is the "random spot"
    // it was ending up in.
    //
    // "#footer top bottom" fires the moment the footer edges into view, which
    // is always reachable however short the footer is.
    const footerTrigger = ScrollTrigger.create({
      trigger: "#footer",
      start: "top bottom",
      end: "bottom top",
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
      // Scrolling up out of the footer band must hand the object back to the
      // contact state. Without this the footer state was never released, so it
      // stayed in its final pose all the way up until the hero re-triggered.
      onLeaveBack: () => {
        animateToPosition({
          x: "15%",
          y: "5%",
          scale: 0.5,
          rotation: 25,
          opacity: 0.5
        })
      }
    })

    scrollTriggers.push(heroTrigger, aboutTrigger, featuresTrigger, contactTrigger, footerTrigger)



    // Refresh ScrollTrigger after setup with longer delay to ensure footer is available
    setTimeout(() => {
      ScrollTrigger.refresh()
    }, 500)

    return () => {
      scrollTriggers.forEach(trigger => trigger.kill())
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
      )}
    </div>
  )
}

// Lights component using JSX declarations instead of direct Three.js imports
function Lights() {
  return (
    <>
      <ambientLight args={[0xffffff, 0.4]} />
      <directionalLight 
        args={[0xffffff, 0.8]}
        position={[10, 10, 5]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight 
        args={[0xffffff, 0.3]}
        position={[-10, -10, -10]}
      />
    </>
  )
}

export default ScrollTriggered3DScene
