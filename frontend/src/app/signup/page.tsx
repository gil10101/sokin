"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { signUp } = useAuth()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signUp(name, email, password)

      toast({
        title: "Account created",
        description: "Welcome to Sokin! Your account has been created successfully.",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error creating your account"
      toast({
        title: "Signup failed",
        description: errorMessage,
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
            <h1 className="text-3xl font-medium font-outfit mb-2">Create an account</h1>
            <p className="text-cream/60">Join Sokin to manage your finances</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-outfit block">
                Full Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-outfit block">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-outfit block">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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
              <p className="text-xs text-cream/40 mt-1">Password must be at least 6 characters long</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-cream text-dark hover:bg-cream/90 font-medium group"
            >
              {loading ? "Creating account..." : "Create account"}
              {!loading && (
                <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-cream/60 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-cream hover:underline group inline-flex items-center">
                Sign in
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

