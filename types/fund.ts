// Parser API Output Schema for Fund Factsheet Aggregator
export interface ParserAPIResponse {
  fund_name: string
  fund_factsheet_as_of_date: string
  fund_launch_date: string
  investment_objectives: string
  '2022_calendar_year_return': number | null
  '2023_calendar_year_return': number | null
  '2024_calendar_year_return': number | null
  '1_year_performance_annualized': number | null
  '3_year_performance_annualized': number | null
  '5_year_performance_annualized': number | null
  since_launch_performance_annualized: number | null
  top_10_holdings_names_in_descending_order: string[]
  asset_classes_invested_in_descending_order: string[]
  top_10_holdings_percentages_in_descending_order: number[]
  asset_allocation_percentages_in_descending_order: number[]
}

export interface AssetClass {
  class: string
  allocationPercent: number
}

export interface Holding {
  name: string
  allocationPercent: number
}

export interface FundData {
  id: string
  fundName: string
  fund_factsheet_as_of_date: string
  launchDate: string
  investmentObjective: string
  returns: {
    oneYearAnnualized: number | null
    threeYearAnnualized: number | null
    fiveYearAnnualized: number | null
    sinceLaunchAnnualized: number | null
    calendarYear2024: number | null
    calendarYear2023: number | null
    calendarYear2022: number | null
  }
  assetClasses: AssetClass[]
  top10Holdings: Holding[]
  sourceFile: string
  processedAt: string
}

export interface ProcessingStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'verifying'
  message?: string
  progress?: number
}

export interface VerificationData {
  firstRun: FundData[]
  secondRun: FundData[] | null
  thirdRun: FundData[] | null
  groundTruth: FundData[] | null
  isVerifying: boolean
  isVerifyingThirdRun: boolean
  verificationComplete: boolean
  thirdRunComplete: boolean
  pdfUrls: string[] // Array of PDF URLs for verification
  pdfFileNames: string[] // Array of file names corresponding to PDF URLs
}