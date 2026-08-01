"use client"

import { useRef, useMemo, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Group } from "three"
import { BoxGeometry } from "three"
import * as THREE from "three"

interface TwistedTorusProps {
  isMobile?: boolean
}

function TwistedTorus({ isMobile = false }: TwistedTorusProps) {
  const groupRef = useRef<Group>(null)
  const { viewport } = useThree()
  const [scaleFactor, setScaleFactor] = useState(1)

  // Calculate responsive scale factor based on viewport
  useEffect(() => {
    const updateScaleFactor = () => {
      const { width, height } = viewport
      const aspectRatio = width / height
      const minDimension = Math.min(width, height)

      // Simplified scaling based on viewport size
      let factor = 1

      // Scale down for smaller viewports
      if (minDimension < 12) {
        factor = 0.7
      } else if (minDimension < 15) {
        factor = 0.8
      } else if (minDimension < 18) {
        factor = 0.9
      }

      // Adjust for extreme aspect ratios
      if (aspectRatio > 2.5) {
        factor *= 0.9 // Reduce for very wide screens
      } else if (aspectRatio < 0.6) {
        factor *= 1.1 // Increase for very tall screens
      }

      setScaleFactor(Math.max(0.5, Math.min(1.2, factor))) // Clamp between 0.5 and 1.2
    }

    updateScaleFactor()

    // Update on viewport changes
    const handleResize = () => updateScaleFactor()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewport])

  // Create simple circular arrangement of square panels
  const segments = useMemo(() => {
    const segmentArray = []
    const numSegments = isMobile ? 50 : 70 // Optimized segment count for better performance
    const baseRadius = isMobile ? 4 : 5.5
    const radius = baseRadius * scaleFactor // Scale radius based on viewport
    const basePanelSize = isMobile ? 1.8 : 2.5
    const panelSize = basePanelSize * scaleFactor // Scale panel size
    const baseThickness = isMobile ? 0.12 : 0.18
    const panelThickness = baseThickness * scaleFactor // Scale thickness
    const twistAmount = (5 * 90) * (Math.PI / 180) // 90 degrees total twist
    
    for (let i = 0; i < numSegments; i++) {
      const angle = (i / numSegments) * 2 * Math.PI
      
      // Create square panel (centered at origin)
      const geometry = new BoxGeometry(panelThickness, panelSize, panelSize)
      
      // Gradual twist: each panel rotates around its center (origin)
      const twistRotation = (i / numSegments) * twistAmount
      
      // First rotate around local X-axis (at origin), then position in circle
      const rotationMatrix = new THREE.Matrix4()
      rotationMatrix.makeRotationX(twistRotation)
      
      // Then rotate to align with circle position
      const circleRotation = new THREE.Matrix4()
      circleRotation.makeRotationZ(angle + Math.PI/2)
      
      // Combine rotations
      const finalRotation = new THREE.Matrix4()
      finalRotation.multiplyMatrices(circleRotation, rotationMatrix)
      
      // Extract euler angles from matrix
      const euler = new THREE.Euler()
      euler.setFromRotationMatrix(finalRotation)
      
      // Position in circle AFTER rotation
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      const z = 0
      
      const position: [number, number, number] = [x, y, z]
      const rotation: [number, number, number] = [euler.x, euler.y, euler.z]
      
      segmentArray.push({
        geometry,
        position,
        rotation
      })
    }
    
    return segmentArray
  }, [isMobile, scaleFactor])

  /**
   * How strongly the object leans toward the pointer, 0 when the pointer is
   * far away and 1 when it is right on top of it. Kept in a ref rather than
   * state so moving the mouse never triggers a React render.
   */
  const gazeRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // Hero only, and pointer devices only - there is no cursor to follow on a
    // touchscreen, and a device that reports coarse pointers should not pay for
    // a mousemove listener at all.
    if (isMobile) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(pointer: coarse)").matches) return

    const onMove = (event: MouseEvent) => {
      // Distance from the object's on-screen centre, normalised so the effect
      // fades out rather than snapping off at the edge of its range.
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const dx = (event.clientX - cx) / cx
      const dy = (event.clientY - cy) / cy

      const distance = Math.hypot(dx, dy)
      const RANGE = 1.1
      // Smoothstep so the lean eases in near the edge of range instead of
      // appearing abruptly the moment the cursor crosses a threshold.
      const t = Math.min(Math.max(1 - distance / RANGE, 0), 1)
      const proximity = t * t * (3 - 2 * t)

      gazeRef.current = { x: dx * proximity, y: dy * proximity }
    }

    const onLeave = () => { gazeRef.current = { x: 0, y: 0 } }

    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeave)
    return () => {
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
    }
  }, [isMobile])

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Smoother animation speed that's consistent across devices
    groupRef.current.rotation.z = state.clock.elapsedTime / 3.0

    // Add subtle floating animation
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1

    // Lean toward the cursor. Deliberately small - this should read as the
    // object noticing you, not tracking you. Eased per-frame toward the target
    // so a fast mouse move produces a glide rather than a snap, and framerate
    // independent so it feels the same on a 60Hz and a 120Hz display.
    // Hero only. This is the same object for the whole page, so the lean is
    // faded out once the hero has scrolled away rather than following the
    // cursor through every section. Eased to zero, not cut, so leaving the hero
    // mid-lean unwinds smoothly.
    const heroFalloff =
      typeof window === "undefined"
        ? 1
        : Math.min(Math.max(1 - window.scrollY / (window.innerHeight * 0.7), 0), 1)

    const MAX_TILT = 0.28
    const targetX = gazeRef.current.y * MAX_TILT * heroFalloff
    const targetY = gazeRef.current.x * MAX_TILT * heroFalloff
    const ease = 1 - Math.pow(0.001, delta)

    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * ease
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * ease
  })

  return (
    <group ref={groupRef} scale={scaleFactor}>
      {segments.map((segment, index) => (
        <mesh
          key={index}
          geometry={segment.geometry}
          position={[
            segment.position[0] / scaleFactor, // Compensate for group scale
            segment.position[1] / scaleFactor,
            segment.position[2] / scaleFactor
          ]}
          rotation={segment.rotation}
        >
          <meshStandardMaterial
            color="#e8e8e8"
            metalness={0.8}
            roughness={0.2}
            emissive="#b8b8b8"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

export default TwistedTorus