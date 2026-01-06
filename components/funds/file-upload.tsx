'use client'

import { forwardRef, useState, useRef } from 'react'
import { sampleFunds } from '@/lib/sample-data'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  onSampleFactsheetDropped?: (fundName: string) => void
  disabled?: boolean
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  ({ onFilesSelected, onSampleFactsheetDropped, disabled }, ref) => {
    const [dragActive, setDragActive] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const validateFile = async (file: File): Promise<boolean> => {
      // Check if it's a PDF file
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError(`${file.name} is not a PDF file. Please upload PDF files only.`)
        return false
      }

      // Check file size (50MB = 50 * 1024 * 1024 bytes)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError(`${file.name} exceeds the 50MB size limit. Please upload a smaller file.`)
        return false
      }

      return true
    }

    const handleFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return

      setError(null)
      const fileArray = Array.from(files)
      const validFiles: File[] = []

      for (const file of fileArray) {
        const isValid = await validateFile(file)
        if (isValid) {
          validFiles.push(file)
        }
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles)
      }
    }

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true)
      } else if (e.type === 'dragleave') {
        setDragActive(false)
      }
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      
      // Check if it's a sample factsheet drop
      const fundName = e.dataTransfer.getData('text/plain')
      if (fundName && onSampleFactsheetDropped) {
        onSampleFactsheetDropped(fundName)
        return
      }
      
      // Otherwise handle as regular file drop
      handleFiles(e.dataTransfer.files)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      // Reset the input value to allow uploading the same file again
      if (e.target) {
        e.target.value = ''
      }
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Upload Fund Factsheets
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload PDF files of fund factsheets to extract and compare fund data
        </p>
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>File Requirements:</strong> PDF files must be under 10 pages and under 50MB in size
          </p>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled) {
              const inputRef = (typeof ref === 'object' && ref?.current) || fileInputRef.current
              inputRef?.click()
            }
          }}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            ref={(node) => {
              if (typeof ref === 'function') {
                ref(node)
              } else if (ref) {
                ref.current = node
              }
              fileInputRef.current = node
            }}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleChange}
            disabled={disabled}
            className="hidden"
          />
          <div className="space-y-3">
            <svg
              className="mx-auto h-14 w-14 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="text-base text-gray-700 dark:text-gray-300 font-medium mb-1">
                <span className="text-blue-600 dark:text-blue-400">Click to upload</span>
                {' '}or drag and drop
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                PDF files only (max 10 pages, max 50MB)
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 rounded text-sm">
            {error}
          </div>
        )}

        {/* Sample Factsheets as Small Buttons */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Or try sample factsheets:
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleFunds.map((fund) => (
              <button
                key={fund.id}
                onClick={() => {
                  if (onSampleFactsheetDropped && !disabled) {
                    onSampleFactsheetDropped(fund.fundName)
                  }
                }}
                disabled={disabled}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={fund.fundName}
              >
                {fund.fundName.length > 25 ? `${fund.fundName.substring(0, 25)}...` : fund.fundName}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
)

FileUpload.displayName = 'FileUpload'

