"use client"

import { useState, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Loader2, Camera, Upload, Check, X } from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '../../lib/firebase'

interface ParsedReceiptData {
  merchant?: string
  amount?: number
  date?: string
  items?: string[]
  confidence: number
}

interface ReceiptScannerProps {
  onDataExtracted: (data: ParsedReceiptData) => void
}

export function ReceiptScanner({ onDataExtracted }: ReceiptScannerProps) {
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ParsedReceiptData | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const processReceipt = async (file: File) => {
    setLoading(true)
    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file)
      setPreviewImage(previewUrl)

      // Prepare form data
      const formData = new FormData()
      formData.append('receipt', file)

      // Get Firebase auth token
      const user = auth.currentUser
      if (!user) {
        throw new Error('User not authenticated')
      }
      const token = await user.getIdToken()

      // Send to backend
      const response = await fetch('/api/receipts/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to process receipt')
      }

      const result = await response.json()
      
      if (result.success) {
        setExtractedData(result.data)
        setShowConfirmation(true)
        toast({
          title: "Receipt processed successfully",
          description: `Extracted data with ${Math.round(result.data.confidence * 100)}% confidence`
        })
      } else {
        throw new Error(result.error || 'Failed to extract data')
      }
    } catch (error: any) {
      console.error('Receipt processing error:', error)
      toast({
        title: "Error processing receipt",
        description: error.message || "Please try again or enter the expense manually",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive"
      })
      return
    }

    processReceipt(file)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const confirmExtraction = () => {
    if (extractedData) {
      onDataExtracted(extractedData)
      setShowConfirmation(false)
      setExtractedData(null)
      setPreviewImage(null)
    }
  }

  const rejectExtraction = () => {
    setShowConfirmation(false)
    setExtractedData(null)
    setPreviewImage(null)
  }

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Camera className="mr-2 h-4 w-4" />
            Scan Receipt
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {loading ? (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm text-muted-foreground">Processing receipt...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drag and drop a receipt image</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    Choose File
                  </Button>
                </div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Extracted Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewImage && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img 
                  src={previewImage} 
                  alt="Receipt preview" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {extractedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Extracted Information 
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({Math.round(extractedData.confidence * 100)}% confidence)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.merchant && (
                    <div className="flex justify-between">
                      <Label className="text-xs text-muted-foreground">Merchant:</Label>
                      <span className="text-sm">{extractedData.merchant}</span>
                    </div>
                  )}
                  {extractedData.amount && (
                    <div className="flex justify-between">
                      <Label className="text-xs text-muted-foreground">Amount:</Label>
                      <span className="text-sm font-medium">${extractedData.amount.toFixed(2)}</span>
                    </div>
                  )}
                  {extractedData.date && (
                    <div className="flex justify-between">
                      <Label className="text-xs text-muted-foreground">Date:</Label>
                      <span className="text-sm">{extractedData.date}</span>
                    </div>
                  )}
                  {extractedData.items && extractedData.items.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Items:</Label>
                      <ul className="text-sm mt-1 space-y-1">
                        {extractedData.items.slice(0, 3).map((item, index) => (
                          <li key={index} className="text-muted-foreground">• {item}</li>
                        ))}
                        {extractedData.items.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{extractedData.items.length - 3} more items
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            <div className="flex space-x-2">
              <Button onClick={confirmExtraction} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Use This Data
              </Button>
              <Button variant="outline" onClick={rejectExtraction} className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Manual Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 