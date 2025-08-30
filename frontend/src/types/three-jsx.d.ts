import { JSX } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Lights
      ambientLight: any
      directionalLight: any
      pointLight: any
      spotLight: any
      hemisphereLight: any
      rectAreaLight: any

      // 3D Primitives
      mesh: any
      group: any
      scene: any

      // Materials
      meshBasicMaterial: any
      meshStandardMaterial: any
      meshLambertMaterial: any
      meshPhongMaterial: any
      meshPhysicalMaterial: any

      // Geometries
      boxGeometry: any
      sphereGeometry: any
      planeGeometry: any
      cylinderGeometry: any
      torusGeometry: any
      coneGeometry: any
      octahedronGeometry: any

      // Cameras
      perspectiveCamera: any
      orthographicCamera: any

      // Helpers
      gridHelper: any
      axesHelper: any
      cameraHelper: any
      directionalLightHelper: any
      hemisphereLightHelper: any
      pointLightHelper: any
      spotLightHelper: any
    }
  }
}
