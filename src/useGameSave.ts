import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { createInitialGameState, normalizeGameState } from './game';
import { SAVE_KEY, parseSave, saveBackup } from './storage';
import type { GameState } from './types';

function loadLocal(): { game: GameState; error: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try { return { game: parseSave(raw), error: '' }; }
      catch {
        localStorage.setItem(`${SAVE_KEY}_recovery`, raw);
        return { game: createInitialGameState(), error: '기기 기록을 읽지 못했습니다. 복구함에 원본을 보관했습니다.' };
      }
    }
  } catch { return { game: createInitialGameState(), error: '기기 저장 공간을 읽지 못했습니다. 파일 내보내기로 기록을 보관해 주세요.' }; }
  return { game: createInitialGameState(), error: '' };
}
const canonical = (game: GameState) => JSON.stringify(normalizeGameState(game));
class RemoteChanged extends Error {
  readonly raw: string | null;
  constructor(raw: string | null) { super('remote-changed'); this.raw = raw; }
}
interface SyncSession { uid: string; active: boolean; raw: string | null; uploaded: string; writing: boolean }

export function useGameSave() {
  const [loaded] = useState(loadLocal);
  const [game, setGame] = useState<GameState>(loaded.game);
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState('');
  const [localError, setLocalError] = useState('');
  const [error, setError] = useState(loaded.error);
  const [cloudReady, setCloudReady] = useState(false);
  const [conflict, setConflict] = useState<GameState | null>(null);
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState(0);
  const current = useRef(game);
  const initialized = useRef(false);
  const session = useRef<SyncSession | null>(null);
  current.current = game;

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      setLocalError('');
    } catch { setLocalError('기기 저장 공간을 사용할 수 없습니다. 기록을 파일로 내보내 보관해 주세요.'); }
  }, [game, connection]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => {
      if (session.current) session.current.active = false;
      setUser(account);
      initialized.current = false;
      setCloudReady(false);
      setConflict(null);
      setCloudStatus(account ? '클라우드 기록 확인 중' : '');
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const knownServer = session.current?.uid === user.uid && initialized.current ? session.current.raw : undefined;
    const scope: SyncSession = { uid: user.uid, active: true, raw: knownServer ?? null, uploaded: '', writing: false };
    session.current = scope;
    initialized.current = knownServer !== undefined;
    setCloudReady(false);
    setCloudStatus('클라우드 기록 확인 중');
    const unsubscribe = onSnapshot(doc(db, 'vampire_saves', user.uid), { includeMetadataChanges: true }, (snapshot) => {
      // A cached empty document cannot authorize overwriting the server's save.
      if (!scope.active || snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
      const value = snapshot.data()?.gameState;
      if (value !== undefined && typeof value !== 'string') {
        setCloudReady(false);
        setCloudStatus('클라우드 기록 확인 필요');
        setError('클라우드 기록 형식이 올바르지 않습니다. 덮어쓰기를 멈췄습니다.');
        return;
      }
      const previousRaw = scope.raw;
      scope.raw = value ?? null;
      if (typeof value === 'string') {
        let remote: GameState;
        try { remote = parseSave(value); }
        catch {
          setError('클라우드 기록을 읽지 못했습니다. 기기의 기록은 보존되어 있습니다.');
          setCloudStatus('클라우드 기록 확인 필요');
          setCloudReady(false);
          return;
        }
        if (canonical(remote) !== canonical(current.current) && value !== scope.uploaded && !(initialized.current && value === previousRaw)) {
          if (!initialized.current && !current.current.characterName && !current.current.setupComplete) setGame(remote);
          else {
            setConflict(remote);
            setCloudReady(false);
            setCloudStatus('저장할 기록 선택 필요');
            return;
          }
        }
      }
      initialized.current = true;
      setCloudReady(true);
      setCloudStatus('클라우드와 동기화됨');
      setRevision(value => value + 1);
    }, () => {
      if (!scope.active) return;
      setCloudReady(false);
      setCloudStatus('기기 저장 · 클라우드 연결 끊김');
      setError('클라우드에 연결하지 못했습니다. 이 기기에서는 계속 기록할 수 있습니다.');
    });
    return () => { scope.active = false; unsubscribe(); };
  }, [user, connection]);

  useEffect(() => {
    const scope = session.current;
    if (!user || !db || !scope?.active || !cloudReady || conflict || scope.writing) return;
    const serialized = JSON.stringify(game);
    if (scope.raw === serialized || (scope.raw && canonical(parseSave(scope.raw)) === canonical(game))) {
      setCloudStatus('클라우드와 동기화됨');
      return;
    }
    setCloudStatus('클라우드에 저장 중');
    const timer = setTimeout(async () => {
      const expected = scope.raw;
      scope.writing = true;
      scope.uploaded = serialized;
      try {
        await runTransaction(db!, async transaction => {
          const reference = doc(db!, 'vampire_saves', user.uid);
          const snapshot = await transaction.get(reference);
          const raw = snapshot.data()?.gameState ?? null;
          // Recheck inside the transaction: another device may have written since our listener ran.
          if (raw !== expected && raw !== serialized) throw new RemoteChanged(typeof raw === 'string' ? raw : null);
          transaction.set(reference, { gameState: serialized }, { merge: true });
        });
        if (!scope.active) return;
        scope.raw = serialized;
        setCloudStatus('클라우드와 동기화됨');
      } catch (cause) {
        if (!scope.active) return;
        scope.uploaded = '';
        setCloudReady(false);
        if (cause instanceof RemoteChanged) {
          try {
            if (!cause.raw) throw new Error('missing', { cause });
            scope.raw = cause.raw;
            setConflict(parseSave(cause.raw));
            setCloudStatus('저장할 기록 선택 필요');
          } catch {
            setCloudStatus('클라우드 기록 확인 필요');
            setError('클라우드 기록이 바뀌었습니다. 다시 연결해 확인해 주세요. 기기 기록은 보존됩니다.');
          }
        } else {
          setCloudStatus('기기 저장 · 클라우드 저장 실패');
          setError('클라우드 저장에 실패했습니다. 다시 연결하거나 파일로 내보내 주세요.');
        }
      } finally {
        scope.writing = false;
        if (scope.active) setRevision(value => value + 1);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [game, user, cloudReady, conflict, revision]);

  const chooseSave = (source: 'local' | 'cloud') => {
    try {
      saveBackup(current.current);
      if (conflict) saveBackup(conflict, '', '', 'cloud_backup');
    } catch { setError('복구본을 저장하지 못했습니다. 선택하지 않은 기록은 파일로 보관해 주세요.'); return; }
    if (source === 'cloud' && conflict) setGame(conflict);
    setConflict(null);
    initialized.current = true;
    setCloudReady(true);
  };
  const retry = () => { setError(''); setConnection(value => value + 1); };
  const login = async () => {
    try { if (auth) await signInWithPopup(auth, googleProvider); }
    catch (cause) {
      if ((cause as { code?: string }).code !== 'auth/popup-closed-by-user') setError('로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };
  const logout = async () => {
    try { if (auth) await signOut(auth); }
    catch { setError('로그아웃에 실패했습니다. 다시 시도해 주세요.'); }
  };
  return { game, setGame, user, status: localError ? '기기 저장 실패' : user ? cloudStatus : '이 기기에 저장됨',
    error: localError || error, dismissError: () => setError(''), conflict, chooseSave, login, logout, retry };
}
