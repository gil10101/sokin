"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowRight, Menu, X, ArrowDown } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.05], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.05], [1, 0.98])

  const [activeSection, setActiveSection] = useState("hero")
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

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
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark text-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cream"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-dark text-cream relative overflow-hidden">
      <header className="fixed top-0 z-50 w-full bg-dark/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 md:px-12 lg:px-16 flex h-24 items-center justify-between">
          <div className="flex-1 flex justify-start">
            <span className="text-xl font-medium font-outfit tracking-tight">
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
            className="md:hidden px-6 py-4 bg-dark/90 backdrop-blur-md"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection("about")}
                className="text-sm font-outfit transition-colors hover:text-cream text-cream/60"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection("features")}
                className="text-sm font-outfit transition-colors hover:text-cream text-cream/60"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-sm font-outfit transition-colors hover:text-cream text-cream/60"
              >
                Contact
              </button>
              {user ? (
                <Link href="/dashboard" className="text-sm font-outfit text-cream" onClick={() => setIsMenuOpen(false)}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-outfit text-cream" onClick={() => setIsMenuOpen(false)}>
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-cream text-dark font-medium text-sm"
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
        <section id="hero" className="h-screen flex items-center justify-center relative pt-24">
          <motion.div
            className="container mx-auto px-6 md:px-12 lg:px-16 relative z-10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight font-outfit mb-6">Sokin</h1>
            <p className="text-lg md:text-xl text-cream/70 font-outfit mb-24 max-w-md mx-auto">
              Personal finance, redefined.
            </p>
            <motion.div
              className="absolute bottom-12 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <button
                onClick={() => scrollToSection("about")}
                className="text-cream/60 hover:text-cream transition-colors"
              >
                <ArrowDown className="h-8 w-8" />
              </button>
            </motion.div>
          </motion.div>
        </section>

        <section id="about" className="min-h-screen flex items-center py-24">
          <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
            <motion.div
              className="max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-sm font-roboto-mono text-cream/60 mb-12">01 / About</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight font-outfit mb-12">
                A new approach to managing your finances.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
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
        </section>

        <section id="features" className="py-24 bg-dark">
          <div className="container mx-auto px-6 md:px-12 lg:px-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="mb-16"
              >
                <p className="text-sm font-roboto-mono text-cream/60 mb-4">02 / Features</p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight font-outfit">
                  Thoughtfully designed for your financial journey.
                </h2>
              </motion.div>

              {coreFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                  className={`flex flex-col ${index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-8 md:gap-16 mb-24 last:mb-0`}
                >
                  <div className="w-full md:w-1/2">
                    <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-2xl">
                      <Image
                        src={`/images/features/${feature.imageSrc}`}
                        alt={feature.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="w-full md:w-1/2">
                    <div className="p-4 md:p-8">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-cream/5 mb-6">
                        <feature.icon className="h-6 w-6 text-cream/60" />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-medium font-outfit mb-4">{feature.title}</h3>
                      <p className="text-lg text-cream/70 font-outfit mb-6">{feature.description}</p>
                      <div className="flex flex-wrap gap-3">
                        {feature.tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 rounded-full bg-cream/5 text-cream/80 text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="min-h-screen flex items-center py-24">
          <div className="container mx-auto px-6 md:px-12 lg:px-16 w-full">
            <motion.div
              className="max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-sm font-roboto-mono text-cream/60 mb-12">03 / Contact</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight font-outfit mb-12">
                Ready to transform your finances?
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
                <div>
                  <p className="text-lg text-cream/70 font-outfit mb-6">
                    Join Sokin today and experience a new way to manage your personal finances. It's completely free to
                    use.
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                    <Link
                      href={user ? "/dashboard" : "/signup"}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-cream/20 px-8 text-sm font-medium text-cream transition-colors hover:border-cream group"
                    >
                      {user ? "Go to Dashboard" : "Get Started"}
                      <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </motion.div>
                </div>
                <div>
                  <p className="text-lg text-cream/70 font-outfit mb-6">Have questions? We're here to help.</p>
                  <p className="text-lg text-cream font-outfit mb-2">hello@sokin.com</p>
                  <p className="text-lg text-cream font-outfit">+1 (555) 123-4567</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <footer className="py-12 relative z-10">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 max-w-3xl mx-auto">
            <div>
              <span className="text-lg font-medium font-outfit tracking-tight">
                Sokin<span className="text-xs align-super">™</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="text-sm text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center"
                >
                  Dashboard
                  <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center"
                  >
                    Login
                    <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm text-cream/60 hover:text-cream transition-colors font-outfit group inline-flex items-center"
                  >
                    Sign Up
                    <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform duration-300" />
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

