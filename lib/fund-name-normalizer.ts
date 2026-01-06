/**
 * Normalize fund name for consistent matching across runs
 * This matches the frontend normalization logic exactly to ensure pairing works correctly
 * This ensures funds with slightly different names (e.g., "Fund ABC" vs "Fund ABC ")
 * get linked to the same fund_id in the database
 */

export function normalizeFundNameForDatabase(name: string): string {
  if (!name) return ''
  
  // Remove trailing numbers and spaces (e.g., "Fund 8" -> "Fund")
  let normalized = name.trim()
  
  // Remove trailing numbers and spaces pattern like " 8", " 123", etc.
  normalized = normalized.replace(/\s+\d+$/, '')
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Convert to lowercase for comparison (matches frontend normalizeFundName)
  normalized = normalized.toLowerCase()
  
  // Trim again after normalization
  normalized = normalized.trim()
  
  // Return normalized name (lowercase for consistent matching)
  return normalized
}
