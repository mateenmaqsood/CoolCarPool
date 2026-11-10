'use client'

import { useCallback, useRef, useState } from 'react'
import { FileText, Image, Upload, X, Eye, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPKR } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export interface SlipUploaderProps {
  travelId: string
  onUploadComplete?: (totalPkr: number) => void
  existingSlip?: {
    storage_path: string
    total_pkr: number | null
    ocr_source: 'anthropic' | 'manual'
  } | null
  className?: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function SlipUploader({
  travelId,
  onUploadComplete,
  existingSlip,
  className,
}: SlipUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ocrResult, setOcrResult] = useState<{ total_pkr: number | null; fallback: boolean; error?: string } | null>(null)
  const [manualAmount, setManualAmount] = useState('')
  const [showManual, setShowManual] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      alert('Unsupported file type. Please upload JPEG, PNG, WebP, or GIF.')
      return
    }
    if (selectedFile.size > MAX_SIZE) {
      alert('File too large. Maximum size is 10 MB.')
      return
    }

    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
    setOcrResult(null)
    setShowManual(false)
    setManualAmount('')
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }, [handleFileSelect])

  const handleUpload = useCallback(async () => {
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/detect-slip', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Upload failed')
      }

      setOcrResult({
        total_pkr: data.total_pkr,
        fallback: data.fallback ?? false,
        error: data.error,
      })

      if (data.total_pkr && !data.fallback) {
        onUploadComplete?.(data.total_pkr)
      } else {
        setShowManual(true)
      }
    } catch (error) {
      console.error('[SlipUploader] error:', error)
      setOcrResult({
        total_pkr: null,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      setShowManual(true)
    } finally {
      setUploading(false)
    }
  }, [file, onUploadComplete])

  const handleManualSubmit = () => {
    const amount = parseInt(manualAmount.replace(/[^\d]/g, ''), 10)
    if (isNaN(amount) || amount < 50 || amount > 1_000_000) {
      alert('Please enter a valid amount between PKR 50 and PKR 1,000,000')
      return
    }
    setOcrResult({ total_pkr: amount, fallback: true })
    onUploadComplete?.(amount)
  }

  const handleRemove = () => {
    setFile(null)
    setPreviewUrl(null)
    setOcrResult(null)
    setShowManual(false)
    setManualAmount('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleViewExisting = () => {
    if (existingSlip?.storage_path) {
      window.open(`/api/storage/bill-slips/${existingSlip.storage_path}`, '_blank')
    }
  }

  // If there's an existing slip, show it
  if (existingSlip && !file && !ocrResult) {
    return (
      <div className={cn('rounded-2xl border border-line bg-elevated p-5', className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center">
              <FileText className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="font-semibold text-ink">Receipt Uploaded</p>
              <p className="text-sm text-ink-secondary">
                {existingSlip.ocr_source === 'anthropic' ? 'AI-extracted' : 'Manually entered'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={existingSlip.ocr_source === 'anthropic' ? 'brand' : 'warning'} size="sm">
              {existingSlip.ocr_source === 'anthropic' ? 'AI' : 'Manual'}
            </Badge>
            {existingSlip.total_pkr && (
              <span className="text-lg font-bold text-ink">{formatPKR(existingSlip.total_pkr)}</span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleViewExisting} className="flex-1">
            <Eye className="h-4 w-4 mr-2" /> View Receipt
          </Button>
          <Button variant="primary" onClick={() => setShowManual(true)} className="flex-1">
            <Upload className="h-4 w-4 mr-2" /> Upload New
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-line bg-elevated p-5', className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-8 text-center transition-all',
          file ? 'border-brand bg-brand-soft/20' : 'border-line hover:border-brand hover:bg-brand-soft/10'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        {previewUrl ? (
          <div className="relative max-w-xs mx-auto">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="rounded-lg shadow-lg max-h-64 w-full object-contain"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-ink-tertiary hover:text-error transition-colors"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-soft flex items-center justify-center">
              <Upload className="h-8 w-8 text-brand" />
            </div>
            <p className="font-medium text-ink mb-1">Drop receipt image here</p>
            <p className="text-sm text-ink-secondary">or click to browse (JPEG, PNG, WebP, GIF · max 10 MB)</p>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 rounded-xl flex items-center justify-center gap-3 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <span className="font-medium text-ink">Analyzing receipt...</span>
          </div>
        )}
      </div>

      {/* OCR Result */}
      {ocrResult && (
        <div className="mt-5 space-y-4 animate-slide-up">
          <div className="rounded-xl border p-4 bg-sunken">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  ocrResult.fallback ? 'bg-warning/10 text-warn' : 'bg-success/10 text-success'
                )}>
                  {ocrResult.fallback ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-ink">
                    {ocrResult.fallback ? 'Manual entry required' : 'Amount detected'}
                  </p>
                  <p className="text-sm text-ink-secondary">
                    {ocrResult.fallback
                      ? 'AI could not read the receipt clearly'
                      : 'AI extracted the total from your receipt'}
                  </p>
                </div>
              </div>
              {ocrResult.total_pkr && (
                <span className="text-2xl font-bold text-ink">{formatPKR(ocrResult.total_pkr)}</span>
              )}
            </div>

            {ocrResult.error && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {ocrResult.error}
              </p>
            )}
          </div>

          {ocrResult.fallback && !ocrResult.total_pkr && (
            <div className="rounded-xl border border-line bg-sunken p-4">
              <p className="font-medium text-ink mb-3">Enter total amount manually</p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  inputMode="numeric"
                  leftIcon={<FileText className="h-4 w-4" />}
                  rightSlot="PKR"
                  className="flex-1"
                />
                <Button variant="primary" onClick={handleManualSubmit} disabled={!manualAmount}>
                  Confirm
                </Button>
              </div>
            </div>
          )}

          {!ocrResult.fallback && ocrResult.total_pkr && (
            <Button variant="outline" onClick={() => setShowManual(true)} className="w-full">
              <X className="h-4 w-4 mr-2" /> Enter different amount
            </Button>
          )}

          {ocrResult.total_pkr && !showManual && (
            <Button variant="primary" onClick={() => onUploadComplete?.(ocrResult.total_pkr!)} className="w-full" size="lg">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Use this amount & proceed to split
            </Button>
          )}
        </div>
      )}

      {/* No file yet - show upload button */}
      {!file && !ocrResult && !existingSlip && (
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full mt-4">
          <Upload className="h-4 w-4 mr-2" /> Choose File
        </Button>
      )}
    </div>
  )
}