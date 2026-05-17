import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (event: any) => void;
}

export function useSpeechToText({
  lang = 'sr-RS',
  onResult,
  onError,
}: UseSpeechToTextOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRequested = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const stop = useCallback(() => {
    isListeningRequested.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, []);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported. Secure context:', window.isSecureContext);
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecognitionActive(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsRecognitionActive(false);
      // Restart if still requested (manual lock)
      if (isListeningRequested.current) {
        setTimeout(() => {
          if (isListeningRequested.current) {
            start();
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      
      console.error('Speech Recognition Error:', event.error);
      if (onErrorRef.current) onErrorRef.current(event);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningRequested.current = false;
        setIsListening(false);
        setError('Pristup mikrofonu je odbijen. Dozvolite ga u podešavanjima pretraživača.');
      } else {
        setError(`Greška mikrofona: ${event.error}`);
      }
    };

    recognition.onresult = (event: any) => {
      if (!onResultRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) onResultRef.current(finalTranscript, true);
      if (interimTranscript) onResultRef.current(interimTranscript, false);
    };

    return recognition;
  }, [lang]);

  const start = useCallback(() => {
    // Kill existing if any
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const rec = createRecognition();
    if (!rec) {
      setError('Prepoznavanje govora nije podržano.');
      return;
    }

    recognitionRef.current = rec;
    isListeningRequested.current = true;
    setIsListening(true);
    
    try {
      rec.start();
    } catch (e: any) {
      console.error('Failed to start recognition:', e);
      if (!e.message.includes('already started')) {
        setIsListening(false);
        setError('Neuspešno pokretanje mikrofona.');
      }
    }
  }, [createRecognition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isListeningRequested.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  return {
    isListening,
    isRecognitionActive,
    error,
    start,
    stop,
    isSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  };
}

