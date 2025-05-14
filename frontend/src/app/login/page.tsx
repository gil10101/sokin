"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "../../components/ui/input"
import { Button } from "../../components/ui/button"
import { useToast } from "../../hooks/use-toast"
import { useAuth } from "../../contexts/auth-context"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { signIn } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
      toast({
        title: "Login successful",
        description: "Welcome back to Sokin",
      })
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark text-cream flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <span className="text-xl font-medium font-outfit tracking-tight">
                Sokin<span className="text-xs align-super">™</span>
              </span>
            </Link>
            <h1 className="text-3xl font-medium font-outfit mb-2">Welcome back</h1>
            <p className="text-cream/60">Sign in to your Sokin account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-outfit block">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-outfit block">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-cream/60 hover:text-cream transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-cream text-dark hover:bg-cream/90 font-medium group"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && (
                <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-cream/60 text-sm">
              Don't have an account?{" "}
              <Link href="/signup" className="text-cream hover:underline group inline-flex items-center">
                Sign up
                <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <footer className="py-6 text-center text-cream/40 text-sm">
        <p>
          Sokin<span className="text-xs align-super">™</span> &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}

