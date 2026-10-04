import React from 'react';

export const AiThinking = ({ label = 'Flash AI is thinking...' }) => {
  return (
    <div className="flex items-center gap-2 text-ink/70 dark:text-muted py-2 px-3 text-sm animate-pulse">
      <div className="flex gap-1 items-center">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-accent animate-bounce" />
      </div>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
};
