import React, { useState, useEffect, useMemo } from 'react';
import {
  NotebookPen,
  Search,
  Plus,
  Pin,
  PinOff,
  Copy,
  Check,
  Edit3,
  Trash2,
  X,
  FileText,
  AlertCircle,
  Tag,
  Clock,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Note } from '../../types';
import { dbService } from '../../services/api';
import { toBnDigits, formatDate } from '../../utils/bengaliNumbers';

const CATEGORIES = [
  { id: 'ALL', label: 'সবগুলো নোট', color: 'slate' },
  { id: 'PINNED', label: '📌 পিনকৃত', color: 'amber' },
  { id: 'সাধারণ', label: 'সাধারণ', color: 'sky' },
  { id: 'জরুরি হিসাব', label: 'জরুরি হিসাব', color: 'rose' },
  { id: 'বেপারী স্মরণিকা', label: 'বেপারী স্মরণিকা', color: 'purple' },
  { id: 'দরদাম', label: 'দরদাম', color: 'emerald' },
];

export const NotebookView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('সাধারণ');
  const [formContent, setFormContent] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Copy feedback tracking
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Quick Inline Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await dbService.notes.getAll();
      setNotes(data);
    } catch (err: any) {
      console.error('Failed to load notes:', err);
      showToast('নোট লোড করতে সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Category filter
    if (selectedCategory === 'PINNED') {
      result = result.filter((n) => n.is_pinned === 1);
    } else if (selectedCategory !== 'ALL') {
      result = result.filter((n) => n.category === selectedCategory);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          n.category.toLowerCase().includes(q)
      );
    }

    // Sort: Pinned first, then by updated_at descending
    return result.sort((a, b) => {
      if ((b.is_pinned || 0) !== (a.is_pinned || 0)) {
        return (b.is_pinned || 0) - (a.is_pinned || 0);
      }
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
  }, [notes, selectedCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = notes.length;
    const pinned = notes.filter((n) => n.is_pinned === 1).length;
    const urgent = notes.filter((n) => n.category === 'জরুরি হিসাব').length;
    const rate = notes.filter((n) => n.category === 'দরদাম').length;
    const party = notes.filter((n) => n.category === 'বেপারী স্মরণিকা').length;
    return { total, pinned, urgent, rate, party };
  }, [notes]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormCategory('সাধারণ');
    setFormContent('');
    setFormIsPinned(false);
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormCategory(note.category || 'সাধারণ');
    setFormContent(note.content || '');
    setFormIsPinned(note.is_pinned === 1);
    setFormError('');
    setIsModalOpen(true);
  };

  // Save Note (Create or Update)
  const handleSaveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('দয়া করে নোটের একটি শিরোনাম লিখুন');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingNote) {
        // Update
        const updated = await dbService.notes.update(editingNote.id, {
          title: formTitle.trim(),
          category: formCategory,
          content: formContent.trim(),
          is_pinned: formIsPinned ? 1 : 0,
        });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        showToast('নোটটি সফলভাবে আপডেট হয়েছে', 'success');
      } else {
        // Create
        const created = await dbService.notes.create({
          title: formTitle.trim(),
          category: formCategory,
          content: formContent.trim(),
          is_pinned: formIsPinned ? 1 : 0,
        });
        setNotes((prev) => [created, ...prev]);
        showToast('নতুন নোট সফলভাবে সংরক্ষণ করা হয়েছে', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save note:', err);
      setFormError(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (id: number, currentPinned: number) => {
    try {
      const res = await dbService.notes.togglePin(id);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_pinned: res.is_pinned } : n))
      );
      showToast(
        res.is_pinned === 1 ? 'নোটটি শীর্ষে পিন করা হয়েছে 📌' : 'নোটটি আনপিন করা হয়েছে',
        'success'
      );
    } catch (err: any) {
      showToast('পিন অবস্থা পরিবর্তন করা সম্ভব হয়নি', 'error');
    }
  };

  // Delete Note
  const handleDeleteNote = async (id: number, title: string) => {
    if (!window.confirm(`আপনি কি "${title}" নোটটি মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      const res = await dbService.notes.delete(id);
      if (res.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        showToast('নোটটি মুছে ফেলা হয়েছে', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('নোট মোছা সম্ভব হয়নি', 'error');
    }
  };

  // Copy Note Text to Clipboard
  const handleCopyNote = (note: Note) => {
    const textToCopy = `${note.title}\n[ক্যাটাগরি: ${note.category}]\n\n${note.content || ''}`.trim();
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(note.id);
    showToast('নোটের লেখা ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
    setTimeout(() => {
      setCopiedId((cur) => (cur === note.id ? null : cur));
    }, 2000);
  };

  // Helper for Category Badge Color
  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'জরুরি হিসাব':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'দরদাম':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'বেপারী স্মরণিকা':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
  };

  // Format Date in Bengali
  const formatNoteTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const formattedDate = formatDate(d.toISOString().split('T')[0]);
      const hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedDate}, ${toBnDigits(formattedHours)}:${toBnDigits(minutes)} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-12 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border flex items-center gap-2 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-600'
                : 'bg-rose-950 text-rose-200 border-rose-600'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Summary & Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border-color)] p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">মোট নোট সংখ্যা</p>
            <p className="text-xl font-black text-[var(--text-primary)] mt-0.5">
              {toBnDigits(stats.total)} <span className="text-xs font-normal text-[var(--text-secondary)]">টি</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <NotebookPen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border-color)] p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">শীর্ষে পিনকৃত নোট</p>
            <p className="text-xl font-black text-amber-400 mt-0.5">
              {toBnDigits(stats.pinned)} <span className="text-xs font-normal text-[var(--text-secondary)]">টি</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Pin className="w-5 h-5 fill-amber-400" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border-color)] p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">জরুরি হিসাব ও তাগাদা</p>
            <p className="text-xl font-black text-rose-400 mt-0.5">
              {toBnDigits(stats.urgent)} <span className="text-xs font-normal text-[var(--text-secondary)]">টি</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border-color)] p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">শস্য দরদাম ও স্মরণিকা</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">
              {toBnDigits(stats.rate + stats.party)} <span className="text-xs font-normal text-[var(--text-secondary)]">টি</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Categories, Search & Add Button */}
      <div className="bg-[var(--surface)] border border-[var(--border-color)] p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-[var(--surface-secondary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search & Add Note Button */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="নোট খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-hidden focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Note Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন নোট লিখুন</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="text-center py-16 bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl">
          <NotebookPen className="w-10 h-10 text-amber-500/60 mx-auto animate-pulse mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">নোটবুক লোড হচ্ছে...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto mb-3">
            <NotebookPen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">কোনো নোট পাওয়া যায়নি</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `"${searchQuery}" এর সাথে মিল রয়েছে এমন কোনো নোট খুঁজে পাওয়া যায়নি।`
              : 'জরুরি হিসাব, বাজার দরদাম বা বেপারী স্মরণিকা সংরক্ষণ করতে নতুন নোট তৈরি করুন।'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>প্রথম নোটটি লিখুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredNotes.map((note) => {
            const isPinned = note.is_pinned === 1;

            return (
              <div
                key={note.id}
                className={`group flex flex-col justify-between rounded-2xl border transition-all duration-200 relative p-4 ${
                  isPinned
                    ? 'bg-[var(--surface)] border-amber-500/60 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/20'
                    : 'bg-[var(--surface)] border-[var(--border-color)] hover:border-amber-500/40 hover:shadow-md'
                }`}
              >
                {/* Top Row: Category Pill & Pin Button */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryBadgeStyle(
                        note.category
                      )}`}
                    >
                      {note.category}
                    </span>
                    {isPinned && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Pin className="w-2.5 h-2.5 fill-amber-400" />
                        <span>পিনকৃত</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(note.id, note.is_pinned)}
                      title={isPinned ? 'আনপিন করুন' : 'শীর্ষে পিন করুন'}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isPinned
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-secondary)] hover:text-white'
                      }`}
                    >
                      {isPinned ? (
                        <Pin className="w-3.5 h-3.5 fill-amber-400" />
                      ) : (
                        <PinOff className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Note Title */}
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-2 line-clamp-2 leading-snug">
                  {note.title}
                </h4>

                {/* Note Content */}
                <div className="flex-1 mb-3">
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-sans leading-relaxed line-clamp-6">
                    {note.content || <span className="italic text-[var(--text-secondary)]/50">কোনো বিস্তারিত লেখা নেই</span>}
                  </p>
                </div>

                {/* Footer: Date & Action Buttons */}
                <div className="pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between gap-1 text-[11px] text-[var(--text-secondary)] mt-auto">
                  <div className="flex items-center gap-1 font-mono text-[10px] truncate" title={note.updated_at || note.created_at}>
                    <Clock className="w-3 h-3 shrink-0 opacity-70" />
                    <span>{formatNoteTime(note.updated_at || note.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopyNote(note)}
                      title="ক্লিপবোর্ডে কপি করুন"
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEditModal(note)}
                      title="নোট সংশোধন করুন"
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteNote(note.id, note.title)}
                      title="নোট মুছে ফেলুন"
                      className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--surface-secondary)]/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <NotebookPen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {editingNote ? 'নোট সংশোধন করুন' : 'নতুন নোট এন্ট্রি'}
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    জরুরি হিসাব, দরদাম ও চালানের বিবরণ সংরক্ষণ করুন
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveNote} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  নোটের শিরোনাম <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="যেমন: চলনবিল হাটের সরিষার দর / করিম বেপারীর তাগাদা"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-hidden focus:border-amber-500 transition-colors font-medium"
                />
              </div>

              {/* Category & Pin Option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    ক্যাটাগরি
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-hidden focus:border-amber-500 transition-colors font-medium cursor-pointer"
                  >
                    <option value="সাধারণ">সাধারণ</option>
                    <option value="জরুরি হিসাব">জরুরি হিসাব</option>
                    <option value="বেপারী স্মরণিকা">বেপারী স্মরণিকা</option>
                    <option value="দরদাম">দরদাম</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 mt-4 text-xs font-bold text-[var(--text-primary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-[var(--surface-secondary)] border-[var(--border-color)] focus:ring-amber-500 cursor-pointer"
                    />
                    <span>📌 শীর্ষে পিন করে রাখুন</span>
                  </label>
                </div>
              </div>

              {/* Note Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  বিস্তারিত বিবরণ / হিসাব / মন্তব্য
                </label>
                <textarea
                  rows={6}
                  placeholder="এখানে প্রয়োজনীয় হিসাব, দরদাম, চালানের তথ্য, বকেয়ার তাগাদা বা যেকোনো টোকা লিখুন..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-hidden focus:border-amber-500 transition-colors font-sans leading-relaxed resize-y"
                />
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  টিপস: কিবোর্ডে একাধিক লাইন লিখে সংরক্ষণ করতে পারেন।
                </p>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : editingNote ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

