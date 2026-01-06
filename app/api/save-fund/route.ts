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
