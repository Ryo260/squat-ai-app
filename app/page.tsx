/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

const APP_VERSION = "v0.6.7 (Wait for Camera)";

// ---------------------------------------------------------
// 型定義 & ユーティリティ
// ---------------------------------------------------------
type Mode = 'SQUAT' | 'PUSHUP' | 'HISTORY';
type SquatSubMode = 'UPPER' | 'FULL';

// サウンドID定義
type SoundType = 
  | 'TECH' | 'COIN' | 'HEAVY' | 'LASER' | 'WATER' | 'WOOD' 
  | 'BELL' | 'SNARE' | 'CHORD' | 'JUMP' | 'SWITCH';

interface WorkoutSession {
  id: string;
  date: string;
  mode: 'UPPER' | 'FULL' | 'PUSHUP';
  count: number;
}

const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

const getLocalDateStr = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ★効果音シンセサイザー
const playSe = (type: SoundType | 'FANFARE') => {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'TECH':
      osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
      break;
    case 'COIN':
      osc.type = 'square'; osc.frequency.setValueAtTime(900, now); osc.frequency.setValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'HEAVY':
      osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'LASER':
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'WATER':
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'WOOD':
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
      break;
    case 'BELL':
      osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.start(now); osc.stop(now + 0.8);
      break;
    case 'SNARE':
      osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now);
      gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = 'square'; osc2.frequency.setValueAtTime(100, now);
      gain2.gain.setValueAtTime(0.1, now); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc2.start(now); osc2.stop(now + 0.05);
      break;
    case 'CHORD':
      const play = (freq: number) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        o.start(now); o.stop(now + 0.4);
      };
      play(523.25); play(659.25); play(783.99);
      break;
    case 'JUMP':
      osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(400, now + 0.2);
      gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'SWITCH':
      osc.type = 'square'; osc.frequency.setValueAtTime(2000, now);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
      osc.start(now); osc.stop(now + 0.03);
      break;
    case 'FANFARE':
      const playNote = (freq: number, time: number, dur: number) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.1, time); g.gain.exponentialRampToValueAtTime(0.01, time + dur);
        o.start(time); o.stop(time + dur);
      };
      playNote(523.25, now, 0.2); playNote(659.25, now + 0.1, 0.2); 
      playNote(783.99, now + 0.2, 0.2); playNote(1046.50, now + 0.3, 0.6);
      break;
  }
};

