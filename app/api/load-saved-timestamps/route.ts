import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fundNames } = body

    if (!fundNames || !Array.isArray(fundNames)) {
      return NextResponse.json(
        { error: 'Missing or invalid fundNames array' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Query funds by fund names
    const { data: funds, error } = await supabase
      .from('funds')
      .select('fund_name, ai_guided_adjustments_saved_at, ground_truth_saved_at, first_run_saved_at, second_run_saved_at')
      .in('fund_name', fundNames)

    if (error) {
      console.error('Error loading saved timestamps:', error)
      return NextResponse.json(
        { error: `Failed to load timestamps: ${error.message}` },
        { status: 500 }
      )
    }

    // Group by fund name (in case there are multiple records per fund, take the most recent)
    const timestamps: Record<string, { aiGuidedAdjustments?: string; groundTruth?: string; firstRun?: string; secondRun?: string }> = {}

    if (funds) {
      funds.forEach(fund => {
        if (!timestamps[fund.fund_name]) {
          timestamps[fund.fund_name] = {}
        }
        const existing = timestamps[fund.fund_name]
        
        // Only update if the timestamp is more recent (if multiple records exist)
        if (fund.ai_guided_adjustments_saved_at && (!existing.aiGuidedAdjustments || fund.ai_guided_adjustments_saved_at > existing.aiGuidedAdjustments)) {
          existing.aiGuidedAdjustments = fund.ai_guided_adjustments_saved_at
        }
        if (fund.ground_truth_saved_at && (!existing.groundTruth || fund.ground_truth_saved_at > existing.groundTruth)) {
          existing.groundTruth = fund.ground_truth_saved_at
        }
        if (fund.first_run_saved_at && (!existing.firstRun || fund.first_run_saved_at > existing.firstRun)) {
          existing.firstRun = fund.first_run_saved_at
        }
        if (fund.second_run_saved_at && (!existing.secondRun || fund.second_run_saved_at > existing.secondRun)) {
          existing.secondRun = fund.second_run_saved_at
        }
      })
    }

    return NextResponse.json({
      success: true,
      timestamps
    })
  } catch (error: any) {
    console.error('Load saved timestamps error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load saved timestamps' },
      { status: 500 }
    )
  }
}
