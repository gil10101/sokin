"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { sendPasswordResetEmail } from "firebase/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { auth } from "@/lib/firebase"
import { logger } from "@/lib/logger"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
    } catch (error: unknown) {
      logger.error("Password reset request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      })
      // Do not reveal whether the address has an account
      setSent(true)
    } finally {
      setLoading(false)
    }

    toast({
      title: "Check your inbox",
      description: "If an account exists for that address, a reset link is on its way.",
    })
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
            <h1 className="text-3xl font-medium font-outfit mb-2">Reset your password</h1>
            <p className="text-cream/60">
              {sent
                ? "If an account exists for that address, a reset link is on its way."
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-outfit block">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-cream text-dark hover:bg-cream/90 font-medium"
              >
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          ) : null}

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-cream/60 hover:text-cream transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </div>

      <footer className="py-6 text-center text-cream/40 text-sm">
        Sokin<span className="text-xs align-super">™</span> © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
