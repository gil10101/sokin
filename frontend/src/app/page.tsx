"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useRef } from "react"
import { ArrowRight, Menu, X, ArrowDown, BarChart3, PieChart, Target, Wallet } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import dynamic from "next/dynamic"

// Lazy load 3D components only when needed on landing page
const ScrollTriggered3DScene = dynamic(() => import("@/components/ui/scroll-triggered-3d-scene").then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => null
})
const MobileHero3DScene = dynamic(() => import("@/components/ui/mobile-hero-3d-scene").then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => null
})
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Feature copy for the landing section.
 *
 * No imagery: the stock screenshots that used to sit here said nothing the
 * words don't, and they competed with the 3D object for the same attention.
 * Each entry carries a `metric` instead - a concrete detail that earns its
 * place on the page in a fraction of the space.
 */
const coreFeatures = [
  {
    id: "01",
    title: "Expense tracking",
    description:
      "Scan a receipt or type a line. Sokin reads the merchant, proposes a category, and files it - so the ledger stays current without becoming a chore.",
    icon: Wallet,
    metric: "Receipt to logged expense in one step",
    tags: ["Receipt scanning", "AI categorization", "Instant search"],
  },
  {
    id: "02",
    title: "Budgets that hold",
    description:
      "Set a limit per category and watch it against real spending, not a rounded guess. Alerts arrive while you can still act on them.",
    icon: PieChart,
    metric: "Warns at 80%, not after you have overspent",
    tags: ["Per-category limits", "Threshold alerts", "Any timeframe"],
  },
  {
    id: "03",
    title: "Net worth over time",
    description:
      "Assets against liabilities, recorded monthly. Every point on the chart is a snapshot you actually have - nothing is interpolated to make the line look smoother.",
    icon: BarChart3,
    metric: "Only real snapshots are plotted",
    tags: ["Assets & liabilities", "Monthly history", "Trend analysis"],
  },
  {
    id: "04",
    title: "Goals you reach",
    description:
      "Name the target, contribute toward it, and see the distance close. Progress is computed from what you have put in, not from what you intended to.",
    icon: Target,
    metric: "Contributions recorded transactionally",
    tags: ["Progress tracking", "Milestones", "Contribution history"],
  },
]

