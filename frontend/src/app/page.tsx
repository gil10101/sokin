"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useRef } from "react"
import { ArrowRight, Menu, X, ArrowDown, BarChart3, PieChart, Target, Wallet, TrendingUp, CalendarClock, LineChart, Sparkles } from "lucide-react"
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
 *
 * Every entry renders in full, always. An earlier version expanded the active
 * one and collapsed the rest, which changed the section's height mid-scroll -
 * that shifted content under the reader and re-triggered the very observer that
 * caused the expansion. Scroll now moves emphasis only, so the height is
 * constant and there is nothing to fight.
 */
const coreFeatures = [
  {
    id: "01",
    title: "Expenses and receipts",
    description:
      "Scan a receipt or type a line. Cloud Vision reads the merchant and amount, and you confirm before anything is saved.",
    icon: Wallet,
    tags: ["Receipt OCR", "Search and filter", "Bulk editing"],
  },
  {
    id: "02",
    title: "Budgets",
    description:
      "Per-category limits over any period, measured against real spending. Alerts arrive at 80%, while you can still act on them.",
    icon: PieChart,
    tags: ["Any timeframe", "Threshold alerts", "Per category"],
  },
  {
    id: "03",
    title: "Savings goals",
    description:
      "Contributions are recorded transactionally, so two at once cannot lose each other. Progress reflects what you put in, not what you intended to.",
    icon: Target,
    tags: ["Contribution history", "Milestones", "Transactional"],
  },
  {
    id: "04",
    title: "Net worth",
    description:
      "Assets against liabilities, snapshotted monthly. Every point on the chart is a snapshot you actually have - nothing is interpolated.",
    icon: TrendingUp,
    tags: ["Assets and debts", "Monthly history", "Real snapshots only"],
  },
  {
    id: "05",
    title: "Bills and subscriptions",
    description:
      "Recurring bills with due dates and an upcoming view, plus subscriptions with projected schedules and true monthly cost.",
    icon: CalendarClock,
    tags: ["Due tracking", "Projected cost", "Renewal reminders"],
  },
  {
    id: "06",
    title: "Stocks and portfolio",
    description:
      "Live quotes and company data from Finnhub, a watchlist, and a buy/sell portfolio with cost basis and gain-loss tracking.",
    icon: LineChart,
    tags: ["Live quotes", "Watchlist", "Cost basis"],
  },
  {
    id: "07",
    title: "Analytics",
    description:
      "Category breakdowns, monthly trends and a spending heatmap, aggregated server-side across your whole history rather than a recent slice.",
    icon: BarChart3,
    tags: ["Trends", "Heatmap", "Full-history totals"],
  },
  {
    id: "08",
    title: "AI assistance",
    description:
      "Claude suggests a category as you type an expense, and writes a short summary of your month from figures the server computed - never invented.",
    icon: Sparkles,
    tags: ["Category suggestions", "Written insights", "Grounded in real data"],
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
   * The carousel index is a pure function of scroll position within the
   * section's track, not a timer and not an observer.
   *
   * The track is taller than the viewport and holds a sticky panel; how far the
   * track has travelled past the top of the screen maps directly to an index.
   * Because the panel is sticky and fixed-height, advancing never changes the
   * document's layout - so reading scroll position can't perturb the thing that
   * produced it.
   */
  const featuresTrackRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const track = featuresTrackRef.current
    if (!track) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = track.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable <= 0) return

      // 0 when the track's top hits the top of the viewport, 1 when its bottom does.
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1)
      const index = Math.min(
        coreFeatures.length - 1,
        Math.floor(progress * coreFeatures.length)
      )
      setCurrentFeature((prev) => (prev === index ? prev : index))
    }

    // rAF-coalesced: scroll fires far more often than we need to recompute.
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const activeFeature = coreFeatures[currentFeature] ?? coreFeatures[0]

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

        {/*
          A scroll-driven vertical carousel.

          The section is a tall scroll track wrapping a sticky, viewport-height
          panel. Scrolling through the track advances the index; the panel never
          moves or resizes, so there is no reflow to fight - which is what made
          the previous accordion lurch on mobile.

          No `bg-dark` here, deliberately. Every other section leaves its
          background transparent so the fixed 3D scene shows through; this
          section was the only one painting over it, which is why the object
          disappeared exactly here.
        */}
        <section id="features" ref={featuresTrackRef} className="relative">
          <div style={{ height: `${coreFeatures.length * 55}vh` }}>
            <div className="sticky top-0 h-screen flex items-center overflow-hidden">
              <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-6">
                    <p className="text-sm font-roboto-mono text-cream/60 mb-4">02 / Features</p>
                    <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl lg:text-4xl'} font-medium tracking-tight font-outfit mb-10 max-w-lg`}>
                      Built to tell you the truth about your money.
                    </h2>

                    {/* Fixed-height stage: the panel below swaps content inside it,
                        so nothing above or below ever shifts. */}
                    <div className={`relative ${isMobile ? 'h-[270px]' : 'h-[240px]'}`}>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeFeature.id}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -24 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="absolute inset-0"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <span className="font-roboto-mono text-xs tabular-nums text-cream/50">
                              {activeFeature.id}
                            </span>
                            <span className="h-px flex-1 max-w-[40px] bg-cream/20" />
                            <activeFeature.icon className="h-4 w-4 text-cream/70" />
                          </div>

                          <h3 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-medium font-outfit tracking-tight mb-3`}>
                            {activeFeature.title}
                          </h3>
                          <p className={`${isMobile ? 'text-sm' : 'text-base'} text-cream/70 font-outfit leading-relaxed max-w-md`}>
                            {activeFeature.description}
                          </p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {activeFeature.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-0.5 rounded-full border border-cream/20 text-cream/60 text-[11px] font-roboto-mono"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Progress rail - shows position in the set without being a control,
                        since scroll is what advances it. */}
                    <div className="mt-8 flex gap-1.5" aria-hidden="true">
                      {coreFeatures.map((f, i) => (
                        <span
                          key={f.id}
                          className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                            i === currentFeature ? "bg-cream/70" : "bg-cream/15"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 font-roboto-mono text-[11px] text-cream/40">
                      {String(currentFeature + 1).padStart(2, "0")} / {String(coreFeatures.length).padStart(2, "0")}
                    </p>
                  </div>

                  {/* Right column left clear for the 3D object, which the scroll
                      trigger parks at x:25% during this section. */}
                  <div className="hidden lg:block lg:col-span-6" aria-hidden="true" />
                </div>
              </div>
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
