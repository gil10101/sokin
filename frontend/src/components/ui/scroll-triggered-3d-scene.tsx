"use client"

import dynamic from "next/dynamic"
import { Suspense, useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

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
const TwistedTorus = dynamic(() => import("./twisted-torus").then(mod => ({ default: mod.TwistedTorus })), {
  ssr: false
})

export function ScrollTriggered3DScene() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // Use consistent mobile breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    // Don't run desktop animations on mobile
    if (isMobile) return
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    // Desktop only - initial positioning
    gsap.set(canvas, {
      x: "25%",
      y: "0%",
      scale: 1,
      rotation: 0,
      opacity: 1
    })

    // Desktop only - section-based animations
    const desktopSections = [
      {
        trigger: "#hero",
        x: "25%",
        y: "0%",
        scale: 1,
        rotation: 0,
        opacity: 1
      },
      {
        trigger: "#about",
        x: "-30%",
        y: "-5%",
        scale: 0.8,
        rotation: 15,
        opacity: 0.9
      },
      {
        trigger: "#features",
        x: "25%",
        y: "10%",
        scale: 0.6,
        rotation: -10,
        opacity: 0.7
      },
      {
        trigger: "#contact",
        x: "15%",
        y: "20%",
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

    // Bottom of page effect for desktop
    const bottomPageEffect = ScrollTrigger.create({
      trigger: "footer",
      start: "top bottom-=100px",
      end: "bottom bottom",
      onEnter: () => {
        gsap.to(canvas, {
          x: "0%",
          y: "85%",
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

  const cameraSettings = { position: [0, 0, 18] as [number, number, number], fov: 55 }

  // On mobile, render nothing here - we'll handle mobile canvas separately
  if (isMobile) {
    return null
  }

  return (
    <div
      ref={canvasRef}
      className="fixed z-0 pointer-events-none"
      style={{
        width: "70vw",
        height: "70vh",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        transformOrigin: "center center",
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
              <TwistedTorus isMobile={false} />
            </Suspense>
          </Canvas>
        </Suspense>
    </div>
  )
}
