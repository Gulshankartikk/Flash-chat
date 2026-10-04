import React from 'react';
import { Info } from 'lucide-react';

export const AI_PROVIDER_DISCLOSURE =
  'Flash AI is powered by Google Gemini. Selected content is processed by Google to generate results.';

export const AiProviderDisclosure = ({ className = '', compact = false }) => {
  if (compact) {
    return (
      <p className={`text-[11px] text-muted text-center ${className}`}>
        {AI_PROVIDER_DISCLOSURE}
      </p>
    );
  }

  return (
    <div className={`p-3 bg-cream border border-line rounded-xl flex items-start gap-2.5 ${className}`}>
      <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-ink">Provider Transparency</span>
        <p className="text-[11px] text-muted leading-relaxed mt-0.5">
          {AI_PROVIDER_DISCLOSURE}
        </p>
      </div>
    </div>
  );
};

export default AiProviderDisclosure;
