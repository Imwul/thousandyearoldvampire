import React, { useState, useEffect } from 'react';
import { gamePrompts, PromptEntry } from './data/prompts';
import { alternatePrompts } from './data/alternatePrompts';
import { GameState, Memory, Experience, Skill, Resource, Character, Mark, DiaryEntry, JournalEntry } from './types';

// --- Firebase Authentication & Firestore Sync ---
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { LogIn, LogOut } from 'lucide-react';


// --- Inline SVG Icons for Complete Offline Standalone Theme ---
const IconScroll = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const IconDices = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="10" height="10" rx="2" ry="2"/><rect x="12" y="7" width="10" height="10" rx="2" ry="2" transform="rotate(15 17 12)"/><circle cx="7" cy="12" r="1"/><circle cx="15" cy="10" r="1"/><circle cx="19" cy="14" r="1"/></svg>
);
const IconFeather = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
);
const IconBook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
);
const IconSword = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
);
const IconCoins = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><circle cx="18" cy="18" r="4"/><path d="M12 14a6 6 0 0 1 6-6"/></svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconSkull = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C7.58 2 4 5.58 4 10c0 2.83 1.47 5.31 3.68 6.74l-.68 3.38a1 1 0 0 0 .98 1.2h8.04a1 1 0 0 0 .98-1.2l-.68-3.38C18.53 15.31 20 12.83 20 10c0-4.42-3.58-8-8-8z"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><path d="M10 16h4"/></svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
const IconArchive = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
);
const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 16 14"/></svg>
);
const IconReset = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
);

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
);

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ marginRight: '4px' }}>
    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.357-2.847-6.357-6.357s2.847-6.357 6.357-6.357c1.623 0 3.096.61 4.237 1.62l3.056-3.056C19.223 2.507 15.938 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.897 0 10.867-4.148 10.867-11.24 0-.568-.06-1.125-.174-1.668H12.24z"/>
  </svg>
);

const LOCAL_STORAGE_KEY = 'athousandyearoldvampire_savegame';

// Create 5 empty memory slots
const createInitialMemories = (): Memory[] => [
  { id: 'm1', experiences: [] },
  { id: 'm2', experiences: [] },
  { id: 'm3', experiences: [] },
  { id: 'm4', experiences: [] },
  { id: 'm5', experiences: [] },
];

const initialGameState: GameState = {
  currentPromptId: 1,
  promptVisitHistory: { 1: 1 }, // Initialized to prompt 1, visited 1 time
  memories: createInitialMemories(),
  diary: [],
  skills: [],
  resources: [],
  characters: [],
  marks: [],
  journal: [],
  isGameOver: false,
  gameOverText: '',
  characterName: '',
  vampireOrigin: '',
  isAltActive: false,
  activeAltIdx: null,
};

