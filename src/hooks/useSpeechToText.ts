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
  const lastResultTimeRef = useRef(Date.now());
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    onResultRef.current = (text: string, isFinal: boolean) => {
      lastResultTimeRef.current = Date.now();
      if (onResult) onResult(text, isFinal);
    };
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const stop = useCallback(async () => {
    console.log('Zaustavljanje mikrofona...');
    isListeningRequested.current = false;
    setIsListening(false);
    setIsRecognitionActive(false);
    
    if (isNative) {
      try {
        await SpeechRecognition.removeAllListeners();
        await SpeechRecognition.stop();
        console.log('Native recognition zaustavljen.');
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
        }, 100);
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

  const isSupported = isNative ? true : !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Native Listeners setup
  useEffect(() => {
    if (!isNative) return;

    const setupListeners = async () => {
      try {
        await SpeechRecognition.removeAllListeners();
        
        await SpeechRecognition.addListener('partialResults', (data: any) => {
          if (onResultRef.current && data.matches && data.matches.length > 0) {
            onResultRef.current(data.matches[0], false);
          }
        });

        await SpeechRecognition.addListener('listeningState', (data: any) => {
          console.log('Native listening state changed:', data.status);
          setIsRecognitionActive(data.status === 'started');
        });

        // Use any because the plugin types might be outdated in our environment
        (SpeechRecognition as any).addListener('error', (data: any) => {
          console.warn('Native speech error listener:', data);
          setIsRecognitionActive(false);
          
          if (data.error === 'not-allowed' || data.error === 'service-not-allowed') {
            setError('Mikrofon nije odobren u sistemu.');
            setIsListening(false);
            isListeningRequested.current = false;
          } else if (data.error === 'network' || data.error === 'network-timeout') {
            setError('Greška mreže. Proverite internet.');
          }
          // no-speech and others are handled by the restart logic watching isRecognitionActive
        });
      } catch (e) {
        console.error('Error setting up listeners:', e);
      }
    };

    setupListeners();
    return () => {
      SpeechRecognition.removeAllListeners();
    };
  }, [isNative]);

  const startNativeRecognition = useCallback(async () => {
    // Ako je već aktivan, ne radimo ništa
    if (isRecognitionActive) {
      console.log('Native prepoznavanje je već aktivno.');
      return;
    }
    
    console.log('Pokrećem native prepoznavanje (startNative)...');
    isListeningRequested.current = true;
    setIsListening(true);

    try {
      const available = await SpeechRecognition.available();
      if (!available.available) {
        setError('Prepoznavanje govora nije dostupno.');
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
      
      setIsRecognitionActive(true);
      console.log('Native prepoznavanje uspešno pokrenuto.');

    } catch (e: any) {
      console.error('Bacio grešku pri startu:', e);
      
      if (e.message && e.message.includes('already started')) {
        setIsRecognitionActive(true);
        return;
      }
      
      setIsRecognitionActive(false);
      // Restartuj posle sekunde ako je ipak puklo
      if (isListeningRequested.current) {
        setTimeout(() => {
          if (isListeningRequested.current && !isRecognitionActive) {
             startNativeRecognition();
          }
        }, 1500);
      }
    }
  }, [lang, isRecognitionActive]);

  // Restart logic for Native (Watchdog)
  useEffect(() => {
    if (!isNative) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // On Android, the recognition service often dies after 3-5s of silence
      const inactiveTooLong = now - lastResultTimeRef.current > 6000;
      
      if (isListeningRequested.current) {
        if (!isRecognitionActive || inactiveTooLong) {
          if (inactiveTooLong && isRecognitionActive) {
            console.log('Watchdog: Nema rezultata 6s. Forsiram restart...');
          } else if (!isRecognitionActive) {
            console.log('Watchdog: Mikrofon je ugašen. Restartujem...');
          }
          // Reset status to allow start
          setIsRecognitionActive(false);
          startNativeRecognition();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isNative, isRecognitionActive, startNativeRecognition]);

  const start = useCallback(() => {
    if (isNative) {
      startNativeRecognition();
      return;
    }

    if (!isSupported) {
      setError('Prepoznavanje govora nije podržano u ovom pregledaču.');
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
    isNative,
    isSupported: isNative ? true : !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  };
}

