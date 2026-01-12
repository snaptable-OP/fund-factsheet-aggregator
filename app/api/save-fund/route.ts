import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeFundNameForDatabase } from '@/lib/fund-name-normalizer'
import type { FundData } from '@/types/fund'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fundData, dataType } = body // dataType: 'aiGuidedAdjustments' | 'groundTruth' | 'firstRun' | 'secondRun' | 'thirdRun'

    if (!fundData || !dataType) {
      return NextResponse.json(
        { error: 'Missing fundData or dataType' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Map dataType to normalized schema run_type
    const runTypeMap: Record<string, string> = {
      'aiGuidedAdjustments': 'ai_guided_adjustments',
      'groundTruth': 'ground_truth',
      'firstRun': 'first_run',
      'secondRun': 'second_run',
      'thirdRun': 'third_run'
    }

    const runType = runTypeMap[dataType]
    if (!runType) {
      return NextResponse.json(
        { error: `Invalid dataType: ${dataType}` },
        { status: 400 }
      )
    }

    // Normalize fund name to ensure consistent matching across runs
    // This ensures funds with slightly different names get linked to the same fund_id
    const normalizedFundName = normalizeFundNameForDatabase(fundData.fundName)

    // Use the upsert_fund_data function from the normalized schema
    const { data: result, error: upsertError } = await supabase
      .rpc('upsert_fund_data', {
        p_fund_name: normalizedFundName,
        p_run_type: runType,
        p_data: fundData // Supabase will automatically convert to JSONB
      })

    if (upsertError) {
      console.error(`Failed to save ${dataType} for ${fundData.fundName}:`, upsertError)
      return NextResponse.json(
        { error: `Failed to save: ${upsertError.message}` },
        { status: 500 }
      )
    }

    // Extract saved_at from result
    const savedAt = result && result.length > 0 ? result[0].saved_at : new Date().toISOString()

    // Track AI-guided adjustments or ground truth save timestamps with data
    if (dataType === 'aiGuidedAdjustments' || dataType === 'groundTruth') {
      try {
        const sourceFile = fundData.sourceFile || 'unknown'
        const params: any = {
          p_fund_name: normalizedFundName,
          p_source_file: sourceFile
        }
        
        // Convert FundData back to original API response format
        const reverseMapFundDataToAPIFormat = (fundData: FundData): any => {
          const top10HoldingsNames: string[] = fundData.top10Holdings.map(h => h.name)
          const top10HoldingsPercentages: number[] = fundData.top10Holdings.map(h => h.allocationPercent)
          const assetClassNames: string[] = fundData.assetClasses.map(ac => ac.class)
          const assetClassPercentages: number[] = fundData.assetClasses.map(ac => ac.allocationPercent)

          return {
            fund_name: fundData.fundName,
            fund_factsheet_as_of_date: fundData.fund_factsheet_as_of_date,
            fund_launch_date: fundData.launchDate,
            investment_objectives: fundData.investmentObjective || '',
            risk_class: fundData.riskLevel,
            '2022_calendar_year_return': fundData.returns.calendarYear2022,
            '2023_calendar_year_return': fundData.returns.calendarYear2023,
            '2024_calendar_year_return': fundData.returns.calendarYear2024,
            '1_year_performance_annualized': fundData.returns.oneYearAnnualized,
            '3_year_performance_annualized': fundData.returns.threeYearAnnualized,
            '5_year_performance_annualized': fundData.returns.fiveYearAnnualized,
            since_launch_performance_annualized: fundData.returns.sinceLaunchAnnualized,
            top_10_holdings_names_in_descending_order: top10HoldingsNames,
            top_10_holdings_percentages_in_descending_order: top10HoldingsPercentages,
            asset_classes_invested_in_descending_order: assetClassNames,
            asset_allocation_percentages_in_descending_order: assetClassPercentages,
          }
        }

        if (dataType === 'aiGuidedAdjustments') {
          params.p_ai_guided_adjustments_saved_at = savedAt
          params.p_ai_guided_adjustments_data = reverseMapFundDataToAPIFormat(fundData)
        } else if (dataType === 'groundTruth') {
          params.p_ground_truth_saved_at = savedAt
          params.p_ground_truth_data = reverseMapFundDataToAPIFormat(fundData)
        }
        
        const { error: trackError } = await supabase.rpc('upsert_file_upload_tracking', params)

        if (trackError) {
          console.error(`Failed to track ${dataType} timestamp for ${fundData.fundName}:`, trackError)
          // Don't fail the request - tracking is non-critical
        } else {
          console.log(`Successfully tracked ${dataType} timestamp and data for ${fundData.fundName}`)
        }
      } catch (trackError: any) {
        console.error(`Error tracking ${dataType} timestamp:`, trackError)
        // Don't fail the request - tracking is non-critical
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${dataType} for ${fundData.fundName}`,
      savedAt: savedAt
    })
  } catch (error: any) {
    console.error('Save fund error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save fund' },
      { status: 500 }
    )
  }
}
