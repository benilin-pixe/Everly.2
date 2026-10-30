import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AuthorizedUser, MemoryNote } from '../types';
import {
  getStoredMemoryNotes,
  saveNewMemoryNote,
  deleteMemoryNote,
} from '../services/storageService';
import {
  subscribeFirestoreMemoryNotes,
  addMemoryNoteToFirestore,
  deleteMemoryNoteFromFirestore,
  saveLocalDraft,
  getLocalDraft,
  clearLocalDraft,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
} from '../services/firestoreService';
import { firebaseAuth, launchGoogleSignIn } from '../services/firebaseAuth';
import {
  MessageSquareHeart,
  Send,
  Trash2,
  Calendar,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  Clock,
  Radio,
  AlertCircle,
  LogIn,
} from 'lucide-react';

interface MemoryBoardTabProps {
  currentUser: AuthorizedUser;
}

export const MemoryBoardTab: React.FC<MemoryBoardTabProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<MemoryNote[]>([]);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncedWithFirestore, setIsSyncedWithFirestore] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'draft-saved' | 'saving' | 'synced' | 'local-only'>('idle');

  // Firebase Authentication State (Requirement 3: Wait for Firebase Auth before attaching protected listeners)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(firebaseAuth.currentUser);
  const [isConnectingFirebase, setIsConnectingFirebase] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load initial local cache
    setMessages(getStoredMemoryNotes());

    // 2. Recover any unsaved draft
    const savedDraft = getLocalDraft();
    if (savedDraft) {
      setContent(savedDraft);
      setSaveStatus('draft-saved');
    }

    let unsubscribeFirestore: (() => void) | null = null;

    // 3. Wait for Firebase authentication to finish before attaching protected listeners (Requirement 3)
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setPermissionNotice(null);

      // Clean up previous Firestore listener on session or membership change
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (user && user.email) {
        // Authenticated in Firebase: attach live Firestore subscription
        unsubscribeFirestore = subscribeFirestoreMemoryNotes(
          (firestoreNotes) => {
            if (firestoreNotes.length > 0) {
              setMessages(firestoreNotes);
              setIsSyncedWithFirestore(true);
              setSaveStatus('synced');
            }
          },
          (err: any) => {
            // Stop retry loop on permission-denied (Requirement 3)
            if (err?.code === 'permission-denied') {
              setPermissionNotice('Cloud database security rules require verified co-owner authorization.');
              setSaveStatus('local-only');
            } else {
              console.warn('[Firestore] Memory board live sync notice:', err?.message || err);
            }
          }
        );
      } else {
        // Unauthenticated in Firebase: operate safely in Local Vault mode without triggering permission error
        setIsSyncedWithFirestore(false);
        setSaveStatus((prev) => (prev === 'synced' ? 'local-only' : prev));
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [currentUser.email]);

  const handleConnectCloudSync = async () => {
    setIsConnectingFirebase(true);
    setPermissionNotice(null);
    try {
      await launchGoogleSignIn();
    } catch (err: any) {
      if (!err?.isCancelled) {
        setPermissionNotice(err?.message || 'Could not connect Firebase session.');
      }
    } finally {
      setIsConnectingFirebase(false);
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    saveLocalDraft(val);
    if (val.trim()) {
      setSaveStatus('draft-saved');
    } else {
      setSaveStatus('idle');
    }
    if (error) setError(null);
  };

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Message content cannot be empty.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    setSaveStatus('saving');

    try {
      const newMsg = saveNewMemoryNote(
        content.trim(),
        'memory',
        'rose',
        currentUser,
        false
      );
      setMessages((prev) => [newMsg, ...prev.filter((m) => m.id !== newMsg.id)]);
      setContent('');
      clearLocalDraft();

      // Persist to Cloud Firestore if Firebase authenticated
      const synced = await addMemoryNoteToFirestore(newMsg);
      if (synced) {
        setIsSyncedWithFirestore(true);
        setSaveStatus('synced');
      } else {
        setSaveStatus('local-only');
      }
    } catch (err: any) {
      console.warn('[Firestore] Stored locally; Firestore sync pending:', err?.message || err);
      setSaveStatus('local-only');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    const updated = deleteMemoryNote(id);
    setMessages(updated);
    try {
      await deleteMemoryNoteFromFirestore(id);
    } catch (err) {
      console.warn('[Firestore] Error deleting note from Firestore:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-500/15">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <MessageSquareHeart className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Message Board
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            A secure space for shared memories, inside jokes, and everyday notes.
          </p>
        </div>
        
        {/* Auth & Cloud Status Pill */}
        <div className="flex flex-wrap items-center gap-2">
          {firebaseUser ? (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cloud Realtime Synced</span>
            </div>
          ) : (
            <button
              onClick={handleConnectCloudSync}
              disabled={isConnectingFirebase}
              className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              title="Connect Firebase Auth to enable cloud database sync"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isConnectingFirebase ? 'Connecting...' : 'Connect Cloud Sync'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})</span>
          </div>
        </div>
      </div>

      {/* Permission Warning Notice (if any) */}
      {permissionNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{permissionNotice} Local notes and edits remain preserved in your private vault.</span>
        </div>
      )}

      {/* Posting Form */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-5 shadow-xl shadow-rose-950/20">
        <form onSubmit={handlePostMessage} className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-rose-300">
              Post New Message
            </label>
            <span className="text-xs text-slate-500">
              {content.length} / 1000 characters
            </span>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Write a message, update, or note for the board..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/25 transition-all resize-none shadow-inner"
          />

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${currentUser ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>Visible to authorized owners</span>
              </div>

              {saveStatus === 'draft-saved' && (
                <span className="flex items-center gap-1 text-[11px] text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Draft saved locally</span>
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[11px] text-sky-300 font-medium bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  <Cloud className="w-3 h-3 text-sky-400 animate-pulse" />
                  <span>Saving to cloud...</span>
                </span>
              )}
              {saveStatus === 'synced' && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Cloud synced</span>
                </span>
              )}
              {saveStatus === 'local-only' && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/50">
                  <span>Saved to local vault</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium text-sm shadow-lg shadow-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Posting...' : 'Post Message'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Messages List / Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Recent Messages ({messages.length})
          </h3>
          <span className="text-xs text-slate-500">
            Shared between BeniLin & Shana Love
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <MessageSquareHeart className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No messages on the board yet.</p>
            <p className="text-xs text-slate-500 mt-1">Post a love note, announcement, or milestone above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-900/70 border border-slate-800/80 hover:border-rose-500/30 p-4 sm:p-5 rounded-2xl shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${msg.author.avatarColor || 'from-rose-500 to-amber-600'} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md`}>
                        {msg.author.avatarInitials || 'EV'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {msg.author.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 font-medium border border-rose-500/20">
                            {msg.author.role}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            {new Date(msg.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed pt-1">
                          {msg.content}
                        </p>
                      </div>
                    </div>

                    {/* Delete action */}
                    {(currentUser.role === 'Owner' || currentUser.email === msg.author.email) && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                        title="Delete message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
