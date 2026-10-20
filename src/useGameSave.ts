import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { createInitialGameState, normalizeGameState } from './game';
import type { GameState } from './types';

export const SAVE_KEY = 'athousandyearoldvampire_savegame';

function loadLocal(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try { return normalizeGameState(JSON.parse(raw)); }
      catch {
        localStorage.setItem(`${SAVE_KEY}_recovery`, raw);
      }
    }
  } catch { /* Storage can be unavailable in private browsers. */ }
  return createInitialGameState();
}

export function useGameSave() {
  const [game, setGame] = useState<GameState>(loadLocal);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState('이 기기에 자동 저장');
  const [error, setError] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [conflict, setConflict] = useState<GameState | null>(null);
  const current = useRef(game);
  const initialized = useRef(false);
  const uploaded = useRef('');
  current.current = game;

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    } catch {
      setError('기기 저장 공간을 사용할 수 없습니다. 기록을 파일로 내보내 보관해 주세요.');
    }
  }, [game]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => {
      setUser(account);
      initialized.current = false;
      setCloudReady(false);
      setConflict(null);
      setStatus(account ? '클라우드 기록 확인 중' : '이 기기에 자동 저장');
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const reference = doc(db, 'vampire_saves', user.uid);
    return onSnapshot(reference, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const raw = snapshot.data()?.gameState;
      if (typeof raw === 'string') {
        let remote: GameState;
        try { remote = normalizeGameState(JSON.parse(raw)); }
        catch {
          setError('클라우드 기록을 읽지 못했습니다. 기기의 기록은 보존되어 있습니다.');
          setCloudReady(false);
          return;
        }
        const remoteText = JSON.stringify(remote);
        const localText = JSON.stringify(normalizeGameState(current.current));
        if (remoteText !== localText && raw !== uploaded.current && remoteText !== uploaded.current) {
          if (!initialized.current && !current.current.characterName && !current.current.setupComplete) {
            setGame(remote);
          } else {
            setConflict(remote);
            setCloudReady(false);
            setStatus('저장할 기록 선택 필요');
            return;
          }
        }
      }
      initialized.current = true;
      setCloudReady(true);
      setStatus('클라우드와 동기화됨');
    }, () => {
      setCloudReady(false);
      setStatus('이 기기에 자동 저장');
      setError('클라우드에 연결하지 못했습니다. 이 기기에서는 계속 기록할 수 있습니다.');
    });
  }, [user]);

  useEffect(() => {
    if (!user || !db || !cloudReady || conflict) return;
    setStatus('클라우드에 저장 중');
    const timer = setTimeout(async () => {
      const serialized = JSON.stringify(game);
      uploaded.current = serialized;
      try {
        await setDoc(doc(db!, 'vampire_saves', user.uid), { gameState: serialized }, { merge: true });
        setStatus('클라우드와 동기화됨');
      } catch {
        setStatus('이 기기에 자동 저장');
        setError('클라우드 저장에 실패했습니다. 기록은 이 기기에 저장되어 있습니다.');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [game, user, cloudReady, conflict]);

  const chooseSave = (source: 'local' | 'cloud') => {
    try {
      localStorage.setItem(`${SAVE_KEY}_backup`, JSON.stringify(current.current));
      if (conflict) localStorage.setItem(`${SAVE_KEY}_cloud_backup`, JSON.stringify(conflict));
    } catch { /* optional backup */ }
    if (source === 'cloud' && conflict) setGame(conflict);
    setConflict(null);
    initialized.current = true;
    setCloudReady(true);
  };

  const login = async () => {
    try { if (auth) await signInWithPopup(auth, googleProvider); }
    catch (cause) {
      const code = (cause as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user') {
        setError('로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 기기 저장은 계속됩니다.');
      }
    }
  };
  const logout = async () => {
    try { if (auth) await signOut(auth); }
    catch { setError('로그아웃에 실패했습니다. 다시 시도해 주세요.'); }
  };

  return { game, setGame, user, status, error, dismissError: () => setError(''), conflict, chooseSave, login, logout };
}
