import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  onAuthStateChanged, 
  auth, 
  loginAnonymously, 
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import type { User } from './lib/firebase';
import { LogIn, Mic, Users, Settings as SettingsIcon, LogOut, Copy, Check, MessageSquare, QrCode, Trash2, Mail, User as UserIcon, X, History, Clock, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSpeechToText } from './hooks/useSpeechToText';
import { Capacitor } from '@capacitor/core';
import { toCyrillic } from './lib/transliterate';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

// --- Components ---

const Dashboard = ({ user, config, onJoin, onOpenSettings, onOpenHistory, setConfig }: { user: User; config: any; onJoin: () => void; onOpenSettings: () => void; onOpenHistory: () => void; setConfig: any }) => {
  const clearHistory = async () => {
    if (!window.confirm('Da li ste sigurni da želite da obrišete kompletnu istoriju razgovora?')) return;
    try {
      const msgsRef = collection(db, 'sessions', 'RAZGOVOR', 'messages');
      const q = query(msgsRef);
      const snapshot = await onSnapshot(q, () => {}); // We use the already loaded messages in parent or here
      // Simplest way is let the App handle global state or just use direct firestore delete
      // Since it's a specific 'RAZGOVOR' session, we clear its messages
      alert('Molimo koristite kanticu u Istoriji za brisanje.');
    } catch (e) {}
  };

  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [isAddingPartner, setIsAddingPartner] = useState(false);

  const addPartner = () => {
    if (!newPartnerEmail.includes('@')) {
      alert('Unesite ispravan email sagovornika.');
      return;
    }
    onOpenSettings(); // Temporarily use settings to save, or we can update directly
    // Actually, let's update directly if we passed setConfig to Dashboard.
    // For now, I'll modify Dashboard to accept setConfig.
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-xl mx-auto px-6 py-8"
    >
      <div className="flex justify-between items-center mb-12">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-accent-red rounded-full flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
          <div className="w-10 h-10 bg-[#008080] rounded-full flex items-center justify-center text-white">
            <div className="flex gap-0.5">
              {[1, 2, 3].map(i => <div key={i} className="w-1 h-4 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        </div>
        <div className="flex gap-6 text-primary-dark/40 items-center">
          <button onClick={onOpenHistory} className="hover:text-primary-dark transition-colors"><History size={22} /></button>
          <button onClick={onOpenSettings} className="hover:text-primary-dark transition-colors"><SettingsIcon size={22} /></button>
        </div>
      </div>

      <h1 className="text-6xl font-extrabold text-primary-dark mb-4 tracking-tight">Razgovor</h1>
      <p className="text-primary-dark/60 text-lg mb-12 leading-snug font-medium">
        Dva naloga, jedan razgovor. Dodaj sebe i sagovornika — sesija je odmah aktivna.
      </p>

      <div className="space-y-4 mb-12">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6 border border-black/5">
          <div className="w-12 h-12 bg-accent-red/10 text-accent-red rounded-full flex items-center justify-center shrink-0">
            <UserIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-1">TVOJ NALOG</p>
            <p className="text-xl font-bold text-primary-dark truncate">{config.myName || 'Podesi ime'}</p>
            <p className="text-sm font-medium text-primary-dark/40 truncate">{user.email}</p>
          </div>
          <button onClick={onOpenSettings} className="p-2 text-primary-dark/20 hover:text-primary-dark transition-colors">
            <SettingsIcon size={20} />
          </button>
        </div>

        {!config.partnerEmail ? (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-black/5 flex flex-col gap-6">
             <div className="flex items-center gap-6">
               <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center shrink-0">
                 <Users size={24} />
               </div>
               <div className="flex-1">
                 <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-1">DODAJ SAGOVORNIKA</p>
                 <p className="text-sm font-medium text-primary-dark/40">Unesi email osobe sa kojom želiš razgovor</p>
               </div>
             </div>
             <div className="flex gap-2">
               <input 
                 type="email"
                 placeholder="email@primer.com"
                 className="flex-1 bg-page-bg border-2 border-transparent rounded-2xl px-4 py-3 text-sm font-bold focus:border-accent-red outline-none transition-all"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     const email = e.currentTarget.value;
                     if (email.includes('@')) {
                       setConfig({ ...config, partnerEmail: email });
                     }
                   }
                 }}
               />
               <button 
                 onClick={(e) => {
                   const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                   if (input.value.includes('@')) {
                     setConfig({ ...config, partnerEmail: input.value });
                   } else {
                     alert('Unesite ispravan email.');
                   }
                 }}
                 className="bg-primary-dark text-white px-6 rounded-2xl text-xs font-black uppercase hover:bg-black transition-all"
               >
                 OK
               </button>
             </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6 border border-black/5 relative group">
            <div className="w-12 h-12 bg-[#008080]/10 text-[#008080] rounded-full flex items-center justify-center shrink-0">
              <UserIcon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-1">SAGOVORNIK</p>
              <p className="text-xl font-bold text-primary-dark truncate">{config.partnerEmail.split('@')[0]}</p>
              <p className="text-sm font-medium text-primary-dark/40 truncate">{config.partnerEmail}</p>
            </div>
            <div className="flex gap-2 text-primary-dark/20">
              <button 
                onClick={onOpenSettings} 
                className="p-2 hover:text-primary-dark transition-colors"
                title="Izmeni"
              >
                <SettingsIcon size={20} />
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Ukloni ovog sagovornika?')) {
                    setConfig({ ...config, partnerEmail: '' });
                  }
                }} 
                className="p-2 hover:text-accent-red transition-colors"
                title="Obriši"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={onJoin}
        className="w-full bg-primary-dark text-white py-6 rounded-[2rem] text-xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-xl"
      >
        Otvori razgovor
        <div className="w-5 h-5 flex items-center justify-center border-2 border-white rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full translate-x-px" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
        </div>
      </button>
      
      <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm mt-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center">
            <QrCode size={20} />
          </div>
          <h2 className="text-xl font-bold">Pozovi sagovornika</h2>
        </div>
        <p className="text-sm font-medium text-primary-dark/40 mb-6">
          Podeli ovaj link ili QR kod sa drugom osobom da se pridruži ovom razgovoru.
        </p>
        <div className="flex flex-col items-center gap-6 p-6 bg-page-bg/50 rounded-2xl">
          <QRCodeSVG 
            value={`${window.location.origin}${window.location.pathname}?session=RAZGOVOR`}
            size={160}
            level="H"
            includeMargin={true}
          />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?session=RAZGOVOR`);
            }}
            className="flex items-center gap-2 text-sm font-black uppercase text-accent-red hover:opacity-80 transition-all"
          >
            <Copy size={16} />
            Kopiraj link za pristup
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-sm font-medium text-primary-dark/40 max-w-xs mx-auto">
        Naloge upamtimo lokalno. Sledeći put kad otvoriš app, razgovor je automatski aktivan.
      </p>
    </motion.div>
  );
};

const Settings = ({ config, setConfig, onBack }: { config: AppConfig; setConfig: any; onBack: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-xl mx-auto px-6 py-8"
    >
      <div className="flex items-center gap-4 mb-12">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-3xl font-black text-primary-dark tracking-tight">Podešavanja</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-1">PISMO</p>
              <h2 className="text-xl font-bold">Latinica</h2>
              <p className="text-sm font-medium text-primary-dark/40">Promeni način prikaza teksta</p>
            </div>
            <button 
              onClick={() => setConfig({ ...config, isCyrillic: !config.isCyrillic })}
              className={`w-14 h-8 rounded-full transition-colors relative ${config.isCyrillic ? 'bg-accent-red' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${config.isCyrillic ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="bg-page-bg p-6 rounded-2xl">
            <p className={`text-xl font-bold ${config.isCyrillic ? 'font-serif' : ''}`}>
              {config.isCyrillic ? toCyrillic("Zdravo, kako si danas?") : "Zdravo, kako si danas?"}
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-2">VELIČINA TEKSTA</p>
          <div className="relative h-12 flex items-center px-2">
            <div className="absolute inset-x-2 h-2 bg-gray-100 rounded-full overflow-hidden">
               <div className="h-full bg-accent-red transition-all" style={{ width: `${((config.textSize - 0.8) / 1.2) * 100}%` }} />
            </div>
            <input 
              type="range" 
              min="0.8" 
              max="2.0" 
              step="0.05"
              value={config.textSize}
              onChange={(e) => setConfig({ ...config, textSize: parseFloat(e.target.value) })}
              className="absolute inset-x-0 h-full opacity-0 cursor-pointer z-10"
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-red z-0 rounded-full" style={{ left: `${((config.textSize - 0.8) / 1.2) * 100}%` }} />
          </div>
          <p className="text-sm font-bold text-primary-dark/40 mt-4">x{config.textSize.toFixed(2)}</p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-4">TVOJE IME</p>
          <input 
            type="text" 
            value={config.myName}
            onChange={(e) => setConfig({ ...config, myName: e.target.value })}
            className="w-full text-xl font-bold bg-transparent border-2 border-gray-100 rounded-2xl p-4 focus:border-accent-red outline-none transition-all"
            placeholder="Vaše ime"
          />
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-4">SAGOVORNIK</p>
          <input 
            type="email" 
            value={config.partnerEmail}
            onChange={(e) => setConfig({ ...config, partnerEmail: e.target.value })}
            className="w-full text-xl font-bold bg-transparent border-2 border-gray-100 rounded-2xl p-4 focus:border-[#008080] outline-none transition-all"
            placeholder="Email sagovornika"
          />
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
            <p className="text-[10px] font-black text-primary-dark/30 uppercase tracking-widest mb-2">O APLIKACIJI</p>
            <p className="text-base font-bold text-primary-dark/60 leading-relaxed">
              Razgovor pomaže nagluvim i čujućim osobama da komuniciraju u realnom vremenu. Govor se prepoznaje na uređaju, a tekst se trenutno deli sa sagovornikom u istoj sobi.
            </p>
        </div>
      </div>
    </motion.div>
  );
};