// Custom hook for responsive viewport detection
const useResponsiveViewport = () => {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false
  })

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setViewport({
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return viewport
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("hero")
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [componentsLoaded, setComponentsLoaded] = useState(false)
  const isMobile = useIsMobile()
  const viewport = useResponsiveViewport()
  const [currentFeature, setCurrentFeature] = useState(0)

  useEffect(() => {
    setMounted(true)
    // Add a small delay to ensure components are ready
    const timer = setTimeout(() => {
      setComponentsLoaded(true)
    }, 100)
    return () => clearTimeout(timer)
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

  /**
   * Which feature is expanded is driven by scroll position, not a timer.
   *
   * A section that advances on its own moves the thing you are reading out
   * from under you, and it makes the section's state independent of where the
   * page actually is. Each row reports when it enters a narrow band around the
   * middle of the viewport, and the last one to enter wins - so scrolling is
   * the only thing that changes the selection.
   */
  const featureRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    const rows = featureRefs.current.filter(Boolean) as HTMLDivElement[]
    if (rows.length === 0) return

    // A focus band roughly a third of the way down. Negative top/bottom margins
    // shrink the observer's viewport to that strip, so a row only counts as
    // active while it is crossing it.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = rows.indexOf(entry.target as HTMLDivElement)
          if (index !== -1) setCurrentFeature(index)
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    )

    rows.forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [])

  /**
   * Clicking a row scrolls it into the focus band rather than setting state
   * directly, so scroll position stays the single source of truth - otherwise a
   * click and the next scroll event would disagree about what is open.
   */
  const goToFeature = (index: number) => {
    featureRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }


  return (
    <div className="flex min-h-screen flex-col bg-dark text-cream relative overflow-hidden">
      {/* Fixed 3D Scene Background - only render when components are loaded */}
      {mounted && componentsLoaded && <ScrollTriggered3DScene />}
      
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
            initial={{ opacity: 0, height: isMobile ? "auto" : 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: isMobile ? "auto" : 0 }}
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
      <main className="flex-1 relative z-20">
        <section id="hero" className={`min-h-screen flex flex-col justify-center relative ${isMobile ? 'pt-16 pb-12' : 'pt-12 sm:pt-16 pb-8'}`}>
          {/* Responsive 3D Scene - mobile/tablet get inline scene */}
          {(viewport.isMobile || viewport.isTablet) && mounted && componentsLoaded && (
            <div className="relative z-10 mt-4 mb-8">
              <MobileHero3DScene />
            </div>
          )}
          
          <div className="w-full px-6 md:px-8 lg:px-12 relative z-10 max-w-[1600px] mx-auto flex-1 flex items-center">
            <div className={`flex flex-col lg:flex-row gap-0 lg:gap-8 items-center ${isMobile ? 'min-h-[50vh]' : 'min-h-[80vh]'} ${isMobile ? 'mt-0' : 'mt-8 lg:mt-12'} w-full`}>
              {/* Left side - Text content */}
              <motion.div
                // w-full on mobile: without a width this column shrink-wraps to
                // its content inside the flex parent, so the "centred" text sat
                // in an off-centre box. lg:w-1/2 takes over at the breakpoint.
                className="flex flex-col justify-center text-center w-full lg:w-1/2 flex-shrink-0 order-2 lg:order-1"
                initial={{ opacity: 0, x: isMobile ? 0 : -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={isMobile ? { duration: 0.8, ease: "easeOut" } : { duration: 1.5, ease: "easeOut" }}
              >
                <h1 className={`${isMobile ? 'text-5xl mb-4' : 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-6'} font-medium tracking-tight font-outfit`}>
                  Sokin
                </h1>
                <p className={`${isMobile ? 'text-xl mb-10' : 'text-lg md:text-xl lg:text-2xl mb-8'} text-cream/70 font-outfit max-w-md mx-auto`}>
                  Personal finance, redefined.
                </p>
                <div className={`flex flex-col ${isMobile ? 'gap-4' : 'sm:flex-row gap-4'} justify-center`}>
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
              {viewport.isDesktop && (
                <div className="relative w-full lg:w-1/2 h-[60vh] min-h-[500px] max-h-[800px] order-1 lg:order-2 -mt-4 lg:mt-0 pointer-events-none">
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
              <div className="hidden lg:block lg:w-1/2">
                {/* Space reserved for 3D scene */}
              </div>

              {/* Right side - Content */}
              <motion.div
                className="w-full lg:w-1/2 text-center"
                initial={{ opacity: 0, y: isMobile ? 0 : 20 }}
                whileInView={{ opacity: 1, y: 0 }}
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
                      Sokin is more than just an expense tracker. It&apos;s a complete financial companion designed with you in
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

        <section id="features" className={`${isMobile ? 'py-20' : 'py-32'} bg-dark`}>
          {/*
            Left-weighted on purpose. During this section the scroll-triggered
            3D object animates to x: "25%", y: "-5%" - the right half, slightly
            above centre. The previous layout put its copy exactly there, so the
            text and the object fought for the same space. Holding the content
            to the left column turns that overlap into deliberate negative
            space, and the object becomes the section's right-hand mass instead
            of an obstruction.
          */}
          <div className="container mx-auto px-6 md:px-12 lg:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 xl:col-span-6">
                <motion.div
                  initial={{ opacity: 0, y: isMobile ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: isMobile ? 0.6 : 0.8 }}
                  className={isMobile ? 'mb-10' : 'mb-16'}
                >
                  <p className="text-sm font-roboto-mono text-cream/60 mb-4">02 / Features</p>
                  <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl lg:text-5xl'} font-medium tracking-tight font-outfit max-w-xl`}>
                    Built to tell you the truth about your money.
                  </h2>
                </motion.div>

                <div className="divide-y divide-cream/10 border-t border-cream/10">
                  {coreFeatures.map((feature, index) => {
                    const isOpen = index === currentFeature
                    return (
                      <motion.div
                        key={feature.title}
                        ref={(node) => { featureRefs.current[index] = node }}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.06 }}
                      >
                        <button
                          type="button"
                          onClick={() => goToFeature(index)}
                          aria-expanded={isOpen}
                          className="w-full text-left py-6 group focus:outline-none focus-visible:ring-1 focus-visible:ring-cream/40 rounded-sm"
                        >
                          <div className="flex items-baseline gap-4 sm:gap-6">
                            <span
                              className={`font-roboto-mono text-xs tabular-nums transition-colors ${
                                isOpen ? 'text-cream' : 'text-cream/35 group-hover:text-cream/60'
                              }`}
                            >
                              {feature.id}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <feature.icon
                                  className={`h-4 w-4 shrink-0 transition-colors ${
                                    isOpen ? 'text-cream' : 'text-cream/40 group-hover:text-cream/70'
                                  }`}
                                />
                                <h3
                                  className={`font-outfit tracking-tight transition-colors ${
                                    isMobile ? 'text-xl' : 'text-2xl'
                                  } ${isOpen ? 'text-cream' : 'text-cream/60 group-hover:text-cream/90'}`}
                                >
                                  {feature.title}
                                </h3>
                              </div>

                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    key="body"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-4 pl-7">
                                      <p className="text-cream/70 font-outfit max-w-lg leading-relaxed">
                                        {feature.description}
                                      </p>
                                      <p className="mt-4 font-roboto-mono text-xs text-cream/50">
                                        {feature.metric}
                                      </p>
                                      <div className="mt-5 flex flex-wrap gap-2">
                                        {feature.tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className="px-3 py-1 rounded-full border border-cream/15 text-cream/70 text-xs font-roboto-mono"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/*
                Intentionally empty at lg and up: this is the column the 3D
                object occupies once the features trigger fires.
              */}
              <div className="hidden lg:block lg:col-span-5 xl:col-span-6" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section id="contact" className={`${isMobile ? 'py-16' : 'min-h-screen py-24'} flex items-center`}>
          <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
            <motion.div
              className={`max-w-3xl mx-auto ${isMobile ? 'text-center' : ''}`}
              initial={{ opacity: 0, y: isMobile ? 0 : 20 }}
              whileInView={{ opacity: 1, y: 0 }}
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
                    Join Sokin today and experience a new way to manage your personal finances. It&apos;s completely free to
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
                  <p className={`${isMobile ? 'text-base mb-4' : 'text-lg mb-6'} text-cream/70 font-outfit`}></p>
                  <p className={`${isMobile ? 'text-base mb-2' : 'text-lg mb-2'} text-cream font-outfit`}></p>
                  <p className={`${isMobile ? 'text-base' : 'text-lg'} text-cream font-outfit`}></p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <footer id="footer" className={`${isMobile ? 'py-8' : 'py-12'} relative z-20`}>
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
