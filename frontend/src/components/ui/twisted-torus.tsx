"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group } from "three"
import { BoxGeometry } from "three"
import * as THREE from "three"

interface TwistedTorusProps {
  isMobile?: boolean
}

function TwistedTorus({ isMobile = false }: TwistedTorusProps) {
  const groupRef = useRef<Group>(null)

  // Create simple circular arrangement of square panels
  const segments = useMemo(() => {
    const segmentArray = []
    const numSegments = 80 // Number of panels around the circle
    const radius = isMobile ? 4.5 : 6 // Radius of the circular path
    const panelSize = isMobile ? 2.0 : 2.8 // Size of each square panel
    const panelThickness = isMobile ? 0.15 : 0.2 // Thickness of each panel
    const twistAmount = (6 * 90) * (Math.PI / 180) // 90 degrees total twist
    
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
  }, [isMobile])

  // Animation loop
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime / 2.7
    }
  })

  return (
    <group ref={groupRef}>
      {segments.map((segment, index) => (
        <mesh
          key={index}
          geometry={segment.geometry}
          position={segment.position}
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
