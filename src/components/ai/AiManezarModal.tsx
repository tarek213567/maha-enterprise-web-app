import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dbService } from '../../services/api';
import {
  Sparkles,
  Send,
  Mic,
  Plus,
  Paperclip,
  Camera,
  Maximize2,
  Minimize2,
  Menu,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  Pin,
  Trash2,
  Edit2,
  FileText,
  Sun,
  ShieldCheck,
  Check,
  ExternalLink,
} from 'lucide-react';

interface AiManezarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

interface ChatSession {
  id: string;
  title: string;
  isPinned: number;
  updatedAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'model';
  message: string;
  hasImage?: number;
  actionJson?: string | null;
  actionExecuted?: number;
  createdAt?: string;
  imageBase64?: string;
}

export const AiManezarModal: React.FC<AiManezarModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  // Sessions & Active Chat State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'chat' | 'task'>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Drop-up menu & File attachments
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Speech TTS state
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Renaming Session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await dbService.ai.getSessions();
      if (res.success && Array.isArray(res.sessions)) {
        setSessions(res.sessions);
        if (!activeSessionId && res.sessions.length > 0) {
          selectSession(res.sessions[0].id);
        }
      }
    } catch (err) {
      console.warn('[AiManezar] Failed to load sessions:', err);
    }
  }, [activeSessionId]);

  // Load Messages for Session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await dbService.ai.getMessages(sessionId);
      if (res.success && Array.isArray(res.messages)) {
        setMessages(res.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.warn('[AiManezar] Failed to load messages:', err);
      setMessages([]);
    }
  }, []);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      loadSessions();
      // Auto-focus textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    } else {
      // Cleanup speech and recording on close
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (isRecording) cancelRecording();
    }
  }, [isOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Select a session
  const selectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await loadMessages(sessionId);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  // Create new session
  const handleCreateNewSession = async () => {
    try {
      const res = await dbService.ai.createSession('নতুন আলোচনা');
      if (res.success && res.session) {
        setSessions((prev) => [res.session, ...prev]);
        setActiveSessionId(res.session.id);
        setMessages([]);
        setTimeout(() => textareaRef.current?.focus(), 150);
      }
    } catch (err) {
      console.error('[AiManezar] Failed to create session:', err);
    }
  };

  // Toggle Pin session
  const handleTogglePin = async (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = session.isPinned ? 0 : 1;
    try {
      await dbService.ai.updateSession(session.id, { isPinned: newPinned });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, isPinned: newPinned } : s))
      );
    } catch (err) {
      console.error('[AiManezar] Failed to pin session:', err);
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('আপনি কি নিশ্চিত যে এই আলোচনাটি স্থায়ীভাবে মুছে ফেলতে চান?')) return;
    try {
      await dbService.ai.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          selectSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('[AiManezar] Failed to delete session:', err);
    }
  };

  // Save renamed session title
  const handleSaveRename = async (sessionId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await dbService.ai.updateSession(sessionId, { title: editingTitle.trim() });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
      );
      setEditingSessionId(null);
    } catch (err) {
      console.error('[AiManezar] Failed to rename session:', err);
    }
  };

  // Handle Morning Briefing
  const handleMorningBriefing = async () => {
    try {
      setIsLoading(true);
      const res = await dbService.ai.getMorningBriefing();
      if (res.success && res.briefing) {
        const text = res.briefing.summaryText || 'সকালের সার্বিক তথ্য সংগৃহীত হয়েছে।';
        handleSendMessage(text);
      }
    } catch (err) {
      console.error('[AiManezar] Briefing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Image Selection (OCR)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage({
        base64,
        mimeType: file.type || 'image/jpeg',
        name: file.name,
      });
      setIsDropupOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt !== undefined ? customPrompt : inputText.trim();
    if (!textToSend && !selectedImage) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      try {
        const newSessRes = await dbService.ai.createSession(
          textToSend ? textToSend.slice(0, 30) : 'ছবি মেমো বিশ্লেষণ'
        );
        if (newSessRes.success && newSessRes.session) {
          targetSessionId = newSessRes.session.id;
          setActiveSessionId(targetSessionId);
          setSessions((prev) => [newSessRes.session, ...prev]);
        }
      } catch (e) {
        console.error('[AiManezar] Auto-session error:', e);
      }
    }

    const optimisticUserMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sessionId: targetSessionId || 'default',
      role: 'user',
      message: textToSend,
      hasImage: selectedImage ? 1 : 0,
      imageBase64: selectedImage?.base64,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInputText('');
    const curImg = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const payload: any = {
        sessionId: targetSessionId || undefined,
        message: textToSend,
      };

      if (curImg) {
        payload.imageBase64 = curImg.base64;
        payload.mimeType = curImg.mimeType;
      }

      const res = await dbService.ai.sendMessage(payload);

      if (res.success) {
        const aiMsg: ChatMessage = {
          id: res.messageId || `ai_${Date.now()}`,
          sessionId: targetSessionId || 'default',
          role: 'model',
          message: res.reply || 'কোনো উত্তর পাওয়া যায়নি।',
          actionJson: res.action ? JSON.stringify(res.action) : null,
          actionExecuted: 0,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Auto-update session title if suggested
        if (res.suggestedTitle && targetSessionId) {
          setSessions((prev) =>
            prev.map((s) => (s.id === targetSessionId ? { ...s, title: res.suggestedTitle! } : s))
          );
        }

        // Auto navigate if AI requested
        if (res.navigateTo && onNavigate) {
          onNavigate(res.navigateTo);
        }
      } else {
        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          sessionId: targetSessionId || 'default',
          role: 'model',
          message: `⚠️ ত্রুটি: ${res.error || 'Gemini 3 Flash সংযোগ ব্যর্থ হয়েছে। Settings থেকে API Key পরীক্ষা করুন।'}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      console.error('[AiManezar] Send message exception:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sessionId: targetSessionId || 'default',
        role: 'model',
        message: `⚠️ নেটওয়ার্ক ত্রুটি: ${err.message || 'সার্ভারে পৌঁছানো যায়নি।'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // Execute AI Action Proposal with 60-day RecycleBin Snapshot
  const handleExecuteAction = async (msg: ChatMessage) => {
    if (!msg.actionJson) return;
    let actionObj: any = null;
    try {
      actionObj = JSON.parse(msg.actionJson);
    } catch {
      alert('অ্যাকশন ডেটা পার্স করতে সমস্যা হয়েছে।');
      return;
    }

    try {
      setExecutingActionId(msg.id);
      const res = await dbService.ai.executeAction(actionObj, msg.id);

      if (res.success) {
        // Mark as executed locally
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, actionExecuted: 1 } : m))
        );

        // Notify entire app of data and override updates
        window.dispatchEvent(new CustomEvent('maha-data-changed'));
        window.dispatchEvent(new CustomEvent('maha-ai-override-updated'));

        alert(`✅ ${res.message || 'অ্যাকশন সফলভাবে ডাটাবেজে কার্যকর করা হয়েছে।'}\n🛡️ ৬০ দিনের রিসাইকেল বিন স্ন্যাপশট সংরক্ষিত হয়েছে।`);
      } else {
        alert(`❌ অ্যাকশন ব্যর্থ হয়েছে: ${res.error || 'অজানা ত্রুটি'}`);
      }
    } catch (err: any) {
      console.error('[AiManezar] Execute action error:', err);
      alert(`ত্রুটি: ${err.message || 'অ্যাকশন কার্যকর করা যায়নি।'}`);
    } finally {
      setExecutingActionId(null);
    }
  };

  // Text-To-Speech (TTS)
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('আপনার ব্রাউজারে স্পিচ সিন্থেসিস (TTS) সুবিধা সমর্থিত নয়।');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingMsgId(msgId);

    // Strip markdown formatting symbols for natural speech
    const cleanText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find(
      (v) => v.lang.includes('bn') || v.lang.includes('BD') || v.name.includes('Bangla')
    );
    if (bnVoice) utterance.voice = bnVoice;
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[AiManezar] Mic access error:', err);
      alert('মাইক্রোফোন চালু করা যায়নি। ব্রাউজারের অডিও পারমিশন চেক করুন।');
    }
  };

  // Stop & Submit Voice Recording to Gemini Multimodal Audio
  const stopAndSubmitRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm',
      });

      // Stop mic tracks
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingSeconds(0);

      // Convert Blob to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;

        let targetSessionId = activeSessionId;
        if (!targetSessionId) {
          const sRes = await dbService.ai.createSession('ভয়েস বার্তা');
          if (sRes.success && sRes.session) {
            targetSessionId = sRes.session.id;
            setActiveSessionId(targetSessionId);
            setSessions((prev) => [sRes.session, ...prev]);
          }
        }

        const optimisticUserMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sessionId: targetSessionId || 'default',
          role: 'user',
          message: '🎙️ [ভয়েস অডিও প্রম্পট পাঠানো হচ্ছে...]',
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimisticUserMsg]);
        setIsLoading(true);

        try {
          const res = await dbService.ai.sendMessage({
            sessionId: targetSessionId || undefined,
            message: '',
            audioBase64: base64Audio,
            audioMimeType: audioBlob.type,
          });

          if (res.success) {
            // Update user message with transcribed text if available
            if (res.transcribedText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optimisticUserMsg.id
                    ? { ...m, message: `🎙️ ${res.transcribedText}` }
                    : m
                )
              );
            }

            const aiMsg: ChatMessage = {
              id: res.messageId || `ai_${Date.now()}`,
              sessionId: targetSessionId || 'default',
              role: 'model',
              message: res.reply || 'কোনো উত্তর পাওয়া যায়নি।',
              actionJson: res.action ? JSON.stringify(res.action) : null,
              actionExecuted: 0,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, aiMsg]);
          } else {
            alert(`ভয়েস প্রসেসিং ব্যর্থ: ${res.error || 'অজানা ত্রুটি'}`);
          }
        } catch (e: any) {
          console.error('[AiManezar] Voice upload exception:', e);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
  };

  // Cancel Recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  // Format seconds to mm:ss
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to render Markdown-like text
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      // Headings
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="ai-md-h2">
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="ai-md-h3">
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="ai-md-h4">
            {line.replace('#### ', '')}
          </h4>
        );
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-slate-200">
            {renderInlineMarkdown(content)}
          </li>
        );
      }

      // Numbered lists
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal text-slate-200">
            {renderInlineMarkdown(numMatch[2])}
          </li>
        );
      }

      // Regular paragraph or blank line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="mb-1 text-slate-200 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  // Helper for bold, code, highlights
  const renderInlineMarkdown = (text: string) => {
    // Simple inline parser for bold **text** and code `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs border border-slate-700"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinnedSessions = filteredSessions.filter((s) => s.isPinned === 1);
  const recentSessions = filteredSessions.filter((s) => s.isPinned !== 1);

  if (!isOpen) return null;

  return (
    <div
      id="modal-ai-manezar"
      className="ai-manezar-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="ai-manezar-backdrop"
        className="ai-manezar-backdrop"
        onClick={onClose}
      />

      <div
        id="ai-manezar-container"
        className={`ai-manezar-container ${isFullscreen ? 'fullscreen' : ''}`}
      >
        {/* =================================================================== */}
        {/* LEFT COLLAPSIBLE SIDEBAR: RAIL (58px) & DRAWER (270px)              */}
        {/* =================================================================== */}
        <aside className={`ai-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Top spark logo & Toggle */}
          <div className="ai-rail-top">
            <span
              className="ai-gemini-sparkle-logo"
              title="Google Gemini 3 Flash"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              ✨
            </span>
            <button
              id="ai-btn-toggle-sidebar"
              type="button"
              className="ai-rail-btn-toggle"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'সাইডবার প্যানেল প্রসারিত করুন' : 'সাইডবার সংকুচিত করুন'}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Icons (Visible only in collapsed rail) */}
          <div className="ai-rail-icons">
            <button
              type="button"
              className="ai-rail-btn"
              onClick={handleCreateNewSession}
              title="নতুন চ্যাট"
            >
              ✏️
            </button>
            <button
              type="button"
              className="ai-rail-btn"
              onClick={() => setIsSidebarCollapsed(false)}
              title="অনুসন্ধান"
            >
              🔍
            </button>
            <button
              type="button"
              className="ai-rail-btn"
              onClick={() => {
                onClose();
                onNavigate?.('notebook');
              }}
              title="নোটবুক"
            >
              📓
            </button>
          </div>

          {/* Expanded Drawer Content (Visible only when expanded) */}
          <div className="ai-sidebar-expanded-only flex-1 flex flex-col min-h-0">
            {/* New Chat Button */}
            <div className="ai-sidebar-top">
              <button
                id="ai-btn-new-chat"
                type="button"
                className="ai-btn-new-chat"
                onClick={handleCreateNewSession}
              >
                <span>✏️</span>
                <span>নতুন আলোচনা শুরু করুন</span>
              </button>
              <button
                id="ai-btn-close-sidebar"
                type="button"
                className="ai-btn-icon-close-sidebar"
                onClick={() => setIsSidebarCollapsed(true)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="ai-search-box">
              <Search className="ai-search-icon w-3.5 h-3.5" />
              <input
                id="ai-search-input"
                type="text"
                placeholder="আলোচনা খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Scrollable Sessions List */}
            <div className="ai-flex-grow">
              {/* Pinned Section */}
              {pinnedSessions.length > 0 && (
                <div className="ai-sidebar-section">
                  <div className="ai-sidebar-section-header">
                    <span>📌 পিন করা আলোচনা</span>
                  </div>
                  <div className="ai-session-list">
                    {pinnedSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`ai-session-item ${activeSessionId === session.id ? 'active' : ''}`}
                        onClick={() => selectSession(session.id)}
                      >
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id, e)}
                              className="w-full bg-slate-800 text-xs text-white px-2 py-1 rounded border border-amber-500 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(session.id, e)}
                              className="text-emerald-400 p-1 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="ai-session-title" title={session.title}>
                              {session.title}
                            </span>
                            <div className="ai-session-actions">
                              <button
                                type="button"
                                className="ai-btn-action pinned"
                                onClick={(e) => handleTogglePin(session, e)}
                                title="আনপিন করুন"
                              >
                                📌
                              </button>
                              <button
                                type="button"
                                className="ai-btn-action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.id);
                                  setEditingTitle(session.title);
                                }}
                                title="নাম পরিবর্তন"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                className="ai-btn-action hover:text-rose-400"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Section */}
              <div className="ai-sidebar-section">
                <div className="ai-sidebar-section-header">
                  <span>🕒 সাম্প্রতিক আলোচনা</span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    ({recentSessions.length})
                  </span>
                </div>
                <div className="ai-session-list">
                  {recentSessions.length === 0 ? (
                    <div className="text-xs text-slate-500 px-3 py-2 italic">
                      কোনো পূর্ববর্তী আলোচনা নেই
                    </div>
                  ) : (
                    recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`ai-session-item ${activeSessionId === session.id ? 'active' : ''}`}
                        onClick={() => selectSession(session.id)}
                      >
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id, e)}
                              className="w-full bg-slate-800 text-xs text-white px-2 py-1 rounded border border-amber-500 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(session.id, e)}
                              className="text-emerald-400 p-1 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="ai-session-title" title={session.title}>
                              {session.title}
                            </span>
                            <div className="ai-session-actions">
                              <button
                                type="button"
                                className="ai-btn-action"
                                onClick={(e) => handleTogglePin(session, e)}
                                title="পিন করুন"
                              >
                                <Pin className="w-3 h-3 text-slate-400 hover:text-amber-400" />
                              </button>
                              <button
                                type="button"
                                className="ai-btn-action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.id);
                                  setEditingTitle(session.title);
                                }}
                                title="নাম পরিবর্তন"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                className="ai-btn-action hover:text-rose-400"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Bottom Profile */}
            <div className="ai-sidebar-footer">
              <div className="ai-footer-profile">
                <div className="ai-avatar-circle">ম</div>
                <div className="ai-footer-info">
                  <div className="ai-footer-name">মাহা এন্টারপ্রাইজ</div>
                  <div className="ai-footer-tier">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span>Gemini 3 Flash PRO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* =================================================================== */}
        {/* MAIN CHAT AREA                                                      */}
        {/* =================================================================== */}
        <main className={`ai-main-chat ${messages.length === 0 ? 'is-empty' : ''}`}>
          {/* Ultra-Clean Top Header */}
          <header className="ai-chat-header">
            <div className="ai-header-left">
              <button
                type="button"
                className="ai-btn-icon md:hidden"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                title="মেনু"
              >
                <Menu className="w-5 h-5 text-slate-300" />
              </button>
              <div className="flex items-center gap-2">
                <h2 className="ai-header-title">
                  {sessions.find((s) => s.id === activeSessionId)?.title || 'Ai Manezar (Gemini 3 Flash)'}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  <span>লাইভ শপ ইন্টেলিজেন্স</span>
                </span>
              </div>
            </div>

            <div className="ai-header-right">
              {/* Morning Briefing Pill Button */}
              <button
                type="button"
                className="ai-btn-pill-briefing flex items-center gap-1.5"
                onClick={handleMorningBriefing}
                title="আজকের সকালের সার্বিক স্টক ও আর্থিক সংক্ষিপ্তসার শুনুন"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>সকালের ব্রিফিং</span>
              </button>

              {/* Fullscreen Button */}
              <button
                id="ai-btn-expand-fullscreen"
                type="button"
                className="ai-btn-icon"
                onClick={() => setIsFullscreen((prev) => !prev)}
                title={isFullscreen ? 'স্বাভাবিক স্ক্রিনে ফিরুন' : 'ফুলস্ক্রিন মোড'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Prominent Circular Exit Button (36px x 36px) */}
              <button
                id="ai-btn-close-modal"
                type="button"
                className="ai-btn-close-prominent"
                onClick={onClose}
                title="বন্ধ করুন (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Chat Body (Messages or Centered Hero) */}
          <div ref={chatBodyRef} className="ai-chat-body">
            {messages.length === 0 ? (
              /* Centered Welcome Hero matching Google Gemini (gemini.google.com/app) */
              <div className="ai-welcome-hero">
                <h1 className="ai-welcome-title">
                  শুভকামনা,{' '}
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
                    মাহা এন্টারপ্রাইজ!
                  </span>
                </h1>
                <p className="ai-welcome-subtitle">
                  আমি আপনার আড়তের সার্বক্ষণিক এআই ম্যানেজার। আজকের ব্যবসা ও মজুদ পরিস্থিতি জানতে নিচের যেকোনো পরামর্শে ক্লিক করুন:
                </p>

                {/* Mode Selector */}
                <div className="ai-welcome-modes">
                  <button
                    type="button"
                    className={`ai-mode-pill ${mode === 'chat' ? 'active' : ''}`}
                    onClick={() => setMode('chat')}
                  >
                    💬 চ্যাট ও পরামর্শ
                  </button>
                  <button
                    type="button"
                    className={`ai-mode-pill ${mode === 'task' ? 'active' : ''}`}
                    onClick={() => setMode('task')}
                  >
                    ⚡ টাস্ক ও ডাটাবেস এক্সিকিউশন
                  </button>
                </div>

                {/* Suggestion Prompts */}
                <div className="ai-welcome-suggestions">
                  <button
                    type="button"
                    className="ai-suggestion-row"
                    onClick={() =>
                      handleSendMessage(
                        'আজকের সামগ্রিক বেচাকেনা, নগদ ক্যাশ ও গুদামের স্টক পরিস্থিতি বিশ্লেষণ করো।'
                      )
                    }
                  >
                    <span className="ai-sugg-icon">📊</span>
                    <span className="ai-sugg-text">
                      আজকের সামগ্রিক বেচাকেনা, নগদ ক্যাশ ও স্টক পরিস্থিতি বিশ্লেষণ করো
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ai-suggestion-row"
                    onClick={() =>
                      handleSendMessage(
                        'কোন কোন শস্যের মজুদ কমে গেছে এবং বাজারদর অনুযায়ী সামনে কত মণ ক্রয় করা লাভজনক হবে?'
                      )
                    }
                  >
                    <span className="ai-sugg-icon">🌾</span>
                    <span className="ai-sugg-text">
                      কোন শস্যের মজুদ কমে গেছে এবং বাজারদর অনুযায়ী কত মণ কেনা দরকার?
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ai-suggestion-row"
                    onClick={() =>
                      handleSendMessage(
                        'ঝুঁকিপূর্ণ বাকি খাতা এবং সর্বোচ্চ ৫ জন দেনাদার পার্টির তাগাদা মেমো তালিকা দেখাও।'
                      )
                    }
                  >
                    <span className="ai-sugg-icon">⚠️</span>
                    <span className="ai-sugg-text">
                      ঝুঁকিপূর্ণ বাকি খাতা ও সর্বোচ্চ দেনাদারদের তাগাদা মেমো তালিকা
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ai-suggestion-row"
                    onClick={() =>
                      handleSendMessage(
                        'আড়তের গুদাম পরিচালন খরচ কমিয়ে নিট লাভ বাড়ানোর বাস্তবসম্মত কৌশল দাও।'
                      )
                    }
                  >
                    <span className="ai-sugg-icon">💡</span>
                    <span className="ai-sugg-text">
                      আড়তের গুদাম পরিচালন খরচ কমিয়ে নিট লাভ বৃদ্ধির কৌশল দাও
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Active Conversation Stream */
              messages.map((msg) => (
                <div key={msg.id} className={`ai-msg-row ${msg.role}`}>
                  {msg.role === 'model' && (
                    <div className="ai-msg-avatar model-avatar">
                      <span className="ai-sparkle-glyph">✨</span>
                    </div>
                  )}

                  <div className="ai-msg-bubble">
                    {/* User Attached Image Preview */}
                    {msg.role === 'user' && msg.imageBase64 && (
                      <div className="mb-2 max-w-[200px] rounded-lg overflow-hidden border border-slate-700">
                        <img
                          src={msg.imageBase64}
                          alt="সংযুক্ত মেমো"
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}

                    {/* Text Content */}
                    <div>{renderFormattedText(msg.message)}</div>

                    {/* Model Message Footer: TTS & Action Proposal */}
                    {msg.role === 'model' && (
                      <div>
                        {/* Action Proposal Card */}
                        {msg.actionJson && (
                          <div className="ai-action-card">
                            {(() => {
                              try {
                                const act = JSON.parse(msg.actionJson);
                                return (
                                  <>
                                    <div className="ai-action-header">
                                      <span className="ai-action-title">
                                        <Sparkles className="w-4 h-4 text-emerald-400" />
                                        <span>প্রস্তাবিত ডাটাবেস অ্যাকশন: {act.actionType}</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>৬০-দিনের রিস্টোর স্ন্যাপশট</span>
                                      </span>
                                    </div>

                                    <p className="ai-action-desc">
                                      {act.description || 'এই পরিবর্তনটি আড়ত ডাটাবেজে রেকর্ড করা হবে।'}
                                    </p>

                                    {/* Action Data Preview Table */}
                                    {act.payload && (
                                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 mb-3 text-xs font-mono text-slate-300 overflow-x-auto">
                                        <div className="text-[11px] font-bold text-amber-400 mb-1">
                                          প্রস্তাবিত পরিবর্তন প্রিভিউ:
                                        </div>
                                        <pre className="text-[11px] leading-tight">
                                          {JSON.stringify(act.payload, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {/* Confirmation / Execution Status */}
                                    <div className="ai-action-buttons">
                                      {msg.actionExecuted === 1 ? (
                                        <span className="ai-action-executed-badge">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                          <span>✓ সফলভাবে ডাটাবেজে সংরক্ষিত ও কার্যকর হয়েছে</span>
                                        </span>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            disabled={executingActionId === msg.id}
                                            onClick={() => handleExecuteAction(msg)}
                                            className="btn-confirm-action"
                                          >
                                            {executingActionId === msg.id ? (
                                              <>
                                                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>সংরক্ষণ হচ্ছে...</span>
                                              </>
                                            ) : (
                                              <>
                                                <span>✅ নিশ্চিত করুন (Execute)</span>
                                              </>
                                            )}
                                          </button>
                                          <span className="text-[11px] text-slate-400 italic">
                                            (রিসাইকেল বিন থেকে ১-ক্লিকে ফেরত আনা সম্ভব)
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </>
                                );
                              } catch {
                                return null;
                              }
                            })()}
                          </div>
                        )}

                        {/* Footer TTS & Timestamp */}
                        <div className="ai-msg-footer">
                          <button
                            type="button"
                            className={`ai-btn-tts ${speakingMsgId === msg.id ? 'speaking' : ''}`}
                            onClick={() => handleToggleSpeak(msg.id, msg.message)}
                            title={speakingMsgId === msg.id ? 'থামুন' : 'শুনুন (বাংলা কণ্ঠ)'}
                          >
                            {speakingMsgId === msg.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5" />
                                <span>থামুন</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>🔊 শুনুন</span>
                              </>
                            )}
                          </button>

                          {msg.createdAt && (
                            <span className="ai-msg-time">
                              {new Date(msg.createdAt).toLocaleTimeString('bn-BD', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="ai-msg-row model">
                <div className="ai-msg-avatar model-avatar">
                  <span className="ai-sparkle-glyph">✨</span>
                </div>
                <div className="ai-msg-bubble flex items-center gap-2 text-slate-400 italic">
                  <RotateCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Gemini 3 Flash বিশ্লেষণ করছে...</span>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* BOTTOM UNIFIED INPUT PILL & CONTROLS                                */}
          {/* =================================================================== */}
          <footer className="ai-chat-footer">
            <div className="ai-input-pill-wrapper flex flex-col w-full gap-1.5">
              {/* Image Preview Bar */}
              {selectedImage && (
                <div className="ai-image-preview-bar rounded-t-2xl mb-1">
                  <div className="ai-preview-thumb-wrap">
                    <img src={selectedImage.base64} alt="প্রিভিউ" />
                    <button
                      type="button"
                      className="ai-btn-remove-img"
                      onClick={() => setSelectedImage(null)}
                      title="মুছে ফেলুন"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="ai-preview-text">
                    📷 {selectedImage.name} (OCR স্ক্যানিংয়ের জন্য প্রস্তুত)
                  </span>
                </div>
              )}

              {/* Voice Recording Bar */}
              {isRecording && (
                <div className="ai-voice-recording-bar">
                  <div className="ai-voice-indicator">
                    <div className="ai-voice-pulse-dot" />
                    <span>বাংলা ভয়েস রেকর্ড হচ্ছে...</span>
                    <span className="ai-voice-timer font-mono">
                      {formatTimer(recordingSeconds)}
                    </span>
                  </div>
                  <div className="ai-voice-actions">
                    <button
                      type="button"
                      className="ai-btn-voice-cancel"
                      onClick={cancelRecording}
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      className="ai-btn-voice-confirm"
                      onClick={stopAndSubmitRecording}
                    >
                      ✓ শেষ করুন ও পাঠান
                    </button>
                  </div>
                </div>
              )}

              {/* Drop-Up Attachment Menu */}
              {isDropupOpen && (
                <div className="ai-dropup-menu">
                  <button
                    type="button"
                    className="ai-dropup-item"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <Camera className="ai-dropup-icon text-amber-400 w-4 h-4" />
                    <span className="ai-dropup-label">📷 মেমো / রশিদ স্ক্যান (OCR)</span>
                  </button>

                  <button
                    type="button"
                    className="ai-dropup-item"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <Paperclip className="ai-dropup-icon text-sky-400 w-4 h-4" />
                    <span className="ai-dropup-label">📁 ফাইল যুক্ত করুন</span>
                  </button>

                  <button
                    type="button"
                    className="ai-dropup-item"
                    onClick={() => {
                      setIsDropupOpen(false);
                      setInputText('আজকের মোট ক্যাশ ও বকেয়া পাওনার হিসাব দাও');
                      textareaRef.current?.focus();
                    }}
                  >
                    <Sparkles className="ai-dropup-icon text-purple-400 w-4 h-4" />
                    <span className="ai-dropup-label">⚡ কুইক প্রম্পট: ক্যাশ ও বকেয়া</span>
                  </button>
                </div>
              )}

              {/* Hidden File Input for OCR & attachments */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Unified Rounded Input Pill */}
              <div className="ai-input-container w-full flex flex-nowrap items-center">
                {/* Left + Button */}
                <button
                  id="ai-btn-attachment-menu"
                  type="button"
                  className="ai-pill-btn-plus"
                  onClick={() => setIsDropupOpen((prev) => !prev)}
                  title="সংযুক্তি ও OCR মেনু"
                >
                  <Plus className={`w-5 h-5 transition-transform duration-200 ${isDropupOpen ? 'rotate-45' : ''}`} />
                </button>

                {/* Auto-Expanding Textarea */}
                <textarea
                  id="ai-chat-textarea"
                  ref={textareaRef}
                  rows={1}
                  placeholder="Ai Manezar কে জিজ্ঞাসা করুন বা কোনো নির্দেশ দিন..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />

                {/* Right Controls */}
                <div className="ai-pill-right-controls">
                  <span className="ai-pill-model-badge hidden sm:inline-block">
                    Gemini 3 Flash
                  </span>

                  {/* Mic Button */}
                  <button
                    id="ai-btn-mic"
                    type="button"
                    className={`ai-pill-btn-mic ${isRecording ? 'recording' : ''}`}
                    onClick={() => {
                      if (isRecording) {
                        stopAndSubmitRecording();
                      } else {
                        startRecording();
                      }
                    }}
                    title={isRecording ? 'রেকর্ডিং থামান' : 'বাংলায় কথা বলুন (ভয়েস ইনপুট)'}
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  {/* Send Button */}
                  <button
                    id="ai-btn-send-message"
                    type="button"
                    disabled={(!inputText.trim() && !selectedImage) || isLoading}
                    className="ai-pill-btn-send"
                    onClick={() => handleSendMessage()}
                    title="পাঠান (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Footnote */}
              <div className="ai-input-footnote w-full text-center text-[10.5px] leading-tight opacity-70">
                Ai Manezar তথ্য ও ডাটাবেজ এন্ট্রির নির্ভুলতা নিশ্চিত করে • ডেটাবেজ পরিবর্তনের পূর্বে ৬০ দিনের রিস্টোর পয়েন্ট সুরক্ষিত থাকে
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
