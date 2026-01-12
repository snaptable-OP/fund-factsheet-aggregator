'use client'

import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import type { FundData, VerificationData } from '@/types/fund'

interface FundsDashboardProps {
  funds: FundData[]
  verificationData?: VerificationData | null
  onUpdateGroundTruth?: (fundName: string, field: string, value: any) => void
  onSaveGroundTruth?: (groundTruth: FundData[]) => void
}

interface FundDataBoxProps {
  fund: FundData | null
  title: string
  isPending?: boolean
  isEditable?: boolean
  onUpdate?: (field: string, value: any) => void
  highlightDifferences?: boolean
  compareFund?: FundData | null
  ignoredDifferences?: Set<string>
  onToggleIgnoreDifference?: (key: string) => void
  firstRunFundName?: string | null
  onSave?: (fund: FundData) => Promise<void>
  savedAt?: string | null
  dataType?: 'aiGuidedAdjustments' | 'groundTruth' | 'firstRun' | 'secondRun'
}

function FundDataBox({ 
  fund, 
  title, 
  isPending = false, 
  isEditable = false, 
  onUpdate,
  highlightDifferences = false,
  compareFund = null,
  ignoredDifferences = new Set(),
  onToggleIgnoreDifference,
  firstRunFundName = null,
  onSave,
  savedAt = null,
  dataType
}: FundDataBoxProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(savedAt)

  // Update localSavedAt when savedAt prop changes
  useEffect(() => {
    setLocalSavedAt(savedAt)
  }, [savedAt])

  const handleSave = async () => {
    if (!fund || !onSave || isSaving) return
    
    setIsSaving(true)
    try {
      await onSave(fund)
      setLocalSavedAt(new Date().toISOString())
    } catch (error) {
      console.error('Error saving fund:', error)
      alert('Failed to save fund data. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const formatSavedTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return ''
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch {
      return timestamp
    }
  }
  const formatPercent = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)}%`
  }

  const formatAllocationPercent = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)}%`
  }

  // Calculate total asset allocation percentage
  const getTotalAllocation = (assetClasses: { class: string; allocationPercent: number }[]): number => {
    return assetClasses.reduce((sum, ac) => sum + ac.allocationPercent, 0)
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

  const getReturnColor = (value: number | null): string => {
    if (value === null || value === undefined) return 'text-gray-500'
    if (value > 0) return 'text-green-600 dark:text-green-400'
    if (value < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Check if a percentage value should be highlighted (likely needs to be divided by 100)
  const shouldHighlightBlue = (allocationPercent: number | null): boolean => {
    if (allocationPercent === null || allocationPercent === undefined) return false
    // If percentage is > 10, it's likely in the wrong format (e.g., 85 instead of 0.85)
    return allocationPercent > 10
  }

  // Detect errors in top 10 holdings data
  const detectTopHoldingsError = (holdings: { name: string; allocationPercent: number }[]): {
    needsCorrection: boolean
    reason: string
    suggestedAction: string
  } => {
    const hasHighPercentages = holdings.some(h => shouldHighlightBlue(h.allocationPercent))
    
    if (hasHighPercentages) {
      return {
        needsCorrection: true,
        reason: 'Some holdings have percentages greater than 10%, which suggests they may be in the wrong format (e.g., 85 instead of 0.85).',
        suggestedAction: 'Click "Apply Fix" to divide highlighted percentages by 100'
      }
    }
    
    return {
      needsCorrection: false,
      reason: '',
      suggestedAction: ''
    }
  }

  // Helper functions for difference highlighting
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return Math.round(value * 10000) / 10000 // Round to 4 decimal places
    if (typeof value === 'string') {
      // Enhanced normalization: remove punctuation, normalize whitespace, lowercase
      return value.trim()
        .replace(/[.,;:!?'"()\[\]{}]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .toLowerCase()
        .trim()
    }
    return value
  }

  // Enhanced string matching for asset classes and holdings (fuzzy matching)
  const areStringsSimilar = (str1: string | null | undefined, str2: string | null | undefined, threshold: number = 0.7): boolean => {
    if (!str1 || !str2) return str1 === str2 // Both null/undefined = match, otherwise no match
    
    const normalized1 = normalizeValue(str1)
    const normalized2 = normalizeValue(str2)
    
    // Exact match after normalization
    if (normalized1 === normalized2) return true
    
    // Check if one contains the other (for abbreviations like "US" vs "United States")
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      // Only consider it a match if the shorter string is at least 3 characters
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2
      if (shorter.length >= 3) return true
    }
    
    // Word-based similarity (for "Equities - US" vs "Equities US")
    const words1 = normalized1.split(/\s+/).filter((w: string) => w.length > 0)
    const words2 = normalized2.split(/\s+/).filter((w: string) => w.length > 0)
    
    if (words1.length > 0 && words2.length > 0) {
      const set1 = new Set<string>(words1)
      const set2 = new Set<string>(words2)
      const intersection = new Set(Array.from(set1).filter((x: string) => set2.has(x)))
      const union = new Set([...Array.from(set1), ...Array.from(set2)])
      const similarity = intersection.size / union.size
      
      // If most words match, consider them similar
      if (similarity >= threshold) return true
      
      // If all words from shorter string are in longer string, consider it a match
      const shorterWords = words1.length <= words2.length ? words1 : words2
      const longerSet = words1.length > words2.length ? new Set<string>(words1) : new Set<string>(words2)
      if (shorterWords.length > 0 && shorterWords.every((w: string) => longerSet.has(w))) return true
    }
    
    return false
  }

  // Compare numbers with tolerance for floating point precision
  const areNumbersEqual = (num1: number | null | undefined, num2: number | null | undefined, tolerance: number = 0.01): boolean => {
    if (num1 === null || num1 === undefined || num2 === null || num2 === undefined) {
      return num1 === num2 // Both null/undefined = match
    }
    return Math.abs(num1 - num2) <= tolerance
  }

  // Get nested property value from object using dot notation (e.g., "returns.calendarYear2024")
  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || !path) return undefined
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return current
  }

  const isDifferent = (field: string, value: any): boolean => {
    if (!highlightDifferences || !compareFund || !fund) return false
    
    // Handle nested field paths like "returns.calendarYear2024"
    const compareValue = getNestedValue(compareFund, field)
    
    // For number fields (returns), use tolerance-based comparison
    if (field.startsWith('returns.')) {
      return !areNumbersEqual(value, compareValue, 0.01) // 0.01% tolerance
    }
    
    // For string fields, use enhanced string matching
    if (typeof value === 'string' || typeof compareValue === 'string') {
      return !areStringsSimilar(value, compareValue, 0.7)
    }
    
    // For other types, use standard comparison
    const normalizedCurrent = normalizeValue(value)
    const normalizedCompare = normalizeValue(compareValue)
    return normalizedCurrent !== normalizedCompare
  }

  // Helper to get run identifier from title (e.g., "2nd Run" -> "2nd-run", "3rd Run" -> "3rd-run")
  const getRunIdentifier = (): string => {
    if (!highlightDifferences || !title) return ''
    const runMatch = title.match(/(\d+)(st|nd|rd|th)\s+Run/i)
    if (runMatch) {
      return `${runMatch[1]}${runMatch[2]}-run`
    }
    return ''
  }

  // Normalize text for comparison (remove Chinese characters, normalize whitespace)
  // This must match the normalization used in calculateConsistencyRate
  const normalizeTextForComparison = (text: string | null | undefined): string => {
    if (!text) return ''
    // Remove Chinese characters (CJK Unified Ideographs: \u4e00-\u9fff)
    // Also remove other CJK ranges and punctuation
    let normalized = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g, '')
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase()
    return normalized
  }

  // Check if an asset class differs from the compare fund
  const isAssetClassDifferent = (assetClass: { class: string; allocationPercent: number }, index: number): boolean => {
    if (!highlightDifferences || !compareFund || !compareFund.assetClasses) return false
    
    // Try to find matching asset class by name using fuzzy matching
    const matchingAC = compareFund.assetClasses.find(ac => 
      areStringsSimilar(ac.class, assetClass.class, 0.7)
    )
    
    if (!matchingAC) {
      // Asset class doesn't exist in compare fund - it's different
      return true
    }
    
    // Compare allocation percentages with tolerance
    return !areNumbersEqual(assetClass.allocationPercent, matchingAC.allocationPercent, 0.01)
  }

  // Check if a holding differs from the compare fund
  const isHoldingDifferent = (holding: { name: string; allocationPercent: number }, index: number): boolean => {
    if (!highlightDifferences || !compareFund || !compareFund.top10Holdings) return false
    
    // Try to find matching holding by name using fuzzy matching
    const matchingHolding = compareFund.top10Holdings.find(h => 
      areStringsSimilar(h.name, holding.name, 0.7)
    )
    
    if (!matchingHolding) {
      // Holding doesn't exist in compare fund - it's different
      return true
    }
    
    // Compare allocation percentages with tolerance
    return !areNumbersEqual(holding.allocationPercent, matchingHolding.allocationPercent, 0.01)
  }

  const getDifferenceKey = (field: string): string => {
    const normalizedFundName = (firstRunFundName || fund?.fundName || '').toLowerCase().replace(/\s+/g, '-')
    // Include run identifier in the key when highlighting differences (2nd or 3rd run)
    // This ensures ignoring a difference in one run doesn't affect the other run
    if (highlightDifferences && title) {
      const runId = getRunIdentifier()
      if (runId) {
        return `${normalizedFundName}-${runId}-${field}`
      }
    }
    return `${normalizedFundName}-${field}`
  }

  const isIgnored = (fieldOrKey: string): boolean => {
    // If it's already a full key (contains run identifier or assetClass/holding), use it directly
    // Otherwise, generate the key using getDifferenceKey
    if (fieldOrKey.includes('-2nd-run-') || fieldOrKey.includes('-3rd-run-') || 
        fieldOrKey.includes('assetClass-') || fieldOrKey.includes('holding-')) {
      return ignoredDifferences.has(fieldOrKey)
    }
    const key = getDifferenceKey(fieldOrKey)
    return ignoredDifferences.has(key)
  }

  const getHighlightClass = (field: string, value: any): string => {
    if (!highlightDifferences || !isDifferent(field, value) || isIgnored(field)) {
      return ''
    }
    return 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 pl-2'
  }

  if (isPending) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 relative">
          <div className="flex justify-between items-start mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
            {localSavedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 text-right">
                Saved: {formatSavedTimestamp(localSavedAt)}
              </div>
            )}
          </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Pending...</p>
        </div>
      </div>
    )
  }

  if (!fund) {
    // If editable and no fund, show empty form to add new fund
    if (isEditable) {
      const emptyFund: FundData = {
        id: `new-${Date.now()}`,
        fundName: '',
        fund_factsheet_as_of_date: new Date().toISOString().split('T')[0],
        launchDate: new Date().toISOString().split('T')[0],
        investmentObjective: '',
        riskLevel: null,
        returns: {
          oneYearAnnualized: null,
          threeYearAnnualized: null,
          fiveYearAnnualized: null,
          sinceLaunchAnnualized: null,
          calendarYear2024: null,
          calendarYear2023: null,
          calendarYear2022: null,
        },
        assetClasses: [],
        top10Holdings: [],
        sourceFile: '',
        processedAt: new Date().toISOString(),
      }
      
      // Use the empty fund for rendering
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-6 relative">
          <div className="flex justify-between items-start mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {title} - Add New Fund
          </h3>
            {localSavedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 text-right">
                Saved: {formatSavedTimestamp(localSavedAt)}
              </div>
            )}
          </div>
          {isEditable && onSave && (
            <div className="mb-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md font-medium"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          )}
          {/* Render the fund content with empty fund */}
          {(() => {
            const fundToRender = emptyFund
            return (
              <>
                {/* Fund Header */}
                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={fundToRender.fundName}
                    onChange={(e) => onUpdate?.('fundName', e.target.value)}
                    className="text-xl font-bold text-gray-900 dark:text-white mb-2 w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    placeholder="Enter fund name"
                  />
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Factsheet Date:</span>{' '}
                      <input
                        type="text"
                        value={fundToRender.fund_factsheet_as_of_date}
                        onChange={(e) => onUpdate?.('fund_factsheet_as_of_date', e.target.value)}
                        className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-24"
                      />
                    </div>
                    <div>
                      <span className="font-medium">Launch Date:</span>{' '}
                      <input
                        type="text"
                        value={fundToRender.launchDate}
                        onChange={(e) => onUpdate?.('launchDate', e.target.value)}
                        className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-24"
                      />
                    </div>
                  </div>
                </div>

                {/* Investment Objective */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Investment Objective</h4>
                  <textarea
                    value={fundToRender.investmentObjective}
                    onChange={(e) => onUpdate?.('investmentObjective', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    rows={3}
                    placeholder="Enter investment objective"
                  />
                </div>

                {/* Returns Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Returns (Annualized)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(['oneYearAnnualized', 'threeYearAnnualized', 'fiveYearAnnualized', 'sinceLaunchAnnualized'] as const).map((returnType) => (
                      <div key={returnType}>
                        <span className="text-gray-600 dark:text-gray-400">
                          {returnType === 'oneYearAnnualized' ? '1 Year:' :
                           returnType === 'threeYearAnnualized' ? '3 Year:' :
                           returnType === 'fiveYearAnnualized' ? '5 Year:' : 'Since Launch:'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={fundToRender.returns[returnType] ?? ''}
                          onChange={(e) => onUpdate?.(`returns.${returnType}`, e.target.value ? parseFloat(e.target.value) : null)}
                          className="ml-2 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-20"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendar Year Returns */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Calendar Year Returns</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {(['calendarYear2024', 'calendarYear2023', 'calendarYear2022'] as const).map((yearType) => (
                      <div key={yearType}>
                        <span className="text-gray-600 dark:text-gray-400">
                          {yearType === 'calendarYear2024' ? '2024:' :
                           yearType === 'calendarYear2023' ? '2023:' : '2022:'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={fundToRender.returns[yearType] ?? ''}
                          onChange={(e) => onUpdate?.(`returns.${yearType}`, e.target.value ? parseFloat(e.target.value) : null)}
                          className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Asset Classes */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Asset Classes</h4>
                    <button
                      onClick={() => {
                        const updated = [...fundToRender.assetClasses, { class: '', allocationPercent: 0 }]
                        onUpdate?.('assetClasses', updated)
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      + Add
                    </button>
                  </div>
                  {fundToRender.assetClasses.length > 0 ? (
                    <>
                      {(() => {
                        const totalAllocation = getTotalAllocation(fundToRender.assetClasses)
                        
                      })()}
                      <div className="space-y-1">
                        {fundToRender.assetClasses.map((ac, idx) => {
                          return (
                            <div 
                              key={idx} 
                              className="flex justify-between items-center text-sm"
                            >
                              <input
                                type="text"
                                value={ac.class}
                                onChange={(e) => {
                                  const updated = [...fundToRender.assetClasses]
                                  updated[idx] = { ...ac, class: e.target.value }
                                  onUpdate?.('assetClasses', updated)
                                }}
                                className="flex-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs mr-2"
                                placeholder="Asset class name"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={ac.allocationPercent}
                                onChange={(e) => {
                                  const updated = [...fundToRender.assetClasses]
                                  updated[idx] = { ...ac, allocationPercent: parseFloat(e.target.value) || 0 }
                                  onUpdate?.('assetClasses', updated)
                                }}
                                className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16 mr-2"
                              />
                              <button
                                onClick={() => {
                                  const updated = fundToRender.assetClasses.filter((_, i) => i !== idx)
                                  onUpdate?.('assetClasses', updated)
                                }}
                                className="text-red-600 hover:text-red-800 text-xs px-1"
                                title="Delete"
                              >
                                ×
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500 italic">Click "+ Add" to add asset classes</p>
                  )}
                </div>

                {/* Top 10 Holdings */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top 10 Holdings</h4>
                    <button
                      onClick={() => {
                        const updated = [...fundToRender.top10Holdings, { name: '', allocationPercent: 0 }]
                        onUpdate?.('top10Holdings', updated)
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      + Add
                    </button>
                  </div>
                  {(() => {
                    const errorDetection = detectTopHoldingsError(fundToRender.top10Holdings)
                    return errorDetection.needsCorrection ? (
                      <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                              ⚠️ Potential Data Error Detected
                            </p>
                            <p className="text-blue-700 dark:text-blue-300 text-xs">
                              {errorDetection.reason}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              // Only correct holdings that are > 10% (blue highlighted)
                              const correctedHoldings = fundToRender.top10Holdings.map(h => {
                                if (shouldHighlightBlue(h.allocationPercent)) {
                                  return {
                                    ...h,
                                    allocationPercent: h.allocationPercent / 100
                                  }
                                }
                                // Leave other holdings unchanged
                                return h
                              })
                              onUpdate?.('top10Holdings', correctedHoldings)
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium whitespace-nowrap"
                            title={errorDetection.suggestedAction}
                          >
                            Apply Fix
                          </button>
                        </div>
                      </div>
                    ) : null
                  })()}
                  <div className="space-y-1">
                    {fundToRender.top10Holdings.length > 0 ? (
                      fundToRender.top10Holdings.map((holding, idx) => {
                        const isBlueHighlight = shouldHighlightBlue(holding.allocationPercent)
                        return (
                          <div 
                            key={idx} 
                            className={`flex justify-between items-center text-sm ${
                              isBlueHighlight 
                                ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-600 rounded px-1' 
                                : ''
                            }`}
                          >
                            <input
                              type="text"
                              value={holding.name}
                              onChange={(e) => {
                                const updated = [...fundToRender.top10Holdings]
                                updated[idx] = { ...holding, name: e.target.value }
                                onUpdate?.('top10Holdings', updated)
                              }}
                              className="flex-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs mr-2"
                              placeholder="Holding name"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={holding.allocationPercent}
                              onChange={(e) => {
                                const updated = [...fundToRender.top10Holdings]
                                updated[idx] = { ...holding, allocationPercent: parseFloat(e.target.value) || 0 }
                                onUpdate?.('top10Holdings', updated)
                              }}
                              className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16 mr-2"
                            />
                            <button
                              onClick={() => {
                                const updated = fundToRender.top10Holdings.filter((_, i) => i !== idx)
                                onUpdate?.('top10Holdings', updated)
                              }}
                              className="text-red-600 hover:text-red-800 text-xs px-1"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-500 italic">Click "+ Add" to add holdings</p>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 relative">
        <div className="flex justify-between items-start mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
          {localSavedAt && (
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 text-right">
              Saved: {formatSavedTimestamp(localSavedAt)}
            </div>
          )}
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 relative">
      <div className="flex justify-between items-start mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h3>
        {localSavedAt && (
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 text-right">
            Saved: {formatSavedTimestamp(localSavedAt)}
          </div>
        )}
      </div>
      {isEditable && onSave && fund && (
        <div className="mb-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md font-medium"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      )}

      {/* Fund Header */}
      <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        {isEditable ? (
          <input
            type="text"
            value={fund.fundName}
            onChange={(e) => onUpdate?.('fundName', e.target.value)}
            className="text-xl font-bold text-gray-900 dark:text-white mb-2 w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            placeholder="Enter fund name"
          />
        ) : (
          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {fund.fundName}
          </h4>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className={getHighlightClass('fund_factsheet_as_of_date', fund.fund_factsheet_as_of_date)}>
            <div className="flex items-center justify-between">
            <span className="font-medium">Factsheet Date:</span>
              {highlightDifferences && isDifferent('fund_factsheet_as_of_date', fund.fund_factsheet_as_of_date) && onToggleIgnoreDifference && (
                <button
                  onClick={() => onToggleIgnoreDifference(getDifferenceKey('fund_factsheet_as_of_date'))}
                  className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                  title={isIgnored('fund_factsheet_as_of_date') ? 'Unignore this difference' : 'Ignore this difference'}
                >
                  {isIgnored('fund_factsheet_as_of_date') ? '✓' : '×'}
                </button>
              )}
            </div>
            {isEditable ? (
              <input
                type="text"
                value={fund.fund_factsheet_as_of_date}
                onChange={(e) => onUpdate?.('fund_factsheet_as_of_date', e.target.value)}
                className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-24"
              />
            ) : (
              formatDate(fund.fund_factsheet_as_of_date)
            )}
          </div>
          <div className={getHighlightClass('launchDate', fund.launchDate)}>
            <div className="flex items-center justify-between">
            <span className="font-medium">Launch Date:</span>
              {highlightDifferences && isDifferent('launchDate', fund.launchDate) && onToggleIgnoreDifference && (
                <button
                  onClick={() => onToggleIgnoreDifference(getDifferenceKey('launchDate'))}
                  className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                  title={isIgnored('launchDate') ? 'Unignore this difference' : 'Ignore this difference'}
                >
                  {isIgnored('launchDate') ? '✓' : '×'}
                </button>
              )}
            </div>
            {isEditable ? (
              <input
                type="text"
                value={fund.launchDate}
                onChange={(e) => onUpdate?.('launchDate', e.target.value)}
                className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-24"
              />
            ) : (
              formatDate(fund.launchDate)
            )}
          </div>
        </div>
      </div>

      {/* Investment Objective */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Investment Objective</h4>
          {highlightDifferences && isDifferent('investmentObjective', fund.investmentObjective) && onToggleIgnoreDifference && (
            <button
              onClick={() => onToggleIgnoreDifference(getDifferenceKey('investmentObjective'))}
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
              title={isIgnored('investmentObjective') ? 'Unignore this difference' : 'Ignore this difference (wording only)'}
            >
              {isIgnored('investmentObjective') ? '✓ Ignored' : 'Ignore'}
            </button>
          )}
        </div>
        {isEditable ? (
          <textarea
            value={fund.investmentObjective}
            onChange={(e) => onUpdate?.('investmentObjective', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            rows={3}
          />
        ) : (
          <p className={`text-sm text-gray-600 dark:text-gray-400 ${getHighlightClass('investmentObjective', fund.investmentObjective)} ${isDifferent('investmentObjective', fund.investmentObjective) && isIgnored('investmentObjective') ? 'opacity-60' : ''}`}>
            {fund.investmentObjective}
          </p>
        )}
      </div>

      {/* Returns Section */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Returns (Annualized)</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(['oneYearAnnualized', 'threeYearAnnualized', 'fiveYearAnnualized', 'sinceLaunchAnnualized'] as const).map((returnType) => {
            const field = `returns.${returnType}`
            const isDiff = isDifferent(field, fund.returns[returnType])
            return (
              <div key={returnType} className={getHighlightClass(field, fund.returns[returnType])}>
                <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {returnType === 'oneYearAnnualized' ? '1 Year:' :
                   returnType === 'threeYearAnnualized' ? '3 Year:' :
                   returnType === 'fiveYearAnnualized' ? '5 Year:' : 'Since Launch:'}
                </span>
                  {highlightDifferences && isDiff && onToggleIgnoreDifference && (
                    <button
                      onClick={() => onToggleIgnoreDifference(getDifferenceKey(field))}
                      className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                      title={isIgnored(field) ? 'Unignore this difference' : 'Ignore this difference'}
                    >
                      {isIgnored(field) ? '✓' : '×'}
                    </button>
                  )}
                </div>
                {isEditable ? (
                  <input
                    type="number"
                    step="0.01"
                    value={fund.returns[returnType] ?? ''}
                    onChange={(e) => onUpdate?.(field, e.target.value ? parseFloat(e.target.value) : null)}
                    className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-20"
                  />
                ) : (
                  <span className={`ml-1 font-medium ${getReturnColor(fund.returns[returnType])}`}>
                    {formatPercent(fund.returns[returnType])}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Calendar Year Returns */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Calendar Year Returns</h4>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {(['calendarYear2024', 'calendarYear2023', 'calendarYear2022'] as const).map((yearType) => {
            const field = `returns.${yearType}`
            const isDiff = isDifferent(field, fund.returns[yearType])
            return (
              <div key={yearType} className={`${getHighlightClass(field, fund.returns[yearType])} ${isDiff && isIgnored(field) ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {yearType === 'calendarYear2024' ? '2024:' :
                     yearType === 'calendarYear2023' ? '2023:' : '2022:'}
                  </span>
                  {highlightDifferences && isDiff && onToggleIgnoreDifference && (
                    <button
                      onClick={() => onToggleIgnoreDifference(getDifferenceKey(field))}
                      className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                      title={isIgnored(field) ? 'Unignore this difference' : 'Ignore this difference'}
                    >
                      {isIgnored(field) ? '✓' : '×'}
                    </button>
                  )}
                </div>
                {isEditable ? (
                  <input
                    type="number"
                    step="0.01"
                    value={fund.returns[yearType] ?? ''}
                    onChange={(e) => onUpdate?.(field, e.target.value ? parseFloat(e.target.value) : null)}
                    className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16"
                  />
                ) : (
                  <span className={`ml-1 font-medium ${getReturnColor(fund.returns[yearType])}`}>
                    {formatPercent(fund.returns[yearType])}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Asset Classes */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Asset Classes</h4>
          {isEditable && (
            <button
              onClick={() => {
                const updated = [...fund.assetClasses, { class: '', allocationPercent: 0 }]
                onUpdate?.('assetClasses', updated)
              }}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              + Add
            </button>
          )}
        </div>
        {(() => {
          // When highlighting differences, show all asset classes from 1st run (compareFund) plus any extras in current run
          const allAssetClasses = highlightDifferences && compareFund
            ? (() => {
                // Start with all from 1st run
                const fromFirstRun = compareFund.assetClasses.map(ac => ({
                  ...ac,
                  source: 'firstRun' as const,
                  existsInCurrentRun: fund.assetClasses.some(fac => 
                    areStringsSimilar(fac.class, ac.class, 0.7)
                  )
                }))
                // Add any from current run that aren't in 1st run (using fuzzy matching)
                const fromCurrentRun = fund.assetClasses
                  .filter(fac => !compareFund.assetClasses.some(cac => 
                    areStringsSimilar(cac.class, fac.class, 0.7)
                  ))
                  .map(ac => ({
                    ...ac,
                    source: 'currentRun' as const,
                    existsInCurrentRun: true
                  }))
                return [...fromFirstRun, ...fromCurrentRun]
              })()
            : fund.assetClasses.map(ac => ({
                ...ac,
                source: 'currentRun' as const,
                existsInCurrentRun: true
              }))

          return allAssetClasses.length > 0 ? (
          <>
            <div className="space-y-1">
                {allAssetClasses.map((ac, idx) => {
                  const isMissing = highlightDifferences && compareFund && ac.source === 'firstRun' && !ac.existsInCurrentRun
                  const isExtra = highlightDifferences && compareFund && ac.source === 'currentRun' && !compareFund.assetClasses.some(cac => 
                    normalizeTextForComparison(cac.class) === normalizeTextForComparison(ac.class)
                  )
                  const isDiff = isMissing || isExtra || (highlightDifferences && compareFund ? isAssetClassDifferent(ac, idx) : false)
                  const normalizedFundName = (firstRunFundName || fund?.fundName || '').toLowerCase().replace(/\s+/g, '-')
                  // Use normalizeTextForComparison to match consistency rate calculation
                  const normalizedClassName = normalizeTextForComparison(ac.class)
                  const runId = getRunIdentifier()
                  const assetClassKey = runId && normalizedClassName
                    ? `${normalizedFundName}-${runId}-assetClass-${normalizedClassName}`
                    : normalizedClassName
                    ? `${normalizedFundName}-assetClass-${normalizedClassName}`
                    : ''
                  const highlightClass = highlightDifferences && isDiff && !isIgnored(assetClassKey) 
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 pl-2' 
                    : ''
                return (
                  <div 
                      key={`${ac.class}-${idx}`} 
                      className={`flex justify-between items-center text-sm ${highlightClass}`}
                  >
                    {isEditable ? (
                      <>
                        <input
                          type="text"
                          value={ac.class}
                          onChange={(e) => {
                            const updated = [...fund.assetClasses]
                            updated[idx] = { ...ac, class: e.target.value }
                            onUpdate?.('assetClasses', updated)
                          }}
                          className="flex-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs mr-2"
                          placeholder="Asset class name"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={ac.allocationPercent}
                          onChange={(e) => {
                            const updated = [...fund.assetClasses]
                            updated[idx] = { ...ac, allocationPercent: parseFloat(e.target.value) || 0 }
                            onUpdate?.('assetClasses', updated)
                          }}
                          className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16 mr-2"
                        />
                        <button
                          onClick={() => {
                            const updated = fund.assetClasses.filter((_, i) => i !== idx)
                            onUpdate?.('assetClasses', updated)
                          }}
                          className="text-red-600 hover:text-red-800 text-xs px-1"
                          title="Delete"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`text-gray-600 dark:text-gray-400 ${isMissing ? 'italic opacity-75' : ''}`}>
                            {ac.class}
                            {isMissing && <span className="ml-1 text-xs text-gray-500">(missing)</span>}
                            {isExtra && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(extra)</span>}
                          </span>
                          {highlightDifferences && isDiff && onToggleIgnoreDifference && (
                            <button
                              onClick={() => {
                                console.log(`Ignore button clicked for asset class:`, {
                                  className: ac.class,
                                  normalizedClassName,
                                  assetClassKey,
                                  isCurrentlyIgnored: isIgnored(assetClassKey),
                                  isMissing
                                })
                                onToggleIgnoreDifference(assetClassKey)
                              }}
                              className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                              title={isIgnored(assetClassKey) ? 'Unignore this difference' : isMissing ? 'Ignore missing asset class' : 'Ignore this difference'}
                            >
                              {isIgnored(assetClassKey) ? '✓' : '×'}
                            </button>
                          )}
                        </div>
                        <span className={`font-medium ${isMissing ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {isMissing ? 'N/A' : formatAllocationPercent(ac.allocationPercent)}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-500">No data available</p>
          )
        })()}
      </div>

      {/* Top 10 Holdings */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top 10 Holdings</h4>
          {isEditable && (
            <button
              onClick={() => {
                const updated = [...fund.top10Holdings, { name: '', allocationPercent: 0 }]
                onUpdate?.('top10Holdings', updated)
              }}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              + Add
            </button>
          )}
        </div>
        <div className="space-y-1">
          {(() => {
            // When highlighting differences, show all holdings from 1st run (compareFund) plus any extras in current run
            const allHoldings = highlightDifferences && compareFund
              ? (() => {
                  // Start with all from 1st run
                  const fromFirstRun = compareFund.top10Holdings.map(h => ({
                    ...h,
                    source: 'firstRun' as const,
                    existsInCurrentRun: fund.top10Holdings.some(fh => 
                      areStringsSimilar(fh.name, h.name, 0.7)
                    )
                  }))
                  // Add any from current run that aren't in 1st run (using fuzzy matching)
                  const fromCurrentRun = fund.top10Holdings
                    .filter(fh => !compareFund.top10Holdings.some(ch => 
                      areStringsSimilar(ch.name, fh.name, 0.7)
                    ))
                    .map(h => ({
                      ...h,
                      source: 'currentRun' as const,
                      existsInCurrentRun: true
                    }))
                  return [...fromFirstRun, ...fromCurrentRun]
                })()
              : fund.top10Holdings.map(h => ({
                  ...h,
                  source: 'currentRun' as const,
                  existsInCurrentRun: true
                }))

            return allHoldings.length > 0 ? (
              allHoldings.map((holding, idx) => {
                const isMissing = highlightDifferences && compareFund && holding.source === 'firstRun' && !holding.existsInCurrentRun
                const isExtra = highlightDifferences && compareFund && holding.source === 'currentRun' && !compareFund.top10Holdings.some(ch => 
                  areStringsSimilar(ch.name, holding.name, 0.7)
                )
                const isDiff = isMissing || isExtra || (highlightDifferences && compareFund ? isHoldingDifferent(holding, idx) : false)
                const normalizedFundName = (firstRunFundName || fund?.fundName || '').toLowerCase().replace(/\s+/g, '-')
                // Use normalizeTextForComparison to match consistency rate calculation
                const normalizedHoldingName = normalizeTextForComparison(holding.name)
                const runId = getRunIdentifier()
                const holdingKey = runId && normalizedHoldingName
                  ? `${normalizedFundName}-${runId}-holding-${normalizedHoldingName}`
                  : normalizedHoldingName
                  ? `${normalizedFundName}-holding-${normalizedHoldingName}`
                  : ''
                const highlightClass = highlightDifferences && isDiff && !isIgnored(holdingKey) 
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 pl-2' 
                  : ''
              return (
                <div 
                    key={`${holding.name}-${idx}`} 
                    className={`flex justify-between items-center text-sm ${highlightClass}`}
                >
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={holding.name}
                        onChange={(e) => {
                          const updated = [...fund.top10Holdings]
                          updated[idx] = { ...holding, name: e.target.value }
                          onUpdate?.('top10Holdings', updated)
                        }}
                        className="flex-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs mr-2"
                        placeholder="Holding name"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={holding.allocationPercent}
                        onChange={(e) => {
                          const updated = [...fund.top10Holdings]
                          updated[idx] = { ...holding, allocationPercent: parseFloat(e.target.value) || 0 }
                          onUpdate?.('top10Holdings', updated)
                        }}
                        className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs w-16 mr-2"
                      />
                      <button
                        onClick={() => {
                          const updated = fund.top10Holdings.filter((_, i) => i !== idx)
                          onUpdate?.('top10Holdings', updated)
                        }}
                        className="text-red-600 hover:text-red-800 text-xs px-1"
                        title="Delete"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`text-gray-600 dark:text-gray-400 ${isMissing ? 'italic opacity-75' : ''}`}>
                          {holding.name}
                          {isMissing && <span className="ml-1 text-xs text-gray-500">(missing)</span>}
                          {isExtra && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(extra)</span>}
                        </span>
                        {highlightDifferences && isDiff && onToggleIgnoreDifference && (
                          <button
                            onClick={() => {
                              console.log(`Ignore button clicked for holding:`, {
                                holdingName: holding.name,
                                normalizedHoldingName,
                                holdingKey,
                                isCurrentlyIgnored: isIgnored(holdingKey),
                                isMissing
                              })
                              onToggleIgnoreDifference(holdingKey)
                            }}
                            className="text-xs px-1 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                            title={isIgnored(holdingKey) ? 'Unignore this difference' : isMissing ? 'Ignore missing holding' : 'Ignore this difference'}
                          >
                            {isIgnored(holdingKey) ? '✓' : '×'}
                          </button>
                        )}
                      </div>
                      <span className={`font-medium ${isMissing ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {isMissing ? 'N/A' : formatAllocationPercent(holding.allocationPercent)}
                      </span>
                    </>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-500">No data available</p>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export function FundsDashboard({ funds, verificationData, onUpdateGroundTruth, onSaveGroundTruth }: FundsDashboardProps) {
  const [sortBy, setSortBy] = useState<'name' | 'launchDate' | 'factsheetDate'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [localGroundTruth, setLocalGroundTruth] = useState<FundData[]>([]) // For AI Guided Adjustments
  const [groundTruthData, setGroundTruthData] = useState<FundData[]>([]) // For Ground Truth (separate from AI Guided Adjustments)
  // Track saved timestamps for each fund by fund name and data type
  const [savedTimestamps, setSavedTimestamps] = useState<Map<string, { aiGuidedAdjustments?: string; groundTruth?: string; firstRun?: string; secondRun?: string }>>(new Map())
  const [f1Scores, setF1Scores] = useState<{
    firstRun: { precision: number; recall: number; f1: number } | null
    secondRun: { precision: number; recall: number; f1: number } | null
    thirdRun: { precision: number; recall: number; f1: number } | null
    aiGuidedAdjustments: { precision: number; recall: number; f1: number } | null
  } | null>(null)
  // Track ignored differences: Set of keys like "Fund Name-field" or "Fund Name-field-index"
  const [ignoredDifferences, setIgnoredDifferences] = useState<Set<string>>(new Set())
  // Track consistency rate results
  const [consistencyRates, setConsistencyRates] = useState<{
    secondRun: { accuracy: number; totalFields: number; differences: number } | null
    thirdRun: { accuracy: number; totalFields: number; differences: number } | null
  } | null>(null)

  // Reset consistency rates and F1 scores when verification starts
  useEffect(() => {
    if (verificationData?.isVerifying || verificationData?.isVerifyingThirdRun) {
      setConsistencyRates(null)
      setF1Scores(null)
    }
  }, [verificationData?.isVerifying, verificationData?.isVerifyingThirdRun])

  const toggleIgnoreDifference = (key: string) => {
    console.log(`Toggle ignore for key: "${key}"`)
    setIgnoredDifferences(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        console.log(`Removing key from ignored set: "${key}"`)
        next.delete(key)
      } else {
        console.log(`Adding key to ignored set: "${key}"`)
        next.add(key)
      }
      console.log(`Updated ignored set (${next.size} keys):`, Array.from(next).sort())
      return next
    })
  }

  // Normalize fund name for matching (remove trailing numbers, extra spaces, etc.)
  const normalizeFundName = (name: string): string => {
    if (!name) return ''
    // Remove trailing numbers and spaces (e.g., "Fund 8" -> "Fund")
    let normalized = name.trim()
    // Remove trailing numbers and spaces pattern like " 8", " 123", etc.
    normalized = normalized.replace(/\s+\d+$/, '')
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ')
    // Convert to lowercase for comparison
    return normalized.toLowerCase()
  }

  // Split name into words, filtering out common stop words
  const getWords = (name: string): string[] => {
    const normalized = normalizeFundName(name)
    const words = normalized.split(/\s+/).filter(w => w.length > 0)
    // Filter out very common words that don't help with matching
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'])
    return words.filter(w => !stopWords.has(w))
  }

  // Calculate word-based similarity (better for "Guaranteed Fund" vs "Guaranteed Portfolio")
  const calculateWordSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1.0
    
    const words1 = getWords(str1)
    const words2 = getWords(str2)
    
    if (words1.length === 0 || words2.length === 0) return 0.0
    
    // Count matching words
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    // Jaccard similarity (intersection over union)
    const jaccard = intersection.size / union.size
    
    // Also check if all words from shorter name are in longer name
    const shorter = words1.length <= words2.length ? words1 : words2
    const longer = words1.length > words2.length ? words1 : words2
    const longerSet = new Set(longer)
    const allWordsMatch = shorter.every(word => longerSet.has(word))
    
    // Boost score if all words from shorter name are present
    if (allWordsMatch && shorter.length > 0) {
      return Math.max(jaccard, 0.75) // At least 75% if all words match
    }
    
    // Special case: if most words match (e.g., "Guaranteed Fund" vs "Guaranteed Portfolio")
    // Calculate what percentage of words match
    const minLength = Math.min(words1.length, words2.length)
    const maxLength = Math.max(words1.length, words2.length)
    
    // If at least 50% of words match and we have 2+ matching words, boost the score
    if (intersection.size >= 2 && intersection.size >= minLength * 0.5) {
      // Use a weighted score: intersection over minimum length (more forgiving)
      const weightedScore = intersection.size / minLength
      // Also consider the ratio of matching words to total unique words
      const combinedScore = (weightedScore * 0.6) + (jaccard * 0.4)
      return Math.max(jaccard, combinedScore)
    }
    
    return jaccard
  }

  // Find matching fund between two arrays using improved matching
  const findMatchingFund = (targetName: string, fundArray: FundData[]): FundData | null => {
    const normalizedTarget = normalizeFundName(targetName)
    const targetWords = getWords(targetName)
    
    // First try exact normalized match
    let match = fundArray.find(f => normalizeFundName(f.fundName) === normalizedTarget)
    if (match) return match
    
    // Then try substring match (one contains the other)
    match = fundArray.find(f => {
      const normalized = normalizeFundName(f.fundName)
      return normalized.includes(normalizedTarget) || normalizedTarget.includes(normalized)
    })
    if (match) return match
    
    // Try word-based matching - if all words from target are in a fund name
    if (targetWords.length > 0) {
      match = fundArray.find(f => {
        const fundWords = getWords(f.fundName)
        const fundWordsSet = new Set(fundWords)
        // Check if all target words are in fund name
        return targetWords.every(word => fundWordsSet.has(word))
      })
      if (match) return match
      
      // Try reverse - if all words from fund are in target
      match = fundArray.find(f => {
        const fundWords = getWords(f.fundName)
        const targetWordsSet = new Set(targetWords)
        return fundWords.every(word => targetWordsSet.has(word))
      })
      if (match) return match
      
      // Try partial word matching - if most words match (e.g., 2 out of 2, or 2 out of 3)
      match = fundArray.find(f => {
        const fundWords = getWords(f.fundName)
        const fundWordsSet = new Set(fundWords)
        const matchingWords = targetWords.filter(word => fundWordsSet.has(word))
        // If at least 50% of words match and we have 2+ matching words
        return matchingWords.length >= 2 && matchingWords.length >= targetWords.length * 0.5
      })
      if (match) return match
    }
    
    // Calculate word-based similarity score
    let bestMatch: FundData | null = null
    let bestScore = 0
    const threshold = 0.6 // Lowered from 0.7 to catch more matches (60% word overlap)
    
    for (const fund of fundArray) {
      const similarity = calculateWordSimilarity(targetName, fund.fundName)
      if (similarity > bestScore && similarity >= threshold) {
        bestScore = similarity
        bestMatch = fund
      }
    }
    
    return bestMatch
  }

  // Get matched fund pairs and unmatched funds (for 1st, 2nd, and 3rd runs)
  const matchedFundPairs = useMemo(() => {
    const pairs: Array<{ firstRun: FundData | null, secondRun: FundData | null, thirdRun: FundData | null, displayName: string }> = []
    const matchedSecondRunNames = new Set<string>()
    const matchedThirdRunNames = new Set<string>()
    
    if (!verificationData?.firstRun) return pairs
    
    // First, match funds from 1st run to 2nd and 3rd runs
    verificationData.firstRun.forEach(firstFund => {
      let matchedSecondFund: FundData | null = null
      let matchedThirdFund: FundData | null = null
      
      if (verificationData?.secondRun) {
        matchedSecondFund = findMatchingFund(firstFund.fundName, verificationData.secondRun)
        if (matchedSecondFund) {
          matchedSecondRunNames.add(matchedSecondFund.fundName)
        }
      }
      
      if (verificationData?.thirdRun) {
        matchedThirdFund = findMatchingFund(firstFund.fundName, verificationData.thirdRun)
        if (matchedThirdFund) {
          matchedThirdRunNames.add(matchedThirdFund.fundName)
        }
      }
      
      pairs.push({
        firstRun: firstFund,
        secondRun: matchedSecondFund,
        thirdRun: matchedThirdFund,
        displayName: firstFund.fundName // Use 1st run name as display name
      })
    })
    
    // Then, add any unmatched funds from 2nd run
    if (verificationData?.secondRun) {
      verificationData.secondRun.forEach(secondFund => {
        if (!matchedSecondRunNames.has(secondFund.fundName)) {
          // Try to find match in 3rd run
          let matchedThirdFund: FundData | null = null
          if (verificationData?.thirdRun) {
            matchedThirdFund = findMatchingFund(secondFund.fundName, verificationData.thirdRun)
            if (matchedThirdFund) {
              matchedThirdRunNames.add(matchedThirdFund.fundName)
            }
          }
          
          pairs.push({
            firstRun: null,
            secondRun: secondFund,
            thirdRun: matchedThirdFund,
            displayName: secondFund.fundName
          })
        }
      })
    }
    
    // Finally, add any unmatched funds from 3rd run
    if (verificationData?.thirdRun) {
      verificationData.thirdRun.forEach(thirdFund => {
        if (!matchedThirdRunNames.has(thirdFund.fundName)) {
          pairs.push({
            firstRun: null,
            secondRun: null,
            thirdRun: thirdFund,
            displayName: thirdFund.fundName
          })
        }
      })
    }
    
    return pairs
  }, [verificationData])


  // Initialize ground truth from first run or existing ground truth
  useMemo(() => {
    if (verificationData?.groundTruth && verificationData.groundTruth.length > 0) {
      // Deep clone to avoid reference issues
      const cloned = verificationData.groundTruth.map(f => ({
        ...f,
        returns: { ...f.returns },
        assetClasses: f.assetClasses.map(ac => ({ ...ac })),
        top10Holdings: f.top10Holdings.map(h => ({ ...h }))
      }))
      setLocalGroundTruth(cloned)
      setGroundTruthData(cloned.map(f => ({
        ...f,
        returns: { ...f.returns },
        assetClasses: f.assetClasses.map(ac => ({ ...ac })),
        top10Holdings: f.top10Holdings.map(h => ({ ...h }))
      })))
    } else if (verificationData?.firstRun && verificationData.firstRun.length > 0) {
      // Deep clone to avoid reference issues
      const cloned = verificationData.firstRun.map(f => ({
        ...f,
        returns: { ...f.returns },
        assetClasses: f.assetClasses.map(ac => ({ ...ac })),
        top10Holdings: f.top10Holdings.map(h => ({ ...h }))
      }))
      setLocalGroundTruth(cloned)
      setGroundTruthData(cloned.map(f => ({
        ...f,
        returns: { ...f.returns },
        assetClasses: f.assetClasses.map(ac => ({ ...ac })),
        top10Holdings: f.top10Holdings.map(h => ({ ...h }))
      })))
    }
  }, [verificationData?.groundTruth, verificationData?.firstRun])


  // Helper function to update a fund in a data array
  const updateFundInArray = (funds: FundData[], fundName: string, field: string, value: any): FundData[] => {
    const existingFund = funds.find(f => f.fundName === fundName)
    
    if (!existingFund) {
      // Create new fund if it doesn't exist (for missing funds)
      const newFund: FundData = {
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fundName: field === 'fundName' ? (value || fundName) : fundName,
        fund_factsheet_as_of_date: new Date().toISOString().split('T')[0],
        launchDate: new Date().toISOString().split('T')[0],
        investmentObjective: '',
        riskLevel: null,
        returns: {
          oneYearAnnualized: null,
          threeYearAnnualized: null,
          fiveYearAnnualized: null,
          sinceLaunchAnnualized: null,
          calendarYear2024: null,
          calendarYear2023: null,
          calendarYear2022: null,
        },
        assetClasses: [],
        top10Holdings: [],
        sourceFile: '',
        processedAt: new Date().toISOString(),
      }
      
      // Update the new fund with the field value
      if (field === 'fundName') {
        newFund.fundName = value || ''
      } else if (field.startsWith('returns.')) {
        const returnField = field.replace('returns.', '') as keyof typeof newFund.returns
        newFund.returns[returnField] = value
      } else if (field === 'assetClasses' || field === 'top10Holdings') {
        (newFund as any)[field] = value
      } else {
        (newFund as any)[field] = value
      }
      
      return [...funds, newFund]
    }
    
    // Update existing fund
    return funds.map(fund => {
      if (fund.fundName !== fundName) return fund
      
      const updatedFund = { ...fund }
      if (field === 'fundName') {
        updatedFund.fundName = value || ''
      } else if (field.startsWith('returns.')) {
        const returnField = field.replace('returns.', '') as keyof typeof fund.returns
        updatedFund.returns = { ...fund.returns, [returnField]: value }
      } else if (field === 'assetClasses' || field === 'top10Holdings') {
        (updatedFund as any)[field] = value
      } else {
        (updatedFund as any)[field] = value
      }
      return updatedFund
    })
  }

  // Update AI Guided Adjustments - also updates Ground Truth (mirrors to GT)
  const handleUpdateAIGuidedAdjustments = (fundName: string, field: string, value: any) => {
    const updatedAIGuided = updateFundInArray(localGroundTruth, fundName, field, value)
    setLocalGroundTruth(updatedAIGuided)
    
    // Mirror the update to Ground Truth
    const updatedGT = updateFundInArray(groundTruthData, fundName, field, value)
    setGroundTruthData(updatedGT)
    
    onUpdateGroundTruth?.(fundName, field, value)
  }

  // Update Ground Truth only - does NOT update AI Guided Adjustments
  const handleUpdateGroundTruth = (fundName: string, field: string, value: any) => {
    const updatedGT = updateFundInArray(groundTruthData, fundName, field, value)
    setGroundTruthData(updatedGT)
    // Note: We don't call onUpdateGroundTruth here because this is a separate Ground Truth state
    // The save button will save groundTruthData instead
  }

  // Save individual fund data to Supabase
  const handleSaveFund = async (fund: FundData, dataType: 'aiGuidedAdjustments' | 'groundTruth' | 'firstRun' | 'secondRun') => {
    try {
      const response = await fetch('/api/save-fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundData: fund,
          dataType
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save fund' }))
        throw new Error(errorData.error || 'Failed to save fund')
      }

      const result = await response.json()
      
      // Update saved timestamp in state
      setSavedTimestamps(prev => {
        const newMap = new Map(prev)
        const key = fund.fundName
        const existing = newMap.get(key) || {}
        newMap.set(key, {
          ...existing,
          [dataType]: result.savedAt
        })
        return newMap
      })

      return result
    } catch (error: any) {
      console.error(`Error saving ${dataType} for ${fund.fundName}:`, error)
      throw error
    }
  }

  // Save all funds in a column to Supabase
  const handleSaveAll = async (dataType: 'aiGuidedAdjustments' | 'groundTruth') => {
    const fundsToSave = dataType === 'aiGuidedAdjustments' ? localGroundTruth : groundTruthData
    
    if (fundsToSave.length === 0) {
      alert(`No funds to save in ${dataType === 'aiGuidedAdjustments' ? 'AI Guided Adjustments' : 'Ground Truth'} column.`)
      return
    }

    const now = new Date().toISOString()
    let successCount = 0
    let errorCount = 0

    // Save all funds in parallel
    const savePromises = fundsToSave.map(async (fund) => {
      try {
        await handleSaveFund(fund, dataType)
        successCount++
      } catch (error) {
        console.error(`Error saving ${fund.fundName}:`, error)
        errorCount++
      }
    })

    await Promise.all(savePromises)

    // Update all timestamps to the same save time
    setSavedTimestamps(prev => {
      const newMap = new Map(prev)
      fundsToSave.forEach(fund => {
        const key = fund.fundName
        const existing = newMap.get(key) || {}
        newMap.set(key, {
          ...existing,
          [dataType]: now
        })
      })
      return newMap
    })

    if (errorCount > 0) {
      alert(`Saved ${successCount} fund(s) successfully. ${errorCount} fund(s) failed to save.`)
    } else {
      alert(`Successfully saved all ${successCount} fund(s) in ${dataType === 'aiGuidedAdjustments' ? 'AI Guided Adjustments' : 'Ground Truth'} column.`)
    }
  }

  // Calculate F1 score for a run against ground truth
  // Using field-level accuracy: each field is a prediction
  // Ignored differences are treated as correct matches
  const calculateF1Score = (
    runData: FundData[] | null, 
    groundTruth: FundData[], 
    ignoredDifferences: Set<string> = new Set(),
    runIdentifier: string = ''
  ): { precision: number; recall: number; f1: number } | null => {
    if (!runData || runData.length === 0 || groundTruth.length === 0) {
      return null
    }

    // Helper function to check if a difference is ignored
    const isDifferenceIgnored = (fundName: string, field: string): boolean => {
      const normalizedFundName = fundName.toLowerCase().replace(/\s+/g, '-')
      
      // Try multiple fund name variations to match how keys were created
      const fundNameVariations = [
        normalizedFundName,
        normalizeFundName(fundName).toLowerCase().replace(/\s+/g, '-'),
        fundName.toLowerCase().trim().replace(/\s+/g, '-')
      ]
      
      // Try each variation
      for (const fundNameVar of fundNameVariations) {
        const key = runIdentifier 
          ? `${fundNameVar}-${runIdentifier}-${field}`
          : `${fundNameVar}-${field}`
        if (ignoredDifferences.has(key)) {
          return true
        }
      }
      
      return false
    }

    // Helper function to check if a missing/extra asset class is ignored
    const isAssetClassIgnored = (fundName: string, assetClassName: string, isMissing: boolean): boolean => {
      const normalizedFundName = fundName.toLowerCase().replace(/\s+/g, '-')
      const normalizedACName = normalizeTextForComparison(assetClassName)
      
      // Try multiple fund name variations to match how keys were created
      const fundNameVariations = [
        normalizedFundName,
        normalizeFundName(fundName).toLowerCase().replace(/\s+/g, '-'),
        fundName.toLowerCase().trim().replace(/\s+/g, '-')
      ]
      
      // Try each variation
      for (const fundNameVar of fundNameVariations) {
        const key = runIdentifier
          ? `${fundNameVar}-${runIdentifier}-assetClass-${normalizedACName}`
          : `${fundNameVar}-assetClass-${normalizedACName}`
        if (ignoredDifferences.has(key)) {
          return true
        }
      }
      
      // Debug logging for unmatched keys
      if (runIdentifier && ignoredDifferences.size > 0) {
        // Check if there are any similar keys
        const similarKeys = Array.from(ignoredDifferences).filter(k => 
          k.includes('assetClass') && k.includes(normalizedACName) && k.includes(runIdentifier)
        )
        if (similarKeys.length > 0) {
          const primaryKey = runIdentifier
            ? `${normalizedFundName}-${runIdentifier}-assetClass-${normalizedACName}`
            : `${normalizedFundName}-assetClass-${normalizedACName}`
          console.log(`Asset class key mismatch - Looking for: "${primaryKey}", Found similar:`, similarKeys.slice(0, 3))
        }
      }
      
      return false
    }

    // Helper function to check if a missing/extra holding is ignored
    const isHoldingIgnored = (fundName: string, holdingName: string, isMissing: boolean): boolean => {
      const normalizedFundName = fundName.toLowerCase().replace(/\s+/g, '-')
      const normalizedHoldingName = normalizeTextForComparison(holdingName)
      
      // Try multiple fund name variations to match how keys were created
      const fundNameVariations = [
        normalizedFundName,
        normalizeFundName(fundName).toLowerCase().replace(/\s+/g, '-'),
        fundName.toLowerCase().trim().replace(/\s+/g, '-')
      ]
      
      // Try each variation
      for (const fundNameVar of fundNameVariations) {
        const key = runIdentifier
          ? `${fundNameVar}-${runIdentifier}-holding-${normalizedHoldingName}`
          : `${fundNameVar}-holding-${normalizedHoldingName}`
        if (ignoredDifferences.has(key)) {
          return true
        }
      }
      
      // Debug logging for unmatched keys
      if (runIdentifier && ignoredDifferences.size > 0) {
        // Check if there are any similar keys
        const similarKeys = Array.from(ignoredDifferences).filter(k => 
          k.includes('holding') && k.includes(normalizedHoldingName) && k.includes(runIdentifier)
        )
        if (similarKeys.length > 0) {
          const primaryKey = runIdentifier
            ? `${normalizedFundName}-${runIdentifier}-holding-${normalizedHoldingName}`
            : `${normalizedFundName}-holding-${normalizedHoldingName}`
          console.log(`Holding key mismatch - Looking for: "${primaryKey}", Found similar:`, similarKeys.slice(0, 3))
        }
      }
      
      return false
    }

    let totalFields = 0
    let correctFields = 0
    let incorrectFields = 0
    let missingFields = 0

    // Match funds between run and ground truth using fuzzy matching
    const matchedPairs: Array<{ runFund: FundData; groundTruthFund: FundData }> = []
    const matchedGroundTruthNames = new Set<string>()

    runData.forEach(runFund => {
      const matchedGT = groundTruth.find(gtFund => {
        if (matchedGroundTruthNames.has(gtFund.fundName)) return false
        const similarity = calculateWordSimilarity(
          runFund.fundName,
          gtFund.fundName
        )
        return similarity > 0.6 || normalizeFundName(runFund.fundName) === normalizeFundName(gtFund.fundName)
      })
      if (matchedGT) {
        matchedPairs.push({ runFund, groundTruthFund: matchedGT })
        matchedGroundTruthNames.add(matchedGT.fundName)
      }
    })

    console.log('Fund Matching:', {
      runDataCount: runData.length,
      groundTruthCount: groundTruth.length,
      matchedCount: matchedPairs.length,
      unmatchedRun: runData.length - matchedPairs.length,
      unmatchedGT: groundTruth.length - matchedPairs.length
    })

    // Count unmatched funds - count actual fields, not estimates
    const unmatchedRunFunds = runData.filter(rf => !matchedPairs.some(p => p.runFund.fundName === rf.fundName))
    const unmatchedGTFunds = groundTruth.filter(gtf => !matchedPairs.some(p => p.groundTruthFund.fundName === gtf.fundName))

    // For unmatched funds, count actual fields
    unmatchedRunFunds.forEach(fund => {
      // Basic fields (3)
      incorrectFields += 3
      // Returns (7)
      incorrectFields += 7
      // Asset classes
      incorrectFields += fund.assetClasses.length
      // Holdings
      incorrectFields += fund.top10Holdings.length
    })

    unmatchedGTFunds.forEach(fund => {
      // Basic fields (3)
      missingFields += 3
      totalFields += 3
      // Returns (7)
      missingFields += 7
      totalFields += 7
      // Asset classes
      missingFields += fund.assetClasses.length
      totalFields += fund.assetClasses.length
      // Holdings
      missingFields += fund.top10Holdings.length
      totalFields += fund.top10Holdings.length
    })

    // Compare matched pairs field by field
    matchedPairs.forEach(({ runFund, groundTruthFund }) => {
      // Use the fund name that matches how ignore keys are created (prefer first run fund name)
      // The ignore keys are created using firstRunFundName, so we need to use a consistent name
      // Try to find the matching fund name from the ignored keys first
      const fundName = runFund.fundName || groundTruthFund.fundName
      
      // Debug: Log ignored keys for this fund
      const fundNameVariations = [
        fundName.toLowerCase().replace(/\s+/g, '-'),
        normalizeFundName(fundName).toLowerCase().replace(/\s+/g, '-'),
        runFund.fundName?.toLowerCase().replace(/\s+/g, '-'),
        groundTruthFund.fundName?.toLowerCase().replace(/\s+/g, '-')
      ].filter(Boolean)
      
      const relevantIgnoredKeys = Array.from(ignoredDifferences).filter(key => 
        fundNameVariations.some(variation => key.startsWith(variation))
      )
      
      if (relevantIgnoredKeys.length > 0 && runIdentifier) {
        console.log(`F1 Calculation - Fund: ${fundName}, Run: ${runIdentifier}, Ignored keys:`, relevantIgnoredKeys.slice(0, 10))
      }
      
      // Compare basic fields (4 fields) - always count these as they should always exist
      totalFields += 4
      if (runFund.fund_factsheet_as_of_date === groundTruthFund.fund_factsheet_as_of_date) {
        correctFields++
      } else {
        // Check if this difference is ignored
        if (isDifferenceIgnored(fundName, 'fund_factsheet_as_of_date')) {
          correctFields++ // Treat ignored difference as correct
        } else {
          incorrectFields++
        }
      }

      if (runFund.launchDate === groundTruthFund.launchDate) {
        correctFields++
      } else {
        if (isDifferenceIgnored(fundName, 'launchDate')) {
          correctFields++
        } else {
          incorrectFields++
        }
      }

      if (isTextEffectivelySame(runFund.investmentObjective, groundTruthFund.investmentObjective)) {
        correctFields++
      } else {
        if (isDifferenceIgnored(fundName, 'investmentObjective')) {
          correctFields++
        } else {
          incorrectFields++
        }
      }

      if (runFund.riskLevel === groundTruthFund.riskLevel) {
        correctFields++
      } else {
        if (isDifferenceIgnored(fundName, 'riskLevel')) {
          correctFields++
        } else {
          incorrectFields++
        }
      }

      // Compare returns (7 fields) - only count fields that exist in ground truth
      const returnFields: (keyof typeof runFund.returns)[] = [
        'oneYearAnnualized', 'threeYearAnnualized', 'fiveYearAnnualized',
        'sinceLaunchAnnualized', 'calendarYear2024', 'calendarYear2023', 'calendarYear2022'
      ]
      returnFields.forEach(field => {
        const runValue = runFund.returns[field]
        const gtValue = groundTruthFund.returns[field]
        const fieldKey = `returns.${field}`
        
        // Only count if ground truth has a value (null in GT means field doesn't exist, don't count it)
        if (gtValue !== null && gtValue !== undefined) {
          totalFields++
          if (areNumbersEqual(runValue, gtValue, 0.01)) {
            correctFields++
          } else {
            // Check if this difference is ignored
            if (isDifferenceIgnored(fundName, fieldKey)) {
              correctFields++ // Treat ignored difference as correct
          } else {
            incorrectFields++
            }
          }
        } else if (runValue !== null && runValue !== undefined) {
          // GT is null but run has value - this is an extra field (incorrect prediction)
          // Check if this extra field is ignored
          if (isDifferenceIgnored(fundName, fieldKey)) {
            // Ignored extra field - don't count as incorrect
          } else {
          incorrectFields++
          }
        }
        // If both are null, don't count as a field (field doesn't exist in either)
      })

      // Compare asset classes - only count asset classes that exist in ground truth
      const runAC = new Map<string, number>()
      runFund.assetClasses.forEach(ac => {
        const normalizedName = normalizeTextForComparison(ac.class)
        if (normalizedName) {
          runAC.set(normalizedName, ac.allocationPercent)
        }
      })

      const gtAC = new Map<string, number>()
      groundTruthFund.assetClasses.forEach(ac => {
        const normalizedName = normalizeTextForComparison(ac.class)
        if (normalizedName) {
          gtAC.set(normalizedName, ac.allocationPercent)
        }
      })

      // Only count asset classes from ground truth (what we need to match)
      gtAC.forEach((gtPercent, normalizedName) => {
        totalFields++
        const runPercent = runAC.get(normalizedName)
        
        if (runPercent !== undefined) {
          // Both exist - check if values match
          if (Math.abs(runPercent - gtPercent) < 0.1) {
            correctFields++
          } else {
            // Check if this difference is ignored
            // Find the original asset class name for the key
            const originalACName = groundTruthFund.assetClasses.find(ac => 
              normalizeTextForComparison(ac.class) === normalizedName
            )?.class || normalizedName
            if (isAssetClassIgnored(fundName, originalACName, false)) {
              correctFields++ // Treat ignored difference as correct
          } else {
            incorrectFields++
            }
          }
        } else {
          // In GT but not in run - missing item
          // Find the original asset class name for the key
          const originalACName = groundTruthFund.assetClasses.find(ac => 
            normalizeTextForComparison(ac.class) === normalizedName
          )?.class || normalizedName
          if (isAssetClassIgnored(fundName, originalACName, true)) {
            // Ignored missing item - don't count as missing, and don't count in totalFields
            // This means it won't affect recall (it's as if the field doesn't exist in GT)
            totalFields-- // Remove from totalFields since we're ignoring it
          } else {
          missingFields++
          }
        }
      })
      
      // Count extra asset classes in run that aren't in GT (incorrect predictions)
      runAC.forEach((runPercent, normalizedName) => {
        if (!gtAC.has(normalizedName)) {
          // Find the original asset class name for the key
          const originalACName = runFund.assetClasses.find(ac => 
            normalizeTextForComparison(ac.class) === normalizedName
          )?.class || normalizedName
          if (isAssetClassIgnored(fundName, originalACName, false)) {
            // Ignored extra item - don't count as incorrect
          } else {
          incorrectFields++
          }
        }
      })

      // Compare holdings - only count holdings that exist in ground truth
      const runHoldings = new Map<string, number>()
      runFund.top10Holdings.forEach(h => {
        const normalizedName = normalizeTextForComparison(h.name)
        if (normalizedName) {
          runHoldings.set(normalizedName, h.allocationPercent)
        }
      })

      const gtHoldings = new Map<string, number>()
      groundTruthFund.top10Holdings.forEach(h => {
        const normalizedName = normalizeTextForComparison(h.name)
        if (normalizedName) {
          gtHoldings.set(normalizedName, h.allocationPercent)
        }
      })

      // Only count holdings from ground truth (what we need to match)
      gtHoldings.forEach((gtPercent, normalizedName) => {
        totalFields++
        const runPercent = runHoldings.get(normalizedName)
        
        if (runPercent !== undefined) {
          // Both exist - check if values match
          if (Math.abs(runPercent - gtPercent) < 0.1) {
            correctFields++
          } else {
            // Check if this difference is ignored
            // Find the original holding name for the key
            const originalHoldingName = groundTruthFund.top10Holdings.find(h => 
              normalizeTextForComparison(h.name) === normalizedName
            )?.name || normalizedName
            if (isHoldingIgnored(fundName, originalHoldingName, false)) {
              correctFields++ // Treat ignored difference as correct
          } else {
            incorrectFields++
            }
          }
        } else {
          // In GT but not in run - missing item
          // Find the original holding name for the key
          const originalHoldingName = groundTruthFund.top10Holdings.find(h => 
            normalizeTextForComparison(h.name) === normalizedName
          )?.name || normalizedName
          if (isHoldingIgnored(fundName, originalHoldingName, true)) {
            // Ignored missing item - don't count as missing, and don't count in totalFields
            // This means it won't affect recall (it's as if the field doesn't exist in GT)
            totalFields-- // Remove from totalFields since we're ignoring it
          } else {
          missingFields++
          }
        }
      })
      
      // Count extra holdings in run that aren't in GT (incorrect predictions)
      runHoldings.forEach((runPercent, normalizedName) => {
        if (!gtHoldings.has(normalizedName)) {
          // Find the original holding name for the key
          const originalHoldingName = runFund.top10Holdings.find(h => 
            normalizeTextForComparison(h.name) === normalizedName
          )?.name || normalizedName
          if (isHoldingIgnored(fundName, originalHoldingName, false)) {
            // Ignored extra item - don't count as incorrect
          } else {
          incorrectFields++
          }
        }
      })
    })

    // Calculate precision, recall, and F1
    // Precision = correct predictions / total predictions
    // Recall = correct predictions / total ground truth
    const totalPredictions = correctFields + incorrectFields
    const totalGroundTruthFields = correctFields + missingFields
    
    const precision = totalPredictions > 0 
      ? correctFields / totalPredictions 
      : 0
    const recall = totalGroundTruthFields > 0 
      ? correctFields / totalGroundTruthFields 
      : 0
    const f1 = (precision + recall) > 0 
      ? (2 * precision * recall) / (precision + recall) 
      : 0

    // Log for debugging
    console.log('F1 Calculation Debug:', {
      runIdentifier,
      matchedFunds: matchedPairs.length,
      unmatchedRunFunds: unmatchedRunFunds.length,
      unmatchedGTFunds: unmatchedGTFunds.length,
      correctFields,
      incorrectFields,
      missingFields,
      totalPredictions,
      totalGroundTruthFields,
      precision: precision * 100,
      recall: recall * 100,
      f1: f1 * 100,
      ignoredDifferencesCount: ignoredDifferences.size,
      sampleIgnoredKeys: Array.from(ignoredDifferences).slice(0, 10)
    })
    
    // Log unmatched fund names for debugging
    if (unmatchedRunFunds.length > 0) {
      console.log('Unmatched Run Funds:', unmatchedRunFunds.map(f => f.fundName))
    }
    if (unmatchedGTFunds.length > 0) {
      console.log('Unmatched Ground Truth Funds:', unmatchedGTFunds.map(f => f.fundName))
    }

    return {
      precision: Math.round(precision * 10000) / 100, // Round to 2 decimal places
      recall: Math.round(recall * 10000) / 100,
      f1: Math.round(f1 * 10000) / 100
    }
  }

  const handleCalculateF1 = async () => {
    // Check if verification is still in progress
    if (verificationData?.isVerifying || verificationData?.isVerifyingThirdRun) {
      alert('Please wait for the 2nd and 3rd run verification to complete before calculating F1 scores. The results are not ready yet.')
      return
    }

    // Use groundTruthData for F1 calculations (the actual Ground Truth column)
    const groundTruth = verificationData?.groundTruth || groundTruthData
    if (!groundTruth || groundTruth.length === 0) {
      alert('Please save ground truth data first before calculating F1 scores.')
      return
    }

    // Check if at least first run data is available
    if (!verificationData?.firstRun || verificationData.firstRun.length === 0) {
      alert('No verification data available. Please process factsheets first.')
      return
    }

    const firstRunF1 = calculateF1Score(verificationData?.firstRun || null, groundTruth, ignoredDifferences, '')
    const secondRunF1 = calculateF1Score(verificationData?.secondRun || null, groundTruth, ignoredDifferences, '2nd-run')
    const thirdRunF1 = calculateF1Score(verificationData?.thirdRun || null, groundTruth, ignoredDifferences, '3rd-run')
    // AI Guided Adjustments is compared against Ground Truth
    // No run identifier needed for AI Guided Adjustments
    const aiGuidedAdjustmentsF1 = calculateF1Score(localGroundTruth.length > 0 ? localGroundTruth : null, groundTruth, ignoredDifferences, '')

    setF1Scores({
      firstRun: firstRunF1,
      secondRun: secondRunF1,
      thirdRun: thirdRunF1,
      aiGuidedAdjustments: aiGuidedAdjustmentsF1
    })

    // Save accuracy rates (F1 scores) to database
    if (groundTruth.length > 0) {
      const sourceFile = groundTruth[0]?.sourceFile || funds[0]?.sourceFile || verificationData?.firstRun?.[0]?.sourceFile || 'unknown'
      
      // Save rates for each fund in ground truth
      for (const fund of groundTruth) {
        try {
          await fetch('/api/save-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fundName: fund.fundName,
              sourceFile,
              accuracyRateFirstRun: firstRunF1?.f1 ?? null,
              accuracyRateSecondRun: secondRunF1?.f1 ?? null,
              accuracyRateThirdRun: thirdRunF1?.f1 ?? null,
              accuracyRateAiGuidedAdjustments: aiGuidedAdjustmentsF1?.f1 ?? null
            })
          })
        } catch (error) {
          console.error(`Failed to save accuracy rates for ${fund.fundName}:`, error)
        }
      }
    }
  }

  // Normalize text for comparison (remove Chinese characters, normalize whitespace)
  const normalizeTextForComparison = (text: string | null | undefined): string => {
    if (!text) return ''
    // Remove Chinese characters (CJK Unified Ideographs: \u4e00-\u9fff)
    // Also remove other CJK ranges and punctuation
    let normalized = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g, '')
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase()
    return normalized
  }

  // Check if two text values are effectively the same (ignoring Chinese characters)
  const isTextEffectivelySame = (text1: string | null | undefined, text2: string | null | undefined): boolean => {
    if (!text1 && !text2) return true
    if (!text1 || !text2) return false
    
    const normalized1 = normalizeTextForComparison(text1)
    const normalized2 = normalizeTextForComparison(text2)
    
    // If both normalized texts are empty, they're the same
    if (!normalized1 && !normalized2) return true
    
    // If one is empty and the other isn't, they're different
    if (!normalized1 || !normalized2) return false
    
    // Compare normalized texts
    return normalized1 === normalized2
  }

  // Compare two numbers with tolerance (for floating point precision issues)
  const areNumbersEqual = (num1: number | null, num2: number | null, tolerance: number = 0.01): boolean => {
    // Both null/undefined are equal
    if (num1 === null && num2 === null) return true
    if (num1 === null || num2 === null) return false
    
    // Compare with tolerance (0.01% default for returns)
    return Math.abs(num1 - num2) < tolerance
  }

  // Helper to check if a difference is ignored
  // Uses normalized fund name to match keys generated from any run
  const isDifferenceIgnored = (fundName: string, field: string, index?: number): boolean => {
    const normalizedName = normalizeFundName(fundName)
    const key = index !== undefined ? `${normalizedName}-${field}-${index}` : `${normalizedName}-${field}`
    return ignoredDifferences.has(key)
  }

  // Calculate consistency rate between 1st run and another run (2nd or 3rd)
  const calculateConsistencyRate = (
    compareRun: 'secondRun' | 'thirdRun'
  ): { accuracy: number; totalFields: number; differences: number } => {
    if (!verificationData?.firstRun) {
      return { accuracy: 0, totalFields: 0, differences: 0 }
    }

    const compareRunFunds = compareRun === 'secondRun' ? verificationData?.secondRun : verificationData?.thirdRun
    if (!compareRunFunds || compareRunFunds.length === 0) {
      return { accuracy: 0, totalFields: 0, differences: 0 }
    }

    // Get run identifier for key matching (e.g., "2nd-run" or "3rd-run")
    const runId = compareRun === 'secondRun' ? '2nd-run' : '3rd-run'

    let totalFields = 0
    let differences = 0
    const differenceDetails: Array<{fund: string, field: string, reason: string, key: string, isIgnored: boolean}> = []

    // Compare each matched pair from matchedFundPairs
    matchedFundPairs.forEach((pair) => {
      const firstRunFund = pair.firstRun
      const compareRunFund = compareRun === 'secondRun' ? pair.secondRun : pair.thirdRun
      
      if (!firstRunFund || !compareRunFund) {
        // Fund missing in one run - count as difference (can't ignore missing funds)
        const missingFundName = firstRunFund?.fundName || compareRunFund?.fundName || 'unknown'
        console.log(`Fund missing in ${compareRun}: ${missingFundName}`)
        differences += 10 // Approximate field count per fund
        totalFields += 10
        differenceDetails.push({
          fund: missingFundName,
          field: 'missing_fund',
          reason: `Fund missing in ${compareRun}`,
          key: `missing-${missingFundName}`,
          isIgnored: false
        })
        return
      }

      const fundName = firstRunFund.fundName || 'unknown'
      
      console.log(`Comparing fund: ${fundName} (${compareRun})`)

      // Both funds exist, compare them
      // Compare basic fields (4 fields)
      totalFields += 4
      // Use the same normalization as getDifferenceKey (dashes, not spaces)
      const normalizedFundName = (fundName || '').toLowerCase().replace(/\s+/g, '-')
      
      if (firstRunFund.fund_factsheet_as_of_date !== compareRunFund.fund_factsheet_as_of_date) {
        const key = `${normalizedFundName}-${runId}-fund_factsheet_as_of_date`
        const isIgnored = ignoredDifferences.has(key)
        if (!isIgnored) {
          differences++
          differenceDetails.push({fund: fundName, field: 'fund_factsheet_as_of_date', reason: `1st: ${firstRunFund.fund_factsheet_as_of_date}, ${compareRun}: ${compareRunFund.fund_factsheet_as_of_date}`, key, isIgnored})
        } else {
          console.log(`Ignored difference found: ${key}`)
        }
      }
      
      if (firstRunFund.launchDate !== compareRunFund.launchDate) {
        const key = `${normalizedFundName}-${runId}-launchDate`
        const isIgnored = ignoredDifferences.has(key)
        if (!isIgnored) {
          differences++
          differenceDetails.push({fund: fundName, field: 'launchDate', reason: `1st: ${firstRunFund.launchDate}, ${compareRun}: ${compareRunFund.launchDate}`, key, isIgnored})
        }
      }
      
      // Use text normalization for investment objective to ignore Chinese/English differences
      if (!isTextEffectivelySame(firstRunFund.investmentObjective, compareRunFund.investmentObjective)) {
        const key = `${normalizedFundName}-${runId}-investmentObjective`
        const isIgnored = ignoredDifferences.has(key)
        if (!isIgnored) {
          differences++
          differenceDetails.push({fund: fundName, field: 'investmentObjective', reason: 'Text difference', key, isIgnored})
        }
      }

      if (firstRunFund.riskLevel !== compareRunFund.riskLevel) {
        const key = `${normalizedFundName}-${runId}-riskLevel`
        const isIgnored = ignoredDifferences.has(key)
        if (!isIgnored) {
          differences++
          differenceDetails.push({fund: fundName, field: 'riskLevel', reason: `1st: ${firstRunFund.riskLevel || 'N/A'}, ${compareRun}: ${compareRunFund.riskLevel || 'N/A'}`, key, isIgnored})
        }
      }

      // Compare returns (7 fields) with tolerance for floating point precision
      totalFields += 7
      const returnFields: (keyof typeof firstRunFund.returns)[] = [
        'oneYearAnnualized', 'threeYearAnnualized', 'fiveYearAnnualized', 
        'sinceLaunchAnnualized', 'calendarYear2024', 'calendarYear2023', 'calendarYear2022'
      ]
      returnFields.forEach(field => {
        const firstValue = firstRunFund.returns[field]
        const compareValue = compareRunFund.returns[field]
        // Use tolerance-based comparison (0.01% tolerance)
        if (!areNumbersEqual(firstValue, compareValue, 0.01)) {
          const key = `${normalizedFundName}-${runId}-returns.${field}`
          const isIgnored = ignoredDifferences.has(key)
          if (!isIgnored) {
            differences++
            differenceDetails.push({fund: fundName, field: `returns.${field}`, reason: `1st: ${firstValue}, ${compareRun}: ${compareValue}`, key, isIgnored})
          } else {
            console.log(`Ignored returns difference: ${key}`)
          }
        }
      })

      // Compare asset classes (using normalized names to match Chinese/English variants)
      const firstRunAC = new Map<string, number>()
      firstRunFund.assetClasses.forEach(ac => {
        const normalizedName = normalizeTextForComparison(ac.class)
        // Store by normalized name to match Chinese/English variants
        if (normalizedName) {
          firstRunAC.set(normalizedName, ac.allocationPercent)
        }
      })
      
      const compareRunAC = new Map<string, number>()
      compareRunFund.assetClasses.forEach(ac => {
        const normalizedName = normalizeTextForComparison(ac.class)
        if (normalizedName) {
          compareRunAC.set(normalizedName, ac.allocationPercent)
        }
      })
      
      // Count all unique asset classes from both runs (by normalized name)
      const allAC = new Set([...firstRunAC.keys(), ...compareRunAC.keys()])
      totalFields += allAC.size // count each asset class as 1 field
      
      allAC.forEach(normalizedClassName => {
        const firstPercent = firstRunAC.get(normalizedClassName)
        const comparePercent = compareRunAC.get(normalizedClassName)
        
        // Create a key using normalized fund name, run identifier, and normalized class name
        // This matches the key format used in FundDataBox
        const diffKey = `${normalizedFundName}-${runId}-assetClass-${normalizedClassName}`
        const isIgnored = ignoredDifferences.has(diffKey)
        
        // Debug: Log key matching for asset classes
        if (firstPercent !== comparePercent && (firstPercent === undefined || comparePercent === undefined || Math.abs(firstPercent - comparePercent) >= 0.1)) {
          const matchingKeys = Array.from(ignoredDifferences).filter(k => {
            // Check if keys match (accounting for potential whitespace differences)
            const normalizedKey = k.replace(/\s+/g, ' ').trim()
            const normalizedDiffKey = diffKey.replace(/\s+/g, ' ').trim()
            return normalizedKey === normalizedDiffKey || k === diffKey
          })
          console.log(`Asset class difference check:`, {
            fundName,
            normalizedClassName,
            diffKey,
            diffKeyLength: diffKey.length,
            diffKeyChars: diffKey.split('').map((c, i) => ({ char: c, code: c.charCodeAt(0) })),
            isIgnored,
            inIgnoredSet: ignoredDifferences.has(diffKey),
            allIgnoredKeys: Array.from(ignoredDifferences).filter(k => k.includes('assetClass')),
            matchingKeys,
            exactMatch: ignoredDifferences.has(diffKey)
          })
        }
        
        // If class doesn't exist in one run, it's a difference
        if (firstPercent === undefined || comparePercent === undefined) {
          if (!isIgnored) {
            differences += 1 // missing asset class
            differenceDetails.push({fund: fundName, field: `assetClass-${normalizedClassName}`, reason: `Missing: 1st=${firstPercent !== undefined}, ${compareRun}=${comparePercent !== undefined}`, key: diffKey, isIgnored})
          } else {
            console.log(`Ignored asset class difference: ${diffKey}`)
          }
        } else if (Math.abs(firstPercent - comparePercent) >= 0.1) {
          // Percentage difference (with 0.1% tolerance for rounding)
          if (!isIgnored) {
            differences++ // percentage difference
            differenceDetails.push({fund: fundName, field: `assetClass-${normalizedClassName}`, reason: `1st: ${firstPercent}%, ${compareRun}: ${comparePercent}%`, key: diffKey, isIgnored})
          } else {
            console.log(`Ignored asset class difference: ${diffKey}`)
          }
        }
      })

      // Compare holdings (using normalized names to match Chinese/English variants)
      const firstRunHoldings = new Map<string, number>()
      firstRunFund.top10Holdings.forEach(h => {
        const normalizedName = normalizeTextForComparison(h.name)
        if (normalizedName) {
          firstRunHoldings.set(normalizedName, h.allocationPercent)
        }
      })
      
      const compareRunHoldings = new Map<string, number>()
      compareRunFund.top10Holdings.forEach(h => {
        const normalizedName = normalizeTextForComparison(h.name)
        if (normalizedName) {
          compareRunHoldings.set(normalizedName, h.allocationPercent)
        }
      })
      
      // Count all unique holdings from both runs (by normalized name)
      const allHoldings = new Set([...firstRunHoldings.keys(), ...compareRunHoldings.keys()])
      totalFields += allHoldings.size // count each holding as 1 field
      
      allHoldings.forEach(normalizedHoldingName => {
        const firstPercent = firstRunHoldings.get(normalizedHoldingName)
        const comparePercent = compareRunHoldings.get(normalizedHoldingName)
        
        // Create a key using normalized fund name, run identifier, and normalized holding name
        // This matches the key format used in FundDataBox
        // Use the same normalization as getDifferenceKey (dashes, not spaces)
        const normalizedFundNameForKey = (fundName || '').toLowerCase().replace(/\s+/g, '-')
        const diffKey = `${normalizedFundNameForKey}-${runId}-holding-${normalizedHoldingName}`
        const isIgnored = ignoredDifferences.has(diffKey)
        
        // Debug logging
        if (!isIgnored && (firstPercent === undefined || comparePercent === undefined || Math.abs((firstPercent || 0) - (comparePercent || 0)) >= 0.1)) {
          console.log(`Holding difference not ignored:`, {
            fundName,
            normalizedFundName,
            holdingName: normalizedHoldingName,
            diffKey,
            isInIgnoredSet: ignoredDifferences.has(diffKey),
            allIgnoredKeys: Array.from(ignoredDifferences).filter(k => k.includes('holding'))
          })
        }
        
        // If holding doesn't exist in one run, it's a difference
        if (firstPercent === undefined || comparePercent === undefined) {
          if (!isIgnored) {
            differences += 1 // missing holding (count as 1 field)
          } else {
            console.log(`Ignored holding difference: ${diffKey}`)
          }
        } else if (Math.abs(firstPercent - comparePercent) >= 0.1) {
          // Percentage difference (with 0.1% tolerance for rounding)
          if (!isIgnored) {
            differences++ // percentage difference
          } else {
            console.log(`Ignored holding difference: ${diffKey}`)
          }
        }
      })
    })

    // Debug: Log sample of ignored keys to see format
    const sampleIgnoredKeys = Array.from(ignoredDifferences).slice(0, 5)
    const assetClassKeys = Array.from(ignoredDifferences).filter(k => k.includes('assetClass')).slice(0, 5)
    const holdingKeys = Array.from(ignoredDifferences).filter(k => k.includes('holding')).slice(0, 5)
    const returnKeys = Array.from(ignoredDifferences).filter(k => k.includes('returns.')).slice(0, 5)
    
    console.log(`Consistency Rate (1st vs ${compareRun}):`, {
      totalFields,
      differences,
      accuracy: totalFields > 0 ? ((totalFields - differences) / totalFields) * 100 : 0,
      ignoredCount: ignoredDifferences.size,
      sampleIgnoredKeys,
      assetClassKeys,
      holdingKeys,
      returnKeys
    })
    
    // Filter to show only non-ignored differences (the ones actually counted)
    const nonIgnoredDifferences = differenceDetails.filter(d => !d.isIgnored)
    const ignoredDifferencesList = differenceDetails.filter(d => d.isIgnored)
    
    console.log(`Consistency Rate Summary (1st vs ${compareRun}):`, {
      totalDifferencesFound: differenceDetails.length,
      ignoredDifferences: differenceDetails.length - nonIgnoredDifferences.length,
      differencesCounted: nonIgnoredDifferences.length,
      totalFields,
      accuracy: totalFields > 0 ? ((totalFields - nonIgnoredDifferences.length) / totalFields) * 100 : 0
    })
    
    console.log(`=== DETAILED DIFFERENCE BREAKDOWN (1st vs ${compareRun}) ===`)
    console.log(`All Differences Found (${differenceDetails.length}):`, differenceDetails)
    console.log(`Ignored Differences (${ignoredDifferencesList.length}):`, ignoredDifferencesList.map(d => ({ key: d.key, field: d.field, fund: d.fund })))
    console.log(`Non-Ignored Differences (${nonIgnoredDifferences.length}) - THESE ARE BEING COUNTED:`, nonIgnoredDifferences.map(d => ({ key: d.key, field: d.field, fund: d.fund, reason: d.reason })))
    console.log(`All keys in ignoredDifferences set:`, Array.from(ignoredDifferences).sort())
    console.log(`Keys from non-ignored differences:`, nonIgnoredDifferences.map(d => d.key).sort())
    console.log(`=== END BREAKDOWN ===`)
    
    // Group differences by type for easier reading
    const differencesByType = {
      basicFields: nonIgnoredDifferences.filter(d => ['fund_factsheet_as_of_date', 'launchDate', 'investmentObjective', 'riskLevel'].includes(d.field)),
      returns: nonIgnoredDifferences.filter(d => d.field.startsWith('returns.')),
      assetClasses: nonIgnoredDifferences.filter(d => d.field.startsWith('assetClass-')),
      holdings: nonIgnoredDifferences.filter(d => d.field.startsWith('holding-'))
    }
    
    console.log(`Differences by Type (1st vs ${compareRun}):`, {
      basicFields: differencesByType.basicFields.length,
      returns: differencesByType.returns.length,
      assetClasses: differencesByType.assetClasses.length,
      holdings: differencesByType.holdings.length,
      details: differencesByType
    })

    const accuracy = totalFields > 0 ? ((totalFields - differences) / totalFields) * 100 : 0
    return { accuracy: Math.round(accuracy * 100) / 100, totalFields, differences }
  }

  const formatPercent = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)}%`
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

  const handleCalculateConsistencyRate = async () => {
    // Check if verification is still in progress
    if (verificationData?.isVerifying || verificationData?.isVerifyingThirdRun) {
      alert('Please wait for the 2nd and 3rd run verification to complete before calculating consistency rate. The results are not ready yet.')
      return
    }

    if (!verificationData?.firstRun) {
      alert('No verification data available. Please process factsheets first.')
      return
    }

    // Check if at least one run (2nd or 3rd) is available
    if (!verificationData?.secondRun && !verificationData?.thirdRun) {
      alert('Please wait for the 2nd and 3rd run verification to complete before calculating consistency rate. The results are not ready yet.')
      return
    }

    // Log current ignored differences for debugging
    console.log('Current ignoredDifferences:', Array.from(ignoredDifferences))
    console.log('Total ignored count:', ignoredDifferences.size)

    const secondRunRate = verificationData?.secondRun 
      ? calculateConsistencyRate('secondRun')
      : null
    const thirdRunRate = verificationData?.thirdRun 
      ? calculateConsistencyRate('thirdRun')
      : null

    setConsistencyRates({
      secondRun: secondRunRate,
      thirdRun: thirdRunRate
    })

    // Save consistency rates to database
    if (funds.length > 0 || verificationData?.firstRun?.length > 0) {
      const sourceFile = funds[0]?.sourceFile || verificationData?.firstRun?.[0]?.sourceFile || 'unknown'
      
      // Save rates for each fund
      const fundNames = funds.length > 0 ? funds.map(f => f.fundName) : (verificationData?.firstRun?.map(f => f.fundName) || [])
      
      for (const fundName of fundNames) {
        try {
          await fetch('/api/save-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fundName,
              sourceFile,
              consistencyRateSecondRun: secondRunRate?.accuracy ?? null,
              consistencyRateThirdRun: thirdRunRate?.accuracy ?? null
            })
          })
        } catch (error) {
          console.error(`Failed to save consistency rates for ${fundName}:`, error)
        }
      }
    }
  }

  const exportToExcel = () => {
    const dataToExport = verificationData?.groundTruth || groundTruthData.length > 0 ? groundTruthData : funds
    const worksheetData = dataToExport.map(fund => ({
      'Fund Name': fund.fundName,
      'Factsheet As Of Date': formatDate(fund.fund_factsheet_as_of_date),
      'Launch Date': formatDate(fund.launchDate),
      'Investment Objective': fund.investmentObjective,
      '1 Year Return (Annualized)': fund.returns.oneYearAnnualized !== null ? `${fund.returns.oneYearAnnualized.toFixed(2)}%` : 'N/A',
      '3 Year Return (Annualized)': fund.returns.threeYearAnnualized !== null ? `${fund.returns.threeYearAnnualized.toFixed(2)}%` : 'N/A',
      '5 Year Return (Annualized)': fund.returns.fiveYearAnnualized !== null ? `${fund.returns.fiveYearAnnualized.toFixed(2)}%` : 'N/A',
      'Return Since Launch (Annualized)': fund.returns.sinceLaunchAnnualized !== null ? `${fund.returns.sinceLaunchAnnualized.toFixed(2)}%` : 'N/A',
      'Calendar Year Return 2024': fund.returns.calendarYear2024 !== null ? `${fund.returns.calendarYear2024.toFixed(2)}%` : 'N/A',
      'Calendar Year Return 2023': fund.returns.calendarYear2023 !== null ? `${fund.returns.calendarYear2023.toFixed(2)}%` : 'N/A',
      'Calendar Year Return 2022': fund.returns.calendarYear2022 !== null ? `${fund.returns.calendarYear2022.toFixed(2)}%` : 'N/A',
      'Asset Classes': fund.assetClasses.map(ac => `${ac.class} (${ac.allocationPercent.toFixed(1)}%)`).join(', '),
      'Top 10 Holdings': fund.top10Holdings.map(h => `${h.name} (${h.allocationPercent.toFixed(1)}%)`).join(', '),
    }))

    const ws = XLSX.utils.json_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Funds Data')
    XLSX.writeFile(wb, `fund-factsheet-data-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // If we have verification data, show three columns
  if (verificationData && matchedFundPairs.length > 0) {
    return (
      <div className="space-y-6">

        {/* Header with Export and Save */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Processed Fund Data
          </h2>
          <div className="flex gap-3">
            {verificationData && (
              <button
                onClick={handleCalculateConsistencyRate}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Calculate Consistency Rate
              </button>
            )}
            {(verificationData?.groundTruth || groundTruthData.length > 0) && (
              <button
                onClick={handleCalculateF1}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Calculate Accuracy (F1)
              </button>
            )}
            <button
              onClick={exportToExcel}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-md hover:shadow-lg font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V14a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </button>
          </div>
        </div>

        {/* Consistency Rate Results Display */}
        {consistencyRates && !verificationData?.isVerifying && !verificationData?.isVerifyingThirdRun && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 shadow-sm mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Consistency Rate Results (vs 1st Run)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {consistencyRates.secondRun && verificationData?.verificationComplete && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-3">2nd Run</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Consistency Rate:</span>
                      <span className="font-bold text-lg text-orange-900 dark:text-orange-200">
                        {consistencyRates.secondRun.accuracy.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Data Points:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{consistencyRates.secondRun.totalFields}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-orange-200 dark:border-orange-700">
                      <span className="text-gray-600 dark:text-gray-400">Differences (not ignored):</span>
                      <span className="font-medium text-gray-900 dark:text-white">{consistencyRates.secondRun.differences}</span>
                    </div>
                  </div>
                </div>
              )}
              {consistencyRates.thirdRun && verificationData?.thirdRunComplete && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-3">3rd Run</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Consistency Rate:</span>
                      <span className="font-bold text-lg text-orange-900 dark:text-orange-200">
                        {consistencyRates.thirdRun.accuracy.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Data Points:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{consistencyRates.thirdRun.totalFields}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-orange-200 dark:border-orange-700">
                      <span className="text-gray-600 dark:text-gray-400">Differences (not ignored):</span>
                      <span className="font-medium text-gray-900 dark:text-white">{consistencyRates.thirdRun.differences}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
              Note: Ignored differences (marked with ✓) are excluded from the consistency rate calculation.
            </p>
          </div>
        )}

        {/* F1 Scores Display */}
        {f1Scores && !verificationData?.isVerifying && !verificationData?.isVerifyingThirdRun && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 shadow-sm mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              F1 Score Results (vs Ground Truth)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {f1Scores.firstRun && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">1st Run</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Precision:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.firstRun.precision.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recall:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.firstRun.recall.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="font-semibold text-blue-900 dark:text-blue-200">F1 Score:</span>
                      <span className="font-bold text-lg text-blue-900 dark:text-blue-200">{f1Scores.firstRun.f1.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}
              {f1Scores.secondRun && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">2nd Run</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Precision:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.secondRun.precision.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recall:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.secondRun.recall.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-yellow-200 dark:border-yellow-700">
                      <span className="font-semibold text-yellow-900 dark:text-yellow-200">F1 Score:</span>
                      <span className="font-bold text-lg text-yellow-900 dark:text-yellow-200">{f1Scores.secondRun.f1.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}
              {f1Scores.thirdRun && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <h4 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-3">3rd Run</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Precision:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.thirdRun.precision.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recall:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.thirdRun.recall.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-700">
                      <span className="font-semibold text-green-900 dark:text-green-200">F1 Score:</span>
                      <span className="font-bold text-lg text-green-900 dark:text-green-200">{f1Scores.thirdRun.f1.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}
              {f1Scores.aiGuidedAdjustments && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3">AI Guided Adjustments</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Precision:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.aiGuidedAdjustments.precision.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recall:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f1Scores.aiGuidedAdjustments.recall.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-purple-200 dark:border-purple-700">
                      <span className="font-semibold text-purple-900 dark:text-purple-200">F1 Score:</span>
                      <span className="font-bold text-lg text-purple-900 dark:text-purple-200">{f1Scores.aiGuidedAdjustments.f1.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Column Headers with Save All Buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div></div> {/* Empty for 1st Run */}
          <div></div> {/* Empty for 2nd Run */}
          <div></div> {/* Empty for 3rd Run */}
          <div className="flex justify-end">
            {localGroundTruth.length > 0 && (
              <button
                onClick={() => handleSaveAll('aiGuidedAdjustments')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save All
              </button>
            )}
          </div>
          <div className="flex justify-end">
            {groundTruthData.length > 0 && (
              <button
                onClick={() => handleSaveAll('groundTruth')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save All
              </button>
            )}
          </div>
        </div>

        {/* Four Column Layout */}
        <div className="space-y-6">
          {matchedFundPairs.map((pair, index) => {
            // For AI Guided Adjustments, use localGroundTruth
            const aiGuidedFund = localGroundTruth.find(f => {
              if (pair.firstRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.firstRun.fundName) || 
                       f.fundName === pair.firstRun.fundName
              }
              if (pair.secondRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.secondRun.fundName) || 
                       f.fundName === pair.secondRun.fundName
              }
              if (pair.thirdRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.thirdRun.fundName) || 
                       f.fundName === pair.thirdRun.fundName
              }
              return false
            }) || pair.firstRun || pair.secondRun || pair.thirdRun || null

            // For Ground Truth, use groundTruthData
            const groundTruthFund = groundTruthData.find(f => {
              if (pair.firstRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.firstRun.fundName) || 
                       f.fundName === pair.firstRun.fundName
              }
              if (pair.secondRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.secondRun.fundName) || 
                       f.fundName === pair.secondRun.fundName
              }
              if (pair.thirdRun) {
                return normalizeFundName(f.fundName) === normalizeFundName(pair.thirdRun.fundName) || 
                       f.fundName === pair.thirdRun.fundName
              }
              return false
            }) || pair.firstRun || pair.secondRun || pair.thirdRun || null

            return (
              <div key={`pair-${index}-${pair.displayName}`} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <FundDataBox
                  fund={pair.firstRun}
                  title="1st Run"
                  isPending={false}
                  firstRunFundName={pair.firstRun?.fundName || null}
                />
                <FundDataBox
                  fund={pair.secondRun}
                  title="2nd Run"
                  isPending={verificationData.isVerifying && !pair.secondRun}
                  highlightDifferences={true}
                  compareFund={pair.firstRun}
                  ignoredDifferences={ignoredDifferences}
                  onToggleIgnoreDifference={toggleIgnoreDifference}
                  firstRunFundName={pair.firstRun?.fundName || null}
                />
                <FundDataBox
                  fund={pair.thirdRun}
                  title="3rd Run"
                  isPending={verificationData.isVerifyingThirdRun && !pair.thirdRun}
                  highlightDifferences={true}
                  compareFund={pair.firstRun}
                  ignoredDifferences={ignoredDifferences}
                  onToggleIgnoreDifference={toggleIgnoreDifference}
                  firstRunFundName={pair.firstRun?.fundName || null}
                />
                <FundDataBox
                  fund={aiGuidedFund}
                  title="AI Guided Adjustments"
                  isPending={false}
                  isEditable={true}
                  onUpdate={(field, value) => handleUpdateAIGuidedAdjustments(pair.displayName, field, value)}
                  firstRunFundName={pair.firstRun?.fundName || null}
                  onSave={(fund) => handleSaveFund(fund, 'aiGuidedAdjustments')}
                  savedAt={aiGuidedFund ? savedTimestamps.get(aiGuidedFund.fundName)?.aiGuidedAdjustments : null}
                  dataType="aiGuidedAdjustments"
                />
                <FundDataBox
                  fund={groundTruthFund}
                  title="Ground Truth"
                  isPending={false}
                  isEditable={true}
                  onUpdate={(field, value) => handleUpdateGroundTruth(pair.displayName, field, value)}
                  firstRunFundName={pair.firstRun?.fundName || null}
                  onSave={(fund) => handleSaveFund(fund, 'groundTruth')}
                  savedAt={groundTruthFund ? savedTimestamps.get(groundTruthFund.fundName)?.groundTruth : null}
                  dataType="groundTruth"
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Original single column layout when no verification data
  if (funds.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-12 text-center shadow-sm">
        <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-lg">Upload fund factsheets to see the comparison dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Processed Fund Data
        </h2>
        <button
          onClick={exportToExcel}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-md hover:shadow-lg font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V14a2 2 0 01-2 2z" />
          </svg>
          Export to Excel
        </button>
      </div>

      {/* Funds Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {funds.map((fund) => (
          <FundDataBox
            key={fund.id}
            fund={fund}
            title={fund.fundName}
          />
        ))}
      </div>
    </div>
  )
}
