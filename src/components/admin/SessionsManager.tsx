import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Layers, Play, Pause, Square, Lock, Unlock, Plus, Users } from 'lucide-react';
import { effectiveStatus, isValidSessionCode, normalizeSessionCode } from '../../lib/session';

interface SessionRow {
  id: string;
  code: string;
  name: string;
  status: string;
  acceptingParticipants: boolean;
  startingBalance: number;
  durationMinutes: number;
  createdMs: number;
  raw: any;
}

const toMs = (v: any) => (v?.toMillis ? v.toMillis() : 0);

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-blue-50 text-blue-700 border-blue-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export default function SessionsManager({
  selectedId,
  onSelect,
  notify,
}: {
  selectedId: string | null;
  onSelect: (id: string | null, code?: string) => void;
  notify: (type: 'success' | 'error', text: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [code, setCode] = useState(randomCode);
  const [name, setName] = useState('');
  const [startingBalance, setStartingBalance] = useState(100000);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'sessions'), (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          code: data.code || '',
          name: data.name || '',
          status: effectiveStatus(data),
          acceptingParticipants: data.acceptingParticipants !== false,
          startingBalance: Number(data.startingBalance) || 100000,
          durationMinutes: Number(data.durationMinutes) || 60,
          createdMs: toMs(data.createdAt),
          raw: data,
        };
      });
      list.sort((a, b) => b.createdMs - a.createdMs);
      setSessions(list);
    }, (err) => notify('error', `Sessions listener: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setParticipantCount(null);
    if (!selectedId) return;
    return onSnapshot(collection(db, 'sessions', selectedId, 'participants'), (snap) => setParticipantCount(snap.size));
  }, [selectedId]);

  const selected = useMemo(() => sessions.find((s) => s.id === selectedId) ?? null, [sessions, selectedId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeSessionCode(code);
    if (!isValidSessionCode(normalized)) return notify('error', 'Codes are 3–24 letters, numbers or dashes.');
    setBusy(true);
    try {
      const dupe = await getDocs(query(collection(db, 'sessions'), where('code', '==', normalized), limit(1)));
      if (!dupe.empty) { notify('error', `Session code ${normalized} is already in use.`); return; }
      const ref = await addDoc(collection(db, 'sessions'), {
        code: normalized,
        name: name.trim() || normalized,
        status: 'NOT_STARTED',
        acceptingParticipants: true,
        startingBalance,
        durationMinutes,
        createdAt: serverTimestamp(),
      });
      onSelect(ref.id, normalized);
      setCode(randomCode());
      setName('');
      notify('success', `Session ${normalized} created. Share the code with participants.`);
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (s: SessionRow, patch: any, label: string) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'sessions', s.id), patch);
      notify('success', `${s.code}: ${label}`);
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const start = (s: SessionRow) => {
    const now = Date.now();
    update(s, {
      status: 'RUNNING',
      startedAt: s.raw.startedAt || Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + s.durationMinutes * 60_000),
    }, 'market open');
  };

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 text-sm">Competition Sessions</h3>
          <p className="text-[11px] text-zinc-500">Participants join with a session code. Portfolios, trades, news and rankings are kept per session.</p>
        </div>
      </div>

      <form onSubmit={create} className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <label className="block">
          <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Code</span>
          <input value={code} onChange={(e) => setCode(normalizeSessionCode(e.target.value))} maxLength={24} className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg font-mono font-bold tracking-wider bg-white" />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Techfest Round 1" className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white" />
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Cash / Minutes</span>
          <div className="flex gap-1">
            <input type="number" min={1000} step={1000} value={startingBalance} onChange={(e) => setStartingBalance(Number(e.target.value) || 100000)} className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white" />
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)} className="w-16 px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white" />
          </div>
        </label>
        <button type="submit" disabled={busy} className={`${btn} justify-center py-2 bg-blue-600 border-blue-600 text-white hover:bg-blue-700`}>
          <Plus className="w-3.5 h-3.5" /> Create
        </button>
      </form>

      {sessions.length === 0 ? (
        <p className="text-xs text-zinc-500">No sessions yet. Create one to let participants join.</p>
      ) : (
        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
          {sessions.map((s) => {
            const isSel = s.id === selectedId;
            return (
              <div key={s.id} className={`p-3 flex flex-wrap items-center gap-3 ${isSel ? 'bg-blue-50/60' : 'bg-white'}`}>
                <button onClick={() => onSelect(isSel ? null : s.id, s.code)} className="text-left min-w-[160px] flex-1 cursor-pointer">
                  <div className="font-mono font-bold text-sm text-zinc-900 tracking-wider">{s.code}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{s.name} · ${s.startingBalance.toLocaleString()} · {s.durationMinutes} min</div>
                </button>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${STATUS_STYLE[s.status] || STATUS_STYLE.COMPLETED}`}>{s.status.replace('_', ' ')}</span>
                <span className={`text-[10px] font-bold uppercase ${s.acceptingParticipants && s.status !== 'COMPLETED' ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {s.acceptingParticipants && s.status !== 'COMPLETED' ? 'Joining open' : 'Joining closed'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(s.status === 'NOT_STARTED' || s.status === 'PAUSED') && (
                    <button disabled={busy} onClick={() => (s.status === 'PAUSED' ? update(s, { status: 'RUNNING' }, 'resumed') : start(s))} className={`${btn} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
                      <Play className="w-3 h-3" /> {s.status === 'PAUSED' ? 'Resume' : 'Start'}
                    </button>
                  )}
                  {s.status === 'RUNNING' && (
                    <button disabled={busy} onClick={() => update(s, { status: 'PAUSED' }, 'paused')} className={`${btn} border-amber-200 text-amber-700 hover:bg-amber-50`}>
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}
                  {s.status !== 'COMPLETED' && (
                    <button
                      disabled={busy}
                      onClick={() => window.confirm(`End ${s.code}? Trading stops and final rankings lock.`) && update(s, { status: 'COMPLETED', completedAt: serverTimestamp(), acceptingParticipants: false }, 'ended')}
                      className={`${btn} border-rose-200 text-rose-700 hover:bg-rose-50`}
                    >
                      <Square className="w-3 h-3" /> End
                    </button>
                  )}
                  {s.status !== 'COMPLETED' && (
                    <button disabled={busy} onClick={() => update(s, { acceptingParticipants: !s.acceptingParticipants }, s.acceptingParticipants ? 'joining closed' : 'joining reopened')} className={`${btn} border-zinc-200 text-zinc-700 hover:bg-zinc-50`}>
                      {s.acceptingParticipants ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {s.acceptingParticipants ? 'Close joining' : 'Open joining'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Users className="w-3.5 h-3.5" />
          <span>
            <span className="font-mono font-bold text-zinc-900">{selected.code}</span> selected · {participantCount ?? '…'} participant{participantCount === 1 ? '' : 's'} · news below publishes to this session
          </span>
        </div>
      )}
    </div>
  );
}
