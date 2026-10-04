import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { getSessionByCode, joinSession } from '../lib/sessionManager';
import { db } from '../firebase';
import { COLLECTIONS } from '../lib/shared-types';
import { TrendingUp, Hash, ArrowRight, AlertCircle } from 'lucide-react';

export default function JoinSession() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || userData?.role !== 'participant' || !userData.currentSessionId) return;

    return onSnapshot(
      doc(db, COLLECTIONS.SESSIONS, userData.currentSessionId),
      async (snap) => {
        const status = snap.exists() ? snap.data().status : 'ENDED';
        if (status === 'ENDED') {
          await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
            currentSessionId: null,
          }, { merge: true });
          return;
        }
        navigate(`/session/${userData.currentSessionId}`, { replace: true });
      }
    );
  }, [navigate, user, userData?.currentSessionId, userData?.role]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    setError('');
    setLoading(true);
    try {
      const session = await getSessionByCode(code);
      if (!session) {
        setError('Session not found. Check the code and try again.');
        return;
      }
      if (session.status === 'ENDED') {
        setError('This session has already ended.');
        return;
      }
      await joinSession(session.id, user.uid, user.displayName || user.email?.split('@')[0] || 'Player', session.startingCash);
      navigate(`/session/${session.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900">Join FinQuest</h1>
          <p className="text-sm text-zinc-500">Enter the session code from your event admin</p>
        </div>

        <form onSubmit={handleJoin} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> Session Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FQ2024"
              maxLength={8}
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-mono font-bold text-center tracking-widest text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {loading ? 'Joining...' : (
              <><ArrowRight className="w-4 h-4" /> Join Session</>
            )}
          </button>
        </form>

        {userData?.role === 'admin' && (
          <p className="text-center text-xs text-zinc-400">
            Admin? <button onClick={() => navigate('/admin')} className="text-blue-600 font-semibold hover:underline cursor-pointer">Go to Admin Panel</button>
          </p>
        )}
      </div>
    </div>
  );
}
