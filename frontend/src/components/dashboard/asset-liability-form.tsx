"use client"

import React, { useState, useEffect } from 'react'
import { 
  X,
  Save,
  DollarSign,
  FileText,
  Calendar,
  Percent,
  AlertCircle,
  Check
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useAuth } from '../../contexts/auth-context'
import { api } from '../../lib/api'
import { 
  Asset, 
  Liability, 
  AssetType, 
  LiabilityType,
  AssetCategory, 
  LiabilityCategory,
  AssetFormData,
  LiabilityFormData
} from '../../lib/types'

interface AssetLiabilityFormProps {
  type: 'asset' | 'liability'
  editItem?: Asset | Liability | null
  onSuccess: () => void
  onCancel: () => void
}

// Type configurations
const ASSET_TYPES_BY_CATEGORY: Record<AssetCategory, { value: AssetType; label: string }[]> = {
  bank_accounts: [
    { value: 'checking', label: 'Checking Account' },
    { value: 'savings', label: 'Savings Account' },
    { value: 'money_market', label: 'Money Market Account' },
    { value: 'cd', label: 'Certificate of Deposit' }
  ],
  investment_accounts: [
    { value: 'stocks', label: 'Stocks' },
    { value: 'crypto', label: 'Cryptocurrency' },
    { value: 'retirement_401k', label: '401(k)' },
    { value: 'retirement_ira', label: 'IRA' },
    { value: 'mutual_funds', label: 'Mutual Funds' },
    { value: 'bonds', label: 'Bonds' },
    { value: 'brokerage', label: 'Brokerage Account' }
  ],
  real_estate: [
    { value: 'primary_residence', label: 'Primary Residence' },
    { value: 'rental_property', label: 'Rental Property' },
    { value: 'commercial_property', label: 'Commercial Property' },
    { value: 'land', label: 'Land' }
  ],
  vehicles: [
    { value: 'car', label: 'Car' },
    { value: 'truck', label: 'Truck' },
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'boat', label: 'Boat' },
    { value: 'rv', label: 'RV' }
  ],
  other_valuables: [
    { value: 'collectibles', label: 'Collectibles' },
    { value: 'business_ownership', label: 'Business Ownership' },
    { value: 'jewelry', label: 'Jewelry' },
    { value: 'art', label: 'Art' },
    { value: 'other', label: 'Other' }
  ]
}

const LIABILITY_TYPES_BY_CATEGORY: Record<LiabilityCategory, { value: LiabilityType; label: string }[]> = {
  credit_cards: [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'store_card', label: 'Store Card' },
    { value: 'business_card', label: 'Business Credit Card' }
  ],
  mortgages: [
    { value: 'primary_mortgage', label: 'Primary Mortgage' },
    { value: 'second_mortgage', label: 'Second Mortgage' },
    { value: 'heloc', label: 'HELOC' }
  ],
  student_loans: [
    { value: 'federal_student_loan', label: 'Federal Student Loan' },
    { value: 'private_student_loan', label: 'Private Student Loan' }
  ],
  auto_loans: [
    { value: 'car_loan', label: 'Car Loan' },
    { value: 'truck_loan', label: 'Truck Loan' },
    { value: 'motorcycle_loan', label: 'Motorcycle Loan' }
  ],
  personal_loans: [
    { value: 'personal_loan', label: 'Personal Loan' },
    { value: 'payday_loan', label: 'Payday Loan' },
    { value: 'medical_debt', label: 'Medical Debt' }
  ],
  other_debts: [
    { value: 'business_loan', label: 'Business Loan' },
    { value: 'family_loan', label: 'Family Loan' },
    { value: 'other', label: 'Other' }
  ]
}

const ASSET_CATEGORIES = [
  { value: 'bank_accounts', label: 'Bank Accounts' },
  { value: 'investment_accounts', label: 'Investment Accounts' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'other_valuables', label: 'Other Valuables' }
] as const

const LIABILITY_CATEGORIES = [
  { value: 'credit_cards', label: 'Credit Cards' },
  { value: 'mortgages', label: 'Mortgages' },
  { value: 'student_loans', label: 'Student Loans' },
  { value: 'auto_loans', label: 'Auto Loans' },
  { value: 'personal_loans', label: 'Personal Loans' },
  { value: 'other_debts', label: 'Other Debts' }
] as const

