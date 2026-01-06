'use client'

import { useState, useMemo } from 'react'
import type { FundData } from '@/types/fund'

interface FundsComparisonProps {
  funds: FundData[]
}

type ComparisonView = 
  | '1year' 
  | '3year' 
  | '5year' 
  | 'sinceLaunch' 
  | '2024' 
  | '2023' 
  | '2022' 
  | 'assetAllocation' 
  | 'topHoldings'

export function FundsComparison({ funds }: FundsComparisonProps) {
  const [activeView, setActiveView] = useState<ComparisonView | null>(null)

  const formatPercent = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)}%`
  }

  const getReturnColor = (value: number | null): string => {
    if (value === null || value === undefined) return 'text-gray-500'
    if (value > 0) return 'text-green-600 dark:text-green-400 font-semibold'
    if (value < 0) return 'text-red-600 dark:text-red-400 font-semibold'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Get all unique asset classes across all funds
  const allAssetClasses = useMemo(() => {
    const classes = new Set<string>()
    funds.forEach(fund => {
      fund.assetClasses.forEach(ac => classes.add(ac.class))
    })
    return Array.from(classes).sort()
  }, [funds])

  // Get all unique holdings across all funds
  const allHoldings = useMemo(() => {
    const holdings = new Set<string>()
    funds.forEach(fund => {
      fund.top10Holdings.forEach(h => holdings.add(h.name))
    })
    return Array.from(holdings).sort()
  }, [funds])

  const renderReturnsComparison = (returnType: 'oneYearAnnualized' | 'threeYearAnnualized' | 'fiveYearAnnualized' | 'sinceLaunchAnnualized' | 'calendarYear2024' | 'calendarYear2023' | 'calendarYear2022') => {
    const sortedFunds = [...funds].sort((a, b) => {
      const aVal = a.returns[returnType] ?? -Infinity
      const bVal = b.returns[returnType] ?? -Infinity
      return bVal - aVal // Sort descending
    })

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                Fund Name
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                Return
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFunds.map((fund) => {
              const value = fund.returns[returnType]
              return (
                <tr key={fund.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-gray-900 dark:text-white">
                    {fund.fundName}
                  </td>
                  <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-right ${getReturnColor(value)}`}>
                    {formatPercent(value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderAssetAllocationComparison = () => {
    // Color palette for asset classes
    const assetClassColors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#8B5CF6', // purple
      '#F59E0B', // orange
      '#EC4899', // pink
      '#6366F1', // indigo
      '#EF4444', // red
      '#14B8A6', // teal
      '#F97316', // orange-600
      '#06B6D4', // cyan
    ]

    const renderPieChart = (fund: FundData) => {
      if (fund.assetClasses.length === 0) {
        return (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No asset allocation data available
          </div>
        )
      }

      // Calculate angles for pie chart
      let currentAngle = -90 // Start at top
      const total = fund.assetClasses.reduce((sum, ac) => sum + ac.allocationPercent, 0)
      
      // Create SVG path for pie chart
      const size = 220
      const radius = size / 2 - 15
      const center = size / 2
      
      const paths = fund.assetClasses.map((ac, index) => {
        const percent = (ac.allocationPercent / total) * 100
        const angle = (percent / 100) * 360
        const startAngle = currentAngle
        const endAngle = currentAngle + angle
        
        const startAngleRad = (startAngle * Math.PI) / 180
        const endAngleRad = (endAngle * Math.PI) / 180
        
        const x1 = center + radius * Math.cos(startAngleRad)
        const y1 = center + radius * Math.sin(startAngleRad)
        const x2 = center + radius * Math.cos(endAngleRad)
        const y2 = center + radius * Math.sin(endAngleRad)
        
        const largeArcFlag = angle > 180 ? 1 : 0
        
        const pathData = [
          `M ${center} ${center}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          'Z'
        ].join(' ')
        
        currentAngle += angle
        
        return {
          path: pathData,
          color: assetClassColors[index % assetClassColors.length],
          label: ac.class,
          percent: ac.allocationPercent,
        }
      })

      return (
        <div className="flex flex-col items-center">
          <svg width={size} height={size} className="mb-4">
            {paths.map((item, index) => (
              <path
                key={index}
                d={item.path}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </svg>
          <div className="w-full space-y-2">
            {fund.assetClasses.map((ac, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: assetClassColors[index % assetClassColors.length] }}
                  ></div>
                  <span className="text-gray-700 dark:text-gray-300">{ac.class}</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {ac.allocationPercent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {funds.map((fund) => (
          <div
            key={fund.id}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
              {fund.fundName}
            </h3>
            {renderPieChart(fund)}
          </div>
        ))}
      </div>
    )
  }

  const renderTopHoldingsComparison = () => {
    const renderBarChart = (fund: FundData) => {
      if (fund.top10Holdings.length === 0) {
        return (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No holdings data available
          </div>
        )
      }

      // Sort holdings by allocation (descending) and take top 10
      const sortedHoldings = [...fund.top10Holdings]
        .sort((a, b) => b.allocationPercent - a.allocationPercent)
        .slice(0, 10)

      const maxAllocation = Math.max(...sortedHoldings.map(h => h.allocationPercent), 1)

      return (
        <div className="space-y-3">
          {sortedHoldings.map((holding, index) => {
            const width = (holding.allocationPercent / maxAllocation) * 100
            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-medium truncate pr-2">
                    {holding.name}
                  </span>
                  <span className="text-gray-900 dark:text-white font-semibold flex-shrink-0">
                    {holding.allocationPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300 hover:bg-blue-600 flex items-center justify-end pr-2 shadow-sm"
                    style={{ width: `${width}%`, minWidth: '20px' }}
                  >
                    {holding.allocationPercent > 5 && (
                      <span className="text-white text-xs font-semibold">
                        {holding.allocationPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {funds.map((fund) => (
          <div
            key={fund.id}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
              {fund.fundName}
            </h3>
            {renderBarChart(fund)}
          </div>
        ))}
      </div>
    )
  }

  if (funds.length === 0) {
    return null
  }

  const viewLabels: Record<ComparisonView, string> = {
    '1year': '1 Year Return',
    '3year': '3 Year Return',
    '5year': '5 Year Return',
    'sinceLaunch': 'Since Launch',
    '2024': '2024 Return',
    '2023': '2023 Return',
    '2022': '2022 Return',
    'assetAllocation': 'Asset Allocation',
    'topHoldings': 'Top Holdings',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 p-6 shadow-sm mb-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Fund Comparison Station
      </h2>

      {/* Comparison Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveView(activeView === '1year' ? null : '1year')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '1year'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          1 Year
        </button>
        <button
          onClick={() => setActiveView(activeView === '3year' ? null : '3year')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '3year'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          3 Year
        </button>
        <button
          onClick={() => setActiveView(activeView === '5year' ? null : '5year')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '5year'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          5 Year
        </button>
        <button
          onClick={() => setActiveView(activeView === 'sinceLaunch' ? null : 'sinceLaunch')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'sinceLaunch'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Since Launch
        </button>
        <button
          onClick={() => setActiveView(activeView === '2024' ? null : '2024')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '2024'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          2024
        </button>
        <button
          onClick={() => setActiveView(activeView === '2023' ? null : '2023')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '2023'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          2023
        </button>
        <button
          onClick={() => setActiveView(activeView === '2022' ? null : '2022')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === '2022'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          2022
        </button>
        <button
          onClick={() => setActiveView(activeView === 'assetAllocation' ? null : 'assetAllocation')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'assetAllocation'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Asset Allocation
        </button>
        <button
          onClick={() => setActiveView(activeView === 'topHoldings' ? null : 'topHoldings')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'topHoldings'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Top Holdings
        </button>
      </div>

      {/* Comparison Table */}
      {activeView && (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {viewLabels[activeView]} Comparison
            </h3>
          </div>
          <div className="p-4">
            {activeView === '1year' && renderReturnsComparison('oneYearAnnualized')}
            {activeView === '3year' && renderReturnsComparison('threeYearAnnualized')}
            {activeView === '5year' && renderReturnsComparison('fiveYearAnnualized')}
            {activeView === 'sinceLaunch' && renderReturnsComparison('sinceLaunchAnnualized')}
            {activeView === '2024' && renderReturnsComparison('calendarYear2024')}
            {activeView === '2023' && renderReturnsComparison('calendarYear2023')}
            {activeView === '2022' && renderReturnsComparison('calendarYear2022')}
            {activeView === 'assetAllocation' && renderAssetAllocationComparison()}
            {activeView === 'topHoldings' && renderTopHoldingsComparison()}
          </div>
        </div>
      )}
    </div>
  )
}

