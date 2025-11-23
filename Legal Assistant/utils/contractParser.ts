
// Contract parsing utility using OpenAI
export interface ContractData {
  provider: string;
  contractType: string;
  startDate?: string;
  endDate?: string;
  monthlyFee?: string;
  dataAllowance?: string;
  callMinutes?: string;
  smsAllowance?: string;
  contractDuration?: string;
  earlyTerminationFee?: string;
  priceProtection?: string;
  autoRenewal?: string;
  noticeRequired?: string;
  keyTerms: string[];
  summary: string;
  warnings?: string[];
}

export interface ParsedContract {
  success: boolean;
  data?: ContractData;
  error?: string;
}

// This function will be called from the Supabase edge function
export function parseContractResponse(aiResponse: string): ContractData {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(aiResponse);
    return parsed;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Fallback: extract information from text response
    return extractFromText(aiResponse);
  }
}

function extractFromText(text: string): ContractData {
  const keyTerms: string[] = [];
  const warnings: string[] = [];
  
  // Extract key information using regex patterns
  const monthlyFeeMatch = text.match(/monthly fee[:\s]+([0-9,]+\s*(?:RSD|EUR|€))/i);
  const durationMatch = text.match(/(?:contract duration|period)[:\s]+([0-9]+\s*months?)/i);
  const dataMatch = text.match(/data[:\s]+([0-9]+\s*(?:GB|MB))/i);
  
  if (monthlyFeeMatch) keyTerms.push(`Monthly fee: ${monthlyFeeMatch[1]}`);
  if (durationMatch) keyTerms.push(`Contract duration: ${durationMatch[1]}`);
  if (dataMatch) keyTerms.push(`Data allowance: ${dataMatch[1]}`);
  
  return {
    provider: 'Unknown Provider',
    contractType: 'Mobile Service',
    keyTerms: keyTerms.length > 0 ? keyTerms : ['Contract terms extracted from document'],
    summary: text.substring(0, 200) + '...',
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function createContractPrompt(provider: string): string {
  return `You are a legal expert specializing in Serbian telecommunications contracts. 
Analyze this contract document and extract the following information in JSON format:

{
  "provider": "Provider name",
  "contractType": "Type of service (Mobile, Internet, TV, Bundle, etc.)",
  "startDate": "Contract start date (YYYY-MM-DD format if available)",
  "endDate": "Contract end date (YYYY-MM-DD format if available)",
  "monthlyFee": "Monthly fee with currency (e.g., '1,500 RSD')",
  "dataAllowance": "Data allowance (e.g., '10 GB')",
  "callMinutes": "Call minutes included (e.g., 'Unlimited' or '500 minutes')",
  "smsAllowance": "SMS allowance (e.g., 'Unlimited' or '100 SMS')",
  "contractDuration": "Contract duration (e.g., '24 months')",
  "earlyTerminationFee": "Early termination fee if applicable",
  "priceProtection": "Price protection clause details",
  "autoRenewal": "Auto-renewal terms",
  "noticeRequired": "Notice period required for cancellation",
  "keyTerms": [
    "List of important terms and conditions",
    "Include pricing, duration, termination fees",
    "Include any price protection clauses",
    "Include any automatic price increase clauses"
  ],
  "summary": "A clear, educational summary of the contract in 2-3 sentences that a consumer can easily understand",
  "warnings": [
    "List any potentially unfavorable terms",
    "Highlight automatic price increase clauses",
    "Note any hidden fees or charges"
  ]
}

Provider: ${provider}

Focus on:
1. Pricing and fees (monthly, one-time, termination)
2. Contract duration and renewal terms
3. Price protection or price increase clauses
4. Service specifications (data, minutes, SMS)
5. Consumer rights and obligations
6. Termination conditions and notice periods

Provide the response ONLY as valid JSON, no additional text.`;
}

export function createContractSystemPrompt(): string {
  return `You are an expert legal assistant specializing in Serbian consumer protection law and telecommunications contracts. 
Your role is to help consumers understand their telecom contracts and identify potential violations of their rights.
You are familiar with Serbian telecom providers: Telekom Srbija, Telenor Serbia, and A1 Serbia.
Always provide clear, accurate information in a format that non-lawyers can understand.
When analyzing contracts, pay special attention to:
- Price protection clauses
- Automatic price increase terms
- Early termination fees
- Notice periods
- Consumer rights under Serbian law
Always respond in valid JSON format when analyzing contracts.`;
}
