"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowRight, Menu, X, ArrowDown } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useAuth } from "../contexts/auth-context"
import dynamic from "next/dynamic"

// Lazy load 3D components only when needed on landing page
const ScrollTriggered3DScene = dynamic(() => import("../components/ui/scroll-triggered-3d-scene"), { 
  ssr: false,
  loading: () => null 
})
const MobileHero3DScene = dynamic(() => import("../components/ui/mobile-hero-3d-scene"), { 
  ssr: false,
  loading: () => null 
})
import { useIsMobile } from "../hooks/use-mobile"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.05], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.05], [1, 0.98])

  const [activeSection, setActiveSection] = useState("hero")
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()
  const [currentFeature, setCurrentFeature] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["hero", "about", "features", "contact"]
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const offsetTop = element.offsetTop
          const offsetHeight = element.offsetHeight

          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    // Disable mouse tracking on mobile devices
    if (isMobile) return

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isMobile])

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      window.scrollTo({
        top: section.offsetTop,
        behavior: "smooth",
      })
    }
    setIsMenuOpen(false)
  }

  const nextFeature = () => {
    setCurrentFeature((prev) => (prev + 1) % coreFeatures.length)
  }

  const prevFeature = () => {
    setCurrentFeature((prev) => (prev - 1 + coreFeatures.length) % coreFeatures.length)
  }

  const goToFeature = (index: number) => {
    setCurrentFeature(index)
  }

  // Auto-play carousel (5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % coreFeatures.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0) // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50 // Minimum distance for a swipe
    
    if (distance > minSwipeDistance) {
      // Swiped left - next feature
      nextFeature()
    } else if (distance < -minSwipeDistance) {
      // Swiped right - previous feature
      prevFeature()
    }
  }

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEnd(0)
    setTouchStart(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touchStart) {
      setTouchEnd(e.clientX)
    }
  }

  const handleMouseUp = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50
    
    if (distance > minSwipeDistance) {
      nextFeature()
    } else if (distance < -minSwipeDistance) {
      prevFeature()
    }
    
    setTouchStart(0)
    setTouchEnd(0)
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark text-cream" aria-hidden="true" data-aria-hidden="true">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cream"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-dark text-cream relative overflow-hidden">
      {/* Fixed 3D Scene Background */}
      <ScrollTriggered3DScene />
      
      <header className="fixed top-0 z-50 w-full bg-dark/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 md:px-12 lg:px-16 flex h-16 sm:h-20 md:h-24 items-center justify-between">
          <div className="flex-1 flex justify-start">
            <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-medium font-outfit tracking-tight`}>
              Sokin<span className="text-xs align-super">™</span>
            </span>
          </div>

          <nav className="hidden md:flex gap-8 flex-1 justify-center">
            <button
              onClick={() => scrollToSection("about")}
              className={`text-sm font-outfit transition-colors hover:text-cream ${activeSection === "about" ? "text-cream" : "text-cream/60"}`}
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className={`text-sm font-outfit transition-colors hover:text-cream ${activeSection === "features" ? "text-cream" : "text-cream/60"}`}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className={`text-sm font-outfit transition-colors hover:text-cream ${activeSection === "contact" ? "text-cream" : "text-cream/60"}`}
            >
              Contact
            </button>
          </nav>

          <div className="flex-1 flex items-center justify-end gap-4">
            {user ? (
              <Link href="/dashboard" className="hidden md:inline-flex items-center relative group">
                <span className="relative z-10 text-sm font-outfit px-1">Dashboard</span>
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cream transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                <ArrowRight className="ml-1 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden md:inline-flex items-center group">
                  <span className="relative px-1">
                    <span className="text-sm font-outfit">Login</span>
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cream transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  </span>
                  <ArrowRight className="ml-1 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
                <Link
                  href="/signup"
                  className="hidden md:inline-flex items-center justify-center h-10 px-6 rounded-full bg-cream text-dark font-medium text-sm group"
                >
                  <span className="relative inline-block">
                    Sign Up
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-dark transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  </span>
                  <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </>
            )}
            <button
              className="md:hidden flex items-center justify-center rounded-md p-2 text-cream/60 hover:text-cream"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <motion.div
            className="md:hidden px-4 sm:px-6 py-6 bg-dark/95 backdrop-blur-md border-t border-cream/10"
            initial={isMobile ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={isMobile ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={isMobile ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: isMobile ? 0.15 : 0.2 }}
          >
            <nav className={`flex flex-col ${isMobile ? 'gap-6' : 'gap-4'}`}>
              <button
                onClick={() => scrollToSection("about")}
                className={`${isMobile ? 'text-base' : 'text-sm'} font-outfit transition-colors hover:text-cream text-cream/60 text-left`}
              >
                About
              </button>
              <button
                onClick={() => scrollToSection("features")}
                className={`${isMobile ? 'text-base' : 'text-sm'} font-outfit transition-colors hover:text-cream text-cream/60 text-left`}
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className={`${isMobile ? 'text-base' : 'text-sm'} font-outfit transition-colors hover:text-cream text-cream/60 text-left`}
              >
                Contact
              </button>
              {user ? (
                <Link 
                  href="/dashboard" 
                  className={`${isMobile ? 'text-base' : 'text-sm'} font-outfit text-cream text-left`} 
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className={`${isMobile ? 'text-base' : 'text-sm'} font-outfit text-cream text-left`} 
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className={`inline-flex items-center justify-center ${isMobile ? 'h-12 px-8 text-base' : 'h-10 px-6 text-sm'} rounded-full bg-cream text-dark font-medium mt-2`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </header>
      <main className="flex-1 relative z-10">
        <section id="hero" className={`min-h-screen flex flex-col justify-center relative ${isMobile ? 'pt-16 pb-12' : 'pt-12 sm:pt-16 pb-8'}`}>
          {/* Mobile 3D Scene at the top */}
          {isMobile && (
            <div className="relative z-10 mt-4 mb-8">
              <MobileHero3DScene />
            </div>
          )}
          
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 relative z-10 max-w-[1600px] mx-auto flex-1 flex items-center">
            <div className={`flex flex-col lg:flex-row gap-0 lg:gap-8 items-center ${isMobile ? 'min-h-[50vh]' : 'min-h-[80vh]'} ${isMobile ? 'mt-0' : 'mt-8 lg:mt-12'} w-full`}>
              {/* Left side - Text content */}
              <motion.div
                className="flex flex-col justify-center text-center lg:text-left flex-shrink-0 lg:w-3/5 order-2 lg:order-1"
                initial={isMobile ? { opacity: 0 } : { opacity: 0, x: -50 }}
                animate={isMobile ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={isMobile ? { duration: 0.8, ease: "easeOut" } : { duration: 1.5, ease: "easeOut" }}
              >
                <h1 className={`${isMobile ? 'text-5xl mb-4' : 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-6'} font-medium tracking-tight font-outfit`}>
                  Sokin
                </h1>
                <p className={`${isMobile ? 'text-xl mb-10' : 'text-lg md:text-xl lg:text-2xl mb-8'} text-cream/70 font-outfit max-w-md mx-auto lg:mx-0`}>
                  Personal finance, redefined.
                </p>
                <div className={`flex flex-col ${isMobile ? 'gap-4' : 'sm:flex-row gap-4'} justify-center lg:justify-start`}>
                  <Link
                    href={user ? "/dashboard" : "/signup"}
                    className={`inline-flex ${isMobile ? 'h-14 px-10 text-base' : 'h-12 px-8 text-sm'} items-center justify-center rounded-full bg-cream text-dark font-medium transition-all hover:bg-cream/90 group`}
                  >
                    {user ? "Go to Dashboard" : "Get Started"}
                    <ArrowRight className={`ml-2 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'} transform group-hover:translate-x-1 transition-transform duration-300`} />
                  </Link>
                  <button
                    onClick={() => scrollToSection("about")}
                    className={`inline-flex ${isMobile ? 'h-14 px-10 text-base' : 'h-12 px-8 text-sm'} items-center justify-center rounded-full border border-cream/20 font-medium text-cream transition-colors hover:border-cream/40`}
                  >
                    Learn More
                  </button>
                </div>
              </motion.div>

              {/* Right side - Space for 3D Scene (desktop only) */}
              {!isMobile && (
                <div className="relative w-full lg:w-2/5 h-[60vh] min-h-[500px] max-h-[800px] order-1 lg:order-2 -mt-4 lg:mt-0 pointer-events-none">
                  {/* This space is reserved for the 3D scene which now floats in the background */}
                </div>
              )}
            </div>

            {/* Scroll indicator - simplified for mobile */}
            <motion.div
              className={`absolute ${isMobile ? 'bottom-8' : 'bottom-12'} left-1/2 -translate-x-1/2`}
              animate={isMobile ? {} : { y: [0, 10, 0] }}
              transition={isMobile ? {} : { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <button
                onClick={() => scrollToSection("about")}
                className="text-cream/60 hover:text-cream transition-colors"
              >
                <ArrowDown className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />
              </button>
            </motion.div>
          </div>
        </section>

        <section id="about" className={`${isMobile ? 'py-16' : 'min-h-screen py-24'} flex items-center`}>
          <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
            <div className={`flex flex-col lg:flex-row items-center justify-between ${isMobile ? 'gap-8' : 'min-h-[60vh]'}`}>
              {/* Left side - Space for 3D Scene */}
              <div className="hidden lg:block lg:w-2/5">
                {/* Space reserved for 3D scene */}
              </div>
              
              {/* Right side - Content */}
              <motion.div
                className={`w-full lg:w-3/5 lg:pl-12 ${isMobile ? 'text-center' : ''}`}
                initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={isMobile ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={isMobile ? { duration: 0.6 } : { duration: 0.8 }}
              >
                <p className={`text-sm font-roboto-mono text-cream/60 ${isMobile ? 'mb-8' : 'mb-12'}`}>01 / About</p>
                <h2 className={`${isMobile ? 'text-3xl mb-8' : 'text-3xl md:text-4xl lg:text-5xl mb-12'} font-medium tracking-tight font-outfit`}>
                  A new approach to managing your finances.
                </h2>
                <div className={`grid grid-cols-1 ${isMobile ? 'gap-8' : 'md:grid-cols-2 gap-12 md:gap-16'}`}>
                  <div>
                    <p className="text-lg text-cream/70 font-outfit mb-6">
                      Sokin is more than just an expense tracker. It's a complete financial companion designed with you in
                      mind.
                    </p>
                    <p className="text-lg text-cream/70 font-outfit">
                      We believe that managing your finances should be intuitive, insightful, and even enjoyable.
                    </p>
                  </div>
                  <div>
                    <p className="text-lg text-cream/70 font-outfit mb-6">
                      Our minimalist approach strips away the complexity, focusing on what truly matters: your financial
                      well-being.
                    </p>
                    <p className="text-lg text-cream/70 font-outfit">
                      No clutter, no confusion. Just clarity and control.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="features" className={`${isMobile ? 'py-16' : 'py-24'} bg-dark`}>
          <div className="container mx-auto px-6 md:px-12 lg:px-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={isMobile ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={isMobile ? { duration: 0.6 } : { duration: 0.8 }}
                className={`${isMobile ? 'mb-12 text-center' : 'mb-16'}`}
              >
                <p className={`text-sm font-roboto-mono text-cream/60 ${isMobile ? 'mb-6' : 'mb-4'}`}>02 / Features</p>
                <h2 className={`${isMobile ? 'text-3xl' : 'text-3xl md:text-4xl lg:text-5xl'} font-medium tracking-tight font-outfit`}>
                  Thoughtfully designed for your financial journey.
                </h2>
              </motion.div>

              {/* Carousel Container */}
              <div className="relative">
                {/* Feature Cards */}
                <div 
                  className="overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <motion.div
                    className="flex"
                    animate={{ x: `-${currentFeature * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    {coreFeatures.map((feature, index) => (
                      <div
                        key={feature.title}
                        className="w-full flex-shrink-0"
                      >
                        <div className={`flex flex-col ${isMobile ? 'items-center text-center gap-6' : 'md:flex-row items-center gap-8 md:gap-16'}`}>
                          <div className={`${isMobile ? 'w-full max-w-sm' : 'w-full md:w-1/2'}`}>
                            <div className={`relative aspect-square w-full ${isMobile ? 'max-w-xs' : 'max-w-md'} mx-auto overflow-hidden rounded-2xl`}>
                              <Image
                                src={`/images/features/${feature.imageSrc}`}
                                alt={feature.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>
                          <div className={`${isMobile ? 'w-full' : 'w-full md:w-1/2'}`}>
                            <div className={`${isMobile ? 'p-0' : 'p-4 md:p-8'}`}>
                              <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-cream/5 ${isMobile ? 'mb-4' : 'mb-6'}`}>
                                <feature.icon className="h-6 w-6 text-cream/60" />
                              </div>
                              <h3 className={`${isMobile ? 'text-2xl mb-3' : 'text-2xl md:text-3xl mb-4'} font-medium font-outfit`}>{feature.title}</h3>
                              <p className={`${isMobile ? 'text-base mb-4' : 'text-lg mb-6'} text-cream/70 font-outfit`}>{feature.description}</p>
                              <div className={`flex flex-wrap ${isMobile ? 'gap-2 justify-center' : 'gap-3'}`}>
                                {feature.tags.map((tag) => (
                                  <span key={tag} className={`px-3 py-1 rounded-full bg-cream/5 text-cream/80 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Dots Indicator */}
                <div className={`flex justify-center ${isMobile ? 'mt-8' : 'mt-12'}`}>
                  <div className="flex gap-3">
                    {coreFeatures.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToFeature(index)}
                        className={`w-4 h-4 rounded-full transition-all duration-300 ${
                          index === currentFeature
                            ? 'bg-cream scale-110'
                            : 'bg-cream/20 hover:bg-cream/40 hover:scale-105'
                        }`}
                        aria-label={`Go to feature ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className={`${isMobile ? 'py-16' : 'min-h-screen py-24'} flex items-center`}>
          <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
            <motion.div
              className={`max-w-3xl mx-auto ${isMobile ? 'text-center' : ''}`}
              initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
              whileInView={isMobile ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={isMobile ? { duration: 0.6 } : { duration: 0.8 }}
            >
              <p className={`text-sm font-roboto-mono text-cream/60 ${isMobile ? 'mb-8' : 'mb-12'}`}>03 / Contact</p>
              <h2 className={`${isMobile ? 'text-3xl mb-8' : 'text-3xl md:text-4xl lg:text-5xl mb-12'} font-medium tracking-tight font-outfit`}>
                Ready to transform your finances?
              </h2>

              <div className={`grid grid-cols-1 ${isMobile ? 'gap-8' : 'md:grid-cols-2 gap-12 md:gap-24'}`}>
                <div>
                  <p className={`${isMobile ? 'text-base mb-8' : 'text-lg mb-6'} text-cream/70 font-outfit`}>
                    Join Sokin today and experience a new way to manage your personal finances. It's completely free to
                    use.
                  </p>
                  <motion.div 
                    whileHover={isMobile ? {} : { scale: 1.05 }} 
                    whileTap={isMobile ? {} : { scale: 0.95 }} 
                    className="inline-block"
                  >
                    <Link
                      href={user ? "/dashboard" : "/signup"}
                      className={`inline-flex ${isMobile ? 'h-14 px-10 text-base' : 'h-12 px-8 text-sm'} items-center justify-center rounded-full border border-cream/20 font-medium text-cream transition-colors hover:border-cream group`}
                    >
                      {user ? "Go to Dashboard" : "Get Started"}
                      <ArrowRight className={`ml-2 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'} transform group-hover:translate-x-1 transition-transform duration-300`} />
                    </Link>
                  </motion.div>
                </div>
                <div className={isMobile ? 'mt-8' : ''}>
                  <p className={`${isMobile ? 'text-base mb-4' : 'text-lg mb-6'} text-cream/70 font-outfit`}>Have questions? We're here to help.</p>
                  <p className={`${isMobile ? 'text-base mb-2' : 'text-lg mb-2'} text-cream font-outfit`}>hello@sokin.com</p>
                  <p className={`${isMobile ? 'text-base' : 'text-lg'} text-cream font-outfit`}>+1 (555) 123-4567</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <footer className={`${isMobile ? 'py-8' : 'py-12'} relative z-10`}>
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className={`flex flex-col ${isMobile ? 'items-center text-center gap-8' : 'md:flex-row justify-between items-start gap-6'} max-w-3xl mx-auto`}>
            <div>
              <span className={`${isMobile ? 'text-xl' : 'text-lg'} font-medium font-outfit tracking-tight`}>
                Sokin<span className="text-xs align-super">™</span>
              </span>
            </div>
            <div className={`flex items-center ${isMobile ? 'flex-col gap-4' : 'gap-4'}`}>
              {user ? (
                <Link
                  href="/dashboard"
                  className={`${isMobile ? 'text-base' : 'text-sm'} text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center`}
                >
                  Dashboard
                  <ArrowRight className={`ml-1 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'} transform group-hover:translate-x-1 transition-transform duration-300`} />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`${isMobile ? 'text-base' : 'text-sm'} text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center`}
                  >
                    Login
                    <ArrowRight className={`ml-1 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'} transform group-hover:translate-x-1 transition-transform duration-300`} />
                  </Link>
                  <Link
                    href="/signup"
                    className={`${isMobile ? 'text-base' : 'text-sm'} text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center`}
                  >
                    Sign Up
                    <ArrowRight className={`ml-1 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'} transform group-hover:translate-x-1 transition-transform duration-300`} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { BarChart3, PieChart, Target, Wallet } from "lucide-react"

const coreFeatures = [
  {
    title: "Expense Tracking",
    description:
      "Effortlessly track your expenses with automatic categorization and real-time updates. Our intuitive interface makes it simple to understand where your money is going and identify spending patterns over time.",
    icon: Wallet,
    imageSrc: "expense-tracking.png",
    tags: ["Auto-categorization", "Real-time updates", "Receipt scanning"],
  },
  {
    title: "Data Visualization",
    description:
      "Transform complex financial data into clear, actionable insights with our advanced visualization tools. Understand your spending patterns and financial health at a glance with beautiful charts and graphs.",
    icon: BarChart3,
    imageSrc: "data-visualization.png",
    tags: ["Interactive charts", "Trend analysis", "Custom reports"],
  },
  {
    title: "Budget Management",
    description:
      "Create and manage budgets that adapt to your spending habits and financial goals. Set limits, track progress, and receive gentle notifications when you're approaching your thresholds.",
    icon: PieChart,
    imageSrc: "budget-tracking.png",
    tags: ["Custom categories", "Spending alerts", "Flexible timeframes"],
  },
  {
    title: "Goal Setting",
    description:
      "Define your financial aspirations and track your journey toward achieving them. Whether saving for a vacation or paying off debt, we'll help you stay focused and motivated with visual progress tracking.",
    icon: Target,
    imageSrc: "goal-setting.png",
    tags: ["Progress tracking", "Milestone rewards", "Smart recommendations"],
  },
]

