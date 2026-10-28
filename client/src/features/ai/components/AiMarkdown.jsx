import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Copy, Check } from 'lucide-react';

const CodeBlock = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-800/80 border-b border-zinc-700/60 text-zinc-400">
        <span className="font-semibold text-[11px] uppercase tracking-wider">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const AiMarkdown = React.memo(({ content = '', className = '' }) => {
  if (!content) return null;

  // Simple, lightweight markdown parser for streaming answers
  const parseMarkdown = (markdownText) => {
    // Split by code blocks first
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(markdownText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: markdownText.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: 'code',
        language: match[1],
        code: match[2].trimEnd()
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < markdownText.length) {
      parts.push({
        type: 'text',
        content: markdownText.substring(lastIndex)
      });
    }

    return parts;
  };

  const renderTextFormatting = (rawText) => {
    // Process markdown headers, bold, italics, lists, inline code, and links
    let formatted = rawText
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-ink dark:text-cream mt-3 mb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-ink dark:text-cream mt-4 mb-1.5">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-ink dark:text-cream mt-5 mb-2">$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-primary pl-3 py-0.5 my-2 text-muted italic">$1</blockquote>')
      // Bold & Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-primary/15 dark:bg-zinc-800 text-primary dark:text-pink-400 px-1.5 py-0.5 rounded text-[13px] font-mono">$1</code>')
      // Unordered list items
      .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="ml-4 list-disc my-0.5">$1</li>')
      // Ordered list items
      .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal my-0.5">$1</li>')
      // Links
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary dark:text-pink-400 underline font-medium hover:opacity-80">$1</a>'
      )
      // Line breaks
      .replace(/\n\n/g, '<div class="h-2"></div>')
      .replace(/\n/g, '<br />');

    const cleanHtml = DOMPurify.sanitize(formatted, {
      ADD_ATTR: ['target', 'rel', 'class']
    });

    return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  };

  const parsedParts = parseMarkdown(content);

  return (
    <div className={`prose-sm leading-relaxed text-ink dark:text-zinc-100 break-words ${className}`}>
      {parsedParts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} language={part.language} code={part.code} />;
        }
        return <React.Fragment key={index}>{renderTextFormatting(part.content)}</React.Fragment>;
      })}
    </div>
  );
});
