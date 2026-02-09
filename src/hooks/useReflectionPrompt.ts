import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GeneratedPrompt {
  id: string;
  prompt_text: string;
  prompt_context: Record<string, unknown>;
  period_type: 'weekly' | 'monthly' | 'on_demand';
  period_start: string;
  status: 'pending' | 'answered' | 'skipped' | 'expired';
  response_item_id: string | null;
  generated_at: string;
  answered_at: string | null;
  skipped_at: string | null;
}

interface UseReflectionPromptReturn {
  prompt: GeneratedPrompt | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  generatePrompt: (periodType?: 'weekly' | 'monthly', forceGenerate?: boolean) => Promise<void>;
  skipPrompt: () => Promise<void>;
  answerPrompt: (responseItemId: string) => Promise<void>;
}

export function useReflectionPrompt(): UseReflectionPromptReturn {
  const [prompt, setPrompt] = useState<GeneratedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();

  // Fetch or generate prompt on mount
  useEffect(() => {
    if (user && session) {
      fetchCurrentPrompt();
    } else {
      setIsLoading(false);
    }
  }, [user, session]);

  const fetchCurrentPrompt = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the most recent prompt for the user (pending or answered)
      const { data: existingPrompt, error: fetchError } = await supabase
        .from('generated_prompts')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_type', 'weekly')
        .in('status', ['pending', 'answered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching prompt:', fetchError);
        setError('Failed to fetch reflection prompt');
        setIsLoading(false);
        return;
      }

      if (existingPrompt) {
        setPrompt(existingPrompt as GeneratedPrompt);
      } else {
        // No prompt yet - will generate on demand
        setPrompt(null);
      }
    } catch (err) {
      console.error('Error in fetchCurrentPrompt:', err);
      setError('Failed to fetch reflection prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrompt = async (periodType: 'weekly' | 'monthly' = 'weekly', forceGenerate = false) => {
    if (!session) return;

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-reflection-prompt', {
        body: { periodType, forceGenerate },
      });

      if (invokeError) {
        console.error('Error generating prompt:', invokeError);
        setError('Failed to generate reflection prompt');
        return;
      }

      if (data?.prompt) {
        setPrompt(data.prompt as GeneratedPrompt);
      }
    } catch (err) {
      console.error('Error in generatePrompt:', err);
      setError('Failed to generate reflection prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const skipPrompt = async () => {
    if (!prompt) return;

    try {
      const { error: updateError } = await supabase
        .from('generated_prompts')
        .update({
          status: 'skipped',
          skipped_at: new Date().toISOString(),
        })
        .eq('id', prompt.id);

      if (updateError) {
        console.error('Error skipping prompt:', updateError);
        setError('Failed to skip prompt');
        return;
      }

      setPrompt(prev => prev ? { ...prev, status: 'skipped', skipped_at: new Date().toISOString() } : null);
    } catch (err) {
      console.error('Error in skipPrompt:', err);
      setError('Failed to skip prompt');
    }
  };

  const answerPrompt = async (responseItemId: string) => {
    if (!prompt) return;

    try {
      const { error: updateError } = await supabase
        .from('generated_prompts')
        .update({
          status: 'answered',
          answered_at: new Date().toISOString(),
          response_item_id: responseItemId,
        })
        .eq('id', prompt.id);

      if (updateError) {
        console.error('Error marking prompt as answered:', updateError);
        setError('Failed to update prompt status');
        return;
      }

      setPrompt(prev => prev ? { 
        ...prev, 
        status: 'answered', 
        answered_at: new Date().toISOString(),
        response_item_id: responseItemId 
      } : null);
    } catch (err) {
      console.error('Error in answerPrompt:', err);
      setError('Failed to update prompt status');
    }
  };

  return {
    prompt,
    isLoading,
    isGenerating,
    error,
    generatePrompt,
    skipPrompt,
    answerPrompt,
  };
}
