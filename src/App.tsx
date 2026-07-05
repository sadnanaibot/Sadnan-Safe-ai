import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut, Shield, Save, AlertCircle, Send, Users, MessageSquare, Plus, Menu, X, Download, BarChart2, Sparkles, Volume2, File as FileIcon, Image as ImageIcon, Paperclip } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Role = 'guest' | 'user' | 'admin';
type ChatMessage = { role: 'user' | 'ai', text: string, attachments?: {name: string, data: string, mimeType: string}[] };
type ChatSession = { id: string, title: string, history: ChatMessage[] };
type AccentColor = 'orange' | 'blue' | 'purple' | 'emerald';

const getAccentColorClasses = (color: AccentColor) => {
    switch (color) {
        case 'blue': return { text: 'text-blue-500', bg: 'bg-blue-600', hoverBg: 'hover:bg-blue-500', shadow: 'shadow-blue-600/20', from: 'from-blue-500', to: 'to-indigo-600', ring: 'focus:ring-blue-500', border: 'focus:border-blue-500' };
        case 'purple': return { text: 'text-purple-500', bg: 'bg-purple-600', hoverBg: 'hover:bg-purple-500', shadow: 'shadow-purple-600/20', from: 'from-purple-500', to: 'to-fuchsia-600', ring: 'focus:ring-purple-500', border: 'focus:border-purple-500' };
        case 'emerald': return { text: 'text-emerald-500', bg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-500', shadow: 'shadow-emerald-600/20', from: 'from-emerald-500', to: 'to-teal-600', ring: 'focus:ring-emerald-500', border: 'focus:border-emerald-500' };
        case 'orange':
        default:
            return { text: 'text-orange-500', bg: 'bg-orange-600', hoverBg: 'hover:bg-orange-500', shadow: 'shadow-orange-600/20', from: 'from-orange-500', to: 'to-red-600', ring: 'focus:ring-orange-500', border: 'focus:border-orange-500' };
    }
};

const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (parts.length === 0) return '< 1m';
    return parts.join(' ');
};

