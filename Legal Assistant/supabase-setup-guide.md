
# AI Contract Parsing Setup Guide

This guide explains how to set up AI-powered contract parsing using Supabase Edge Functions and OpenAI.

## Overview

The app uses OpenAI's GPT-4 model to analyze contract documents (PDFs and images) and extract structured information including:
- Monthly fees and pricing
- Contract duration and terms
- Early termination fees
- Price protection clauses
- Consumer rights warnings

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. An OpenAI API key (get one at https://platform.openai.com)
3. Supabase CLI installed (optional, for local development)

## Setup Steps

### 1. Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Note your project URL and anon key
3. Enable Supabase in Natively by clicking the Supabase button

### 2. Create Edge Function

Create a new edge function in your Supabase project:

```bash
supabase functions new parse-contract
```

### 3. Edge Function Code

Create the file `supabase/functions/parse-contract/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { fileUri, fileName, provider } = await req.json()

    // Create prompt for OpenAI
    const systemPrompt = `You are an expert legal assistant specializing in Serbian consumer protection law and telecommunications contracts.
Your role is to help consumers understand their telecom contracts and identify potential violations of their rights.
You are familiar with Serbian telecom providers: Telekom Srbija, Telenor Serbia, and A1 Serbia.
Always provide clear, accurate information in a format that non-lawyers can understand.
Always respond in valid JSON format when analyzing contracts.`

    const userPrompt = `Analyze this contract document and extract the following information in JSON format:

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
    "List of important terms and conditions"
  ],
  "summary": "A clear, educational summary of the contract in 2-3 sentences",
  "warnings": [
    "List any potentially unfavorable terms"
  ]
}

Provider: ${provider}
File: ${fileName}

Provide the response ONLY as valid JSON, no additional text.`

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const contractData = JSON.parse(openaiData.choices[0].message.content)

    return new Response(
      JSON.stringify({ success: true, data: contractData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
```

### 4. Deploy Edge Function

Deploy the function to Supabase:

```bash
supabase functions deploy parse-contract
```

### 5. Set Environment Variables

Add your OpenAI API key to Supabase:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

Or set it in the Supabase dashboard:
1. Go to Project Settings > Edge Functions
2. Add a new secret: `OPENAI_API_KEY`
3. Paste your OpenAI API key

### 6. Update App Configuration

In your app, update the hook to call the Supabase edge function:

```typescript
// hooks/useContractParser.ts
import { supabase } from '@/integrations/supabase/client';

export function useContractParserWithSupabase() {
  const parseContract = async (fileUri: string, fileName: string, provider: string) => {
    const { data, error } = await supabase.functions.invoke('parse-contract', {
      body: { fileUri, fileName, provider }
    });

    if (error) throw error;
    return data;
  };

  return { parseContract };
}
```

## Testing

1. Upload a contract PDF or image in the app
2. The app will send it to the edge function
3. OpenAI will analyze the document
4. Extracted data will be displayed in the app

## Cost Considerations

- OpenAI API charges per token used
- GPT-4o-mini is cost-effective for this use case
- Typical contract analysis costs $0.01-0.05 per document
- Monitor usage in OpenAI dashboard

## Troubleshooting

### Edge Function Not Working
- Check Supabase logs in the dashboard
- Verify OPENAI_API_KEY is set correctly
- Ensure user is authenticated

### OpenAI Errors
- Verify API key is valid
- Check OpenAI account has credits
- Review rate limits

### File Upload Issues
- Ensure file is PDF or image format
- Check file size limits
- Verify Supabase storage is configured

## Security Notes

- Never expose OpenAI API key in client code
- Always use Supabase Edge Functions for API calls
- Implement rate limiting to prevent abuse
- Validate user authentication before processing

## Next Steps

1. Add file upload to Supabase Storage
2. Implement OCR for scanned documents
3. Add support for multiple languages
4. Create contract comparison features
5. Build notification system for contract changes
