
import { useState, useCallback } from 'react';
import { ContractData, ParsedContract, createContractPrompt, createContractSystemPrompt, parseContractResponse } from '@/utils/contractParser';

interface UseContractParserResult {
  parseContract: (fileUri: string, fileName: string, provider: string) => Promise<ParsedContract>;
  loading: boolean;
  error: string | null;
  progress: string | null;
}

export function useContractParser(): UseContractParserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const parseContract = useCallback(async (
    fileUri: string,
    fileName: string,
    provider: string
  ): Promise<ParsedContract> => {
    setLoading(true);
    setError(null);
    setProgress('Reading document...');

    try {
      // Read the file content
      setProgress('Preparing document for analysis...');
      
      // For now, we'll use a mock implementation
      // In production, this would call the Supabase edge function
      // that uses OpenAI to parse the contract
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProgress('Analyzing contract with AI...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProgress('Extracting key terms...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock response - in production this would come from OpenAI
      const mockData: ContractData = {
        provider: provider,
        contractType: 'Mobile Service',
        monthlyFee: '1,500 RSD',
        dataAllowance: '10 GB',
        callMinutes: 'Unlimited',
        smsAllowance: 'Unlimited',
        contractDuration: '24 months',
        earlyTerminationFee: '5,000 RSD',
        priceProtection: 'Price locked for 24 months',
        autoRenewal: 'Automatically renews for 12 months unless cancelled',
        noticeRequired: '30 days written notice required',
        keyTerms: [
          'Fixed monthly fee: 1,500 RSD for 24 months',
          'Early termination fee: 5,000 RSD if cancelled before 24 months',
          'Price protection: No price increases during initial 24-month period',
          'Auto-renewal: Contract automatically renews for 12 months',
          'Notice period: 30 days written notice required for cancellation',
          'Data allowance: 10 GB per month with unlimited calls and SMS',
        ],
        summary: `This is a 24-month mobile service contract with ${provider} offering 10 GB data and unlimited calls/SMS for 1,500 RSD per month. The price is locked for the initial 24 months, but the contract auto-renews for 12 months unless you provide 30 days notice. Early termination incurs a 5,000 RSD fee.`,
        warnings: [
          'Auto-renewal clause: Contract will automatically renew unless you cancel',
          'Early termination fee of 5,000 RSD applies if cancelled before 24 months',
          'Price protection only applies to initial 24-month period',
        ],
      };

      setProgress('Complete!');
      setLoading(false);
      
      return {
        success: true,
        data: mockData,
      };
    } catch (err) {
      console.error('Error parsing contract:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse contract';
      setError(errorMessage);
      setLoading(false);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  return {
    parseContract,
    loading,
    error,
    progress,
  };
}

// Hook for using with Supabase integration
export function useContractParserWithSupabase(): UseContractParserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const parseContract = useCallback(async (
    fileUri: string,
    fileName: string,
    provider: string
  ): Promise<ParsedContract> => {
    setLoading(true);
    setError(null);
    setProgress('Reading document...');

    try {
      // This would integrate with Supabase edge function
      // For now, return error indicating Supabase is needed
      throw new Error('Supabase integration required. Please enable Supabase to use AI contract parsing.');
    } catch (err) {
      console.error('Error parsing contract:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse contract';
      setError(errorMessage);
      setLoading(false);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  return {
    parseContract,
    loading,
    error,
    progress,
  };
}