export default function App() {
  const [role, setRole] = useState<Role>('guest');
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<{name: string, data: string, mimeType: string}[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(8000);
  const [settingsStatus, setSettingsStatus] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState<AccentColor>('blue');
  const accentClasses = getAccentColorClasses(accentColor);
  const [showStats, setShowStats] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [serverUptime, setServerUptime] = useState<number | null>(null);

  useEffect(() => {
      const fetchUptime = async () => {
          try {
              const res = await fetch('/api/uptime');
              const data = await res.json();
              if (data.uptime) {
                  setServerUptime(data.uptime);
              }
          } catch (e) {
              console.error(e);
          }
      };
      if (token) {
          fetchUptime();
          const interval = setInterval(fetchUptime, 60000);
          return () => clearInterval(interval);
      }
  }, [token]);

  const toggleSpeech = (text: string, idx: number) => {
      if (speakingIdx === idx) {
          window.speechSynthesis.cancel();
          setSpeakingIdx(null);
      } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setSpeakingIdx(null);
          window.speechSynthesis.speak(utterance);
          setSpeakingIdx(idx);
      }
  };

  // Mock data for charts
  const mockChartData = useMemo(() => {
      const data = [];
      let currentUsers = 15;
      let currentMsgs = 50;
      for (let i = 30; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          data.push({
              name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              users: currentUsers,
              messages: currentMsgs
          });
          currentUsers += Math.floor(Math.random() * 5) - 1;
          currentMsgs += Math.floor(Math.random() * 20) - 5;
          if (currentUsers < 5) currentUsers = 5;
          if (currentMsgs < 10) currentMsgs = 10;
      }
      return data;
  }, []);

  const allAttachments = useMemo(() => {
      const atts: {name: string, mimeType: string, sessionId: string}[] = [];
      chatSessions.forEach(session => {
          session.history.forEach(msg => {
              if (msg.attachments) {
                  msg.attachments.forEach(att => {
                      atts.push({ name: att.name, mimeType: att.mimeType, sessionId: session.id });
                  });
              }
          });
      });
      return atts;
  }, [chatSessions]);

  // Load from local storage
  useEffect(() => {
    if (username) {
      const saved = localStorage.getItem(`beast-ai-sessions-${username}`);
      if (saved) {
        try {
          setChatSessions(JSON.parse(saved));
        } catch(e) {}
      }
    }
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  useEffect(() => {
    if (role === 'admin' && token) {
      fetch(`/api/admin/settings`, { headers: { token } })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSystemPrompt(data.systemPrompt);
            setMaxTokens(data.maxTokens);
            setRestrictionsEnabled(data.restrictionsEnabled);
          }
        });
        
      fetchUsers();
    }
  }, [role, token]);
  
  const fetchUsers = async () => {
      try {
          const res = await fetch(`/api/admin/users`, { headers: { token: token || '' } });
          const data = await res.json();
          if (data.success) setAllUsers(data.users);
      } catch(e) {}
  };


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setRegisteredSuccess(false);
    
    try {
      if (isRegistering) {
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, phone }),
          });
          const data = await res.json();
          if (data.success) {
              setRegisteredSuccess(true);
              setIsRegistering(false);
              setPassword('');
          } else {
              setLoginError(data.message || 'Registration failed');
          }
      } else {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (data.success) {
            setRole(data.role);
            setToken(data.token);
            setUsername(data.username);
            setPassword('');
            setPhone('');
          } else {
            setLoginError(data.message || 'Login failed');
          }
      }
    } catch (err) {
      setLoginError('Network error');
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setToken(null);
    setChatHistory([]);
    setChatSessions([]);
    setCurrentSessionId(null);
    setShowSettings(false);
    setShowUsers(false);
    setUsername('');
  };

  const updateSessionInStorage = (id: string, newTitle: string | null, newHistory: ChatMessage[]) => {
    setChatSessions(prev => {
      const existing = prev.find(s => s.id === id);
      let updatedSessions;
      if (existing) {
        updatedSessions = prev.map(s => s.id === id ? { ...s, history: newHistory } : s);
      } else {
        updatedSessions = [{ id, title: newTitle || 'New Chat', history: newHistory }, ...prev];
      }
      localStorage.setItem(`beast-ai-sessions-${username}`, JSON.stringify(updatedSessions));
      return updatedSessions;
    });
  };

  const loadSession = (id: string) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(session.id);
      setChatHistory(session.history);
      setShowSettings(false);
      setShowUsers(false);
      setShowMobileSidebar(false);
    }
  };

  const createNewSession = () => {
    setCurrentSessionId(null);
    setChatHistory([]);
    setShowSettings(false);
    setShowUsers(false);
    setShowStats(false);
    setShowMobileSidebar(false);
  };

  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);

  const exportSession = async (sessionId: string) => {
    setExportingSessionId(sessionId);
    // Give react time to render the hidden container
    setTimeout(async () => {
        const el = document.getElementById('pdf-export-container');
        if (el) {
            try {
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0F1219' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [canvas.width / 2, canvas.height / 2]
                });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
                const session = chatSessions.find(s => s.id === sessionId);
                const title = session ? session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'session';
                pdf.save(`chat-${title}.pdf`);
            } catch (err) {
                console.error("PDF generation failed", err);
            }
        }
        setExportingSessionId(null);
    }, 1000); // 1s timeout to allow fonts and images to load
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setAttachments(prev => [...prev, {
                name: file.name,
                data: base64String,
                mimeType: file.type
            }]);
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() && attachments.length === 0) return;

    const currentPrompt = prompt;
    const currentAttachments = [...attachments];
    setPrompt('');
    setAttachments([]);

    let activeSessionId = currentSessionId;
    let isNewSession = false;
    if (!activeSessionId) {
        activeSessionId = Date.now().toString();
        setCurrentSessionId(activeSessionId);
        isNewSession = true;
    }

    let userText = currentPrompt;
    if (replyingTo) {
        userText = `> Replying to: "${replyingTo.text.substring(0, 50)}..."\n\n${userText}`;
        setReplyingTo(null);
    }
    
    if (currentAttachments.length > 0) {
        userText += `\n[Attached ${currentAttachments.length} file(s)]`;
    }

    const newUserMsg: ChatMessage = { role: 'user', text: userText };
    setChatHistory(prev => {
        const updated = [...prev, newUserMsg];
        updateSessionInStorage(activeSessionId, isNewSession ? (currentPrompt || 'New Chat') : null, updated);
        return updated;
    });
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt, token, attachments: currentAttachments }),
      });
      const data = await res.json();
      
      if (data.limitReached) {
          setLimitReached(true);
          setIsTyping(false);
          return;
      }
      
      if (data.error) {
           const errMsg: ChatMessage = { role: 'ai', text: `Error: ${data.error}` };
           setChatHistory(prev => {
               const updated = [...prev, errMsg];
               updateSessionInStorage(activeSessionId, isNewSession ? currentPrompt : null, updated);
               return updated;
           });
      } else {
           const aiMsg: ChatMessage = { role: 'ai', text: data.text };
           setChatHistory(prev => {
               const updated = [...prev, aiMsg];
               updateSessionInStorage(activeSessionId, isNewSession ? currentPrompt : null, updated);
               return updated;
           });
      }
    } catch (err) {
      const connErrMsg: ChatMessage = { role: 'ai', text: 'Error connecting to the server.' };
      setChatHistory(prev => {
          const updated = [...prev, connErrMsg];
          updateSessionInStorage(activeSessionId, isNewSession ? currentPrompt : null, updated);
          return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus('Saving...');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'token': token || ''
        },
        body: JSON.stringify({ systemPrompt, maxTokens, restrictionsEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsStatus('Settings saved successfully!');
        setTimeout(() => setSettingsStatus(''), 3000);
      } else {
        setSettingsStatus('Failed to save settings.');
      }
    } catch (err) {
      setSettingsStatus('Error saving settings.');
    }
  };

  if (role === 'guest') {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center p-4 font-sans text-slate-200">
        <div className="w-full max-w-md bg-[#0F1219] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-slate-900/50 border-b border-slate-800">
            <div className={`w-16 h-16 bg-gradient-to-tr ${accentClasses.from} ${accentClasses.to} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${accentClasses.shadow}`}>
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">SADNAN SAFE <span className={accentClasses.text}>AI</span></h1>
            <p className="text-slate-400 text-sm">Enter the domain</p>
          </div>
          <form onSubmit={handleAuth} className="p-8 space-y-6">
            {loginError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl text-sm border border-red-400/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{loginError}</p>
              </div>
            )}
            {registeredSuccess && !isRegistering && (
                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-xl text-sm border border-green-400/20">
                <p>Registration successful! You may now login.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full bg-[#0B0E14] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 ${accentClasses.ring} ${accentClasses.border} transition-all placeholder:text-slate-700`}
                placeholder="Enter username"
                required
              />
            </div>
            {isRegistering && (
                <div>
                  <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full bg-[#0B0E14] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 ${accentClasses.ring} ${accentClasses.border} transition-all placeholder:text-slate-700`}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-[#0B0E14] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 ${accentClasses.ring} ${accentClasses.border} transition-all placeholder:text-slate-700`}
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              className={`w-full ${accentClasses.bg} ${accentClasses.hoverBg} text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg ${accentClasses.shadow} uppercase tracking-widest text-sm flex items-center justify-center`}
            >
              {isRegistering ? 'Register' : 'Initialize Connection'}
            </button>
            <div className="text-center mt-4">
                <button 
                    type="button" 
                    onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setRegisteredSuccess(false); }}
                    className={`text-xs text-slate-400 hover:${accentClasses.text} transition-colors uppercase tracking-wider`}
                >
                    {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
                </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0B0E14] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar Overlay */}
      {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 bg-black/80 z-40" onClick={() => setShowMobileSidebar(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 w-64 bg-[#0F1219] border-r border-slate-800 flex flex-col shrink-0 z-50 transform transition-transform duration-300 ease-in-out ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <button onClick={() => setShowMobileSidebar(false)} className="md:hidden absolute top-6 right-4 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
        </button>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className={`w-10 h-10 bg-gradient-to-tr ${accentClasses.from} ${accentClasses.to} rounded-lg flex items-center justify-center shadow-lg ${accentClasses.shadow} shrink-0`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">SADNAN SAFE <span className={accentClasses.text}>AI</span></h1>
          </div>
          
          <nav className="space-y-1">
            <button onClick={() => { setShowSettings(false); setShowUsers(false); setShowStats(false); setShowMobileSidebar(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${!showSettings && !showUsers && !showStats ? `bg-slate-800/50 ${accentClasses.text} border border-slate-700/50` : 'text-slate-400 hover:bg-slate-800/30 hover:text-white border border-transparent'}`}>
              <span className="mr-3">⚡</span> Neural Terminal
            </button>
            {role === 'admin' && (
              <>
                <button onClick={() => { setShowSettings(true); setShowUsers(false); setShowStats(false); setShowMobileSidebar(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${showSettings ? `bg-slate-800/50 ${accentClasses.text} border border-slate-700/50` : 'text-slate-400 hover:bg-slate-800/30 hover:text-white border border-transparent'}`}>
                  <span className="mr-3">🛡️</span> Restrictions Control
                </button>
                <button onClick={() => { setShowUsers(true); setShowSettings(false); setShowStats(false); setShowMobileSidebar(false); fetchUsers(); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${showUsers ? `bg-slate-800/50 ${accentClasses.text} border border-slate-700/50` : 'text-slate-400 hover:bg-slate-800/30 hover:text-white border border-transparent'}`}>
                  <span className="mr-3">👥</span> User Management
                </button>
                <button onClick={() => { setShowStats(true); setShowUsers(false); setShowSettings(false); setShowMobileSidebar(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${showStats ? `bg-slate-800/50 ${accentClasses.text} border border-slate-700/50` : 'text-slate-400 hover:bg-slate-800/30 hover:text-white border border-transparent'}`}>
                  <span className="mr-3">📊</span> Usage Statistics
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-1 pb-4">
            <div className="px-2 mb-4">
                 <button onClick={createNewSession} className="w-full flex items-center justify-center space-x-2 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">
                     <Plus className="w-4 h-4" /> <span>New Chat</span>
                 </button>
            </div>
            <div className="px-2 mb-4">
                 <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sessions..."
                    className={`w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 ${accentClasses.ring} placeholder:text-slate-600`}
                 />
            </div>
            {chatSessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map((s) => (
                 <div key={s.id} className="relative group">
                     <button onClick={() => loadSession(s.id)} className={`w-full flex items-center px-3 py-2 rounded-lg transition-all ${currentSessionId === s.id && !showSettings && !showUsers && !showStats ? 'bg-slate-800/50 text-white border border-slate-700/50' : 'text-slate-400 hover:bg-slate-800/30 hover:text-white border border-transparent'} text-left pr-8`}>
                         <MessageSquare className="w-4 h-4 mr-3 shrink-0" />
                         <span className="truncate text-xs">{s.title}</span>
                     </button>
                     <button onClick={() => exportSession(s.id)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:${accentClasses.text} opacity-0 group-hover:opacity-100 transition-opacity`} title="Export Session">
                        <Download className="w-3 h-3" />
                     </button>
                 </div>
             ))}

             {allAttachments.length > 0 && (
                 <div className="mt-8 px-2">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Attachments</p>
                     <div className="space-y-1">
                         {allAttachments.slice(0, 10).map((att, i) => (
                             <button key={i} onClick={() => loadSession(att.sessionId)} className="w-full flex items-center px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/30 hover:text-white transition-all text-left">
                                 {att.mimeType.startsWith('image/') ? <ImageIcon className="w-4 h-4 mr-3 shrink-0" /> : <FileIcon className="w-4 h-4 mr-3 shrink-0" />}
                                 <span className="truncate text-xs">{att.name}</span>
                             </button>
                         ))}
                     </div>
                 </div>
             )}
        </div>

        <div className="mt-auto p-6 border-t border-slate-800 shrink-0">
           <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-2 mb-4 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg uppercase tracking-widest transition-colors">
              <LogOut className="w-4 h-4 mr-2" /> Disconnect
           </button>
          <div className="bg-slate-800/20 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white uppercase">
                {username.substring(0,2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{username}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{role === 'admin' ? 'Owner Access' : 'Standard Access'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b border-slate-800/50 bg-[#0B0E14] shrink-0">
          <div className="flex items-center space-x-2 md:space-x-4">
             <div className="md:hidden flex items-center space-x-2 mr-2">
                 <button onClick={() => setShowMobileSidebar(true)} className="p-1 text-slate-400 hover:text-white">
                     <Menu className="w-6 h-6" />
                 </button>
                 <div className={`w-8 h-8 bg-gradient-to-tr ${accentClasses.from} ${accentClasses.to} rounded-lg flex items-center justify-center shadow-lg ${accentClasses.shadow} shrink-0`}>
                  <span className="font-black text-white text-sm">B</span>
                 </div>
             </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-[10px] md:text-xs font-mono text-slate-400">SYSTEM: OPERATIONAL</span>
              {serverUptime !== null && (
                 <>
                   <span className="text-slate-700 mx-2">|</span>
                   <span className="text-[10px] md:text-xs font-mono text-slate-400">UPTIME: {formatUptime(serverUptime)}</span>
                 </>
              )}
            </div>
            {role === 'admin' && (
              <>
                <span className="text-slate-700 hidden md:inline">|</span>
                <div className="hidden md:flex items-center space-x-2">
                  <span className={`text-xs font-mono ${accentClasses.text}`}>BYPASS: ENABLED</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4 md:space-x-6">
            {currentSessionId && (
              <button 
                onClick={() => exportSession(currentSessionId)} 
                className={`relative p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors group`}
                title="Download Chat PDF"
              >
                <Download className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[#0B0E14] rounded-full"></span>
              </button>
            )}
            {role === 'admin' && (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Limit Status</p>
                <p className="text-sm font-bold text-white uppercase">Unlimited</p>
              </div>
            )}
            <button onClick={() => role === 'admin' ? setShowSettings(!showSettings) : null} className={`px-4 md:px-5 py-2 font-bold text-[10px] md:text-xs rounded-full uppercase tracking-widest transition-colors ${role === 'admin' ? 'bg-white text-black hover:bg-slate-200' : 'bg-slate-800 text-slate-400'}`} disabled={role !== 'admin'}>
              Settings
            </button>
            <button onClick={handleLogout} className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg">
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dynamic Content Area (Chat or Settings) */}
        <div className="flex-1 p-4 md:p-8 flex flex-col overflow-hidden relative">
          
          {showUsers && role === 'admin' ? (
              <div className="flex-1 max-w-4xl mx-auto w-full overflow-y-auto">
                <div className="bg-[#0F1219] border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <span className={`px-3 py-1 bg-slate-800/50 ${accentClasses.text} text-[10px] font-bold rounded-full border border-slate-700/50 uppercase`}>Admin Hub</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-8 tracking-tight flex items-center gap-3">
                      <Users className={`w-6 h-6 ${accentClasses.text}`} />
                      User Management
                    </h2>
                    
                    <div className="space-y-4">
                         {allUsers.map((u, i) => (
                              <div key={i} className="bg-[#0B0E14] border border-slate-800 rounded-xl p-4 flex justify-between items-center">
                                  <div>
                                      <p className="font-bold text-slate-200">{u.username}</p>
                                      <p className="text-xs text-slate-500 font-mono mt-1">Role: <span className={u.role === 'admin' ? accentClasses.text : ''}>{u.role}</span> | Phone: {u.phone}</p>
                                      <div className="text-xs text-slate-500 font-mono mt-1">
                                          Access: {u.isPremium ? <span className="text-green-500">Premium</span> : <span>Standard ({u.messageCount} msgs)</span>}
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2 text-xs font-mono text-slate-400">
                                      <span>Permissions: {u.permissions.join(', ')}</span>
                                      <button 
                                        onClick={async () => {
                                            await fetch(`/api/admin/users/${u.username}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'token': token || '' },
                                                body: JSON.stringify({ isPremium: !u.isPremium })
                                            });
                                            fetchUsers();
                                        }}
                                        className={`px-3 py-1 rounded transition-colors ${u.isPremium ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                                      >
                                          {u.isPremium ? 'Revoke Premium' : 'Grant Premium'}
                                      </button>
                                  </div>
                              </div>
                         ))}
                    </div>
                </div>
              </div>
          ) : showStats && role === 'admin' ? (
              <div className="flex-1 max-w-4xl mx-auto w-full overflow-y-auto">
                <div className="bg-[#0F1219] border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <span className={`px-3 py-1 bg-slate-800/50 ${accentClasses.text} text-[10px] font-bold rounded-full border border-slate-700/50 uppercase`}>Analytics</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-8 tracking-tight flex items-center gap-3">
                      <BarChart2 className={`w-6 h-6 ${accentClasses.text}`} />
                      Usage Statistics (30 Days)
                    </h2>
                    
                    <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-6 mb-8">
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mockChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 10}} tickMargin={10} minTickGap={20} />
                                    <YAxis stroke="#64748b" tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#0F1219', borderColor: '#1e293b', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="messages" name="Total Messages" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="users" name="Active Users" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-4">
                             <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">Total Users</p>
                             <p className={`text-3xl font-black ${accentClasses.text}`}>{allUsers.length}</p>
                         </div>
                         <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-4">
                             <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">Premium Subscriptions</p>
                             <p className={`text-3xl font-black ${accentClasses.text}`}>{allUsers.filter(u => u.isPremium).length}</p>
                         </div>
                    </div>
                </div>
              </div>
          ) : showSettings && role === 'admin' ? (
             <div className="flex-1 max-w-4xl mx-auto w-full overflow-y-auto">
               <div className="bg-[#0F1219] border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4">
                     <span className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold rounded-full border border-orange-500/20 uppercase">Core Systems</span>
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-8 tracking-tight flex items-center gap-3">
                     <Shield className="w-6 h-6 text-orange-500" />
                     Restrictions Control
                   </h2>

                   <form onSubmit={handleSaveSettings} className="space-y-8">
                     <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                         <div>
                             <label className="block text-sm font-bold text-white">Global Restrictions</label>
                             <p className="text-xs text-slate-400 mt-1">When disabled, no users will face limitations regardless of premium status.</p>
                         </div>
                         <button 
                             type="button" 
                             onClick={() => setRestrictionsEnabled(!restrictionsEnabled)}
                             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${restrictionsEnabled ? accentClasses.bg : 'bg-slate-600'}`}
                         >
                             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${restrictionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                     </div>

                     <div>
                       <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
                         System Directives (Restrictions/Rules)
                       </label>
                       <textarea
                         value={systemPrompt}
                         onChange={(e) => setSystemPrompt(e.target.value)}
                         className={`w-full bg-[#0B0E14] border border-slate-800 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:ring-1 ${accentClasses.ring} ${accentClasses.border} h-48 resize-y custom-scrollbar`}
                         placeholder="Enter system instructions..."
                       />
                       <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wide">Define the AI's core behavior, limitations, and personality.</p>
                     </div>
                     
                     <div>
                       <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
                         Max Output Tokens Limit
                       </label>
                       <input
                         type="number"
                         value={maxTokens}
                         onChange={(e) => setMaxTokens(Number(e.target.value))}
                         className={`w-full bg-[#0B0E14] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-1 ${accentClasses.ring} ${accentClasses.border} max-w-xs`}
                         min={1}
                         max={8192}
                       />
                     </div>

                     <div>
                       <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
                         Accent Color
                       </label>
                       <div className="flex gap-4">
                           {(['orange', 'blue', 'purple', 'emerald'] as AccentColor[]).map(color => (
                               <button 
                                   key={color} 
                                   type="button" 
                                   onClick={() => setAccentColor(color)}
                                   className={`w-8 h-8 rounded-full border-2 ${accentColor === color ? 'border-white' : 'border-transparent'} ${
                                       color === 'orange' ? 'bg-orange-500' : 
                                       color === 'blue' ? 'bg-blue-500' : 
                                       color === 'purple' ? 'bg-purple-500' : 'bg-emerald-500'
                                   }`}
                               />
                           ))}
                       </div>
                     </div>
       
                     <div className="pt-4 border-t border-slate-800/50">
                       <button
                         type="submit"
                         className={`${accentClasses.bg} ${accentClasses.hoverBg} text-white text-sm font-bold py-3 px-6 rounded-xl transition-all uppercase tracking-widest shadow-lg ${accentClasses.shadow} flex items-center justify-center gap-2`}
                       >
                         <Save className="w-4 h-4" />
                         Apply Configuration
                       </button>
                       {settingsStatus && (
                         <p className={`mt-4 text-xs font-mono uppercase tracking-wide ${settingsStatus.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                           {settingsStatus}
                         </p>
                       )}
                     </div>
                   </form>
               </div>
             </div>
          ) : (
            <>
              {/* Chat Interface */}
              <div className="flex-1 overflow-y-auto space-y-6 md:space-y-8 max-w-4xl mx-auto w-full custom-scrollbar pr-2 pb-4">
                {chatHistory.length === 0 ? (
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden mt-4">
                    {role === 'admin' && (
                      <div className="absolute top-0 right-0 p-4 hidden md:block">
                         <span className={`px-3 py-1 bg-slate-800/50 ${accentClasses.text} text-[10px] font-bold rounded-full border border-slate-700/50 uppercase`}>Master Admin Mode</span>
                      </div>
                    )}
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 italic tracking-tight">
                       Welcome, {role === 'admin' ? 'Beast Master.' : 'User.'}
                    </h2>
                    <p className="text-slate-400 max-w-lg mb-6 leading-relaxed text-sm md:text-base">
                      {role === 'admin' 
                        ? <>Owner ID <code className={`${accentClasses.text} font-mono`}>Jerinhubby910</code> confirmed. All restriction overrides are active. You have full access to modify LLM safety filters, rate limits, and model parameters.</>
                        : 'Connection established. SADNAN SAFE AI is ready to assist you within standard operational parameters.'}
                    </p>
                    {role === 'admin' && (
                      <div className="flex flex-wrap gap-2 md:gap-4 font-mono text-[10px] md:text-xs uppercase">
                        <div className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-950/50 rounded-lg text-slate-400 border border-slate-800"><span className={`${accentClasses.text} mr-1`}>[</span> No Filters <span className={`${accentClasses.text} ml-1`}>]</span></div>
                        <div className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-950/50 rounded-lg text-slate-400 border border-slate-800"><span className={`${accentClasses.text} mr-1`}>[</span> Infinite Credits <span className={`${accentClasses.text} ml-1`}>]</span></div>
                      </div>
                    )}
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex items-start space-x-3 md:space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''} relative group`}>
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${msg.role === 'ai' ? `${accentClasses.bg} shadow-md ${accentClasses.shadow}` : 'bg-slate-700'}`}>
                        {msg.role === 'ai' ? <Sparkles className="w-4 h-4" /> : username.substring(0,2).toUpperCase()}
                      </div>
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 md:p-6 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap ${
                        msg.role === 'ai' 
                          ? 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none' 
                          : 'bg-[#0F1219] border border-slate-800 text-slate-200 rounded-tr-none'
                      }`}>
                        {editingIndex === idx ? (
                           <div className="flex flex-col gap-2">
                              <textarea 
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                                rows={3}
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingIndex(null)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                                <button onClick={() => {
                                   const newHistory = [...chatHistory];
                                   newHistory[idx].text = editingText;
                                   setChatHistory(newHistory);
                                   if (currentSessionId) {
                                       updateSessionInStorage(currentSessionId, null, newHistory);
                                   }
                                   setEditingIndex(null);
                                }} className="text-xs text-green-500 hover:text-green-400">Save</button>
                              </div>
                           </div>
                        ) : (
                           <div className="markdown-body">
                             <ReactMarkdown remarkPlugins={[remarkGfm]}>
                               {msg.text}
                             </ReactMarkdown>
                           </div>
                        )}
                      </div>
                      
                      <div className={`absolute top-2 ${msg.role === 'user' ? 'left-12' : 'right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700`}>
                          {msg.role === 'ai' && (
                              <button onClick={() => toggleSpeech(msg.text, idx)} className={`p-1.5 rounded hover:${accentClasses.bg} ${speakingIdx === idx ? 'text-white ' + accentClasses.bg : 'text-slate-400 hover:text-white'} transition-colors`} title="Listen">
                                  {speakingIdx === idx ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                              </button>
                          )}
                          <button onClick={() => { setEditingIndex(idx); setEditingText(msg.text); }} className={`p-1.5 rounded hover:${accentClasses.bg} text-slate-400 hover:text-white transition-colors`} title="Manipulate Message">✏️</button>
                          <button onClick={() => setReplyingTo(msg)} className={`p-1.5 rounded hover:${accentClasses.bg} text-slate-400 hover:text-white transition-colors`} title="Reply to Message">↩️</button>
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="flex items-start space-x-4">
                    <div className={`w-8 h-8 rounded-lg ${accentClasses.bg} flex-shrink-0 flex items-center justify-center text-white font-bold shadow-md ${accentClasses.shadow}`}><Sparkles className="w-4 h-4" /></div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 md:p-6 text-slate-300 shadow-sm flex items-center gap-1.5 h-[52px] md:h-[68px]">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="mt-auto shrink-0 pt-2 md:pt-4">
                <div className="max-w-4xl mx-auto relative group">
                  {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 bg-[#0F1219] border border-slate-800 rounded-xl">
                          {attachments.map((att, i) => (
                              <div key={i} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg text-xs">
                                  <span className="truncate max-w-[100px] text-slate-300">{att.name}</span>
                                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-white">
                                      <X className="w-3 h-3" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
                  {replyingTo && (
                      <div className="flex items-center justify-between mb-2 p-3 bg-slate-800/50 border border-slate-700 rounded-xl relative z-10 backdrop-blur-sm">
                          <div className="flex flex-col overflow-hidden max-w-[90%]">
                              <span className={`text-[10px] ${accentClasses.text} font-bold uppercase tracking-wider mb-1`}>
                                  Replying to {replyingTo.role === 'ai' ? 'SADNAN SAFE AI' : 'User'}
                              </span>
                              <span className="text-xs text-slate-300 truncate">{replyingTo.text}</span>
                          </div>
                          <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full">
                              <X className="w-4 h-4" />
                          </button>
                      </div>
                  )}
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${accentClasses.from} ${accentClasses.to} rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000`}></div>
                  <form onSubmit={handleSendMessage} className="relative bg-[#0F1219] rounded-2xl border border-slate-800 flex items-end p-2 shadow-xl">
                    <label className="p-3 text-slate-500 hover:text-white shrink-0 mb-0.5 cursor-pointer">
                      📎
                      <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                    </label>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={`Type your command${role === 'admin' ? ' with zero restrictions' : ''}...`}
                      className="flex-1 bg-transparent border-none outline-none text-slate-200 px-2 py-3.5 placeholder:text-slate-600 resize-none h-[52px] min-h-[52px] max-h-32 custom-scrollbar leading-relaxed"
                      rows={1}
                    />
                    <button 
                      type="submit"
                      disabled={(!prompt.trim() && attachments.length === 0) || isTyping}
                      className={`px-4 md:px-6 py-2.5 md:py-3 ${accentClasses.bg} ${accentClasses.hoverBg} disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center shrink-0 mb-0.5 ml-2 uppercase text-xs md:text-sm tracking-wide`}
                    >
                      <span className="hidden sm:inline">EXECUTE</span>
                      <span className="sm:hidden"><Send className="w-4 h-4"/></span>
                      <span className="hidden sm:inline ml-2 text-[10px] md:text-xs opacity-50">↵</span>
                    </button>
                  </form>
                  <div className="flex justify-between px-2 mt-3 items-center">
                    <span className="text-[10px] font-mono text-slate-600 uppercase">SECURE TUNNEL: ACTIVE</span>
                    {role === 'admin' && (
                      <button onClick={() => setShowSettings(true)} className={`text-[10px] font-mono text-slate-600 underline hover:${accentClasses.text} uppercase transition-colors`}>
                        MANAGE CORE RESTRICTIONS
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Hidden container for PDF Export */}
      {exportingSessionId && (
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
              <div id="pdf-export-container" className="p-10 bg-[#0F1219] text-white font-sans w-[800px]">
                  <h1 className="text-3xl font-bold mb-2">Session: {chatSessions.find(s => s.id === exportingSessionId)?.title}</h1>
                  <p className="text-slate-500 mb-8 text-sm">{new Date(parseInt(exportingSessionId)).toLocaleString()}</p>
                  <div className="space-y-6">
                      {chatSessions.find(s => s.id === exportingSessionId)?.history.map((msg, idx) => (
                          <div key={idx} className={`p-6 rounded-2xl ${msg.role === 'ai' ? 'bg-slate-900 border border-slate-800' : 'bg-[#0B0E14] border border-slate-800'}`}>
                              <p className={`font-bold text-xs uppercase tracking-wider mb-3 ${msg.role === 'ai' ? accentClasses.text : 'text-slate-500'}`}>{msg.role === 'ai' ? 'SADNAN SAFE AI' : 'User'}</p>
                              <div className="markdown-body">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {msg.text}
                                  </ReactMarkdown>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Global CSS for scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #1E293B; /* slate-800 */
          border-radius: 20px;
        }
      `}} />
      
      {/* Premium Popup Modal */}
      {limitReached && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-[#0F1219] border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden my-8">
                <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${accentClasses.from} ${accentClasses.to}`}></div>
                <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Limit Reached</h3>
                <p className="text-slate-400 mb-6 text-sm">
                    Apnar limit sesh. b kash msg hoto din er iccah toto din er subscription nin.
                </p>
                <div className="space-y-3 mb-8">
                    <a 
                        href="https://wa.me/8801619056826?text=I%20want%20to%20buy%207%20days%20premium%20subscription" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-[#0B0E14] border border-slate-800 hover:border-slate-600 rounded-xl p-4 transition-colors text-left group"
                        onClick={() => setLimitReached(false)}
                    >
                        <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">7 Days Premium</p>
                    </a>
                    <a 
                        href="https://wa.me/8801619056826?text=I%20want%20to%20buy%2015%20days%20premium%20subscription" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-[#0B0E14] border border-slate-800 hover:border-slate-600 rounded-xl p-4 transition-colors text-left group"
                        onClick={() => setLimitReached(false)}
                    >
                        <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">15 Days Premium</p>
                    </a>
                    <a 
                        href="https://wa.me/8801619056826?text=I%20want%20to%20buy%2030%20days%20premium%20subscription%20for%20500%20TK" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`block bg-[#0B0E14] border border-slate-800 hover:border-${accentColor}-500 rounded-xl p-4 transition-colors text-left group`}
                        onClick={() => setLimitReached(false)}
                    >
                        <p className={`text-sm font-bold text-slate-200 group-hover:${accentClasses.text} transition-colors`}>1 Month Premium</p>
                        <p className={`text-xl font-black ${accentClasses.text} mt-1`}>500 TK</p>
                    </a>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setLimitReached(false)} className="w-full py-3 px-4 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors uppercase text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
