'use client'

import { useState, useRef, useEffect } from 'react'
import { FileUpload } from '@/components/funds/file-upload'
import { FundsDashboard } from '@/components/funds/funds-dashboard'
import { FundsComparison } from '@/components/funds/funds-comparison'
import { ProcessingStatus } from '@/components/funds/processing-status'
import { sampleFunds } from '@/lib/sample-data'
import type { FundData, ProcessingStatus as ProcessingStatusType, VerificationData } from '@/types/fund'

export default function Home() {
  const [funds, setFunds] = useState<FundData[]>([])
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusType>({
    status: 'idle'
  })
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleProcessFiles = async (files: File[]) => {
    console.log('Starting file upload process...', files.length, 'file(s)')
    setProcessingStatus({ status: 'uploading', message: 'Uploading factsheets...', progress: 0 })
    
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      setProcessingStatus({ status: 'processing', message: 'Extracting fund data from images...', progress: 50 })

      const response = await fetch('/api/process-factsheets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to process factsheets' }))
        const errorMessage = errorData.error || errorData.message || 'Failed to process factsheets'
        const details = errorData.details ? `\n\nDetails: ${Array.isArray(errorData.details) ? errorData.details.join('\n') : errorData.details}` : ''
        const warnings = errorData.warnings ? `\n\nWarnings: ${Array.isArray(errorData.warnings) ? errorData.warnings.join('\n') : errorData.warnings}` : ''
        console.error('API Error Response:', errorData)
        console.error('Full error details:', JSON.stringify(errorData, null, 2))
        throw new Error(errorMessage + details + warnings)
      }

      const responseData = await response.json()
      console.log('API Response:', JSON.stringify(responseData, null, 2))
      
      // Check for error in response
      if (responseData.error) {
        const errorMessage = responseData.error || 'Failed to process factsheets'
        const details = responseData.details 
          ? (Array.isArray(responseData.details) 
              ? responseData.details.join('\n') 
              : String(responseData.details))
          : ''
        throw new Error(errorMessage + (details ? `\n\nDetails: ${details}` : ''))
      }
      
      let data: FundData[] = []
      let pdfUrls: string[] = []
      
      if (Array.isArray(responseData)) {
        data = responseData
      } else if (responseData.funds && Array.isArray(responseData.funds)) {
        data = responseData.funds
        pdfUrls = responseData.pdfUrls || []
      } else if (responseData.data && Array.isArray(responseData.data)) {
        data = responseData.data
      } else {
        throw new Error('Unexpected response format from server. Expected array of funds or object with funds property.')
      }
      
      if (data.length === 0) {
        throw new Error('No fund data was returned from the server')
      }
      
      // Reset file input after successful processing
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      // Store first run results and start verification
      const firstRunData = [...data]
      
      // Initialize verification data
      setVerificationData({
        firstRun: firstRunData,
        secondRun: null,
        thirdRun: null,
        groundTruth: null,
        isVerifying: true,
        isVerifyingThirdRun: false,
        verificationComplete: false,
        thirdRunComplete: false,
        pdfUrls: pdfUrls,
        pdfFileNames: files.map(f => f.name)
      })
      
      // Show first run results immediately
      setFunds(firstRunData)
      setProcessingStatus({ 
        status: 'verifying', 
        message: `Processed ${data.length} fund(s) from ${files.length} PDF(s). Verification in process...`, 
        progress: 100 
      })
      
      // Start verification (2nd API call) for all PDFs in background
      if (pdfUrls.length > 0 && files.length > 0) {
        triggerVerificationForAllPDFs(pdfUrls, files.map(f => f.name), firstRunData)
      } else {
        // If no PDF URLs, mark verification as complete
        setVerificationData(prev => prev ? {
          ...prev,
          isVerifying: false,
          isVerifyingThirdRun: false,
          verificationComplete: true,
          thirdRunComplete: true
        } : null)
        // Reset file input since verification won't run
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error: any) {
      setProcessingStatus({ 
        status: 'error', 
        message: error.message || 'An error occurred while processing factsheets' 
      })
      // Reset file input on error so user can try again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleReset = () => {
    setFunds([])
    setVerificationData(null)
    setProcessingStatus({ status: 'idle' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerVerificationForAllPDFs = async (pdfUrls: string[], fileNames: string[], firstRunData: FundData[]) => {
    try {
      console.log(`Starting verification (2nd API call) for ${pdfUrls.length} PDF(s)...`)
      
      // Verify all PDFs in parallel
      const verificationPromises = pdfUrls.map((pdfUrl, index) => 
        fetch('/api/process-factsheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            verify: true,
            pdfUrl: pdfUrl,
            sourceFile: fileNames[index] || `file-${index + 1}`,
            runNumber: 2
          }),
        }).then(async (response) => {
          const data = await response.json()
          
          // Check if response contains errors
          if (data.error) {
            console.error(`Verification failed for PDF ${index + 1}:`, data.error, data.details)
            // Still return the funds array if available, but log the error
            return Array.isArray(data.funds) ? data.funds : []
          }
          
          if (!response.ok) {
            console.error(`Verification failed for PDF ${index + 1}:`, response.statusText, data)
            return []
          }
          
          return Array.isArray(data) ? data : []
        }).catch((error) => {
          console.error(`Verification error for PDF ${index + 1}:`, error)
          return []
        })
      )

      // Wait for all verifications to complete
      const allSecondRunResults = await Promise.all(verificationPromises)
      
      // Combine all results from all PDFs
      const combinedSecondRunData = allSecondRunResults.flat()
      
      console.log(`Verification (2nd run) completed for all PDFs: ${combinedSecondRunData.length} fund(s) total`)
      
      setVerificationData(prev => prev ? {
        ...prev,
        secondRun: combinedSecondRunData,
        isVerifying: false,
        verificationComplete: true
      } : null)
      
      setProcessingStatus({ 
        status: 'verifying', 
        message: `2nd run complete. ${firstRunData.length} fund(s) in 1st run, ${combinedSecondRunData.length} fund(s) in 2nd run. Starting 3rd run...`, 
        progress: 100 
      })
      
      // Start 3rd run verification after 2nd run completes
      triggerThirdRunVerification(pdfUrls, fileNames, firstRunData)
    } catch (error: any) {
      console.error('Verification error:', error)
      setVerificationData(prev => prev ? {
        ...prev,
        isVerifying: false,
        isVerifyingThirdRun: false,
        verificationComplete: true,
        thirdRunComplete: true
      } : null)
      // Reset file input on verification error
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerThirdRunVerification = async (pdfUrls: string[], fileNames: string[], firstRunData: FundData[]) => {
    try {
      console.log(`Starting verification (3rd API call) for ${pdfUrls.length} PDF(s)...`)
      
      // Set verifying third run flag
      setVerificationData(prev => prev ? {
        ...prev,
        isVerifyingThirdRun: true
      } : null)
      
      // Verify all PDFs in parallel (3rd run)
      const verificationPromises = pdfUrls.map((pdfUrl, index) => 
        fetch('/api/process-factsheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            verify: true,
            pdfUrl: pdfUrl,
            sourceFile: fileNames[index] || `file-${index + 1}`,
            runNumber: 3
          }),
        }).then(async (response) => {
          const data = await response.json()
          
          // Check if response contains errors
          if (data.error) {
            console.error(`3rd run verification failed for PDF ${index + 1}:`, data.error, data.details)
            // Still return the funds array if available, but log the error
            return Array.isArray(data.funds) ? data.funds : []
          }
          
          if (!response.ok) {
            console.error(`3rd run verification failed for PDF ${index + 1}:`, response.statusText, data)
            return []
          }
          
          return Array.isArray(data) ? data : []
        }).catch((error) => {
          console.error(`3rd run verification error for PDF ${index + 1}:`, error)
          return []
        })
      )

      // Wait for all verifications to complete
      const allThirdRunResults = await Promise.all(verificationPromises)
      
      // Combine all results from all PDFs
      const combinedThirdRunData = allThirdRunResults.flat()
      
      console.log(`Verification (3rd run) completed for all PDFs: ${combinedThirdRunData.length} fund(s) total`)
      
      setVerificationData(prev => {
        const secondRunCount = prev?.secondRun?.length || 0
        setProcessingStatus({ 
          status: 'completed', 
          message: `All verifications complete. ${firstRunData.length} fund(s) in 1st run, ${secondRunCount} fund(s) in 2nd run, ${combinedThirdRunData.length} fund(s) in 3rd run.`, 
          progress: 100 
        })
        return prev ? {
          ...prev,
          thirdRun: combinedThirdRunData,
          isVerifyingThirdRun: false,
          thirdRunComplete: true
        } : null
      })
      // Reset file input after verification completes
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('3rd run verification error:', error)
      setVerificationData(prev => prev ? {
        ...prev,
        isVerifyingThirdRun: false,
        thirdRunComplete: true
      } : null)
      // Reset file input on verification error
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSaveGroundTruth = async (groundTruth: FundData[]) => {
    try {
      // Save ground truth to Supabase
      const response = await fetch('/api/process-factsheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saveGroundTruth: true,
          groundTruth: groundTruth,
          pdfUrl: verificationData?.pdfUrls?.[0] || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save ground truth' }))
        throw new Error(errorData.error || 'Failed to save ground truth')
      }

      const result = await response.json()
      console.log('Ground truth saved to database:', result)

      setVerificationData(prev => prev ? {
        ...prev,
        groundTruth: groundTruth
      } : null)
      
      // Update funds to use ground truth
      setFunds(groundTruth)
      
      setProcessingStatus({ 
        status: 'completed', 
        message: `Ground truth saved to database for ${groundTruth.length} fund(s)!`, 
        progress: 100 
      })
    } catch (error: any) {
      console.error('Error saving ground truth:', error)
      setProcessingStatus({ 
        status: 'error', 
        message: `Failed to save ground truth: ${error.message}` 
      })
    }
  }

  const handleSampleFactsheetDropped = (fundName: string) => {
    // Find the sample fund data that matches the dropped factsheet
    const sampleFund = sampleFunds.find(f => f.fundName === fundName)
    if (!sampleFund) return

    setProcessingStatus({ status: 'processing', message: `Processing ${fundName}...`, progress: 50 })

    // Simulate processing delay, then add to dashboard
    setTimeout(() => {
      setFunds(prevFunds => {
        const existing = prevFunds.find(f => f.fundName === sampleFund.fundName)
        if (existing) {
          // Update if newer
          const existingDate = new Date(existing.fund_factsheet_as_of_date)
          const newDate = new Date(sampleFund.fund_factsheet_as_of_date)
          if (newDate > existingDate) {
            return prevFunds.map(f => f.fundName === sampleFund.fundName ? sampleFund : f)
          }
          return prevFunds
        } else {
          return [...prevFunds, sampleFund]
        }
      })
      setProcessingStatus({ status: 'completed', message: `Processed ${fundName} successfully!`, progress: 100 })
    }, 1000)
  }
  
  // Determine which funds to display (ground truth if available, otherwise first run)
  const displayFunds = verificationData?.groundTruth || funds

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 lg:p-12">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            Fund Factsheet Aggregator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Upload PDF files of fund factsheets and compare comprehensive fund data including returns, asset allocation, and holdings
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Upload Section */}
          <FileUpload 
            onFilesSelected={handleProcessFiles}
            onSampleFactsheetDropped={handleSampleFactsheetDropped}
            ref={fileInputRef}
            disabled={processingStatus.status === 'processing' || processingStatus.status === 'uploading' || processingStatus.status === 'verifying'}
          />

          {/* Processing Status */}
          <ProcessingStatus status={processingStatus} />

          {/* Dashboard */}
          <FundsDashboard 
            funds={displayFunds} 
            verificationData={verificationData}
            onSaveGroundTruth={handleSaveGroundTruth}
          />

          {/* Fund Comparison Station */}
          <FundsComparison funds={displayFunds} />

          {/* Reset Button */}
          {(funds.length > 0 || verificationData) && (
            <div className="text-center">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium shadow-sm hover:shadow"
              >
                Clear All Funds
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