// ---------------------------------------------------------
// 設定モーダル
// ---------------------------------------------------------
const SettingsModal = ({ isOpen, onClose, currentSound, onSoundChange }: { isOpen: boolean, onClose: () => void, currentSound: SoundType, onSoundChange: (s: SoundType) => void }) => {
  if (!isOpen) return null;
  const soundOptions: {id: SoundType, name: string}[] = [
    { id: 'TECH', name: '♪ Tech (Default)' }, { id: 'COIN', name: '♪ Coin (Game)' },
    { id: 'HEAVY', name: '♪ Heavy (Impact)' }, { id: 'LASER', name: '♪ Laser (Sci-Fi)' },
    { id: 'WATER', name: '♪ Water (Drop)' }, { id: 'WOOD', name: '♪ Wood (Block)' },
    { id: 'BELL', name: '♪ Bell (Chime)' }, { id: 'SNARE', name: '♪ Snare (Drum)' },
    { id: 'CHORD', name: '♪ Chord (Major)' }, { id: 'JUMP', name: '♪ Jump (Boing)' },
    { id: 'SWITCH', name: '♪ Switch (Click)' },
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Select Sound Effect</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {soundOptions.map((opt) => (
            <div key={opt.id} onClick={() => { onSoundChange(opt.id); playSe(opt.id); }} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${currentSound === opt.id ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${currentSound === opt.id ? 'border-green-500' : 'border-gray-500'}`}>
                  {currentSound === opt.id && <div className="w-2 h-2 rounded-full bg-green-500" />}
                </div>
                <span className="text-sm font-bold text-white">{opt.name}</span>
              </div>
              <span className="text-[10px] text-gray-500">▶ Preview</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700">
            <button onClick={onClose} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-bold text-sm shadow-lg">OK</button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 1. スタート画面
// ---------------------------------------------------------
const StartScreen = ({ onStart, onOpenSettings }: { onStart: () => void, onOpenSettings: () => void }) => {
  const [heatmapData, setHeatmapData] = useState<{date: string, count: number, status: string}[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('squat_sessions');
    let parsed: WorkoutSession[] = [];
    if (saved) {
      parsed = JSON.parse(saved);
      parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTotalCount(parsed.reduce((sum, s) => sum + s.count, 0));
    }
    const workoutMap: {[key: string]: number} = {};
    let firstWorkoutDateStr = "";
    parsed.forEach(s => {
      const d = new Date(s.date);
      const dateStr = getLocalDateStr(d);
      workoutMap[dateStr] = (workoutMap[dateStr] || 0) + s.count;
      if (firstWorkoutDateStr === "") firstWorkoutDateStr = dateStr;
    });

    const today = new Date();
    const tempDate = new Date();
    tempDate.setDate(today.getDate() - 100);
    const dataArray = [];
    let lastWorkoutDaysAgo = -1; 
    const todayStr = getLocalDateStr(today);

    while (tempDate <= today) {
      const dateStr = getLocalDateStr(tempDate);
      const count = workoutMap[dateStr] || 0;
      let status = 'empty';
      if (firstWorkoutDateStr && dateStr >= firstWorkoutDateStr) {
        if (count > 0) {
          if (count < 10) status = 'level-1'; else if (count < 30) status = 'level-2'; else if (count < 60) status = 'level-3'; else status = 'level-4';                 
          lastWorkoutDaysAgo = 0;
        } else {
          if (lastWorkoutDaysAgo >= 0) {
            lastWorkoutDaysAgo++;
            if (lastWorkoutDaysAgo <= 3) status = 'recovery'; else status = 'empty';
          }
        }
      }
      dataArray.push({ date: dateStr, count, status });
      tempDate.setDate(tempDate.getDate() + 1);
    }
    setHeatmapData(dataArray);
    setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth; }, 100);
  }, []);

  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 100);
  const todayStr = getLocalDateStr(today);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6 py-10 overflow-y-auto relative z-10">
      <button onClick={onOpenSettings} className="absolute top-4 right-4 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-full text-gray-300 transition z-50 border border-gray-600">⚙️</button>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-green-500">SQUAT<br/>MASTER</h1>
          <p className="text-gray-400 text-sm">Total Workouts: <span className="text-white font-bold">{totalCount}</span></p>
        </div>
        <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700 overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto" ref={scrollContainerRef}>
            <div className="min-w-[500px]">
              <CalendarHeatmap startDate={startDate} endDate={today} values={heatmapData}
                classForValue={(value) => {
                  if (!value) return 'color-empty';
                  let cls = `color-${value.status}`; 
                  if (value.date === todayStr) return `${cls} today-cell`;
                  return cls;
                }}
                titleForValue={(value) => value ? `${value.date}: ${value.count}回` : ''}
              />
            </div>
          </div>
          <div className="flex justify-center space-x-3 mt-3 text-[10px] text-gray-400">
             <div className="flex items-center"><span className="w-2 h-2 bg-[#0e4429] rounded-sm mr-1"></span>Low</div>
             <div className="flex items-center"><span className="w-2 h-2 bg-[#006d32] rounded-sm mr-1"></span>Mid</div>
             <div className="flex items-center"><span className="w-2 h-2 bg-[#26a641] rounded-sm mr-1"></span>High</div>
             <div className="flex items-center"><span className="w-2 h-2 bg-[#39d353] rounded-sm mr-1"></span>Max</div>
             <div className="flex items-center ml-2"><span className="w-2 h-2 bg-[#3b82f6] rounded-sm mr-1"></span>回復期</div>
          </div>
        </div>
        <button onClick={onStart} className="group relative w-full py-6 px-6 bg-green-600 hover:bg-green-500 rounded-2xl shadow-[0_10px_0_rgb(21,128,61)] active:shadow-[0_2px_0_rgb(21,128,61)] active:translate-y-2 transition-all duration-150 overflow-hidden">
          <div className="relative z-10 flex items-center justify-center space-x-2">
            <span className="text-3xl font-black tracking-widest text-white">START</span><span className="text-3xl">🔥</span>
          </div>
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-2xl pointer-events-none"></div>
        </button>
        <div className="text-center pt-8"><p className="text-xs text-gray-600 font-mono">{APP_VERSION}</p></div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. 履歴画面
// ---------------------------------------------------------
const HistoryScreen = ({ onDelete }: { onDelete: () => void }) => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('squat_sessions');
    if (saved) {
      const parsed: WorkoutSession[] = JSON.parse(saved);
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(parsed);
    }
  }, [onDelete]);

  const graphData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const targetDateStr = getLocalDateStr(d);
      const count = sessions.reduce((sum, s) => {
        const sessionDate = new Date(s.date);
        const sessionDateStr = getLocalDateStr(sessionDate);
        return sessionDateStr === targetDateStr ? sum + s.count : sum;
      }, 0);
      data.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: count, isToday: i === 0 });
    }
    return data;
  }, [sessions]);
  const maxCount = Math.max(10, ...graphData.map(d => d.count));

  const handleDelete = (id: string) => {
    if(!confirm('削除しますか？')) return;
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem('squat_sessions', JSON.stringify(newSessions));
    onDelete();
  };

  const handleExport = () => {
    if (sessions.length === 0) { alert("データがありません"); return; }
    const header = "id,date,mode,count\n";
    const rows = sessions.map(s => `${s.id},${s.date},${s.mode},${s.count}`).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `workout_backup_${getLocalDateStr()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n').slice(1);
        const newSessions: WorkoutSession[] = [];
        lines.forEach(line => {
          const [id, date, mode, countStr] = line.split(',');
          if (id && date && mode && countStr) newSessions.push({ id, date, mode: mode as any, count: Number(countStr) });
        });
        if (newSessions.length === 0) { alert("データなし"); return; }
        const currentSaved = localStorage.getItem('squat_sessions');
        let currentSessions: WorkoutSession[] = currentSaved ? JSON.parse(currentSaved) : [];
        let added = 0;
        newSessions.forEach(newS => {
          if (!currentSessions.some(curr => curr.id === newS.id)) { currentSessions.push(newS); added++; }
        });
        if (added > 0) { localStorage.setItem('squat_sessions', JSON.stringify(currentSessions)); alert(`${added}件復元しました`); onDelete(); }
        else { alert("新しいデータはありません"); }
      } catch (err) { alert("読込失敗"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 pt-16 overflow-y-auto relative z-10">
      <div className="mb-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 mb-4 flex justify-between"><span>Last 7 Days</span><span className="text-[10px] font-normal opacity-50">Local Time</span></h3>
        <div className="flex items-end justify-between h-32 space-x-2">
          {graphData.map((d, i) => {
            const barHeight = d.count > 0 ? `${(d.count / maxCount) * 100}%` : '4px';
            const barColor = d.count > 0 ? (d.isToday ? 'bg-green-400' : 'bg-blue-500/80 group-hover:bg-blue-400') : 'bg-gray-700/50';
            return (
                <div key={i} className="flex flex-col items-center flex-1 group h-full justify-end">
                <div className="relative w-full flex items-end justify-center h-full">
                    <div className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ease-out ${barColor}`} style={{ height: barHeight }}>
                        {d.count > 0 && (<span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white">{d.count}</span>)}
                    </div>
                </div>
                <span className={`text-[10px] mt-2 ${d.isToday ? 'text-green-400 font-bold' : 'text-gray-500'}`}>{d.label}</span>
                </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2 pb-24">
        {sessions.length === 0 && <p className="text-center text-gray-500 py-10">記録なし</p>}
        {sessions.map((session) => {
            const isPushup = session.mode === 'PUSHUP';
            const bgColor = isPushup ? 'bg-orange-900/30 border-orange-700' : 'bg-blue-900/30 border-blue-700';
            const textColor = isPushup ? 'text-orange-300' : 'text-blue-300';
            const icon = isPushup ? '💪' : '🦵';
            const label = isPushup ? '腕立て' : (session.mode === 'UPPER' ? 'スクワット(肩)' : 'スクワット(膝)');
            return (
              <div key={session.id} className={`p-3 rounded-lg flex justify-between items-center shadow-sm border ${bgColor}`}>
                <div>
                  <p className="text-xs text-gray-400">{new Date(session.date).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-lg">{icon}</span><span className={`text-xs font-bold ${textColor}`}>{label}</span><span className="font-bold text-lg ml-2">{session.count} 回</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(session.id)} className="bg-red-900/20 text-red-400 p-2 rounded-full hover:bg-red-900/40 transition">🗑️</button>
              </div>
            );
        })}
      </div>
      <div className="mt-auto pt-8 pb-4 border-t border-gray-800">
        <p className="text-[10px] text-center text-gray-600 mb-3">Data Management</p>
        <div className="flex justify-center space-x-4">
            <button onClick={handleExport} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center transition">📤 バックアップ</button>
            <button onClick={handleImportClick} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center transition">📥 復元</button>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 3. トレーニング画面
// ---------------------------------------------------------
const WorkoutScreen = ({ mode, soundType, onSave, videoRef, isCameraReady }: { mode: 'SQUAT' | 'PUSHUP', soundType: SoundType, onSave: (count: number, modeStr: string) => void, videoRef: React.RefObject<HTMLVideoElement>, isCameraReady: boolean }) => {
    // ★腕立て伏せの難易度テーブル
    const difficultyLevels = {
      LEVEL1: 0.10,  // ちょい下げればOK（初心者）
      LEVEL2: 0.15,  // 標準
      LEVEL3: 0.20,  // 深く下げる（上級）
    } as const;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [squatSubMode, setSquatSubMode] = useState<SquatSubMode>('UPPER');
  const [isPaused, setIsPaused] = useState(false);

  // ★腕立て伏せの難易度選択（Lv1/Lv2/Lv3）
  const [currentDifficulty, setCurrentDifficulty] =
    useState<keyof typeof difficultyLevels>("LEVEL2");

  const logicState = useRef({ isSquatting: false, baselineY: 0, countdown: 3 });
  const [count, setCount] = useState(0);
  
  const countRef = useRef(0);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("AI準備中...");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialCountdownStarted = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => { countRef.current = count; }, [count]);
  useEffect(() => {
    if (count > 0 && !isMuted) {
      playSe(soundType); 
      if (count % 10 === 0) setTimeout(() => playSe('FANFARE'), 200);
    }
  }, [count, isMuted, soundType]);
  
  useEffect(() => {
    return () => {
      if (countRef.current > 0) {
          const modeStr = mode === 'PUSHUP' ? 'PUSHUP' : squatSubMode;
          onSave(countRef.current, modeStr);
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onSave, mode, squatSubMode]);

  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatusMessage(""); 
    logicState.current.countdown = 3;
    setCountdownDisplay(3);
    
    timerRef.current = setInterval(() => {
      logicState.current.countdown -= 1;
      if (logicState.current.countdown > 0) { 
          setCountdownDisplay(logicState.current.countdown); 
      } else { 
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setCountdownDisplay(null); 
          setStatusMessage("GO!"); 
          if(!isMuted) playSe('FANFARE');
          setTimeout(() => setStatusMessage(""), 1000); 
      }
    }, 1000);
  };

  const handleReset = (e: React.MouseEvent) => { e.stopPropagation(); startCountdown(); };
  const togglePause = () => { setIsPaused(prev => !prev); };
  const toggleMute = (e: React.MouseEvent) => { e.stopPropagation(); setIsMuted(prev => !prev); };

  // ★「AI準備完了」かつ「カメラ準備完了」で初めてスタートシーケンスを開始
  useEffect(() => {
    // 状態メッセージの更新
    if (!isCameraReady) {
        setStatusMessage("カメラ許可待ち...");
    } else if (!isModelReady) {
        setStatusMessage("AI準備中...");
    }

    if (isModelReady && isCameraReady && !initialCountdownStarted.current) {
        initialCountdownStarted.current = true;
        setStatusMessage("READY?"); 
        setTimeout(() => {
            startCountdown();
        }, 1000);
    }
  }, [isModelReady, isCameraReady]);

  useEffect(() => {
    let pose: any = null;
    let animationFrameId: number;

    const onResults = (results: any) => {
      if (!canvasRef.current || !videoRef.current) return;
      if (isPaused) return;

      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      if (videoWidth === 0) return;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.translate(videoWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

      if (logicState.current.countdown > 0) {
          if (mode === 'SQUAT' && squatSubMode === 'UPPER' && results.poseLandmarks) {
              const leftShoulder = results.poseLandmarks[11];
              const rightShoulder = results.poseLandmarks[12];
              if (leftShoulder && rightShoulder) logicState.current.baselineY = (leftShoulder.y + rightShoulder.y) / 2;
          }
          if (mode === 'SQUAT' && squatSubMode === 'UPPER') {
            ctx.strokeStyle = "yellow"; ctx.lineWidth = 2; ctx.beginPath();
            ctx.moveTo(0, logicState.current.baselineY * videoHeight); ctx.lineTo(videoWidth, logicState.current.baselineY * videoHeight); ctx.stroke();
          }
          ctx.restore(); return;
      }

      if (results.poseLandmarks) {
        if (mode === 'PUSHUP') {
            const rShoulder = results.poseLandmarks[12]; const lShoulder = results.poseLandmarks[11];
            const rElbow = results.poseLandmarks[14]; const lElbow = results.poseLandmarks[13];
            if (rShoulder && lShoulder && rElbow && lElbow) {
                const shoulderY = (rShoulder.y + lShoulder.y) / 2;
                const elbowY = (rElbow.y + lElbow.y) / 2;
                // ★選択中の難易度に応じてラインを変える
                const difficultyOffset = difficultyLevels[currentDifficulty];
                const targetY = elbowY - difficultyOffset;

                const shoulderPx = shoulderY * videoHeight;
                const targetPx = targetY * videoHeight;

                ctx.beginPath(); ctx.moveTo(0, targetPx); ctx.lineTo(videoWidth, targetPx);
                ctx.lineWidth = 3; ctx.strokeStyle = logicState.current.isSquatting ? "#00FF00" : "rgba(0, 255, 0, 0.5)";
                ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); 

                ctx.beginPath(); ctx.arc(videoWidth / 2, shoulderPx, 10, 0, 2 * Math.PI);
                ctx.fillStyle = logicState.current.isSquatting ? "#00FF00" : "#FFFF00"; ctx.fill();

                if (shoulderY > targetY) { if (!logicState.current.isSquatting) logicState.current.isSquatting = true; } 
                else if (shoulderY < targetY - 0.1) { if (logicState.current.isSquatting) { logicState.current.isSquatting = false; setCount(c => c + 1); } }
            }
        } else {
            if (squatSubMode === 'UPPER') {
                const leftShoulder = results.poseLandmarks[11]; const rightShoulder = results.poseLandmarks[12];
                if (leftShoulder && rightShoulder) {
                    const currentY = (leftShoulder.y + rightShoulder.y) / 2;
                    const baselineYPx = logicState.current.baselineY * videoHeight;
                    ctx.beginPath(); ctx.moveTo(0, baselineYPx); ctx.lineTo(videoWidth, baselineYPx); ctx.strokeStyle = "rgba(0,255,255,0.8)"; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = "#00FFFF"; ctx.beginPath(); ctx.arc(leftShoulder.x * videoWidth, leftShoulder.y * videoHeight, 8, 0, 2 * Math.PI); ctx.arc(rightShoulder.x * videoWidth, rightShoulder.y * videoHeight, 8, 0, 2 * Math.PI); ctx.fill();
                    if (currentY > logicState.current.baselineY + 0.1) { if (!logicState.current.isSquatting) logicState.current.isSquatting = true; } 
                    else if (currentY < logicState.current.baselineY + 0.03) { if (logicState.current.isSquatting) { logicState.current.isSquatting = false; setCount(c => c + 1); } }
                }
            } else {
                const leftHip = results.poseLandmarks[23]; const leftKnee = results.poseLandmarks[25]; const leftAnkle = results.poseLandmarks[27];
                const rightHip = results.poseLandmarks[24]; const rightKnee = results.poseLandmarks[26]; const rightAnkle = results.poseLandmarks[28];
                const leftScore = (leftHip?.visibility || 0) + (leftKnee?.visibility || 0) + (leftAnkle?.visibility || 0);
                const rightScore = (rightHip?.visibility || 0) + (rightKnee?.visibility || 0) + (rightAnkle?.visibility || 0);
                let tHip, tKnee, tAnkle;
                if (leftScore > rightScore) { tHip = leftHip; tKnee = leftKnee; tAnkle = leftAnkle; } else { tHip = rightHip; tKnee = rightKnee; tAnkle = rightAnkle; }
                if (tHip && tKnee && tAnkle) {
                    const angle = calculateAngle(tHip, tKnee, tAnkle);
                    ctx.beginPath(); ctx.moveTo(tHip.x * videoWidth, tHip.y * videoHeight); ctx.lineTo(tKnee.x * videoWidth, tKnee.y * videoHeight); ctx.lineTo(tAnkle.x * videoWidth, tAnkle.y * videoHeight);
                    ctx.lineWidth = 4; ctx.strokeStyle = "#00FF00"; ctx.stroke();
                    if (angle < 100) { if (!logicState.current.isSquatting) logicState.current.isSquatting = true; } 
                    else if (angle > 160) { if (logicState.current.isSquatting) { logicState.current.isSquatting = false; setCount(c => c + 1); } }
                }
            }
        }
      }
      ctx.restore();
    };

    const loadMediaPipe = async () => {
      try {
        const poseModule = await import('@mediapipe/pose');
        pose = new poseModule.Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(onResults);
        setIsModelReady(true);
        const loop = async () => { if (videoRef.current && pose) { await pose.send({ image: videoRef.current }); } animationFrameId = requestAnimationFrame(loop); };
        loop();
      } catch (e) { console.error(e); }
    };
    loadMediaPipe();
    return () => { cancelAnimationFrame(animationFrameId); if (pose) pose.close(); };
  }, [mode, videoRef, isPaused, squatSubMode]);

  const modeLabel = mode === 'PUSHUP' ? 'PUSH UP' : (squatSubMode === 'UPPER' ? 'SQUAT (Shoulder)' : 'SQUAT (Knee)');
  const modeBadgeClass = mode === 'PUSHUP' ? 'bg-orange-500' : 'bg-blue-500';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center relative z-10">
      {mode === 'SQUAT' && (
        
          <div className="absolute top-4 left-0 w-full flex justify-center z-30">
              <div className="bg-gray-800/80 p-1 rounded-full flex space-x-1 border border-gray-600">
                  <button onClick={(e) => { e.stopPropagation(); setSquatSubMode('UPPER'); }} className={`px-3 py-1 rounded-full text-xs font-bold transition ${squatSubMode === 'UPPER' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>UPPER</button>
                  <button onClick={(e) => { e.stopPropagation(); setSquatSubMode('FULL'); }} className={`px-3 py-1 rounded-full text-xs font-bold transition ${squatSubMode === 'FULL' ? 'bg-green-600 text-white' : 'text-gray-400'}`}>FULL BODY</button>
              </div>
          </div>
      )}
      <div className="relative w-full h-full cursor-pointer" onClick={togglePause}>
        <div className="relative border-4 border-gray-800 rounded-lg overflow-hidden w-full max-w-md aspect-[3/4] bg-gray-900/50 backdrop-blur-sm mx-auto my-auto h-full object-cover">
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
            {!isModelReady && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20"><p className="text-yellow-400 font-bold animate-pulse">SYSTEM LOADING...</p></div>}
            
            {countdownDisplay !== null && !isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                    <p key={countdownDisplay} className="text-9xl font-black text-white animate-pulse">{countdownDisplay}</p>
                </div>
            )}
            
            {statusMessage && !countdownDisplay && <div className="absolute top-1/2 left-0 w-full text-center z-30 transform -translate-y-1/2"><p className="text-6xl font-black text-yellow-400 drop-shadow-lg">{statusMessage}</p></div>}
            
            {isPaused && (
                <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center space-y-2">
                    <p className="text-6xl font-black text-white tracking-widest animate-pulse">PAUSED</p>
                    <p className="text-xs text-gray-300 uppercase tracking-[0.2em]">Tap to Resume</p>
                </div>
            )}

            <div className="absolute top-16 left-4 bg-gray-900/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10">
                <p className="text-xs text-gray-400 mb-1">COUNT</p><p className="text-6xl font-bold text-yellow-400 leading-none font-mono">{count}</p>
            </div>
            
            <div className={`absolute top-16 right-4 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 z-10 ${modeBadgeClass}`}>
                <p className="text-xs font-bold text-white">{modeLabel}</p>
            </div>
            
            <button onClick={toggleMute} className="absolute top-4 right-4 z-50 bg-gray-800/80 p-2 rounded-full border border-gray-600 text-white">{isMuted ? '🔇' : '🔊'}</button>
{/* ★腕立て伏せの難易度切り替えボタン（PUSHUPのときのみ表示） */}
{mode === 'PUSHUP' && (
  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex space-x-2 bg-black/40 px-3 py-2 rounded-full border border-gray-600 backdrop-blur-sm">
    {(['LEVEL1', 'LEVEL2', 'LEVEL3'] as const).map((lv) => (
      <button
        key={lv}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentDifficulty(lv);
        }}
        className={`
          text-xs font-bold px-3 py-1 rounded-full border transition-all
          ${currentDifficulty === lv
            ? 'bg-orange-500 text-white border-orange-300'
            : 'bg-gray-700/50 text-gray-300 border-gray-500'}
        `}
      >
        {lv.replace('LEVEL', 'Lv')}
      </button>
    ))}
  </div>
)}
            {mode === 'PUSHUP' && !isPaused && countdownDisplay === null && (
                <div className="absolute bottom-4 left-0 w-full text-center z-20">
                      <p className="text-sm font-bold text-white bg-black/50 inline-block px-3 py-1 rounded-full">
                        {logicState.current.isSquatting ? "🆗 準備OK！体を起こして！" : "肩を緑のラインまで下げて！"}
                      </p>
                </div>
            )}

            {mode === 'SQUAT' && squatSubMode === 'UPPER' && countdownDisplay === null && !isPaused && (
                <button onClick={handleReset} className="absolute bottom-4 right-4 bg-gray-800/80 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-xs font-bold border border-gray-600 z-40 shadow-lg">↻ 位置リセット</button>
            )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 4. メインレイアウト
// ---------------------------------------------------------
export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentMode, setCurrentMode] = useState<Mode>('SQUAT');
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [soundType, setSoundType] = useState<SoundType>('TECH');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // ★カメラ準備OKフラグ
  const [isCameraReady, setIsCameraReady] = useState(false);

  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { const saved = localStorage.getItem('squat_sound_type'); if (saved) setSoundType(saved as SoundType); }, []);
  const handleSoundChange = (type: SoundType) => { setSoundType(type); localStorage.setItem('squat_sound_type', type); };
  
  // ★カメラ映像取得時に呼ばれる関数でフラグを立てる
  const handleUserMedia = () => { 
      if (webcamRef.current && webcamRef.current.video) { 
          videoRef.current = webcamRef.current.video;
          setIsCameraReady(true);
      } 
  };

  const handleSaveSession = useCallback((count: number, modeStr: string) => {
    if (count === 0) return;
    const saveMode = (modeStr === 'PUSHUP' ? 'PUSHUP' : (modeStr === 'FULL' ? 'FULL' : 'UPPER'));
    const newSession: WorkoutSession = { id: Date.now().toString(), date: new Date().toISOString(), mode: saveMode as any, count: count };
    const saved = localStorage.getItem('squat_sessions');
    const sessions = saved ? JSON.parse(saved) : [];
    sessions.push(newSession);
    localStorage.setItem('squat_sessions', JSON.stringify(sessions));
    setRefreshHistory(prev => prev + 1);
  }, []);

  const goHome = () => { if(confirm("トップ画面に戻りますか？\n(現在のカウントは保存されません)")) { setHasStarted(false); setIsCameraReady(false); } };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentSound={soundType} onSoundChange={handleSoundChange} />
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {hasStarted && (<Webcam ref={webcamRef} onUserMedia={handleUserMedia} className="absolute top-0 left-0 w-full h-full object-cover opacity-50" mirrored={true} playsInline={true} videoConstraints={{ facingMode: 'user', width: 480, height: 360 }} />)}
      </div>
      <div className="relative z-10 flex-1 flex flex-col h-full">
        {hasStarted && (<button onClick={goHome} className="absolute top-4 left-4 z-50 flex flex-col items-start leading-none group active:scale-95 transition"><span className="font-black italic text-lg text-yellow-400 tracking-tighter group-hover:text-green-400 transition-colors">SQUAT<br/>MASTER</span></button>)}
        <div className="flex-1 relative overflow-hidden">
          {!hasStarted ? (
            <StartScreen onStart={() => setHasStarted(true)} onOpenSettings={() => setIsSettingsOpen(true)} />
          ) : (
            currentMode === 'HISTORY' ? (<HistoryScreen onDelete={() => setRefreshHistory(prev => prev + 1)} />) : (
              <WorkoutScreen 
                  key={currentMode} 
                  mode={currentMode === 'SQUAT' ? 'SQUAT' : 'PUSHUP'} 
                  soundType={soundType} 
                  onSave={handleSaveSession} 
                  videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                  isCameraReady={isCameraReady}
              />
            )
          )}
        </div>
        {hasStarted && (
          <div className="h-20 bg-gray-900 border-t border-gray-800 flex justify-around items-center px-2 pb-2">
            <button onClick={() => setCurrentMode('SQUAT')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'SQUAT' ? 'text-blue-400' : 'text-gray-500'}`}><span className="text-2xl">🦵</span><span className="text-xs font-bold">スクワット</span></button>
            <button onClick={() => setCurrentMode('PUSHUP')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'PUSHUP' ? 'text-orange-400' : 'text-gray-500'}`}><span className="text-2xl">💪</span><span className="text-xs font-bold">腕立て伏せ</span></button>
            <button onClick={() => setCurrentMode('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'HISTORY' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl">📊</span><span className="text-xs font-bold">履歴</span></button>
          </div>
        )}
      </div>
      <div className="absolute top-0 right-0 p-1 pointer-events-none z-50"><span className="text-[10px] text-gray-600 font-mono">{APP_VERSION}</span></div>
      <style jsx global>{`
        .react-calendar-heatmap text { font-size: 10px; fill: #666; }
        .react-calendar-heatmap .react-calendar-heatmap-weekday-labels { display: none; }
        .react-calendar-heatmap .color-empty { fill: #1f2937; } 
        .react-calendar-heatmap .color-level-1 { fill: #0e4429; } .react-calendar-heatmap .color-level-2 { fill: #006d32; } 
        .react-calendar-heatmap .color-level-3 { fill: #26a641; } .react-calendar-heatmap .color-level-4 { fill: #39d353; } 
        .react-calendar-heatmap .color-recovery { fill: #3b82f6; }
        @keyframes blink-green { 0% { stroke-opacity: 1; stroke-width: 2px; } 50% { stroke-opacity: 0.2; stroke-width: 2px; } 100% { stroke-opacity: 1; stroke-width: 2px; } }
        .react-calendar-heatmap .today-cell { stroke: #34d399; fill-opacity: 0.8; animation: blink-green 2s infinite ease-in-out; rx: 2px; }
      `}</style>
    </div>
  );
}