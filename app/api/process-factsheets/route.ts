import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeFundNameForDatabase } from '@/lib/fund-name-normalizer'
import type { FundData } from '@/types/fund'

/**
 * Upload PDF file to Supabase Storage and get public URL
 */
async function uploadPDFToSupabase(file: File, supabase: any): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `factsheets/${fileName}`

  console.log(`Uploading ${file.name} (${file.size} bytes)`)
  
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabase.storage
    .from('factsheet-pdfs')
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    console.error('Supabase upload error:', error)
    throw new Error(`Failed to upload PDF: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('factsheet-pdfs')
    .getPublicUrl(filePath)

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded PDF')
  }

  return urlData.publicUrl
}

/**
 * Call data parser API with PDF URL
 */
async function parsePDFWithAPI(pdfUrl: string): Promise<any> {
  const parserApiUrl = process.env.DATA_PARSER_API_URL
  const parserApiKey = process.env.DATA_PARSER_API_KEY
  const templateId = process.env.DATA_PARSER_TEMPLATE_ID || '7204cfa0-dc4c-41f9-9931-a8da9a43fda0'

  if (!parserApiUrl) {
    throw new Error('DATA_PARSER_API_URL environment variable is not set')
  }

  if (!parserApiKey) {
    throw new Error('DATA_PARSER_API_KEY environment variable is not set')
  }

  // Construct full API URL with template_id if needed
  let fullApiUrl = parserApiUrl
  if (fullApiUrl.includes('{template_id}')) {
    fullApiUrl = fullApiUrl.replace('{template_id}', templateId)
  } else if (!fullApiUrl.includes(templateId) && !fullApiUrl.endsWith('/compile')) {
    // If URL doesn't have template_id, append it
    fullApiUrl = `${fullApiUrl.replace(/\/$/, '')}/${templateId}`
  }

  console.log('Calling parser API:', fullApiUrl)
  console.log('PDF URL:', pdfUrl)
  console.log('Template ID:', templateId)
  
  // Create an AbortController for timeout handling (30 minutes timeout for large PDFs with many funds)
  const controller = new AbortController()
  const timeoutMs = 30 * 60 * 1000 // 30 minutes (increased from 15)
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  
  try {
    console.log('Making fetch request to:', fullApiUrl)
    console.log('Request headers:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${parserApiKey.substring(0, 10)}...` // Log partial key for debugging
    })
    
    const response = await fetch(fullApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${parserApiKey}`,
    },
    body: JSON.stringify({
        pdf: pdfUrl, // API expects 'pdf' field with the Supabase storage URL
      }),
      signal: controller.signal,
    } as RequestInit)
    
    clearTimeout(timeoutId)
    
    console.log('Parser API response status:', response.status, response.statusText)
    console.log('Parser API response headers:', Object.fromEntries(response.headers.entries()))
    
    // Check Content-Length header if available
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      console.log(`Parser API response Content-Length: ${contentLength} bytes (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB)`)
    }
    
    // Get response text - read fully to avoid truncation
    const responseText = await response.text()
    const actualLength = responseText.length
    console.log(`Parser API raw response length: ${actualLength} characters`)
    
    // Check if response might be truncated
    if (contentLength && parseInt(contentLength) > actualLength) {
      console.warn(`⚠️ Response might be truncated! Expected ${contentLength} bytes but got ${actualLength} characters`)
    }
    
    // Log first and last 500 characters to check for truncation
    if (responseText.length > 1000) {
      console.log('Parser API response preview (first 500 chars):', responseText.substring(0, 500))
      console.log('Parser API response preview (last 500 chars):', responseText.substring(responseText.length - 500))
    } else {
      console.log('Parser API raw response:', responseText)
    }
    
    if (!response.ok) {
      console.error('Parser API error - Status:', response.status)
      console.error('Parser API error - Response:', responseText)
      
      // Try to parse as JSON for better error message
      let errorMessage = responseText
      let errorDetails: any = null
      try {
        const errorJson = JSON.parse(responseText)
        errorMessage = JSON.stringify(errorJson, null, 2)
        errorDetails = errorJson
      } catch {
        // Not JSON, use text as-is
      }
      
      // Check for common error patterns that might indicate API key/token issues
      const errorTextLower = responseText.toLowerCase()
      if (
        response.status === 500 || 
        response.status === 429 ||
        errorTextLower.includes('quota') ||
        errorTextLower.includes('limit') ||
        errorTextLower.includes('token') ||
        errorTextLower.includes('credit') ||
        errorTextLower.includes('insufficient') ||
        (errorDetails?.error?.message && (
          errorDetails.error.message.toLowerCase().includes('quota') ||
          errorDetails.error.message.toLowerCase().includes('limit') ||
          errorDetails.error.message.toLowerCase().includes('token') ||
          errorDetails.error.message.toLowerCase().includes('credit')
        ))
      ) {
        console.error('⚠️ Parser API error might be due to API key quota/token limit issues')
        throw new Error(`Parser API error (${response.status}): The parser API may have run out of API credits/tokens. Please check the parser API service status and API key balance. Original error: ${errorMessage}`)
      }
      
      throw new Error(`Parser API error (${response.status}): ${errorMessage}`)
    }
    
    // Parse JSON response
    const jsonResponse = JSON.parse(responseText)
    console.log('Parser API JSON response:', JSON.stringify(jsonResponse, null, 2))
    
    return jsonResponse
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    console.error('Parser API fetch error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      cause: error.cause,
      stack: error.stack
    })
    
    if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT' || error.message?.includes('timeout')) {
      console.error('Parser API timeout error:', error)
      throw new Error(`Parser API request timed out after ${timeoutMs / 1000 / 60} minutes. The PDF processing is taking longer than expected. This may happen with large or complex PDFs. Please try again or contact support if the issue persists.`)
    }
    
    // Handle fetch failures
    if (error.message?.includes('fetch failed') || error.cause) {
      const errorDetails = error.cause ? ` (${error.cause.message || error.cause})` : ''
      throw new Error(`Failed to connect to parser API at ${fullApiUrl}. Please check: 1) The API URL is correct, 2) The API is accessible, 3) Network connectivity.${errorDetails}`)
    }
    
    // Re-throw other errors with more context
    throw new Error(`Parser API error: ${error.message || String(error)}`)
  }
}

/**
 * Map a single fund object from parser API to FundData schema
 * Expected fund object format:
 * {
 *   fund_name: string
 *   fund_factsheet_as_of_date: string
 *   fund_launch_date: string
 *   investment_objectives: string
 *   2022_calendar_year_return: number
 *   2023_calendar_year_return: number
 *   2024_calendar_year_return: number
 *   1_year_performance_annualized: number
 *   3_year_performance_annualized: number
 *   5_year_performance_annualized: number
 *   since_launch_performance_annualized: number
 *   top_10_holdings_names_in_descending_order: string[]
 *   asset_classes_invested_in_descending_order: string[]
 *   top_10_holdings_percentages_in_descending_order: number[]
 *   asset_allocation_percentages_in_descending_order: number[]
 * }
 */
function mapSingleFundToFundData(
  fundObject: any,
  sourceFile: string,
  pdfUrl: string
): FundData {
  if (!fundObject || typeof fundObject !== 'object') {
    throw new Error('Invalid fund object format')
  }
  
  const data = fundObject
  
  console.log('=== MAPPING SINGLE FUND ===')
  console.log('Fund name:', data.fund_name || 'Unknown')
  console.log('Fund object keys:', Object.keys(data))
  console.log('Fund object:', JSON.stringify(data, null, 2))
  
  // Log specific return fields for debugging percentage issues
  console.log('Return values from API (raw):')
  console.log('  1_year_performance_annualized:', data['1_year_performance_annualized'], `(type: ${typeof data['1_year_performance_annualized']})`)
  console.log('  3_year_performance_annualized:', data['3_year_performance_annualized'], `(type: ${typeof data['3_year_performance_annualized']})`)
  console.log('  2024_calendar_year_return:', data['2024_calendar_year_return'], `(type: ${typeof data['2024_calendar_year_return']})`)
  console.log('  risk_class:', data['risk_class'], `(type: ${typeof data['risk_class']})`)

  // Helper function to parse date from DD/MM/YYYY or MM/DD/YYYY format to YYYY-MM-DD
  const parseDate = (dateString: string | null | undefined): string => {
    if (!dateString) return new Date().toISOString().split('T')[0]
    
    // Try to parse DD/MM/YYYY format (common in the API response)
    const ddmmyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    // If already in ISO format or other format, try to parse it
    try {
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    } catch {
      // If parsing fails, return current date
    }
    
    return new Date().toISOString().split('T')[0]
  }

  // Helper function to extract values
  const getValue = (field: string) => {
    const value = data[field]
    console.log(`  getValue('${field}') =`, value)
    return value !== null && value !== undefined ? value : null
  }
  
  // Helper function to get date values (with parsing)
  const getDate = (field: string) => {
    const value = getValue(field)
    return parseDate(value)
  }

  const getNumber = (field: string) => {
    const value = getValue(field)
    if (value === null || value === undefined || value === '') return null
    
    let num: number
    
    // Handle string values
    if (typeof value === 'string') {
      // Remove any percentage signs or other characters
      const cleaned = value.replace(/[%,\s]/g, '')
      num = parseFloat(cleaned)
      if (isNaN(num)) return null
    } else {
      // Handle number values
      num = value
      if (isNaN(num)) return null
    }
    
    // Return values are already percentages, no conversion needed
    return num
  }

  const getArray = (field: string) => {
    const value = getValue(field)
    if (!Array.isArray(value)) return []
    return value
  }

  // Get arrays for holdings and asset classes
  const holdingsNames = getArray('top_10_holdings_names_in_descending_order')
  const holdingsPercentages = getArray('top_10_holdings_percentages_in_descending_order')
  const assetClassNames = getArray('asset_classes_invested_in_descending_order')
  const assetClassPercentages = getArray('asset_allocation_percentages_in_descending_order')

  // Zip holdings names with percentages (keep original values, no rounding)
  const top10Holdings = holdingsNames.map((name: string, index: number) => {
    const rawPercent = holdingsPercentages[index]
    const percent = typeof rawPercent === 'number' ? rawPercent : 0
    return {
      name: name || '',
      allocationPercent: percent, // Keep original value, no rounding
    }
  }).filter((h: any) => h.name && h.allocationPercent > 0).slice(0, 10)

  // Zip asset class names with percentages (keep original values, no rounding)
  const assetClasses = assetClassNames.map((className: string, index: number) => {
    const rawPercent = assetClassPercentages[index]
    const percent = typeof rawPercent === 'number' ? rawPercent : 0
    return {
      class: className || '',
      allocationPercent: percent, // Keep original value, no rounding
    }
  }).filter((ac: any) => ac.class && ac.allocationPercent > 0)

  const fundData: FundData = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fundName: getValue('fund_name') || 'Unknown Fund',
    fund_factsheet_as_of_date: getDate('fund_factsheet_as_of_date'),
    launchDate: getDate('fund_launch_date'),
    investmentObjective: getValue('investment_objectives') || '',
    riskLevel: (() => {
      const riskValue = getValue('risk_class')
      console.log(`  risk_class value:`, riskValue, `(type: ${typeof riskValue})`)
      return riskValue !== null && riskValue !== undefined ? String(riskValue) : null
    })(),
    returns: {
      oneYearAnnualized: getNumber('1_year_performance_annualized'),
      threeYearAnnualized: getNumber('3_year_performance_annualized'),
      fiveYearAnnualized: getNumber('5_year_performance_annualized'),
      sinceLaunchAnnualized: getNumber('since_launch_performance_annualized'),
      calendarYear2024: getNumber('2024_calendar_year_return'),
      calendarYear2023: getNumber('2023_calendar_year_return'),
      calendarYear2022: getNumber('2022_calendar_year_return'),
    },
    assetClasses,
    top10Holdings,
    sourceFile,
    processedAt: new Date().toISOString(),
  }

  // Log mapped return values for debugging
  console.log('Mapped return values for', fundData.fundName, ':')
  console.log('  riskLevel:', fundData.riskLevel)
  console.log('  oneYearAnnualized:', fundData.returns.oneYearAnnualized)
  console.log('  threeYearAnnualized:', fundData.returns.threeYearAnnualized)
  console.log('  fiveYearAnnualized:', fundData.returns.fiveYearAnnualized)
  console.log('  sinceLaunchAnnualized:', fundData.returns.sinceLaunchAnnualized)
  console.log('  calendarYear2024:', fundData.returns.calendarYear2024)
  console.log('  calendarYear2023:', fundData.returns.calendarYear2023)
  console.log('  calendarYear2022:', fundData.returns.calendarYear2022)
  console.log('  Asset Classes:', fundData.assetClasses.map(ac => `${ac.class}: ${ac.allocationPercent}%`).join(', '))
  console.log('  Top Holdings:', fundData.top10Holdings.slice(0, 3).map(h => `${h.name}: ${h.allocationPercent}%`).join(', '))

  console.log('Mapped fund data:', JSON.stringify(fundData, null, 2))
  return fundData
}

/**
 * Map parser API response (array of fund objects) to FundData array
 * The API returns an array of fund objects
 */
function mapParserResponseToFundDataArray(
  parserResponse: any,
  sourceFile: string,
  pdfUrl: string
): FundData[] {
  console.log('=== RAW PARSER API RESPONSE ===')
  console.log(JSON.stringify(parserResponse, null, 2))
  console.log('=== END RAW RESPONSE ===')
  
  if (!parserResponse) {
    throw new Error('Parser API returned empty response')
  }

  // Handle different possible response structures
  let fundsArray: any[] = []
  
  // Check for nested structure: result.fund_data (actual API structure)
  if (parserResponse.result && parserResponse.result.fund_data && Array.isArray(parserResponse.result.fund_data)) {
    fundsArray = parserResponse.result.fund_data
    console.log('Found funds in parserResponse.result.fund_data')
  } else if (parserResponse.funds && Array.isArray(parserResponse.funds)) {
    // Check for direct 'funds' property
    fundsArray = parserResponse.funds
    console.log('Found funds in parserResponse.funds')
  } else if (Array.isArray(parserResponse)) {
    // Direct array response
    fundsArray = parserResponse
    console.log('Found funds as direct array')
  } else if (parserResponse.data && Array.isArray(parserResponse.data)) {
    // Wrapped in data property
    fundsArray = parserResponse.data
    console.log('Found funds in parserResponse.data')
  } else if (parserResponse.result && Array.isArray(parserResponse.result)) {
    // Wrapped in result property (if result is directly an array)
    fundsArray = parserResponse.result
    console.log('Found funds in parserResponse.result')
  } else if (typeof parserResponse === 'object') {
    // Single object - wrap in array
    fundsArray = [parserResponse]
    console.log('Treating response as single fund object')
  } else {
    console.error('Parser API response structure:', JSON.stringify(parserResponse, null, 2))
    throw new Error('Parser API returned invalid response format - expected array of fund objects')
  }

  if (fundsArray.length === 0) {
    throw new Error('Parser API returned empty array - no funds found in PDF')
  }

  console.log(`Found ${fundsArray.length} fund(s) in response`)
  console.log('First fund object keys:', Object.keys(fundsArray[0] || {}))
  console.log('First fund object sample:', JSON.stringify(fundsArray[0], null, 2))

  // Map each fund object to FundData
  const mappedFunds = fundsArray.map((fundObject, index) => {
    try {
      return mapSingleFundToFundData(fundObject, sourceFile, pdfUrl)
    } catch (error: any) {
      console.error(`Error mapping fund at index ${index}:`, error)
      throw new Error(`Failed to map fund ${index + 1}: ${error.message}`)
    }
  })

  return mappedFunds
}

/**
 * Store fund data in Supabase database using normalized schema
 */
async function storeFundData(fundData: FundData, pdfUrl: string, supabase: any, runType: 'first_run' | 'second_run' | 'third_run' | 'ai_guided_adjustments' | 'ground_truth' = 'first_run'): Promise<void> {
  // Normalize fund name to ensure consistent matching across runs
  // This ensures funds with slightly different names get linked to the same fund_id
  const normalizedFundName = normalizeFundNameForDatabase(fundData.fundName)
  
  console.log(`Attempting to store fund "${fundData.fundName}" (normalized: "${normalizedFundName}") as ${runType}`)
  
  // Use the upsert_fund_data function from the normalized schema
  const { data: result, error } = await supabase
    .rpc('upsert_fund_data', {
      p_fund_name: normalizedFundName,
      p_run_type: runType,
      p_data: fundData // Supabase will automatically convert to JSONB
    })

  if (error) {
    console.error('Supabase upsert error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fundName: fundData.fundName,
      normalizedFundName,
      runType
    })
    throw new Error(`Failed to store fund data: ${error.message || error}`)
  }
  
  if (result && result.length > 0) {
    console.log(`Successfully stored fund "${fundData.fundName}" - fund_id: ${result[0].fund_id}, saved_at: ${result[0].saved_at}`)
  } else {
    console.warn(`Warning: upsert_fund_data returned no result for fund "${fundData.fundName}"`)
  }
}

/**
 * Process a single PDF file
 * Returns array of FundData and PDF URL since API can return multiple funds per PDF
 */
async function processPDF(file: File, supabase: any): Promise<{ funds: FundData[], pdfUrl: string }> {
  console.log(`Processing PDF: ${file.name}`)
  
  // Step 1: Upload PDF to Supabase Storage
  const pdfUrl = await uploadPDFToSupabase(file, supabase)
  console.log(`PDF uploaded, URL: ${pdfUrl}`)

  // Step 2: Parse PDF with external API
  const parserResponse = await parsePDFWithAPI(pdfUrl)
  console.log(`Parser response received`)

  // Step 3: Map parser response (array of fund objects) to FundData array
  const fundDataArray = mapParserResponseToFundDataArray(parserResponse, file.name, pdfUrl)
  console.log(`Mapped ${fundDataArray.length} fund(s) from PDF`)

  // Step 4: Store each fund in Supabase database (first run)
  for (const fundData of fundDataArray) {
    await storeFundData(fundData, pdfUrl, supabase, 'first_run')
    console.log(`Fund "${fundData.fundName}" stored in database (first_run)`)
  }

  return { funds: fundDataArray, pdfUrl }
}

// Increase timeout for this route (30 minutes for large PDFs with many funds)
export const maxDuration = 1800 // 30 minutes in seconds (increased from 15 minutes)

export async function POST(request: NextRequest) {
  try {
    console.log('API route called - starting request processing')
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not set')
      return NextResponse.json(
        { error: 'Server configuration error: Supabase URL not configured' },
        { status: 500 }
      )
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
      return NextResponse.json(
        { error: 'Server configuration error: Supabase API key not configured' },
        { status: 500 }
      )
    }
    
    // Create Supabase client
    let supabase
    try {
      supabase = await createClient()
      console.log('Supabase client created successfully')
    } catch (supabaseError: any) {
      console.error('Failed to create Supabase client:', supabaseError)
      return NextResponse.json(
        { 
          error: 'Failed to initialize database connection',
          details: supabaseError.message || String(supabaseError)
        },
        { status: 500 }
      )
    }

    // Check if this is a verification request (re-process existing PDF URL)
    const contentType = request.headers.get('content-type') || ''
    console.log('Content-Type:', contentType)
    
    if (contentType.includes('application/json')) {
      const body = await request.json()
      
      // Check if it's a verification request
      if (body.verify && body.pdfUrl) {
        console.log('Verification request for PDF:', body.pdfUrl)
        
        // Determine run type: 'second_run' by default, 'third_run' if specified
        // Check if this is a third run by looking for a flag or counting existing runs
        // For now, we'll use a simple approach: if runNumber is 3, it's third_run
        const runType = (body.runNumber === 3 || body.isThirdRun) ? 'third_run' : 'second_run'
        console.log(`Storing as ${runType}`)
        
        // Re-process the PDF URL without uploading again
        try {
          const parserResponse = await parsePDFWithAPI(body.pdfUrl)
          const fundDataArray = mapParserResponseToFundDataArray(parserResponse, body.sourceFile || 'verification', body.pdfUrl)
          
          // Store run data in normalized Supabase database
          console.log(`Storing ${fundDataArray.length} fund(s) from ${runType} in database`)
          const storageErrors: string[] = []
          for (const fundData of fundDataArray) {
            try {
              await storeFundData(fundData, body.pdfUrl, supabase, runType as 'second_run' | 'third_run')
              console.log(`Successfully stored ${runType} data for ${fundData.fundName}`)
            } catch (error: any) {
              const errorMsg = `Error storing ${runType} data for ${fundData.fundName}: ${error.message || error}`
              console.error(errorMsg)
              storageErrors.push(errorMsg)
            }
          }
          
          // If there were storage errors, include them in the response
          if (storageErrors.length > 0) {
            console.error(`Failed to store ${storageErrors.length} fund(s) in database:`, storageErrors)
            return NextResponse.json(
              { 
                error: `Failed to store some fund data in database`,
                details: storageErrors,
                funds: fundDataArray 
              },
              { status: 207 } // 207 Multi-Status - partial success
            )
          }
          
          return NextResponse.json(fundDataArray)
        } catch (error: any) {
          console.error('Verification error:', error)
          return NextResponse.json(
            { error: error.message || 'Verification failed' },
            { status: 500 }
          )
        }
      }
      
      // Check if it's a save ground truth request
      if (body.saveGroundTruth && body.groundTruth && Array.isArray(body.groundTruth)) {
        console.log('Save ground truth request for', body.groundTruth.length, 'fund(s)')
        
        try {
          for (const fundData of body.groundTruth) {
            try {
              // Try to find existing fund record by fund_name
              const { data: existingFund, error: findError } = await supabase
                .from('funds')
                .select('id')
                .eq('fund_name', fundData.fundName)
                .order('processed_at', { ascending: false })
                .limit(1)
                .single()
              
              if (existingFund && !findError) {
                // Store ground truth in normalized schema
                await storeFundData(fundData, body.pdfUrl || '', supabase, 'ground_truth' as any)
                console.log(`Successfully saved ground truth for ${fundData.fundName}`)
              } else {
                // Fund doesn't exist, create it with ground truth in normalized schema
                console.log(`Fund ${fundData.fundName} not found, creating new record with ground truth`)
                await storeFundData(fundData, body.pdfUrl || '', supabase, 'ground_truth' as any)
                console.log(`Successfully created and saved ground truth for ${fundData.fundName}`)
              }
            } catch (error: any) {
              console.error(`Error saving ground truth for ${fundData.fundName}:`, error)
            }
          }
          
          return NextResponse.json({ success: true, message: `Saved ground truth for ${body.groundTruth.length} fund(s)` })
        } catch (error: any) {
          console.error('Save ground truth error:', error)
          return NextResponse.json(
            { error: error.message || 'Failed to save ground truth' },
            { status: 500 }
          )
        }
      }
      
      // Sample factsheet request
      const sampleId = body.sampleFactsheet
      // For now, return empty array - you can add sample data later
      return NextResponse.json([])
    }

    // File upload request
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    console.log(`Processing ${files.length} file(s)`)

    const results: FundData[] = []
    const pdfUrls: string[] = []
    const errors: string[] = []
    
    for (const file of files) {
      try {
        console.log(`Starting to process file: ${file.name} (${file.size} bytes, type: ${file.type})`)
        const { funds: fundDataArray, pdfUrl } = await processPDF(file, supabase)
        // Add all funds from this PDF to results
        if (fundDataArray && fundDataArray.length > 0) {
          results.push(...fundDataArray)
          pdfUrls.push(pdfUrl)
          console.log(`Successfully processed ${fundDataArray.length} fund(s) from ${file.name}`)
        } else {
          console.warn(`No funds extracted from ${file.name}`)
          errors.push(`${file.name}: No funds were extracted from the PDF`)
        }
      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error)
        console.error(`Error stack:`, error.stack)
        const errorMessage = error.message || String(error)
        errors.push(`${file.name}: ${errorMessage}`)
        // Continue processing other files even if one fails
      }
    }

    if (results.length === 0) {
      console.error('No funds processed successfully. Errors:', errors)
      return NextResponse.json(
        { 
          error: 'Failed to process any files',
          details: errors.length > 0 ? errors : ['Unknown error occurred - check server logs for details']
        },
        { status: 500 }
      )
    }

    // Return results with PDF URLs for verification
    const response: any = {
      funds: results,
      pdfUrls: pdfUrls.length > 0 ? pdfUrls : undefined
    }

    // Include any errors if some files failed
    if (errors.length > 0) {
      response.warnings = errors
      response.message = `Processed ${results.length} fund(s) successfully, but ${errors.length} file(s) failed`
      console.warn(`Some files failed: ${errors.join('; ')}`)
    } else {
      response.message = `Successfully processed ${results.length} fund(s) from ${files.length} file(s)`
    }

    console.log(`Returning ${results.length} fund(s) from ${files.length} file(s)`)
    console.log(`PDF URLs processed: ${pdfUrls.length}`)
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('API error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process factsheets',
        details: error.stack || String(error)
      },
      { status: 500 }
    )
  }
}

