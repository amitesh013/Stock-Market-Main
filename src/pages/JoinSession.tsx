import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { JoinError, JoinErrorCode, normalizeSessionCode, useSession } from '../lib/session';
import joinBg from '../assets/bg/dashboard-bg.jpg';

const ERRORS: Record<JoinErrorCode, { title: string; body: string }> = {
  NOT_FOUND: { title: 'Session not found', body: 'Check the session code and try again.' },
  CLOSED: { title: 'Session closed', body: 'This competition is no longer accepting participants.' },
  INVALID: { title: 'Invalid code', body: 'Session codes use letters, numbers and dashes.' },
  UNAVAILABLE: { title: 'Unable to join', body: 'The competition server could not be reached. Try again in a moment.' },
};

export default function JoinSession() {
  const { userData, signOut } = useAuth();
  const { join, phase, sessionCode } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<JoinErrorCode | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await join(code);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof JoinError ? err.code : 'UNAVAILABLE');
    } finally {
      setSubmitting(false);
    }
  };

  const err = error ? ERRORS[error] : null;

  return (
    <div className="relative min-h-screen bg-[#06090B] text-[#F3F5F4] font-sans flex flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `url(${joinBg})`, backgroundSize: 'cover', backgroundPosition: '65% 45%' }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,rgba(6,9,11,0.55)_0%,rgba(6,9,11,0.92)_100%)]" />
      </div>

      <header className="relative z-[1] flex items-center justify-between px-4 sm:px-8 h-14 border-b border-[#26343C] bg-[#06090B]/80 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Activity className="w-6 h-6 text-[#3B82FF]" strokeWidth={1.75} />
          <span className="text-[15px] font-semibold tracking-tight">StotraSim</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#A4AFB4]">
          <span className="hidden sm:inline truncate max-w-[200px]">{userData?.name || 'Trader'}</span>
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="w-8 h-8 flex items-center justify-center text-[#65737A] hover:text-[#F3F5F4] hover:bg-[#111A20] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="relative z-[1] flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#3B82FF] text-center">Join Competition</div>
          <h1 className="mt-3 text-center text-3xl sm:text-4xl font-semibold tracking-tight">Enter Session Code</h1>
          <p className="mt-3 text-center text-sm text-[#A4AFB4]">Enter the session code provided by the administrator.</p>

          <form onSubmit={submit} className="mt-8 rounded-md border border-[#26343C] bg-[#0D1419]/90 backdrop-blur p-6">
            <label htmlFor="session-code" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#65737A]">
              Session code
            </label>
            <input
              id="session-code"
              value={code}
              onChange={(e) => { setCode(normalizeSessionCode(e.target.value)); setError(null); }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              placeholder="e.g. TECHFEST-01"
              aria-invalid={!!err}
              aria-describedby={err ? 'join-error' : undefined}
              className={`mt-2 w-full h-14 rounded-md bg-[#06090B] border px-4 text-center text-2xl font-semibold tracking-[0.2em] tabular-nums placeholder:text-[#34444D] placeholder:tracking-[0.1em] placeholder:text-lg focus:outline-none focus:ring-2 transition-colors ${
                err ? 'border-[#FF4D5A]/60 focus:ring-[#FF4D5A]/30' : 'border-[#34444D] focus:border-[#3B82FF] focus:ring-[#3B82FF]/30'
              }`}
            />

            {err && (
              <div id="join-error" role="alert" className="mt-4 rounded-md border border-[#FF4D5A]/40 bg-[#FF4D5A]/10 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF4D5A]">{err.title}</div>
                <div className="mt-1 text-[13px] text-[#F3F5F4]/85">{err.body}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={!code.trim() || submitting}
              className="mt-5 w-full h-12 rounded-md bg-[#3B82FF] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1419]"
            >
              {submitting ? 'Joining…' : <>Join Session <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          {phase === 'ready' && sessionCode && (
            <p className="mt-5 text-center text-[13px] text-[#A4AFB4]">
              Currently in <span className="font-semibold text-[#F3F5F4] tabular-nums">{sessionCode}</span>.{' '}
              <Link to="/" className="text-[#3B82FF] hover:underline">Return to dashboard</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
