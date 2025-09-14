"use client"

import React, { PropsWithChildren, forwardRef } from 'react'
import { motion, AnimatePresence as FMAnimatePresence, MotionProps } from 'framer-motion'

// Enhanced prop types for motion components using framer-motion types
type EnhancedMotionProps = MotionProps & {
  className?: string;
  style?: React.CSSProperties;
};

export const MotionDiv = forwardRef<HTMLDivElement, PropsWithChildren<EnhancedMotionProps>>(
  ({ children, ...rest }, ref) => {
    return <motion.div ref={ref} {...rest}>{children}</motion.div>;
  }
);
MotionDiv.displayName = 'MotionDiv';

export const MotionMain = forwardRef<HTMLElement, PropsWithChildren<EnhancedMotionProps>>(
  ({ children, ...rest }, ref) => {
    return <motion.main ref={ref} {...rest}>{children}</motion.main>;
  }
);
MotionMain.displayName = 'MotionMain';

export const MotionHeader = forwardRef<HTMLElement, PropsWithChildren<EnhancedMotionProps>>(
  ({ children, ...rest }, ref) => {
    return <motion.header ref={ref} {...rest}>{children}</motion.header>;
  }
);
MotionHeader.displayName = 'MotionHeader';

export const MotionSection = forwardRef<HTMLElement, PropsWithChildren<EnhancedMotionProps>>(
  ({ children, ...rest }, ref) => {
    return <motion.section ref={ref} {...rest}>{children}</motion.section>;
  }
);
MotionSection.displayName = 'MotionSection';

export const MotionButton = forwardRef<
  HTMLButtonElement, 
  PropsWithChildren<EnhancedMotionProps & { onClick?: () => void; disabled?: boolean }>
>(({ children, ...rest }, ref) => {
  return <motion.button ref={ref} {...rest}>{children}</motion.button>;
});
MotionButton.displayName = 'MotionButton';

// Animation variants and utilities
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

export const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

export const AnimatePresence = FMAnimatePresence