export function AssetLiabilityForm({ type, editItem, onSuccess, onCancel }: AssetLiabilityFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Form state for assets
  const [assetForm, setAssetForm] = useState<AssetFormData>({
    type: 'checking',
    category: 'bank_accounts',
    name: '',
    currentValue: 0,
    description: '',
    metadata: {}
  })

  // Form state for liabilities
  const [liabilityForm, setLiabilityForm] = useState<LiabilityFormData>({
    type: 'credit_card',
    category: 'credit_cards',
    name: '',
    currentBalance: 0,
    originalAmount: 0,
    interestRate: 0,
    minimumPayment: 0,
    dueDate: '',
    metadata: {}
  })

  // Initialize form with edit data
  useEffect(() => {
    if (editItem) {
      if (type === 'asset') {
        const asset = editItem as Asset
        setAssetForm({
          type: asset.type,
          category: asset.category,
          name: asset.name,
          currentValue: asset.currentValue,
          description: asset.description || '',
          metadata: asset.metadata || {}
        })
      } else {
        const liability = editItem as Liability
        setLiabilityForm({
          type: liability.type,
          category: liability.category,
          name: liability.name,
          currentBalance: liability.currentBalance,
          originalAmount: liability.originalAmount || 0,
          interestRate: liability.interestRate || 0,
          minimumPayment: liability.minimumPayment || 0,
          dueDate: liability.dueDate || '',
          metadata: liability.metadata || {}
        })
      }
    }
  }, [editItem, type])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (type === 'asset') {
      if (!assetForm.name.trim()) {
        newErrors.name = 'Asset name is required'
      }
      if (assetForm.currentValue <= 0) {
        newErrors.currentValue = 'Value must be greater than 0'
      }
    } else {
      if (!liabilityForm.name.trim()) {
        newErrors.name = 'Liability name is required'
      }
      if (liabilityForm.currentBalance <= 0) {
        newErrors.currentBalance = 'Balance must be greater than 0'
      }
      if (liabilityForm.interestRate && (liabilityForm.interestRate < 0 || liabilityForm.interestRate > 100)) {
        newErrors.interestRate = 'Interest rate must be between 0 and 100'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      const token = await user?.getIdToken()

      const endpoint = type === 'asset' ? 'net-worth/assets' : 'net-worth/liabilities'
      
      // Prepare the body data and clean up empty optional fields
      let body: AssetFormData | LiabilityFormData
      if (type === 'asset') {
        body = {
          ...assetForm,
          // Remove empty description
          ...(assetForm.description === '' && { description: undefined }),
          // Clean up metadata
          metadata: Object.keys(assetForm.metadata || {}).length > 0 ? assetForm.metadata : undefined
        }
      } else {
        body = {
          ...liabilityForm,
          // Remove empty optional fields that should not be sent as empty strings
          ...(liabilityForm.dueDate === '' && { dueDate: undefined }),
          ...(liabilityForm.originalAmount === 0 && { originalAmount: undefined }),
          ...(liabilityForm.interestRate === 0 && { interestRate: undefined }),
          ...(liabilityForm.minimumPayment === 0 && { minimumPayment: undefined }),
          // Clean up metadata
          metadata: Object.keys(liabilityForm.metadata || {}).length > 0 ? liabilityForm.metadata : undefined
        }
      }

      // Remove undefined fields
      body = Object.fromEntries(
        Object.entries(body).filter(([_key, value]: [string, unknown]) => value !== undefined)
      ) as AssetFormData | LiabilityFormData

      if (editItem) {
        // Update existing item
        await api.put(`${endpoint}/${editItem.id}`, body as unknown as Record<string, unknown>, { token })
      } else {
        // Create new item
        await api.post(endpoint, body as unknown as Record<string, unknown>, { token })
      }

      onSuccess()
    } catch (error) {

      setErrors({ submit: 'An error occurred while saving' })
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (category: string) => {
    if (type === 'asset') {
      const assetCategory = category as AssetCategory
      const firstType = ASSET_TYPES_BY_CATEGORY[assetCategory][0]?.value || 'other'
      setAssetForm(prev => ({
        ...prev,
        category: assetCategory,
        type: firstType
      }))
    } else {
      const liabilityCategory = category as LiabilityCategory
      const firstType = LIABILITY_TYPES_BY_CATEGORY[liabilityCategory][0]?.value || 'other'
      setLiabilityForm(prev => ({
        ...prev,
        category: liabilityCategory,
        type: firstType
      }))
    }
  }

  const currentForm = type === 'asset' ? assetForm : liabilityForm
  const currentCategory = type === 'asset' ? assetForm.category : liabilityForm.category
  const availableTypes = type === 'asset' 
    ? ASSET_TYPES_BY_CATEGORY[assetForm.category]
    : LIABILITY_TYPES_BY_CATEGORY[liabilityForm.category]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-dark border-cream/10">
        <CardHeader className="border-b border-cream/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-cream">
              {editItem ? 'Edit' : 'Add'} {type === 'asset' ? 'Asset' : 'Liability'}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              className="text-cream/60 hover:text-cream hover:bg-cream/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-cream">Category</Label>
              <Select value={currentCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="bg-cream/5 border-cream/10 text-cream">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark border-cream/10">
                  {(type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES).map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} className="text-cream">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-cream">Type</Label>
              <Select 
                value={type === 'asset' ? assetForm.type : liabilityForm.type} 
                onValueChange={(value) => {
                  if (type === 'asset') {
                    setAssetForm(prev => ({ ...prev, type: value as AssetType }))
                  } else {
                    setLiabilityForm(prev => ({ ...prev, type: value as LiabilityType }))
                  }
                }}
              >
                <SelectTrigger className="bg-cream/5 border-cream/10 text-cream">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark border-cream/10">
                  {availableTypes.map((typeOption) => (
                    <SelectItem key={typeOption.value} value={typeOption.value} className="text-cream">
                      {typeOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-cream">Name</Label>
              <Input
                id="name"
                value={type === 'asset' ? assetForm.name : liabilityForm.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (type === 'asset') {
                    setAssetForm(prev => ({ ...prev, name: e.target.value }))
                  } else {
                    setLiabilityForm(prev => ({ ...prev, name: e.target.value }))
                  }
                }}
                className="bg-cream/5 border-cream/10 text-cream"
                placeholder={`Enter ${type} name`}
              />
              {errors.name && (
                <p className="text-red-400 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Value/Balance */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-cream">
                {type === 'asset' ? 'Current Value' : 'Current Balance'}
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/60" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={type === 'asset' 
                    ? (assetForm.currentValue || '') 
                    : (liabilityForm.currentBalance || '')
                  }
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value
                    if (value === '' || value === '0') {
                      if (type === 'asset') {
                        setAssetForm(prev => ({ ...prev, currentValue: 0 }))
                      } else {
                        setLiabilityForm(prev => ({ ...prev, currentBalance: 0 }))
                      }
                    } else {
                      const parsedValue = parseFloat(value)
                      if (!isNaN(parsedValue) && parsedValue > 0) {
                        if (type === 'asset') {
                          setAssetForm(prev => ({ ...prev, currentValue: parsedValue }))
                        } else {
                          setLiabilityForm(prev => ({ ...prev, currentBalance: parsedValue }))
                        }
                      }
                    }
                  }}
                  className="bg-cream/5 border-cream/10 text-cream pl-10"
                  placeholder="Enter amount in USD"
                />
              </div>
              {(errors.currentValue || errors.currentBalance) && (
                <p className="text-red-400 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.currentValue || errors.currentBalance}
                </p>
              )}
            </div>

            {/* Liability-specific fields */}
            {type === 'liability' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interestRate" className="text-cream">Interest Rate (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/60" />
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={liabilityForm.interestRate || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value
                          if (value === '' || value === '0') {
                            setLiabilityForm(prev => ({ ...prev, interestRate: 0 }))
                          } else {
                            const parsedValue = parseFloat(value)
                            if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 100) {
                              setLiabilityForm(prev => ({ ...prev, interestRate: parsedValue }))
                            }
                          }
                        }}
                        className="bg-cream/5 border-cream/10 text-cream pl-10"
                        placeholder="Enter interest rate"
                      />
                    </div>
                    {errors.interestRate && (
                      <p className="text-red-400 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.interestRate}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minimumPayment" className="text-cream">Minimum Payment</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/60" />
                      <Input
                        id="minimumPayment"
                        type="number"
                        step="0.01"
                        min="0"
                        value={liabilityForm.minimumPayment || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value
                          if (value === '' || value === '0') {
                            setLiabilityForm(prev => ({ ...prev, minimumPayment: 0 }))
                          } else {
                            const parsedValue = parseFloat(value)
                            if (!isNaN(parsedValue) && parsedValue > 0) {
                              setLiabilityForm(prev => ({ ...prev, minimumPayment: parsedValue }))
                            }
                          }
                        }}
                        className="bg-cream/5 border-cream/10 text-cream pl-10"
                        placeholder="Enter amount in USD"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-cream">Due Date (Optional)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/60" />
                    <Input
                      id="dueDate"
                      type="date"
                      value={liabilityForm.dueDate || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setLiabilityForm(prev => ({ ...prev, dueDate: e.target.value }))
                      }}
                      className="bg-cream/5 border-cream/10 text-cream pl-10"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Description/Notes */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-cream">
                {type === 'asset' ? 'Description' : 'Notes'} (Optional)
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-cream/60" />
                <Textarea
                  id="description"
                  value={type === 'asset' ? assetForm.description : liabilityForm.metadata?.notes || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    if (type === 'asset') {
                      setAssetForm(prev => ({ ...prev, description: e.target.value }))
                    } else {
                      setLiabilityForm(prev => ({
                        ...prev,
                        metadata: { ...prev.metadata, notes: e.target.value }
                      }))
                    }
                  }}
                  className="bg-cream/5 border-cream/10 text-cream pl-10 pt-3"
                  placeholder={`Add ${type === 'asset' ? 'description' : 'notes'} about this ${type}`}
                  rows={3}
                />
              </div>
            </div>

            {/* Error message */}
            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errors.submit}
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-cream/10">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editItem ? 'Update' : 'Add'} {type === 'asset' ? 'Asset' : 'Liability'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="border-cream/20 text-cream hover:bg-cream/10"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 