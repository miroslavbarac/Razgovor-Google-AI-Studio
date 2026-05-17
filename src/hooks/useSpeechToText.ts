import { useState, useCallback, useRef, useEffect } from 'react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

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
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const stop = useCallback(async () => {
    isListeningRequested.current = false;
    setIsListening(false);
    
    if (isNative) {
      try {
        await SpeechRecognition.stop();
        setIsRecognitionActive(false);
      } catch (e) {
        console.error('Native stop error:', e);
      }
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, [isNative]);

  const createWebRecognition = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.error('Speech recognition not supported. Secure context:', window.isSecureContext);
      return null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecognitionActive(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsRecognitionActive(false);
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
        setError('Pristup mikrofonu je odbijen. Dozvolite ga u podešavanjima.');
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

  const startNativeRecognition = useCallback(async () => {
    console.log('Starting native recognition...');
    try {
      const available = await SpeechRecognition.available();
      console.log('Recognition available:', available);
      if (!available.available) {
        setError('Prepoznavanje govora nije dostupno na ovom uređaju.');
        setIsListening(false);
        return;
      }

      const permissions = await SpeechRecognition.checkPermissions();
      console.log('Current permissions:', permissions);
      
      // Check for both common permission keys
      const hasPermission = (permissions as any).speechRecognition === 'granted' || (permissions as any).microphone === 'granted';
      
      if (!hasPermission) {
        console.log('Requesting permissions...');
        const result = await SpeechRecognition.requestPermissions();
        console.log('Permission request result:', result);
        const granted = (result as any).speechRecognition === 'granted' || (result as any).microphone === 'granted';
        
        if (!granted) {
          setError('Dozvola za mikrofon nije odobrena.');
          setIsListening(false);
          return;
        }
      }

      setIsListening(true);
      setIsRecognitionActive(true);
      setError(null);

      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (onResultRef.current && data.matches && data.matches.length > 0) {
          onResultRef.current(data.matches[0], false);
        }
      });

      await SpeechRecognition.start({
        language: lang,
        partialResults: true,
        popup: false,
      });

    } catch (e: any) {
      console.error('Native recognition error:', e);
      setError(`Greška: ${e.message || 'Neuspešno pokretanje prepoznavanja'}`);
      setIsListening(false);
      setIsRecognitionActive(false);
    }
  }, [lang]);

  const start = useCallback(() => {
    if (isNative) {
      startNativeRecognition();
      return;
    }

    // Web fallback
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const rec = createWebRecognition();
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
  }, [isNative, createWebRecognition, startNativeRecognition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isListeningRequested.current = false;
      if (isNative) {
        SpeechRecognition.removeAllListeners();
        SpeechRecognition.stop();
      } else if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, [isNative]);

  return {
    isListening,
    isRecognitionActive,
    error,
    start,
    stop,
    isSupported: isNative ? true : !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  };
}

