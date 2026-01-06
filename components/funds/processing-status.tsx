'use client'

import type { ProcessingStatus as ProcessingStatusType } from '@/types/fund'

interface ProcessingStatusProps {
  status: ProcessingStatusType
}

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  if (status.status === 'idle') {
    return null
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'uploading':
      case 'processing':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'uploading':
      case 'processing':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'completed':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`${getStatusColor()} rounded-full p-2 text-white`}>
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-white">
            {status.message || 'Processing...'}
          </div>
          {status.progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`${getStatusColor()} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