function App() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [activeTab, setActiveTab] = useState<'setup' | 'memories' | 'skills' | 'resources' | 'characters' | 'marks' | 'diary' | 'manual'>('setup');
  
  // Dice and Action states
  const [d10Val, setD10Val] = useState<number | null>(null);
  const [d6Val, setD6Val] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  
  // Editor input states
  const [currentJournalText, setCurrentJournalText] = useState('');
  const [newExperienceInputs, setNewExperienceInputs] = useState<Record<string, string>>({});
  const [newSkillName, setNewSkillName] = useState('');
  const [newResourceName, setNewResourceName] = useState('');
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterType, setNewCharacterType] = useState<'mortal' | 'immortal'>('mortal');
  const [newMarkDesc, setNewMarkDesc] = useState('');

  // Journal editing states
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingJournalText, setEditingJournalText] = useState<string>('');

  // Experience editing states
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [editingExperienceText, setEditingExperienceText] = useState<string>('');

  const [user, setUser] = useState<User | null>(null);

  // Firebase Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      setUser(currentUser);
      if (!currentUser) {
        // When logged out, load local save to continue playing offline
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            setGameState(JSON.parse(saved));
            if (!saved || !JSON.parse(saved).characterName) setActiveTab('setup'); else setActiveTab('memories');
          } catch (e) {
            console.error('Failed to load local save on logout', e);
          }
        } else {
          setGameState(initialGameState);
          setActiveTab('setup');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firebase Real-time Sync Listener
  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db as any, 'vampire_saves', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.gameState) {
          try {
            const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localStr === data.gameState) {
              return; // Already in sync, avoid triggering state update to prevent loops
            }
            const parsed = JSON.parse(data.gameState);
            setGameState(parsed);
            if (!saved || !JSON.parse(saved).characterName) setActiveTab('setup'); else setActiveTab('memories');
          } catch (e) {
            console.error("Failed to parse synced state", e);
          }
        }
      } else {
        // If no cloud save exists, seed from localStorage immediately
        const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localStr) {
          try {
            const parsed = JSON.parse(localStr);
            if (parsed.characterName) {
              setDoc(docRef, { gameState: localStr }, { merge: true })
                .catch((err: any) => console.error("Initial cloud save failed:", err));
            }
          } catch (e) {
            console.error("Failed to parse localStr during seeding", e);
          }
        }
      }
    }, (error: any) => {
      console.error("Firebase sync error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Load save from LocalStorage (initial load on boot, only if no user is signed in yet)
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setGameState(parsed);
          if (!saved || !JSON.parse(saved).characterName) setActiveTab('setup'); else setActiveTab('memories');
        } catch (e) {
          console.error('Failed to load save', e);
        }
      }
    }
  }, [user]);

  // Save state to LocalStorage on any change
  useEffect(() => {
    if (activeTab !== 'setup') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  // Save state to Firebase on any change (debounced 1s)
  useEffect(() => {
    if (user && db && gameState.characterName) {
      const timer = setTimeout(() => {
        const docRef = doc(db as any, 'vampire_saves', user.uid);
        setDoc(docRef, { gameState: JSON.stringify(gameState) }, { merge: true })
          .catch((err: any) => console.error("Firebase save failed:", err));
      }, 1000); // 1-second debounce
      return () => clearTimeout(timer);
    }
  }, [gameState, user]);


  // Get active prompt text based on prompt ID and visit count
  const activePrompt = gamePrompts.find(p => p.id === gameState.currentPromptId) || gamePrompts[0];
  const currentVisitCount = gameState.promptVisitHistory[gameState.currentPromptId] || 1;
  
  // Alternate Prompt Support (Appendix)
  const isAltActive = !!gameState.isAltActive;
  const activeAltPrompt = gameState.activeAltIdx !== null && gameState.activeAltIdx !== undefined
    ? alternatePrompts[gameState.activeAltIdx] 
    : null;

  const activePromptText = isAltActive && activeAltPrompt
    ? `[부록 대체사건] ${activeAltPrompt.text}`
    : activePrompt.entries[Math.min(currentVisitCount - 1, activePrompt.entries.length - 1)];

  // Handle Drawing an Alternate Prompt
  const handleSubstitutePrompt = () => {
    const randomIdx = Math.floor(Math.random() * alternatePrompts.length);
    setGameState(prev => ({
      ...prev,
      isAltActive: true,
      activeAltIdx: randomIdx
    }));
  };

  const handleRevertPrompt = () => {
    setGameState(prev => ({
      ...prev,
      isAltActive: false,
      activeAltIdx: null
    }));
  };

  // Reset and start fresh
  const handleResetGame = () => {
    if (window.confirm('정말 모든 기록을 초기화하고 처음부터 다시 시작하시겠습니까? (일기장과 모든 세이브가 삭제됩니다)')) {
      if (user && db) {
        const docRef = doc(db as any, 'vampire_saves', user.uid);
        setDoc(docRef, { gameState: JSON.stringify(initialGameState) }, { merge: true })
          .catch((err: any) => console.error("Firebase reset failed:", err));
      }
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setGameState(initialGameState);
      setActiveTab('setup');
      setCurrentJournalText('');
      setD10Val(null);
      setD6Val(null);
    }
  };

  const handleLogin = async () => {
    try {
      if (auth && googleProvider) {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      alert("로그인 실패: " + (error.message || "알 수 없는 오류"));
    }
  };

  const handleLogout = async () => {
    if (window.confirm("정말로 로그아웃 하시겠습니까? 현재 기기의 세이브는 유지되나 새로운 클라우드 저장은 중단됩니다.")) {
      try {
        if (auth) {
          await signOut(auth);
        }
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };


  // Start game from setup
  const handleStartGame = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!gameState.characterName.trim()) {
      alert('흡혈귀의 이름을 먼저 기입해 주십시오.');
      return;
    }
    // Pre-populate starting sheet placeholders so user can edit them directly
    const startingSkills: Skill[] = [
      { id: 's1', name: '고대 언어', isChecked: false },
      { id: 's2', name: '도검술', isChecked: false },
      { id: 's3', name: '설득', isChecked: false }
    ];
    const startingResources: Resource[] = [
      { id: 'r1', name: '소유물: 은색 인장 반지', isStationary: false },
      { id: 'r2', name: '정착지: 무너진 수도원', isStationary: true },
      { id: 'r3', name: '동물 동반자', isStationary: false }
    ];
    const startingCharacters: Character[] = [
      { id: 'c1', name: '가족/친구 (필멸자)', type: 'mortal', isAlive: true },
      { id: 'c2', name: '연인/지인 (필멸자)', type: 'mortal', isAlive: true },
      { id: 'c3', name: '지역 유력자 (필멸자)', type: 'mortal', isAlive: true },
      { id: 'c4', name: '당신을 창조한 흡혈귀 (불멸자)', type: 'immortal', isAlive: true }
    ];
    
    // 5 Initial Memories, each with one base experience from origin
    const startingMemories: Memory[] = [
      { id: 'm1', experiences: [{ id: 'e1', text: `${gameState.characterName}로서의 시작: ${gameState.vampireOrigin || '어둠 속에서 깨어났다'}` }] },
      { id: 'm2', experiences: [] },
      { id: 'm3', experiences: [] },
      { id: 'm4', experiences: [] },
      { id: 'm5', experiences: [] }
    ];

    setGameState(prev => ({
      ...prev,
      skills: prev.skills.length > 0 ? prev.skills : startingSkills,
      resources: prev.resources.length > 0 ? prev.resources : startingResources,
      characters: prev.characters.length > 0 ? prev.characters : startingCharacters,
      memories: prev.memories[0].experiences.length > 0 ? prev.memories : startingMemories
    }));
    setActiveTab('memories');
    
    if (!saved || !JSON.parse(saved).characterName) setActiveTab('setup'); else setActiveTab('memories');
  };

  // Roll Dice Logic (1d10 - 1d6)
  const handleRollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    let rolls = 0;
    const interval = setInterval(() => {
      setD10Val(Math.floor(Math.random() * 10) + 1);
      setD6Val(Math.floor(Math.random() * 6) + 1);
      rolls++;
      if (rolls > 8) {
        clearInterval(interval);
        finalizeRoll();
      }
    }, 60);
  };

  const finalizeRoll = () => {
    const d10 = Math.floor(Math.random() * 10) + 1;
    const d6 = Math.floor(Math.random() * 6) + 1;
    setD10Val(d10);
    setD6Val(d6);
    setIsRolling(false);

    const offset = d10 - d6;
    let newPromptId = gameState.currentPromptId + offset;
    
    // Constraints
    if (newPromptId < 1) newPromptId = 1;
    if (newPromptId > 80) newPromptId = 80;

    // Automatically handle prompt visits increment
    const updatedVisits = { ...gameState.promptVisitHistory };
    updatedVisits[newPromptId] = (updatedVisits[newPromptId] || 0) + 1;

    // Check if this constitutes a Game Over (Prompts 72-80 contain Game Over, or if explicitly reached)
    const willBeGameOver = newPromptId >= 72;
    let gameOverMsg = '';
    if (willBeGameOver) {
      const endPrompt = gamePrompts.find(p => p.id === newPromptId);
      gameOverMsg = endPrompt?.entries[0] || '당신의 천 년 여정이 막을 내렸습니다.';
    }

    // Pre-save current text as an entry before moving
    const textToSave = currentJournalText.trim() || "(기록 없음)";
    
    const journalItem: JournalEntry = {
      id: `j-${Date.now()}`,
      promptId: gameState.currentPromptId,
      visitCount: gameState.promptVisitHistory[gameState.currentPromptId] || 1,
      rollText: `1d10(${d10}) - 1d6(${d6}) = ${offset >= 0 ? '+' + offset : offset}`,
      dateString: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}),
      textContent: textToSave,
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      currentPromptId: newPromptId,
      promptVisitHistory: updatedVisits,
      journal: [journalItem, ...prev.journal],
      isGameOver: prev.isGameOver || willBeGameOver,
      gameOverText: prev.isGameOver ? prev.gameOverText : (willBeGameOver ? gameOverMsg : ''),
      isAltActive: false,
      activeAltIdx: null
    }));

    setCurrentJournalText('');
  };

  // Manual navigation
  const handleManualMove = (direction: 'prev' | 'next') => {
    let targetId = gameState.currentPromptId + (direction === 'next' ? 1 : -1);
    if (targetId < 1) targetId = 1;
    if (targetId > 80) targetId = 80;

    const updatedVisits = { ...gameState.promptVisitHistory };
    updatedVisits[targetId] = (updatedVisits[targetId] || 0) + 1;

    setGameState(prev => ({
      ...prev,
      currentPromptId: targetId,
      promptVisitHistory: updatedVisits,
      isAltActive: false,
      activeAltIdx: null
    }));
  };

  // --- Game Sheet Management Utilities ---

  // 1. Memories & Experiences
  const handleAddExperience = (memoryId: string) => {
    const text = newExperienceInputs[memoryId]?.trim();
    if (!text) return;

    setGameState(prev => {
      const updatedMemories = prev.memories.map(m => {
        if (m.id === memoryId) {
          if (m.experiences.length >= 3) {
            alert('기억 슬롯 하나는 최대 3개의 경험만 담을 수 있습니다. 경험을 추가하려면 다른 기억 공간을 사용하거나, 이 기억 슬롯 전체를 일기장으로 옮겨 비우십시오.');
            return m;
          }
          return {
            ...m,
            experiences: [...m.experiences, { id: `e-${Date.now()}`, text }]
          };
        }
        return m;
      });

      return { ...prev, memories: updatedMemories };
    });

    setNewExperienceInputs(prev => ({ ...prev, [memoryId]: '' }));
  };

  const handleDeleteExperience = (memoryId: string, expId: string) => {
    if (!window.confirm('이 경험을 정말 잊으시겠습니까? 영원히 지워집니다.')) return;
    setGameState(prev => ({
      ...prev,
      memories: prev.memories.map(m => {
        if (m.id === memoryId) {
          return { ...m, experiences: m.experiences.filter(e => e.id !== expId) };
        }
        return m;
      })
    }));
  };

  const handleStartEditExperience = (expId: string, text: string) => {
    setEditingExperienceId(expId);
    setEditingExperienceText(text);
  };

  const handleCancelEditExperience = () => {
    setEditingExperienceId(null);
    setEditingExperienceText('');
  };

  const handleSaveEditExperience = (memoryId: string, expId: string) => {
    if (!editingExperienceText.trim()) {
      alert('경험 내용을 입력해주세요.');
      return;
    }
    setGameState(prev => ({
      ...prev,
      memories: prev.memories.map(m => {
        if (m.id === memoryId) {
          return {
            ...m,
            experiences: m.experiences.map(e =>
              e.id === expId ? { ...e, text: editingExperienceText.trim() } : e
            )
          };
        }
        return m;
      })
    }));
    setEditingExperienceId(null);
    setEditingExperienceText('');
  };

  // Offload entire Memory to Diary
  const handleMoveToDiary = (memoryId: string) => {
    const memory = gameState.memories.find(m => m.id === memoryId);
    if (!memory || memory.experiences.length === 0) {
      alert('비어 있는 기억은 일기장으로 옮길 수 없습니다.');
      return;
    }

    if (!window.confirm('이 기억 슬롯의 모든 경험들을 일기장(Diary)으로 안전하게 보관하시겠습니까? 옮긴 후 기억 칸은 깨끗하게 비어 새로운 경험을 저장할 수 있게 됩니다.')) return;

    const diaryEntry: DiaryEntry = {
      id: `d-${Date.now()}`,
      originalMemoryId: memory.id,
      experiences: [...memory.experiences],
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      diary: [diaryEntry, ...prev.diary],
      memories: prev.memories.map(m => m.id === memoryId ? { ...m, experiences: [] } : m)
    }));
    setActiveTab('diary');
  };

  // 2. Skills
  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    setGameState(prev => ({
      ...prev,
      skills: [...prev.skills, { id: `s-${Date.now()}`, name: newSkillName.trim(), isChecked: false }]
    }));
    setNewSkillName('');
  };

  const handleToggleSkill = (id: string) => {
    setGameState(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.id === id ? { ...s, isChecked: !s.isChecked } : s)
    }));
  };

  const handleDeleteSkill = (id: string) => {
    setGameState(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.id !== id)
    }));
  };

  // 3. Resources
  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    setGameState(prev => ({
      ...prev,
      resources: [...prev.resources, { id: `r-${Date.now()}`, name: newResourceName.trim(), isStationary: false }]
    }));
    setNewResourceName('');
  };

  const handleToggleResourceLost = (id: string) => {
    setGameState(prev => ({
      ...prev,
      resources: prev.resources.map(r => r.id === id ? { ...r, isLost: !r.isLost } : r)
    }));
  };

  const handleDeleteResource = (id: string) => {
    setGameState(prev => ({
      ...prev,
      resources: prev.resources.filter(r => r.id !== id)
    }));
  };

  // 4. Characters
  const handleAddCharacter = () => {
    if (!newCharacterName.trim()) return;
    setGameState(prev => ({
      ...prev,
      characters: [...prev.characters, { 
        id: `c-${Date.now()}`, 
        name: newCharacterName.trim(), 
        type: newCharacterType, 
        isAlive: true 
      }]
    }));
    setNewCharacterName('');
  };

  const handleToggleCharacterDeath = (id: string) => {
    setGameState(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === id ? { ...c, isAlive: !c.isAlive } : c)
    }));
  };

  const handleDeleteCharacter = (id: string) => {
    setGameState(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== id)
    }));
  };

  // 5. Marks
  const handleAddMark = () => {
    if (!newMarkDesc.trim()) return;
    setGameState(prev => ({
      ...prev,
      marks: [...prev.marks, { id: `m-${Date.now()}`, description: newMarkDesc.trim() }]
    }));
    setNewMarkDesc('');
  };

  const handleDeleteMark = (id: string) => {
    setGameState(prev => ({
      ...prev,
      marks: prev.marks.filter(m => m.id !== id)
    }));
  };

  // 6. Journal Entries
  const handleStartEditJournal = (id: string, text: string) => {
    setEditingJournalId(id);
    setEditingJournalText(text);
  };

  const handleCancelEditJournal = () => {
    setEditingJournalId(null);
    setEditingJournalText('');
  };

  const handleSaveEditJournal = (id: string) => {
    if (!editingJournalText.trim()) {
      alert('일지 내용을 입력해주세요.');
      return;
    }
    setGameState(prev => ({
      ...prev,
      journal: prev.journal.map(item =>
        item.id === id ? { ...item, textContent: editingJournalText.trim() } : item
      )
    }));
    setEditingJournalId(null);
    setEditingJournalText('');
  };

  const handleDeleteJournalEntry = (id: string) => {
    if (window.confirm('이 일지 기록을 영원히 삭제하시겠습니까?')) {
      setGameState(prev => ({
        ...prev,
        journal: prev.journal.filter(item => item.id !== id)
      }));
    }
  };



  // --- Game Over Overlay Screen ---
  if (gameState.isGameOver) {
    return (
      <div className="app-container game-over-container" style={{maxWidth: '800px', marginTop:'4rem'}}>
        <div className="parchment-card" style={{borderColor: 'var(--crimson-primary)'}}>
          <div className="vampire-seal">🩸</div>
          <h1 className="game-over-title gothic-font">연대기의 끝</h1>
          <div className="ornate-divider"><span className="english-gothic" style={{fontSize: '1.4rem', letterSpacing: '0.1em'}}>FINIS</span></div>
          
          <p className="prompt-body" style={{fontSize: '1.3rem', textAlign:'center', marginBottom: '2rem'}}>
            "{gameState.gameOverText}"
          </p>

          <p style={{fontSize: '1.1rem', color: 'var(--text-light)', marginBottom: '2rem'}}>
            흡혈귀 <strong>{gameState.characterName}</strong>의 이야기는 프롬프트 {gameState.currentPromptId}번에서 영원히 멈추었습니다. 
            당신은 수백 년간 피와 어둠의 길을 걸으며 역사의 한 장을 장식했습니다.
          </p>

          <div style={{display:'flex', gap:'1rem', justifyContent:'center'}}>
            <button className="btn-medieval" onClick={handleResetGame}>
              새 연대기 시작
            </button>
            <button className="btn-gold-outline" onClick={() => setGameState({...gameState, isGameOver: false})}>
              저널 복구해서 보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Global Layout ---
  return (
    <div className="app-container">
      {/* GLOBAL HEADER */}
      <header className="app-header" style={{flexDirection: 'row', justifyContent: 'space-between', width:'100%', paddingBottom:'0.5rem', borderBottom: 'none'}}>
        <div style={{textAlign: 'left'}}>
          <h2 style={{fontSize: '1.5rem', color:'var(--crimson-primary)'}} className="gothic-font">천년 동안 살아온 흡혈귀</h2>
          <span className="english-gothic" style={{fontSize:'1.2rem', color: 'var(--gold-dark)', marginTop: '0.2rem', fontWeight: 400}}>
            {gameState.characterName ? `Chronicle of ${gameState.characterName}` : 'Thousand Year Old Vampire'}
          </span>
        </div>
        
        <div className="action-btn-group" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                border: '1px solid rgba(39, 174, 96, 0.3)',
                padding: '0.35rem 0.6rem',
                borderRadius: '3px',
                fontSize: '0.85rem',
                color: '#27ae60',
                fontWeight: 'bold'
              }}>
                <span style={{width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#27ae60', boxShadow: '0 0 6px #27ae60'}}></span>
                <span>클라우드 동기화 중 ({user.displayName})</span>
              </div>
              <button className="btn-gold-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }} onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          ) : (
            <button className="btn-medieval" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem', backgroundColor: '#fff', color: '#2b2519', border: '1.5px solid var(--gold-accent)', fontWeight: 'bold' }} onClick={handleLogin}>
              <GoogleIcon /> Google 로그인 연동
            </button>
          )}
          <button className="btn-gold-outline" style={{display:'flex', alignItems:'center', gap:'0.3rem', padding: '0.35rem 0.7rem', fontSize: '0.85rem'}} onClick={handleResetGame}>
            <IconReset /> 초기화
          </button>
        </div>
      </header>

      {/* GLOBAL TOP NAVIGATION TABS */}
      <nav className="global-tabs-list" style={{ 
        display: 'flex', gap: '0.2rem', flexWrap: 'wrap', 
        marginBottom: '1.5rem', 
        borderBottom: '2px solid rgba(197, 160, 89, 0.5)', 
        paddingBottom: '0.5rem',
        width: '100%'
      }}>
        <button className={`tab-btn ${activeTab === 'setup' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('setup')}>기본 정보 (시작)</button>
        <button className={`tab-btn ${activeTab === 'memories' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('memories')}>기억 & 경험</button>
        <button className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('skills')}>기술</button>
        <button className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('resources')}>자원</button>
        <button className={`tab-btn ${activeTab === 'characters' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('characters')}>등장인물</button>
        <button className={`tab-btn ${activeTab === 'marks' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('marks')}>표식</button>
        <button className={`tab-btn ${activeTab === 'diary' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('diary')}>일기장 ({gameState.diary.length})</button>
        <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} style={{fontSize: '1rem', padding: '0.6rem 1.2rem'}} onClick={() => setActiveTab('manual')}>설명서</button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="main-content" style={{ width: '100%' }}>
        
        {/* 1. SETUP TAB (기본 정보) */}
        {activeTab === 'setup' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 기본 정보 및 연대기 시작</h3>
            <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(143,117,54,0.1)', border: '1px solid var(--gold-dark)', borderRadius: '4px'}}>
              <p style={{fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.6', whiteSpace: 'pre-line'}}>
                <strong>[ 천년 동안 살아온 흡혈귀 - 초기 설정 ]</strong>
                당신은 필멸의 삶을 등지고 영겁의 어둠 속으로 들어선 존재입니다. 피의 저주를 짊어지기 전, 당신이 누구였으며 어떤 상태로 흡혈귀가 되었는지 그 기원을 기록하십시오.
              </p>
            </div>
            
            <div className="setup-group">
              <label>흡혈귀의 이름</label>
              <input 
                type="text" 
                className="input-medieval" 
                placeholder="예: 로데릭 반 카르슈타인, 발렌티나..."
                value={gameState.characterName}
                onChange={e => setGameState({...gameState, characterName: e.target.value})}
              />
            </div>
            <div className="setup-group">
              <label>기원 (어떻게 흡혈귀가 되었는가?)</label>
              <textarea 
                className="input-medieval" 
                style={{minHeight: '100px', resize:'vertical'}}
                placeholder="예: 흑사병이 돌던 해, 뒷골목에서 만난 의문의 귀족에 물려 밤을 헤매게 되었다..."
                value={gameState.vampireOrigin}
                onChange={e => setGameState({...gameState, vampireOrigin: e.target.value})}
              />
            </div>
            <div style={{textAlign: 'center', marginTop: '2rem'}}>
              <button type="button" className="btn-medieval" onClick={handleStartGame} style={{fontSize: '1.1rem', padding: '0.8rem 2rem', backgroundColor: 'var(--crimson-primary)', color: '#fff'}}>
                연대기 시작하기 ➔
              </button>
              <p style={{marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-light)'}}>
                (이름과 기원을 확정하고, 본격적으로 주사위를 굴려 기억을 기록합니다. 기술, 자원 등은 다른 탭에서 자유롭게 추가하실 수 있습니다.)
              </p>
            </div>
          </section>
        )}

        {/* 2. MEMORIES TAB (Split Layout) */}
        {activeTab === 'memories' && (
          <div className="main-grid">
            {/* LEFT PANEL: Prompts */}
            <section className="parchment-card prompt-container">
              <h3 className="section-title gothic-font">
                <IconScroll /> 시간의 흐름
              </h3>

              <div className="prompt-display" style={{
                position: 'relative',
                borderColor: isAltActive ? 'var(--gold-dark)' : 'rgba(140,21,21,0.2)',
                boxShadow: isAltActive ? '0 0 15px rgba(143,117,54,0.15)' : 'none'
              }}>
                <div className="prompt-header" style={{flexWrap:'wrap', gap:'0.5rem'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                    {isAltActive ? (
                      <span className="prompt-badge" style={{background:'var(--gold-dark)', border:'1px solid #fff'}}>
                        ✨ 부록 대체 프롬프트: {activeAltPrompt?.category}
                      </span>
                    ) : (
                      <span className="prompt-badge">프롬프트 #{activePrompt.id} (P.{activePrompt.page})</span>
                    )}
                    {!isAltActive && (
                      <span style={{fontSize: '0.8rem', fontWeight:'bold', color: 'var(--gold-dark)'}}>
                        방문 횟수: {currentVisitCount}회째
                      </span>
                    )}
                  </div>
                  
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    {isAltActive ? (
                      <>
                        <button className="btn-gold-outline" style={{padding:'0.1rem 0.4rem', fontSize:'0.75rem'}} onClick={handleSubstitutePrompt}>
                          다른 부록 뽑기
                        </button>
                        <button className="btn-gold-outline" style={{padding:'0.1rem 0.4rem', fontSize:'0.75rem', borderColor:'var(--crimson-primary)', color:'var(--crimson-primary)'}} onClick={handleRevertPrompt}>
                          기본으로 복구
                        </button>
                      </>
                    ) : (
                      <button className="btn-gold-outline" style={{padding:'0.1rem 0.4rem', fontSize:'0.75rem', background:'rgba(143,117,54,0.1)'}} onClick={handleSubstitutePrompt} title="오리지널 룰북 부록(Appendix)의 대체 프롬프트 중 하나를 랜덤으로 뽑아 이벤트를 교체합니다.">
                        ✨ 부록 프롬프트 대체
                      </button>
                    )}
                  </div>
                </div>
                <p className="prompt-body" style={{
                  fontStyle: isAltActive ? 'italic' : 'normal',
                  color: isAltActive ? '#2b2519' : 'inherit'
                }}>
                  {activePromptText}
                </p>
              </div>

              <div className="dice-roller-box">
                <div className="dice-group" style={{display:'flex', gap:'1rem'}}>
                  <div className={`die d10 ${isRolling ? 'roll-anim' : ''}`} data-type="d10">
                    {d10Val || '?'}
                  </div>
                  <div style={{fontSize: '2rem', alignSelf:'center', color:'var(--text-light)'}}>-</div>
                  <div className={`die d6 ${isRolling ? 'roll-anim' : ''}`} data-type="d6">
                    {d6Val || '?'}
                  </div>
                </div>

                <div style={{flex: 1, display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                  <button className="btn-medieval" onClick={handleRollDice} disabled={isRolling} style={{width:'100%'}}>
                    <IconDices /> 주사위 굴리기 & 전진
                  </button>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <button className="btn-gold-outline" style={{padding:'0.2rem 0.5rem', fontSize:'0.8rem'}} onClick={() => handleManualMove('prev')}>
                      ← 이전 프롬프트
                    </button>
                    <button className="btn-gold-outline" style={{padding:'0.2rem 0.5rem', fontSize:'0.8rem'}} onClick={() => handleManualMove('next')}>
                      다음 프롬프트 →
                    </button>
                  </div>
                </div>
              </div>

              <div className="journal-editor">
                <h4 className="gothic-font" style={{fontSize: '1.1rem', display:'flex', alignItems:'center', gap:'0.4rem'}}>
                  <IconFeather /> 연대기 일지 작성
                </h4>
                <span style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>현재 사건에 대한 당신의 대응이나 이야기를 적어 보십시오. 주사위를 굴려 다음 프롬프트로 이동할 때 자동으로 연대기에 보관됩니다.</span>
                <textarea
                  className="journal-textarea"
                  placeholder="여기에 이 프롬프트에서 일어난 당신의 생각이나 이야기를 적으십시오..."
                  value={currentJournalText}
                  onChange={e => setCurrentJournalText(e.target.value)}
                />
              </div>

              <div className="ornate-divider"><span>◈ 연대기 타임라인 ◈</span></div>

              <div style={{maxHeight: '400px', overflowY: 'auto', paddingRight:'0.5rem'}}>
                {gameState.journal.length === 0 ? (
                  <p style={{textAlign:'center', color:'var(--text-light)', fontStyle:'italic'}}>아직 기록된 타임라인이 없습니다. 첫 주사위를 굴려 이야기를 시작하십시오.</p>
                ) : (
                  <div className="timeline-list">
                    {gameState.journal.map(item => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-meta">
                            <span>프롬프트 #{item.promptId} (방문 {item.visitCount}회)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>🎲 {item.rollText}</span>
                              {editingJournalId !== item.id && (
                                <div style={{ display: 'inline-flex', gap: '0.2rem', marginLeft: '0.5rem' }}>
                                  <button
                                    className="icon-btn"
                                    title="수정"
                                    style={{ padding: '0.1rem', color: 'var(--gold-dark)' }}
                                    onClick={() => handleStartEditJournal(item.id, item.textContent)}
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    className="icon-btn delete"
                                    title="삭제"
                                    style={{ padding: '0.1rem' }}
                                    onClick={() => handleDeleteJournalEntry(item.id)}
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {editingJournalId === item.id ? (
                            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <textarea
                                className="input-medieval"
                                style={{
                                  width: '100%',
                                  minHeight: '80px',
                                  fontSize: '0.95rem',
                                  padding: '0.5rem',
                                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                  color: '#2b2519',
                                  border: '1px solid var(--gold-accent)',
                                  borderRadius: '3px',
                                  resize: 'vertical',
                                  fontFamily: 'inherit'
                                }}
                                value={editingJournalText}
                                onChange={e => setEditingJournalText(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn-gold-outline"
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                                  onClick={handleCancelEditJournal}
                                >
                                  취소
                                </button>
                                <button
                                  className="btn-medieval"
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', minHeight: 'auto' }}
                                  onClick={() => handleSaveEditJournal(item.id)}
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p style={{fontSize: '0.95rem', whiteSpace: 'pre-line'}}>{item.textContent}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT PANEL: Memories */}
            <section className="parchment-card">
              <h3 className="section-title gothic-font">
                <IconBook /> 기억 슬롯
              </h3>
              <div className="memory-list">
                <p className="small-text" style={{marginBottom: '0.5rem'}}>기억 슬롯은 5개로 고정됩니다. 각 슬롯에는 최대 3개의 경험을 쌓을 수 있습니다. 꽉 찬 경우 슬롯 전체를 일기장으로 이관하고 공간을 비울 수 있습니다.</p>
                {gameState.memories.map((mem, idx) => (
                  <div key={mem.id} className="memory-box">
                    <div className="memory-header">
                      <span>기억 슬롯 #{idx + 1} ({mem.experiences.length}/3)</span>
                      <button 
                        className="icon-btn" 
                        title="일기장으로 이관" 
                        onClick={() => handleMoveToDiary(mem.id)}
                        disabled={mem.experiences.length === 0}
                      >
                        <IconArchive /> <span style={{fontSize:'0.8rem', marginLeft:'0.2rem'}}>일기장 이관</span>
                      </button>
                    </div>
                    
                    <ul className="experience-list">
                      {mem.experiences.map(exp => (
                        <li key={exp.id} className="experience-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          {editingExperienceId === exp.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                              <textarea
                                className="input-medieval"
                                style={{
                                  width: '100%',
                                  minHeight: '90px',
                                  fontSize: '0.95rem',
                                  lineHeight: '1.6',
                                  padding: '0.5rem',
                                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                  border: '1px solid var(--gold-accent)',
                                  borderRadius: '3px',
                                  resize: 'vertical',
                                  outline: 'none',
                                  fontFamily: 'inherit'
                                }}
                                value={editingExperienceText}
                                onChange={e => setEditingExperienceText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleSaveEditExperience(mem.id, exp.id);
                                  }
                                  if (e.key === 'Escape') {
                                    handleCancelEditExperience();
                                  }
                                }}
                                placeholder="경험 수정 (Ctrl+Enter 혹은 저장 버튼으로 저장)"
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn-gold-outline"
                                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={handleCancelEditExperience}
                                >
                                  취소
                                </button>
                                <button
                                  className="btn-medieval"
                                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', minHeight: 'auto' }}
                                  onClick={() => handleSaveEditExperience(mem.id, exp.id)}
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '0.5rem' }}>
                              <span style={{ whiteSpace: 'pre-line', flex: 1 }}>{exp.text}</span>
                              <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, marginTop: '0.15rem' }}>
                                <button 
                                  className="icon-btn" 
                                  title="경험 수정" 
                                  style={{ color: 'var(--gold-dark)' }}
                                  onClick={() => handleStartEditExperience(exp.id, exp.text)}
                                >
                                  <IconEdit />
                                </button>
                                <button 
                                  className="icon-btn delete" 
                                  title="잊어버리기(삭제)" 
                                  onClick={() => handleDeleteExperience(mem.id, exp.id)}
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                      {mem.experiences.length === 0 && (
                        <li style={{fontSize:'0.9rem', color:'var(--text-light)', fontStyle:'italic', padding:'0.5rem'}}>비어 있는 기억 공간</li>
                      )}
                    </ul>

                    {mem.experiences.length < 3 && (
                      <div className="add-form" style={{marginBottom:0, marginTop:'0.5rem'}}>
                        <textarea 
                          className="input-medieval" 
                          style={{
                            flex: 1,
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.9rem',
                            minHeight: '60px',
                            resize: 'vertical',
                            lineHeight: '1.5',
                            fontFamily: 'inherit',
                            backgroundColor: 'rgba(255, 255, 255, 0.75)',
                            border: '1px solid var(--gold-accent)',
                            borderRadius: '3px',
                            outline: 'none'
                          }}
                          placeholder="새 경험 입력... (Ctrl+Enter 혹은 추가 버튼으로 등록)"
                          value={newExperienceInputs[mem.id] || ''}
                          onChange={e => setNewExperienceInputs({...newExperienceInputs, [mem.id]: e.target.value})}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              handleAddExperience(mem.id);
                            }
                          }}
                        />
                        <button className="btn-gold-outline" style={{padding:'0.3rem 0.6rem'}} onClick={() => handleAddExperience(mem.id)}>
                          추가
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 3. SKILLS TAB (Full Width) */}
        {activeTab === 'skills' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 기술 (Skills)</h3>
            <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(143,117,54,0.1)', border: '1px solid var(--gold-dark)', borderRadius: '4px'}}>
              <p style={{fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.6', whiteSpace: 'pre-line'}}>
                <strong>[ 기술 (Skills) - 초기 3가지 창조 ]</strong>
                당신이 필멸자 시절부터 익혔거나, 흡혈귀가 되며 얻게 된 <strong>기술</strong>을 창조하십시오.
                이 기술들은 훗날 특정한 프롬프트를 해결하거나 위기를 모면할 때 체크(소비)될 수 있습니다.
                <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>예: 승마, 야수 교감, 왕실 예법, 사교계의 매력, 검술 등</span>
              </p>
            </div>
            <div className="add-form">
              <input 
                type="text" 
                className="input-medieval" 
                placeholder="새 기술 추가 (예: 은밀한 이동, 조작...)"
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSkill()}
              />
              <button className="btn-medieval" onClick={handleAddSkill} style={{padding:'0.5rem'}}>
                <IconPlus />
              </button>
            </div>
            <div className="item-grid" style={{marginTop: '1.5rem'}}>
              {gameState.skills.map(skill => (
                <div key={skill.id} className={`item-card ${skill.isChecked ? 'checked' : ''}`}>
                  <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                    <input 
                      type="checkbox" 
                      checked={skill.isChecked} 
                      onChange={() => handleToggleSkill(skill.id)}
                      style={{width:'18px', height:'18px', cursor:'pointer'}}
                    />
                    <span style={{fontWeight:'500'}}>{skill.name}</span>
                  </div>
                  <button className="icon-btn delete" onClick={() => handleDeleteSkill(skill.id)}>
                    <IconTrash />
                  </button>
                </div>
              ))}
              {gameState.skills.length === 0 && <p style={{textAlign:'center', color:'var(--text-light)', width:'100%'}}>아직 보유한 기술이 없습니다.</p>}
            </div>
          </section>
        )}

        {/* 4. RESOURCES TAB (Full Width) */}
        {activeTab === 'resources' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 자원 (Resources)</h3>
            <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(143,117,54,0.1)', border: '1px solid var(--gold-dark)', borderRadius: '4px'}}>
              <p style={{fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.6', whiteSpace: 'pre-line'}}>
                <strong>[ 자원 (Resources) - 초기 3가지 창조 ]</strong>
                물리적인 재산, 가보, 은신처 등 당신이 보유한 <strong>자원</strong>을 창조하십시오.
                자원은 이야기 속에서 잃어버리거나 다른 무언가를 얻기 위해 영구히 소비될 수 있습니다.
                <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>예: 금화 주머니, 조상의 저택, 낡은 마차, 기사단장의 검 등</span>
              </p>
            </div>
            <div className="add-form">
              <input 
                type="text" 
                className="input-medieval" 
                placeholder="새 자원 추가 (예: 옛 고성, 재화 주머니...)"
                value={newResourceName}
                onChange={e => setNewResourceName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddResource()}
              />
              <button className="btn-medieval" onClick={handleAddResource} style={{padding:'0.5rem'}}>
                <IconPlus />
              </button>
            </div>
            <div className="item-grid" style={{marginTop: '1.5rem'}}>
              {gameState.resources.map(res => (
                <div key={res.id} className="item-card">
                  <div style={{display:'flex', flexDirection:'column', gap:'0.2rem'}}>
                    <span style={{fontSize:'0.75rem', fontWeight:'bold', color: res.isStationary ? 'var(--crimson-primary)' : 'var(--text-light)'}}>
                      {res.isStationary ? '고정 자원 (Stationary)' : '이동 가능'}
                    </span>
                    <span style={{fontWeight:'500'}}>{res.name}</span>
                  </div>
                  <button className="icon-btn delete" onClick={() => handleDeleteResource(res.id)}>
                    <IconTrash />
                  </button>
                </div>
              ))}
              {gameState.resources.length === 0 && <p style={{textAlign:'center', color:'var(--text-light)', width:'100%'}}>아직 보유한 자원이 없습니다.</p>}
            </div>
          </section>
        )}

        {/* 5. CHARACTERS TAB (Full Width) */}
        {activeTab === 'characters' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 등장인물 (Characters)</h3>
            <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(143,117,54,0.1)', border: '1px solid var(--gold-dark)', borderRadius: '4px'}}>
              <p style={{fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.6', whiteSpace: 'pre-line'}}>
                <strong>[ 인물 (Characters) - 초기 5명 창조 ]</strong>
                당신과 서사가 깊게 얽혀 있는 <strong>등장인물</strong>을 창조하십시오.
                필멸자(Mortal)는 세월이 흐르면 늙어 죽지만, 불멸자(Immortal)는 영원히 존재합니다.
                <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>예: 안나 (충직한 하녀 - 필멸자), 드라큘라 (나를 문 자 - 불멸자)</span>
              </p>
            </div>
            <div className="add-form" style={{flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch'}}>
              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <select 
                  className="input-medieval" 
                  style={{width: 'auto', padding: '0.4rem'}}
                  value={newCharacterType}
                  onChange={e => setNewCharacterType(e.target.value as 'mortal'|'immortal')}
                >
                  <option value="mortal">필멸자(Mortal)</option>
                  <option value="immortal">불멸자(Immortal)</option>
                </select>
                <input 
                  type="text" 
                  className="input-medieval" 
                  style={{flex: 1}}
                  placeholder="새 인물 추가 (예: 그레고르 신부)"
                  value={newCharacterName}
                  onChange={e => setNewCharacterName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCharacter()}
                />
                <button className="btn-medieval" onClick={handleAddCharacter} style={{padding:'0.5rem'}}>
                  <IconPlus />
                </button>
              </div>
            </div>
            <div className="item-grid" style={{marginTop: '1.5rem'}}>
              {gameState.characters.map(char => (
                <div key={char.id} className={`item-card ${!char.isAlive ? 'dead' : ''}`} style={{borderColor: char.type === 'immortal' ? 'var(--crimson-primary)' : 'var(--gold-accent)'}}>
                  <div style={{display:'flex', flexDirection:'column', gap:'0.2rem'}}>
                    <span style={{fontSize:'0.75rem', fontWeight:'bold', color: char.type==='immortal'?'var(--crimson-primary)':'var(--text-light)'}}>
                      {char.type === 'immortal' ? '불멸자' : '필멸자'} {char.isAlive ? '' : '(사망/소실)'}
                    </span>
                    <span style={{fontWeight:'500'}}>{char.name}</span>
                  </div>
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    {char.isAlive && (
                      <button className="icon-btn delete" style={{fontSize:'0.8rem'}} onClick={() => handleKillCharacter(char.id)}>
                        ☠️
                      </button>
                    )}
                    <button className="icon-btn delete" onClick={() => handleDeleteCharacter(char.id)}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
              {gameState.characters.length === 0 && <p style={{textAlign:'center', color:'var(--text-light)', width:'100%'}}>아직 등록된 인물이 없습니다.</p>}
            </div>
          </section>
        )}

        {/* 6. MARKS TAB (Full Width) */}
        {activeTab === 'marks' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 표식 (Marks)</h3>
            <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(143,117,54,0.1)', border: '1px solid var(--gold-dark)', borderRadius: '4px'}}>
              <p style={{fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.6', whiteSpace: 'pre-line'}}>
                <strong>[ 표식 (Marks) - 초기 1가지 창조 ]</strong>
                당신이 흡혈귀가 되면서 신체나 정신에 지워지지 않게 새겨진 기이한 <strong>표식</strong>을 창조하십시오.
                <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>예: 태양 아래서 살갗이 탄다, 박쥐로 변할 수 있다, 십자가를 두려워한다 등</span>
              </p>
            </div>
            <div className="add-form">
              <input 
                type="text" 
                className="input-medieval" 
                placeholder="새 표식 추가..."
                value={newMarkDesc}
                onChange={e => setNewMarkDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMark()}
              />
              <button className="btn-medieval" onClick={handleAddMark} style={{padding:'0.5rem'}}>
                <IconPlus />
              </button>
            </div>
            <div className="item-grid" style={{marginTop: '1.5rem'}}>
              {gameState.marks.map(mark => (
                <div key={mark.id} className="item-card" style={{borderStyle:'dashed', borderColor:'var(--crimson-dark)'}}>
                  <span style={{fontWeight:'500'}}>{mark.description}</span>
                  <button className="icon-btn delete" onClick={() => handleDeleteMark(mark.id)}>
                    <IconTrash />
                  </button>
                </div>
              ))}
              {gameState.marks.length === 0 && <p style={{textAlign:'center', color:'var(--text-light)', width:'100%'}}>아직 새겨진 표식이 없습니다.</p>}
            </div>
          </section>
        )}

        {/* 7. DIARY TAB (Full Width) */}
        {activeTab === 'diary' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 일기장 (Archived Memories)</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
              <p className="small-text">일기장으로 이관된 기억들의 뭉치입니다. 이 경험들은 더는 수정되지 않으며 고정된 역사가 됩니다.</p>
              {gameState.diary.map((entry, dIdx) => (
                <div key={entry.id} className="memory-box" style={{borderColor: 'var(--gold-dark)', background:'rgba(143,117,54,0.1)'}}>
                  <div className="memory-header" style={{color:'var(--crimson-dark)'}}>
                    <span>일기장 묶음 #{gameState.diary.length - dIdx}</span>
                    <span style={{fontSize:'0.75rem', fontWeight:'normal'}}>{new Date(entry.timestamp).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <ul className="experience-list">
                    {entry.experiences.map(e => (
                      <li key={e.id} className="experience-item" style={{borderLeftColor: 'var(--crimson-dark)', background:'rgba(255,255,255,0.5)', whiteSpace: 'pre-line'}}>
                        {e.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {gameState.diary.length === 0 && <p style={{textAlign:'center', color:'var(--text-light)', fontStyle:'italic', padding:'1rem'}}>일기장이 비어 있습니다.</p>}
            </div>
          </section>
        )}

        {/* 8. MANUAL TAB (Full Width) */}
        {activeTab === 'manual' && (
          <section className="parchment-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 className="section-title gothic-font"><IconBook /> 게임 설명서</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: '"Eulyoo1945", serif', lineHeight: '1.8' }}>
              <p className="small-text" style={{ borderBottom: '1px solid rgba(197, 160, 89, 0.25)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                📖 천년 동안 살아온 흡혈귀 (Thousand Year Old Vampire) 게임 규칙 요약
              </p>
              <div>
                <strong>1. 게임의 목표와 시간의 흐름</strong><br/>
                이 게임은 수백 년에 걸친 흡혈귀의 서사를 일기 형태로 기록하는 솔로 TRPG입니다. [시간의 흐름] 패널에서 '주사위 굴리기'를 누르면, `d10 - d6` 연산 값만큼 프롬프트 페이지를 앞으로 이동하며 새로운 사건을 맞이합니다.
              </div>
              <div>
                <strong>2. 기억(Memory)과 일기장(Diary)</strong><br/>
                흡혈귀의 뇌 용량은 한계가 있습니다. 기억 슬롯은 최대 5개뿐이며, 한 슬롯에 3개의 <strong>경험(Experience)</strong>만 담을 수 있습니다. 기억 슬롯이 가득 차면 오래된 슬롯 하나를 <strong>일기장(Diary)</strong>으로 이관해야만 새로운 기억을 저장할 수 있습니다. 일기장에 들어간 기억은 흡혈귀 본인도 점차 그 진위를 잊게 됩니다.
              </div>
              <div>
                <strong>3. 기술(Skills)과 자원(Resources)의 상실</strong><br/>
                프롬프트의 지시에 따라 당신은 특정한 기술이나 자원을 <strong>소비(Check)</strong>하거나 잃어버려야 할 수 있습니다. 잃을 자원이 없다면 더 끔찍한 대가를 치러야 할지도 모릅니다.
              </div>
              <div>
                <strong>4. 등장인물(Characters)과 표식(Marks)</strong><br/>
                새로운 인물이 서사에 합류하거나, 흡혈귀 사냥꾼에게 쫓기게 될 수 있습니다. 뱀파이어로서 몸에 지워지지 않는 새로운 이형의 <strong>표식</strong>이 생겨나기도 합니다. 프롬프트가 지시하는 대로 탭에 이동하여 시트를 갱신하십시오.
              </div>
              <p style={{ color: 'var(--crimson-primary)', fontStyle: 'italic', marginTop: '1rem', textAlign: 'center' }}>
                "모든 것을 잃고, 모든 것을 잊어버리십시오. 그것이 불멸의 대가입니다."
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
