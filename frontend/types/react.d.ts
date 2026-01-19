/// <reference types="react" />
/// <reference types="react-dom" />

/**
 * React 19 type augmentations for compatibility
 * These augmentations help ensure compatibility between React 19 and libraries
 * that may not yet have updated their types.
 */

// Ensure proper JSX namespace for React 19
declare global {
  namespace JSX {
    // React 19 compatibility - ensure key property is properly typed on intrinsic attributes
    interface IntrinsicAttributes {
      key?: React.Key | null | undefined;
    }
  }
}