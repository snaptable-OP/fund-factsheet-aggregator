import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeFundNameForDatabase } from '@/lib/fund-name-normalizer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      fundName, 
      sourceFile, 
      // Consistency rates (2 separate values)
      consistencyRateSecondRun, 
      consistencyRateThirdRun,
      // Accuracy rates (4 separate F1 scores)
      accuracyRateFirstRun,
      accuracyRateSecondRun,
      accuracyRateThirdRun,
      accuracyRateAiGuidedAdjustments
    } = body

    if (!fundName || !sourceFile) {
      return NextResponse.json(
        { error: 'Missing fundName or sourceFile' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const normalizedFundName = normalizeFundNameForDatabase(fundName)

    const params: any = {
      p_fund_name: normalizedFundName,
      p_source_file: sourceFile
    }

    // Add consistency rates if provided
    if (consistencyRateSecondRun !== undefined && consistencyRateSecondRun !== null) {
      params.p_consistency_rate_second_run = consistencyRateSecondRun
    }
    if (consistencyRateThirdRun !== undefined && consistencyRateThirdRun !== null) {
      params.p_consistency_rate_third_run = consistencyRateThirdRun
    }

    // Add accuracy rates (F1 scores) if provided
    if (accuracyRateFirstRun !== undefined && accuracyRateFirstRun !== null) {
      params.p_accuracy_rate_first_run = accuracyRateFirstRun
    }
    if (accuracyRateSecondRun !== undefined && accuracyRateSecondRun !== null) {
      params.p_accuracy_rate_second_run = accuracyRateSecondRun
    }
    if (accuracyRateThirdRun !== undefined && accuracyRateThirdRun !== null) {
      params.p_accuracy_rate_third_run = accuracyRateThirdRun
    }
    if (accuracyRateAiGuidedAdjustments !== undefined && accuracyRateAiGuidedAdjustments !== null) {
      params.p_accuracy_rate_ai_guided_adjustments = accuracyRateAiGuidedAdjustments
    }

    console.log(`Saving rates for ${fundName} from ${sourceFile}:`, {
      consistencyRateSecondRun,
      consistencyRateThirdRun,
      accuracyRateFirstRun,
      accuracyRateSecondRun,
      accuracyRateThirdRun,
      accuracyRateAiGuidedAdjustments,
      params
    })

    const { data, error: trackError } = await supabase.rpc('upsert_file_upload_tracking', params)

    if (trackError) {
      console.error(`Failed to save rates for ${fundName}:`, {
        error: trackError.message,
        details: trackError.details,
        hint: trackError.hint,
        code: trackError.code,
        params
      })
      return NextResponse.json(
        { error: `Failed to save rates: ${trackError.message}` },
        { status: 500 }
      )
    }

    console.log(`Successfully saved rates for ${fundName}:`, data)

    return NextResponse.json({
      success: true,
      message: `Successfully saved rates for ${fundName}`,
      data
    })
  } catch (error: any) {
    console.error('Save rates error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save rates' },
      { status: 500 }
    )
  }
}
