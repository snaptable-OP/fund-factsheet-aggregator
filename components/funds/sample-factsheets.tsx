'use client'

import { useState } from 'react'
import { sampleFunds } from '@/lib/sample-data'

interface SampleFactsheetsProps {
  onFactsheetDropped: (fundName: string) => void
}

export function SampleFactsheets({ onFactsheetDropped }: SampleFactsheetsProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, fundName: string) => {
    setDraggedItem(fundName)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fundName)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleClick = (fundName: string) => {
    onFactsheetDropped(fundName)
  }

  const formatDate = (dateString: string): string => {
    try {
      // Parse date string as local date to avoid timezone issues
      // Date strings in YYYY-MM-DD format are parsed as UTC by default, which causes day shifts
      const parts = dateString.split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
        const day = parseInt(parts[2], 10)
        const date = new Date(year, month, day)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }
      // Fallback for other formats
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 shadow-sm h-fit">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Sample Factsheets
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Drag and drop these sample factsheets into the upload area, or click to add them directly
      </p>
      
      <div className="space-y-3">
        {sampleFunds.map((fund) => (
          <div
            key={fund.id}
            draggable
            onDragStart={(e) => handleDragStart(e, fund.fundName)}
            onDragEnd={handleDragEnd}
            onClick={() => handleClick(fund.fundName)}
            className={`p-4 border-2 border-dashed rounded-lg cursor-move transition-all duration-200 ${
              draggedItem === fund.fundName
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 opacity-50 scale-95'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:scale-[1.02]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {fund.fundName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Factsheet: {formatDate(fund.fund_factsheet_as_of_date)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

