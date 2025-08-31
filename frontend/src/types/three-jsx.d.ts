import { JSX } from 'react'
import { ReactThreeFiber } from '@react-three/fiber'
import * as THREE from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Lights
      ambientLight: ReactThreeFiber.LightProps
      directionalLight: ReactThreeFiber.DirectionalLightProps
      pointLight: ReactThreeFiber.PointLightProps
      spotLight: ReactThreeFiber.SpotLightProps
      hemisphereLight: ReactThreeFiber.HemisphereLightProps
      rectAreaLight: ReactThreeFiber.RectAreaLightProps

      // 3D Primitives
      mesh: ReactThreeFiber.Object3DNode<THREE.Mesh>
      group: ReactThreeFiber.Object3DNode<THREE.Group>
      scene: ReactThreeFiber.Object3DNode<THREE.Scene>

      // Materials
      meshBasicMaterial: ReactThreeFiber.MaterialNode<THREE.MeshBasicMaterial>
      meshStandardMaterial: ReactThreeFiber.MaterialNode<THREE.MeshStandardMaterial>
      meshLambertMaterial: ReactThreeFiber.MaterialNode<THREE.MeshLambertMaterial>
      meshPhongMaterial: ReactThreeFiber.MaterialNode<THREE.MeshPhongMaterial>
      meshPhysicalMaterial: ReactThreeFiber.MaterialNode<THREE.MeshPhysicalMaterial>

      // Geometries
      boxGeometry: ReactThreeFiber.Node<THREE.BoxGeometry>
      sphereGeometry: ReactThreeFiber.Node<THREE.SphereGeometry>
      planeGeometry: ReactThreeFiber.Node<THREE.PlaneGeometry>
      cylinderGeometry: ReactThreeFiber.Node<THREE.CylinderGeometry>
      torusGeometry: ReactThreeFiber.Node<THREE.TorusGeometry>
      coneGeometry: ReactThreeFiber.Node<THREE.ConeGeometry>
      octahedronGeometry: ReactThreeFiber.Node<THREE.OctahedronGeometry>

      // Cameras
      perspectiveCamera: ReactThreeFiber.Node<THREE.PerspectiveCamera>
      orthographicCamera: ReactThreeFiber.Node<THREE.OrthographicCamera>

      // Helpers
      gridHelper: ReactThreeFiber.Node<THREE.GridHelper>
      axesHelper: ReactThreeFiber.Node<THREE.AxesHelper>
      cameraHelper: ReactThreeFiber.Node<THREE.CameraHelper>
      directionalLightHelper: ReactThreeFiber.Node<THREE.DirectionalLightHelper>
      hemisphereLightHelper: ReactThreeFiber.Node<THREE.HemisphereLightHelper>
      pointLightHelper: ReactThreeFiber.Node<THREE.PointLightHelper>
      spotLightHelper: ReactThreeFiber.Node<THREE.SpotLightHelper>
    }
  }
}
