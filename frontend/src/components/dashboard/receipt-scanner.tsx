"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Loader2, Camera, Upload, Check, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { auth } from '@/lib/firebase'
import { expensesAPI } from '@/lib/api'
import { useCategories } from '@/hooks/use-categories'
import { validateExpenseAmount, isValidAmountInput } from '@/lib/expense-validation'
import { useCurrency } from "@/hooks/use-currency"

// Below this confidence we ask the user to review before saving
const LOW_CONFIDENCE_THRESHOLD = 0.6

interface ParsedReceiptData {
  merchant?: string
  amount?: number
  date?: string
  items?: string[]
  confidence: number
  suggestedName?: string
  suggestedCategory?: string
  suggestedDescription?: string
  imageUrl?: string
  rawText?: string
}

interface ReceiptScannerProps {
  onDataExtracted?: (data: ParsedReceiptData) => void
  onExpenseCreated?: () => void
}

interface ExpenseFormErrors {
  name?: string
  amount?: string
  date?: string
  category?: string
}

const EMPTY_EXPENSE_FORM = {
  name: '',
  amount: '',
  date: '',
  category: '',
  description: ''
}

export function ReceiptScanner({ onDataExtracted, onExpenseCreated }: ReceiptScannerProps) {
  const { format: formatCurrency } = useCurrency()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ParsedReceiptData | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [creatingExpense, setCreatingExpense] = useState(false)
  const [formErrors, setFormErrors] = useState<ExpenseFormErrors>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewImageRef = useRef<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { categories } = useCategories()

  // Expense form state (amount kept as a raw string so partial input isn't mangled)
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM)

  // Swap the preview blob URL, revoking the previous one so it doesn't leak
  const replacePreviewImage = (url: string | null) => {
    if (previewImageRef.current && previewImageRef.current !== url) {
      URL.revokeObjectURL(previewImageRef.current)
    }
    previewImageRef.current = url
    setPreviewImage(url)
  }

  // Revoke any outstanding preview blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewImageRef.current) {
        URL.revokeObjectURL(previewImageRef.current)
        previewImageRef.current = null
      }
    }
  }, [])

  const updateFormField = (field: keyof typeof EMPTY_EXPENSE_FORM, value: string) => {
    setExpenseForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => (prev[field as keyof ExpenseFormErrors] ? { ...prev, [field]: undefined } : prev))
  }

  const resetScannerState = () => {
    setShowConfirmation(false)
    setExtractedData(null)
    setFormErrors({})
    setExpenseForm(EMPTY_EXPENSE_FORM)
    replacePreviewImage(null)
  }

  const processReceipt = async (file: File) => {
    setLoading(true)
    try {
      // Create preview (revoking any previous blob URL)
      replacePreviewImage(URL.createObjectURL(file))

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
        const data: ParsedReceiptData = result.data
        const needsReview = data.confidence < LOW_CONFIDENCE_THRESHOLD

        // Guard against unparseable OCR dates
        const today = new Date().toISOString().split('T')[0]
        const parsedDate = data.date ? new Date(data.date) : null
        const extractedDate = parsedDate && !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString().split('T')[0]
          : today

        setExtractedData(data)
        setFormErrors({})
        // Pre-populate form with extracted data. When confidence is low, leave
        // amount and date empty so the user enters them deliberately.
        setExpenseForm({
          name: data.suggestedName || '',
          amount: needsReview ? '' : (data.amount ? data.amount.toString() : ''),
          date: needsReview ? '' : extractedDate,
          category: data.suggestedCategory || 'Other',
          description: data.suggestedDescription || ''
        })
        setScannerOpen(false)
        setShowConfirmation(true)
        toast({
          title: needsReview ? "Receipt processed — needs review" : "Receipt processed successfully",
          description: `Extracted data with ${Math.round(data.confidence * 100)}% confidence`
        })
      } else {
        throw new Error(result.error || 'Failed to extract data')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please try again or enter the expense manually";

      toast({
        title: "Error processing receipt",
        description: errorMessage,
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
  }, [handleFileSelect])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const createExpenseFromReceipt = async () => {
    if (!extractedData) return

    // Validate before submitting — backend requires amount, date and category
    const errors: ExpenseFormErrors = {}
    const amountValidation = validateExpenseAmount(expenseForm.amount)

    if (!expenseForm.name.trim()) {
      errors.name = 'Expense name is required'
    }
    if (!amountValidation.ok) {
      errors.amount = amountValidation.error
    }
    if (!expenseForm.date) {
      errors.date = 'Date is required'
    }
    if (!expenseForm.category) {
      errors.category = 'Category is required'
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!amountValidation.ok) return

    setCreatingExpense(true)
    try {
      await expensesAPI.createExpense({
        name: expenseForm.name.trim(),
        amount: amountValidation.value,
        category: expenseForm.category,
        date: new Date(expenseForm.date).toISOString(),
        description: expenseForm.description.trim(),
        ...(extractedData.imageUrl ? { receiptImageUrl: extractedData.imageUrl } : {}),
        receiptData: {
          merchant: extractedData.merchant || '',
          confidence: extractedData.confidence,
          items: extractedData.items || [],
          rawText: extractedData.rawText || ''
        }
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ])

      toast({
        title: "Expense created successfully",
        description: "Your receipt has been processed and expense added"
      })

      resetScannerState()
      onExpenseCreated?.()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create expense";

      toast({
        title: "Error creating expense",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setCreatingExpense(false)
    }
  }

  const confirmExtraction = () => {
    if (!extractedData) return

    // Hand the reviewed values (not the raw OCR result) back to the parent form
    const amountValidation = validateExpenseAmount(expenseForm.amount)
    onDataExtracted?.({
      ...extractedData,
      suggestedName: expenseForm.name.trim() || undefined,
      amount: amountValidation.ok ? amountValidation.value : undefined,
      date: expenseForm.date || undefined,
      suggestedCategory: expenseForm.category || undefined,
      suggestedDescription: expenseForm.description.trim() || undefined
    })
    resetScannerState()
  }

  const rejectExtraction = () => {
    resetScannerState()
  }

  const lowConfidence = !!extractedData && extractedData.confidence < LOW_CONFIDENCE_THRESHOLD

  return (
    <>
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
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
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
              }`}
              onClick={() => fileInputRef.current?.click()}
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
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
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
      <Dialog open={showConfirmation} onOpenChange={(open: boolean) => { if (!open) rejectExtraction() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Expense from Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {lowConfidence && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Low confidence — review before saving
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Receipt Preview */}
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
                  <Card className="text-xs">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        Extracted Data
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({Math.round(extractedData.confidence * 100)}% confidence)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      {extractedData.merchant && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Merchant:</span>
                          <span>{extractedData.merchant}</span>
                        </div>
                      )}
                      {extractedData.amount && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">{formatCurrency(extractedData.amount)}</span>
                        </div>
                      )}
                      {extractedData.items && extractedData.items.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Items:</span>
                          <div className="mt-1">
                            {extractedData.items.slice(0, 2).map((item, index) => (
                              <div key={index} className="text-muted-foreground">• {item}</div>
                            ))}
                            {extractedData.items.length > 2 && (
                              <div className="text-muted-foreground">
                                +{extractedData.items.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Expense Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Expense Name</Label>
                  <Input
                    id="name"
                    value={expenseForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormField('name', e.target.value)}
                    placeholder="Enter expense name"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-400">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={expenseForm.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value
                        if (isValidAmountInput(value)) {
                          updateFormField('amount', value)
                        }
                      }}
                      placeholder="0.00"
                    />
                    {formErrors.amount && (
                      <p className="text-xs text-red-400">{formErrors.amount}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={expenseForm.date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormField('date', e.target.value)}
                    />
                    {formErrors.date && (
                      <p className="text-xs text-red-400">{formErrors.date}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={expenseForm.category}
                    onChange={(e) => updateFormField('category', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">Select category...</option>
                    {expenseForm.category && !categories.includes(expenseForm.category) && (
                      <option value={expenseForm.category}>{expenseForm.category}</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {formErrors.category && (
                    <p className="text-xs text-red-400">{formErrors.category}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={expenseForm.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormField('description', e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              {onDataExtracted ? (
                <>
                  <Button
                    onClick={confirmExtraction}
                    className="flex-1"
                    disabled={creatingExpense}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Use these values
                  </Button>
                  <Button
                    variant="outline"
                    onClick={createExpenseFromReceipt}
                    className="flex-1"
                    disabled={creatingExpense}
                  >
                    {creatingExpense ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create expense directly'
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={createExpenseFromReceipt}
                  className="flex-1"
                  disabled={creatingExpense}
                >
                  {creatingExpense ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Create Expense
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={rejectExtraction} className="flex-1" disabled={creatingExpense}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
