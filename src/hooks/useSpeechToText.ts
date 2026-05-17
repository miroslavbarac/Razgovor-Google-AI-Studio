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
  const isStartingNative = useRef(false);
  const isActuallyActive = useRef(false); // Real-time flag for logic
  const lastResultTimeRef = useRef(Date.now());
  const restartDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const isNative = Capacitor.isNativePlatform();
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    onResultRef.current = (text: string, isFinal: boolean) => {
      if (text.trim()) {
        lastResultTimeRef.current = Date.now();
      }
      if (onResult) onResult(text, isFinal);
    };
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const isSupported = isNative ? true : !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const createWebRecognition = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return null;

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
          if (isListeningRequested.current) startRef.current();
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      if (onErrorRef.current) onErrorRef.current(event);
      setError(`Greška: ${event.error}`);
    };

    recognition.onresult = (event: any) => {
      if (!onResultRef.current) return;
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (final) onResultRef.current(final, true);
      if (interim) onResultRef.current(interim, false);
    };

    return recognition;
  }, [lang]);

  const startNativeRecognition = useCallback(async () => {
    if (isStartingNative.current) return;
    
    console.log('--- STARTING NATIVE RECOGNITION ---');
    isStartingNative.current = true;
    setIsListening(true);
    isListeningRequested.current = true;
    lastResultTimeRef.current = Date.now();

    try {
      const available = await SpeechRecognition.available();
      if (!available.available) {
        setError('Prepoznavanje nije dostupno.');
        setIsListening(false);
        isListeningRequested.current = false;
        return;
      }

      let permissions = await SpeechRecognition.checkPermissions();
      if (permissions.speechRecognition !== 'granted') {
        permissions = await SpeechRecognition.requestPermissions();
        if (permissions.speechRecognition !== 'granted') {
          setError('Nema dozvole za mikrofon.');
          setIsListening(false);
          isListeningRequested.current = false;
          return;
        }
      }

      setError(null);
      await SpeechRecognition.start({
        language: lang,
        partialResults: true,
        popup: false,
      });
      
      console.log('--- NATIVE RECOGNITION STARTED ---');
      setIsRecognitionActive(true);
      isActuallyActive.current = true;
    } catch (e: any) {
      console.error('--- START ERROR ---', e);
      if (e.message && e.message.includes('already started')) {
        setIsRecognitionActive(true);
        isActuallyActive.current = true;
      } else {
        setIsRecognitionActive(false);
        isActuallyActive.current = false;
      }
    } finally {
      isStartingNative.current = false;
    }
  }, [lang]);

  const stop = useCallback(async () => {
    console.log('--- STOPPING MANUALLY ---');
    isListeningRequested.current = false;
    isStartingNative.current = false;
    isActuallyActive.current = false;
    setIsListening(false);
    setIsRecognitionActive(false);
    
    if (restartDebounceRef.current) clearTimeout(restartDebounceRef.current);
    
    if (isNative) {
      try {
        await SpeechRecognition.stop();
      } catch (e) {}
    } else if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, [isNative]);

  const start = useCallback(() => {
    if (isNative) {
      startNativeRecognition();
      return;
    }

    if (!isSupported) {
      setError('Prepoznavanje govora nije podržano.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const rec = createWebRecognition();
    if (!rec) return;

    recognitionRef.current = rec;
    isListeningRequested.current = true;
    setIsListening(true);
    
    try {
      rec.start();
    } catch (e: any) {
      console.error('Failed to start recognition:', e);
      if (!e.message.includes('already started')) {
        setIsListening(false);
        setError('Greška pri startu klijenta.');
      }
    }
  }, [isNative, createWebRecognition, startNativeRecognition, isSupported]);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Event handlers for Native
  useEffect(() => {
    if (!isNative) return;

    const setup = async () => {
      await SpeechRecognition.removeAllListeners();
      
      await SpeechRecognition.addListener('partialResults', (data: any) => {
        if (onResultRef.current && data.matches?.length > 0) {
          onResultRef.current(data.matches[0], false);
        }
      });

      await SpeechRecognition.addListener('listeningState', (data: any) => {
        console.log('State:', data.status);
        const isActiveNow = data.status === 'started';
        setIsRecognitionActive(isActiveNow);
        isActuallyActive.current = isActiveNow;

        if (data.status === 'stopped' && isListeningRequested.current) {
          if (restartDebounceRef.current) clearTimeout(restartDebounceRef.current);
          restartDebounceRef.current = setTimeout(() => {
            if (isListeningRequested.current && !isActuallyActive.current) {
              startNativeRecognition();
            }
          }, 300);
        }
      });

      (SpeechRecognition as any).addListener('error', (data: any) => {
        console.warn('Speech Error:', data.error);
        if (data.error === 'not-allowed') {
          setError('Nema dozvole.');
          stop();
          return;
        }
        if (isListeningRequested.current) {
          if (restartDebounceRef.current) clearTimeout(restartDebounceRef.current);
          restartDebounceRef.current = setTimeout(() => {
            if (isListeningRequested.current) startNativeRecognition();
          }, 1000);
        }
      });
    };

    setup();
    return () => {
      SpeechRecognition.removeAllListeners();
      if (restartDebounceRef.current) clearTimeout(restartDebounceRef.current);
    };
  }, [isNative, startNativeRecognition, stop]);

  // Watchdog backup
  useEffect(() => {
    if (!isNative) return;
    const interval = setInterval(() => {
      const timeSinceResult = Date.now() - lastResultTimeRef.current;
      if (isListeningRequested.current && !isStartingNative.current) {
        if (!isActuallyActive.current || timeSinceResult > 15000) {
           startNativeRecognition();
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isNative, startNativeRecognition]);

  return {
    isListening,
    isRecognitionActive,
    error,
    start,
    stop,
    isNative,
    isSupported
  };
}
