import { useState, useRef, useCallback, useEffect } from 'react';
import { useAiStore } from '../store/useAiStore';

export const useAiStream = () => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'streaming' | 'done' | 'error'
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const bufferRef = useRef('');
  const animFrameRef = useRef(null);
  const setIsStreamingGlobal = useAiStore((s) => s.setIsStreaming);
  const setStreamingTextGlobal = useAiStore((s) => s.setStreamingText);

  // Throttled UI updater using requestAnimationFrame
  const scheduleUpdate = useCallback(() => {
    if (animFrameRef.current) return;
    animFrameRef.current = requestAnimationFrame(() => {
      setText(bufferRef.current);
      setStreamingTextGlobal(bufferRef.current);
      animFrameRef.current = null;
    });
  }, [setStreamingTextGlobal]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setStatus('done');
    setIsStreamingGlobal(false);
  }, [setIsStreamingGlobal]);

  const startStream = useCallback(
    async ({ chatId, message, attachments = [] }) => {
      // Abort any ongoing stream
      stopStream();

      bufferRef.current = '';
      setText('');
      setError(null);
      setStatus('streaming');
      setIsStreamingGlobal(true);
      setStreamingTextGlobal('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = localStorage.getItem('flash_chat_token');
        const headers = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/ai/chats/${chatId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message, attachments }),
          signal: controller.signal
        });

        if (!response.ok) {
          let errMsg = 'Failed to generate response';
          try {
            const errData = await response.json();
            errMsg = errData.message || errMsg;
          } catch (_) {}
          throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let sseBuffer = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n\n');
            sseBuffer = lines.pop() || ''; // Keep remainder

            for (const block of lines) {
              const trimmed = block.trim();
              if (!trimmed) continue;

              const eventMatch = trimmed.match(/^event:\s*(\w+)/m);
              const dataMatch = trimmed.match(/^data:\s*(.*)/m);
              const eventType = eventMatch ? eventMatch[1] : 'token';
              const rawData = dataMatch ? dataMatch[1] : '';

              if (eventType === 'token' && rawData) {
                try {
                  const parsed = JSON.parse(rawData);
                  if (parsed.token) {
                    bufferRef.current += parsed.token;
                    scheduleUpdate();
                  }
                } catch (_) {}
              } else if (eventType === 'done') {
                setStatus('done');
                setIsStreamingGlobal(false);
              } else if (eventType === 'error') {
                try {
                  const parsed = JSON.parse(rawData);
                  throw new Error(parsed.message || 'AI generation error');
                } catch (e) {
                  throw new Error(rawData || 'AI generation error');
                }
              }
            }
          }
        }

        // Final flush
        setText(bufferRef.current);
        setStreamingTextGlobal(bufferRef.current);
        setStatus('done');
        setIsStreamingGlobal(false);
      } catch (err) {
        if (err.name === 'AbortError') {
          // User stopped manually
          setStatus('done');
        } else {
          setError(err.message || 'An error occurred during AI generation');
          setStatus('error');
        }
        setIsStreamingGlobal(false);
      }
    },
    [scheduleUpdate, setIsStreamingGlobal, setStreamingTextGlobal, stopStream]
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return {
    text,
    status,
    error,
    isStreaming: status === 'streaming',
    startStream,
    stopStream,
    reset: () => {
      setText('');
      setStatus('idle');
      setError(null);
    }
  };
};