const HistoryView = ({ config, onBack }: { config: AppConfig; onBack: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'sessions', 'RAZGOVOR', 'messages'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const displayText = (text: string | null | undefined) => {
    if (!text) return '';
    return config.isCyrillic ? toCyrillic(text) : text;
  };

  const groupedByDay = useRef<Record<string, Message[]>>({});
  
  // Update groupings whenever messages change
  const currentGroups = messages.reduce((acc, msg) => {
    if (!msg.timestamp) return acc;
    const date = new Date(msg.timestamp.seconds * 1000);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const label = new Intl.DateTimeFormat('sr-RS', options).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const sortedDays = Object.keys(currentGroups).sort((a, b) => b.localeCompare(a));

  const downloadTranscripts = (day: string) => {
    const dayMessages = currentGroups[day].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    const content = dayMessages.map(m => {
      const time = m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const text = displayText(m.text);
      return `[${time}] ${m.senderName}: ${text}`;
    }).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Razgovor-${day}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = async () => {
    if (!window.confirm('Da li ste sigurni da želite da obrišete kompletnu istoriju razgovora?')) return;
    
    try {
      setLoading(true);
      const q = query(collection(db, 'sessions', 'RAZGOVOR', 'messages'));
      const snapshot = await getDoc(doc(db, 'sessions', 'RAZGOVOR')); // This is just to check
      // For simplicity in Firestore with limited tools, we delete the known messages
      for (const msg of messages) {
        await deleteDoc(doc(db, 'sessions', 'RAZGOVOR', 'messages', msg.id));
      }
      alert('Istorija je obrisana.');
    } catch (err) {
      console.error('Greška pri brisanju:', err);
      alert('Greška pri brisanju istorije.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="max-w-2xl mx-auto px-6 py-8 min-h-screen flex flex-col"
    >
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button 
            onClick={selectedDate ? () => setSelectedDate(null) : onBack} 
            className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-black text-primary-dark tracking-tight">
            {selectedDate ? formatDateLabel(selectedDate) : 'Istorija'}
          </h1>
        </div>
        <div className="flex gap-2">
          {selectedDate && (
            <button 
              onClick={() => downloadTranscripts(selectedDate)}
              className="flex items-center gap-2 bg-accent-red text-white px-4 py-2 rounded-full text-xs font-black uppercase hover:bg-black transition-all shadow-lg active:scale-95"
            >
              Preuzmi
            </button>
          )}
          {!selectedDate && messages.length > 0 && (
            <button 
              onClick={clearHistory}
              className="p-3 bg-gray-100 text-gray-400 hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-all"
              title="Obriši sve"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-accent-red border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Clock size={32} className="text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-400">Nema sačuvanih razgovora</p>
        </div>
      ) : !selectedDate ? (
        <div className="space-y-4">
          {sortedDays.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDate(day)}
              className="w-full bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="text-left">
                <p className="text-[10px] font-black text-accent-red uppercase tracking-widest mb-1">DAN</p>
                <p className="text-2xl font-black text-primary-dark tracking-tight">{formatDateLabel(day)}</p>
                <p className="text-sm font-bold text-gray-400 mt-1">{currentGroups[day].length} poruka</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-page-bg flex items-center justify-center text-primary-dark/20 group-hover:text-accent-red transition-colors">
                <ChevronLeft size={24} className="rotate-180" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6 pb-20">
          {currentGroups[selectedDate].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)).map((m) => (
            <div key={m.id} className="group bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
               <div className="flex justify-between items-start mb-3">
                 <div className="flex flex-col">
                   <p className="text-[10px] font-black text-accent-red uppercase tracking-widest">{m.senderName}</p>
                   <p className="text-[10px] font-bold text-gray-400">
                     {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                   </p>
                 </div>
                 <button 
                   onClick={async () => {
                     if (window.confirm('Obriši ovu poruku?')) {
                       await deleteDoc(doc(db, 'sessions', 'RAZGOVOR', 'messages', m.id));
                     }
                   }}
                   className="p-2 text-gray-200 hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
               <p 
                 className="text-lg font-bold text-primary-dark leading-snug"
                 style={{ fontSize: `${config.textSize * 1.1}rem` }}
               >
                 {displayText(m.text)}
               </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
}

const LiveSession = ({ sessionId, user, onExit, config, onOpenSettings, onOpenHistory }: { sessionId: string; user: User; onExit: () => void; config: AppConfig; onOpenSettings: () => void; onOpenHistory: () => void }) => {
  const isNative = Capacitor.isNativePlatform();
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscripts, setLiveTranscripts] = useState<Record<string, any>>({});
  
  // Refs for buffering logic
  const sessionBufferRef = useRef<string>('');
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [participants, setParticipants] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const commitSegment = useCallback(async (textToCommit: string) => {
    if (!textToCommit.trim() || !sessionId || !user) return;
    try {
      const myName = config.myName || user.displayName || user.email?.split('@')[0] || 'Anonim';
      const sessionRef = doc(db, 'sessions', sessionId);
      
      await addDoc(collection(sessionRef, 'messages'), {
        text: textToCommit,
        senderId: user.uid,
        senderName: myName,
        timestamp: serverTimestamp()
      });

      // Zadržavamo tekst na ekranu još 30 sekundi nakon što ode u istoriju
      setTimeout(async () => {
        if (sessionBufferRef.current.trim() === textToCommit.trim()) {
           sessionBufferRef.current = '';
           await updateDoc(sessionRef, {
             [`liveTranscripts.${user.uid}`]: deleteField()
           });
        }
      }, 30000); 
    } catch (err) {
       console.error('Commit error:', err);
    }
  }, [sessionId, user, config.myName]);

  const onTranscriptResult = useCallback(async (text: string, isFinal: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    
    // Na Androidu (Native), svako novo javljanje nakon pauze je novi "segment".
    const currentBuffer = sessionBufferRef.current.trim();
    let updatedText = trimmed;

    if (isNative && currentBuffer) {
      const words = currentBuffer.split(/\s+/);
      const lastThree = words.slice(-3).join(' ').toLowerCase();
      if (lastThree && !trimmed.toLowerCase().includes(lastThree)) {
        updatedText = `${currentBuffer} ${trimmed}`;
      }
    }
    
    sessionBufferRef.current = updatedText;

    // SIMULTANI UPIS: Nadograđujemo 'liveTranscripts' odmah
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const myName = config.myName || user.displayName || user.email?.split('@')[0] || 'Anonim';
      await setDoc(sessionRef, {
        liveTranscripts: {
          [user.uid]: {
            text: updatedText,
            senderId: user.uid,
            senderName: myName,
            updatedAt: Date.now()
          }
        }
      }, { merge: true });
    } catch (e) {}

    // AUTOMATSKI KOMIT u istoriju ako postane predugačko
    const wordCount = updatedText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 25) {
       commitSegment(updatedText);
    }

    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => {
      commitSegment(sessionBufferRef.current);
    }, 4000); 
  }, [sessionId, user, config.myName, isNative, commitSegment]);

  const { isListening, isRecognitionActive, start, stop, error } = useSpeechToText({
    lang: 'sr-RS',
    onResult: onTranscriptResult
  });

  const handleStop = useCallback(async () => {
    stop();
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    
    const textToCommit = sessionBufferRef.current.trim();
    if (textToCommit) {
      const myName = config.myName || user.displayName || user.email?.split('@')[0] || 'Anonim';
      const sessionRef = doc(db, 'sessions', sessionId);
      
      sessionBufferRef.current = '';
      
      try {
        await addDoc(collection(sessionRef, 'messages'), {
          text: textToCommit,
          senderId: user.uid,
          senderName: myName,
          timestamp: serverTimestamp()
        });
        await updateDoc(sessionRef, {
          [`liveTranscripts.${user.uid}`]: deleteField()
        });
      } catch (err) {
        console.error("Error committing on stop:", err);
      }
    }
  }, [stop, user, sessionId, config.myName]);


  useEffect(() => {
    console.log("LiveSession rendering for:", sessionId);
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, liveTranscripts]);


  useEffect(() => {
    const sessionRef = doc(db, 'sessions', sessionId);
    let isMounted = true;
    
    const initSession = async () => {
      try {
        const myName = user.displayName || user.email?.split('@')[0] || 'Anonim';
        await setDoc(sessionRef, {
          id: sessionId,
          participants: { [user.uid]: myName }
        }, { merge: true });
      } catch (e) {}
    };
    initSession();

    const unsubSession = onSnapshot(sessionRef, (snap) => {
      const data = snap.data();
      if (isMounted && data) {
        if (data.participants) setParticipants(data.participants);
        if (data.liveTranscripts) {
          setLiveTranscripts(data.liveTranscripts);
        } else {
          setLiveTranscripts((prev) => Object.keys(prev).length === 0 ? prev : {});
        }
      }
    }, (err) => {
      console.error("Session snapshot error:", err);
    });

    const q = query(collection(sessionRef, 'messages'), orderBy('timestamp', 'asc'));
    const unsubMessages = onSnapshot(q, (snap) => {
      if (isMounted) setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });

    return () => {
      isMounted = false;
      unsubMessages();
      unsubSession();
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    };
  }, [sessionId, user]);

  const displayText = (text: string | null | undefined) => {
    if (!text) return '';
    return config.isCyrillic ? toCyrillic(text) : text;
  };

  // --- Main Render ---

  const deleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId, 'messages', msgId));
    } catch (e) {
      console.error('Greška pri brisanju poruke:', e);
    }
  };

  const hasContent = messages.length > 0 || Object.values(liveTranscripts).some((t: any) => t?.text);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-screen bg-page-bg overflow-hidden text-primary-dark font-sans"
    >
      {/* Top Handle bar (visual only) */}
      <div className="w-12 h-1 bg-gray-400/30 rounded-full mx-auto mt-2" />

      {/* Header */}
      <div className="p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 text-primary-dark/80 hover:bg-black/5 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-extrabold tracking-tight">Soba {sessionId}</h2>
            <div className="flex items-center gap-1.5 leading-none">
              <div className="w-2 h-2 bg-[#008080] rounded-full" />
              <span className="text-xs font-bold text-gray-500">Uživo</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <button onClick={onOpenHistory} className="p-2 text-primary-dark/80 hover:bg-black/5 rounded-full transition-colors" title="Istorija">
            <History size={24} />
          </button>
          <button onClick={onOpenSettings} className="p-2 text-primary-dark/80 hover:bg-black/5 rounded-full transition-colors" title="Podešavanja">
            <SettingsIcon size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 flex flex-col items-center custom-scrollbar relative">
        {!hasContent && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center max-w-sm"
          >
            <div className="w-24 h-24 bg-accent-red/10 rounded-full flex items-center justify-center mb-8">
              <Mic size={32} className="text-accent-red" />
            </div>
            <h3 className="text-3xl font-extrabold mb-4">Spremno za razgovor</h3>
            <p className="text-gray-500 font-bold leading-relaxed">
              Pritisni mikrofon da počneš da pričaš. Tvoj govor se vidi i kod tebe i kod sagovornika u realnom vremenu.
            </p>
          </motion.div>
        )}

        <div className="w-full max-w-4xl">
          {messages.map((m) => {
            const isMe = m.senderId === user.uid;
            return (
              <div key={m.id} className={`group mb-12 flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-start gap-4 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div 
                    className={`
                      flex-1 p-1 rounded-3xl font-extrabold leading-[1.1] tracking-tight
                      ${isMe ? 'text-right' : 'text-left'}
                    `}
                    style={{ fontSize: `${config.textSize * 2.5}rem` }}
                  >
                    {displayText(m.text)}
                  </div>
                  <button 
                    onClick={() => deleteMessage(m.id)}
                    className="mt-4 p-2 text-primary-dark/5 hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100"
                    title="Obriši"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="mt-4 text-[10px] font-black text-primary-dark/20 uppercase tracking-[0.2em]">
                  {m.senderName} • {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </p>
              </div>
            );
          })}

          {/* Live transcripts */}
          {Object.entries(liveTranscripts).map(([uid, data]: [string, any]) => {
            const isMe = uid === user.uid;
            if (!data?.text) return null;
            
            // Provera da li je ovaj text već u listi poslednjih poruka
            const alreadyInMessages = messages.slice(-1).some(m => 
              m.text.toLowerCase().trim() === data.text.toLowerCase().trim()
            );
            if (alreadyInMessages) return null;

            // Povećavamo vreme vidljivosti na 60 sekundi da bi korisnik mogao da pročita
            const isStale = Date.now() - (data.updatedAt || 0) > 60000;
            if (isStale) return null;

            return (
              <motion.div
                key={`live-${uid}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-4 mb-24 last:mb-60 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`font-black leading-[1.1] tracking-tight ${isMe ? 'text-primary-dark/60' : 'text-[#008080]'}`}
                  style={{ fontSize: `${config.textSize * 3.2}rem` }}
                >
                  {displayText(data.text)}
                  <span className={`inline-block w-[0.1em] h-[0.8em] ml-[0.1em] ${isMe ? 'bg-primary-dark/20' : 'bg-[#008080]/30'} animate-pulse align-middle`} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className={`w-2 h-2 ${isMe ? 'bg-primary-dark/20' : 'bg-[#008080]'} rounded-full animate-ping`} />
                  <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${isMe ? 'text-primary-dark/20' : 'text-[#008080]/50'}`}>
                    {isMe ? 'TI GOVORIŠ' : `${data.senderName} GOVORI SADA`}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} className="h-60" />
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] px-8 py-6 flex items-center justify-between z-20">
        <div className="flex flex-col">
          <p className="text-2xl font-black tracking-tight">
            {isListening ? 'Govori sada' : 'Tap da govoriš'}
          </p>
          <p className="text-sm font-bold text-gray-400">
            {isListening ? 'Mikrofon je aktivan' : 'Mikrofon je isključen'}
          </p>
        </div>

        <button 
          onClick={isListening ? handleStop : start}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl ${
            isListening 
            ? 'bg-[#22c55e] text-white shadow-[#22c55e]/30' 
            : 'bg-[#ef4444] text-white shadow-[#ef4444]/20'
          }`}
        >
          <Mic size={36} />
        </button>
      </div>

      {/* Floating Error Bar (if any) */}
      {error && (
        <div className="fixed bottom-36 left-0 w-full px-6 pointer-events-none">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-md mx-auto pointer-events-auto bg-white p-4 rounded-2xl shadow-2xl border-4 border-accent-red flex flex-col gap-2">
            <p className="text-accent-red text-xs font-black uppercase leading-tight text-center">{error}</p>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

interface AppConfig {
  textSize: number;
  isCyrillic: boolean;
  myName: string;
  partnerEmail: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'session' | 'settings' | 'history'>('dashboard');
  
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('razgovor_config');
    return saved ? JSON.parse(saved) : {
      textSize: 1.15,
      isCyrillic: false,
      myName: '',
      partnerEmail: 'rackovic.vera@gmail.com'
    };
  });

  useEffect(() => {
    localStorage.setItem('razgovor_config', JSON.stringify(config));
  }, [config]);

  const isLoggingIn = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('session');
    if (sessionFromUrl) {
      setCurrentSession(sessionFromUrl.toUpperCase());
      setView('session');
    }

    console.log("App mounted, setting up auth...");
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("Auth state changed:", u ? `User present: ${u.uid} (Anonymous: ${u.isAnonymous})` : "No user");
      
      if (!u) {
        if (isLoggingIn.current) {
          console.log("Already attempting login, skipping...");
          return;
        }
        
        try {
          isLoggingIn.current = true;
          console.log("Attempting anonymous login...");
          await loginAnonymously();
          console.log("Anonymous login successful");
          isLoggingIn.current = false;
        } catch (err: any) {
          console.error("Critical Auth error:", err);
          setAuthError(err.message || String(err));
          setLoading(false);
          isLoggingIn.current = false;
        }
      } else {
        setUser(u);
        setAuthError(null);
        if (!config.myName) {
          const defaultName = u.displayName || (u.isAnonymous ? 'Ja' : u.email?.split('@')[0]) || 'Ja';
          setConfig(prev => ({ ...prev, myName: defaultName }));
        }
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  if (authError) return (
    <div className="flex flex-col items-center justify-center h-screen bg-page-bg px-6 text-center">
      <div className="w-16 h-16 bg-accent-red/10 text-accent-red rounded-full flex items-center justify-center mb-6">
        <X size={32} />
      </div>
      <h2 className="text-xl font-black text-primary-dark mb-4">GREŠKA PRI PRIJAVI</h2>
      <p className="text-gray-500 font-medium mb-8 leading-relaxed max-w-sm">
        Aplikacija nije uspela da se prijavi anonimno. Proverite da li je Anonymous auth omogućen u Firebase konzoli.
      </p>
      <div className="bg-white p-4 rounded-xl border border-black/5 text-xs font-mono text-accent-red mb-8 w-full overflow-auto max-h-32">
        {authError}
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-4 bg-primary-dark text-white rounded-full font-bold shadow-lg active:scale-95 transition-all"
      >
        Pokušaj ponovo
      </button>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-page-bg px-6 text-center">
      <div className="w-16 h-16 border-4 border-accent-red border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-black uppercase text-primary-dark/40 tracking-widest animate-pulse">Inicijalizacija...</p>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen bg-page-bg px-6 text-center">
      <div className="w-16 h-16 border-4 border-accent-red border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-black uppercase text-primary-dark/40 tracking-widest">Priprema korisnika...</p>
    </div>
  );

  const handleJoin = () => {
    setCurrentSession("RAZGOVOR");
    setView('session');
  };

  return (
    <div className="min-h-screen bg-page-bg font-sans selection:bg-indigo-100">
      <AnimatePresence mode="wait">
        {view === 'history' ? (
          <HistoryView 
            config={config}
            onBack={() => setView('dashboard')}
          />
        ) : view === 'settings' ? (
          <Settings 
            config={config} 
            setConfig={setConfig} 
            onBack={() => setView(currentSession ? 'session' : 'dashboard')} 
          />
        ) : view === 'session' && currentSession ? (
          <LiveSession 
            sessionId={currentSession} 
            user={user} 
            config={config}
            onExit={() => {
              setCurrentSession(null);
              setView('dashboard');
            }}
            onOpenSettings={() => setView('settings')}
            onOpenHistory={() => setView('history')}
          />
        ) : (
          <Dashboard 
            user={user} 
            config={config}
            onJoin={handleJoin} 
            onOpenSettings={() => setView('settings')}
            onOpenHistory={() => setView('history')}
            setConfig={setConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
