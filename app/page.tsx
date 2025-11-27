/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

const APP_VERSION = "v0.1.6 (CSV Backup)";

// ---------------------------------------------------------
// 型定義 & ユーティリティ
// ---------------------------------------------------------
type Mode = 'UPPER_BODY' | 'FULL_BODY' | 'HISTORY';

interface WorkoutSession {
  id: string;
  date: string;
  mode: 'UPPER' | 'FULL';
  count: number;
}

const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

// ---------------------------------------------------------
// 1. スタート画面
// ---------------------------------------------------------
const StartScreen = ({ onStart }: { onStart: () => void }) => {
  const [heatmapData, setHeatmapData] = useState<{date: string, count: number}[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const saved = localStorage.getItem('squat_sessions');
    let parsed: WorkoutSession[] = [];
    if (saved) {
      parsed = JSON.parse(saved);
      setTotalCount(parsed.reduce((sum, s) => sum + s.count, 0));
    }

    const map: {[key: string]: number} = {};
    parsed.forEach(s => {
      const d = new Date(s.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      map[dateStr] = (map[dateStr] || 0) + s.count;
    });

    const todayStr = getTodayStr();
    if (map[todayStr] === undefined) {
      map[todayStr] = 0;
    }

    const data = Object.keys(map).map(date => ({ date, count: map[date] }));
    setHeatmapData(data);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      }
    }, 100);
  }, []);

  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 100);
  const todayStr = getTodayStr();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-green-500">
            SQUAT<br/>MASTER
          </h1>
          <p className="text-gray-400 text-sm">Total Squats: <span className="text-white font-bold">{totalCount}</span></p>
        </div>

        <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto" ref={scrollContainerRef}>
            <div className="min-w-[500px]">
              <CalendarHeatmap
                startDate={startDate}
                endDate={today}
                values={heatmapData}
                classForValue={(value) => {
                  if (!value) return 'color-empty';
                  let cls = `color-scale-${Math.min(Math.ceil(value.count / 10), 4)}`;
                  if (value.count === 0) cls = 'color-empty';
                  if (value.date === todayStr) {
                      return `${cls} today-cell`;
                  }
                  return cls;
                }}
                titleForValue={(value) => value ? `${value.date}: ${value.count}回` : ''}
              />
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-500 mt-2">
             <span className="animate-pulse text-green-400 font-bold">□</span> 今日の枠を埋めよう！
          </p>
        </div>

        <button
          onClick={onStart}
          className="group relative w-full py-6 px-6 bg-green-600 hover:bg-green-500 rounded-2xl shadow-[0_10px_0_rgb(21,128,61)] active:shadow-[0_2px_0_rgb(21,128,61)] active:translate-y-2 transition-all duration-150 overflow-hidden"
        >
          <div className="relative z-10 flex items-center justify-center space-x-2">
            <span className="text-3xl font-black tracking-widest text-white">START</span>
            <span className="text-3xl">🔥</span>
          </div>
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-2xl pointer-events-none"></div>
        </button>

        <div className="bg-gray-800/70 border border-gray-700 rounded-2xl p-4 space-y-2 shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-300 text-xl">⭐</span>
            <p className="text-sm font-bold text-white">ホーム画面に追加して即起動！</p>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            iPhone: Safari の共有ボタン →「ホーム画面に追加」／Android: Chrome メニュー →「ホーム画面に追加」
          </p>
          <p className="text-[11px] text-gray-500">※PWAとしてインストールするとオフラインでも起動が早くなります。</p>
        </div>

        <div className="text-center pt-8">
          <p className="text-xs text-gray-600 font-mono">{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. 履歴画面 (CSV機能付き)
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

  // 1行削除
  const handleDelete = (id: string) => {
    if(!confirm('削除しますか？')) return;
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem('squat_sessions', JSON.stringify(newSessions));
    onDelete();
  };

  // ★CSV書き出し
  const handleExport = () => {
    if (sessions.length === 0) {
      alert("データがありません");
      return;
    }
    // ヘッダー + データ行
    const header = "id,date,mode,count\n";
    const rows = sessions.map(s => `${s.id},${s.date},${s.mode},${s.count}`).join("\n");
    const csvContent = header + rows;
    
    // ダウンロード発火
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `squat_backup_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ★CSV読み込み
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n');
        // ヘッダーを除外
        const dataLines = lines.slice(1);
        
        const newSessions: WorkoutSession[] = [];
        dataLines.forEach(line => {
          const [id, date, mode, countStr] = line.split(',');
          if (id && date && mode && countStr) {
            newSessions.push({
              id,
              date,
              mode: mode as 'UPPER' | 'FULL',
              count: Number(countStr)
            });
          }
        });

        if (newSessions.length === 0) {
          alert("有効なデータが見つかりませんでした");
          return;
        }

        // 既存データとマージ（ID重複チェック）
        const currentSaved = localStorage.getItem('squat_sessions');
        let currentSessions: WorkoutSession[] = currentSaved ? JSON.parse(currentSaved) : [];
        
        // IDが既に存在する場合はスキップ、新しいものだけ追加
        let addedCount = 0;
        newSessions.forEach(newS => {
          if (!currentSessions.some(curr => curr.id === newS.id)) {
            currentSessions.push(newS);
            addedCount++;
          }
        });

        if (addedCount > 0) {
          localStorage.setItem('squat_sessions', JSON.stringify(currentSessions));
          alert(`${addedCount}件のデータを復元しました！`);
          onDelete(); // 再読み込み
        } else {
          alert("新しいデータはありませんでした（全て重複済み）");
        }
      } catch (err) {
        alert("ファイルの読み込みに失敗しました");
        console.error(err);
      }
    };
    reader.readAsText(file);
    // inputをリセット
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 pt-16 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-center">History Log</h2>

      {/* ★CSVボタンエリア */}
      <div className="flex justify-center space-x-4 mb-6">
        <button 
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-lg active:scale-95 transition"
        >
          📤 バックアップ(CSV)
        </button>
        <button 
          onClick={handleImportClick}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-lg active:scale-95 transition"
        >
          📥 復元(CSV)
        </button>
        {/* 隠しinput */}
        <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
      </div>

      <div className="space-y-2 pb-20">
        {sessions.length === 0 && <p className="text-center text-gray-500 py-10">記録なし</p>}
        {sessions.map((session) => (
          <div key={session.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center shadow-sm border border-gray-700">
            <div>
              <p className="text-xs text-gray-400">
                {new Date(session.date).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${session.mode === 'UPPER' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                    {session.mode === 'UPPER' ? '上半身' : '全身'}
                </span>
                <span className="font-bold text-lg">{session.count} 回</span>
              </div>
            </div>
            <button onClick={() => handleDelete(session.id)} className="bg-red-900/20 text-red-400 p-2 rounded-full hover:bg-red-900/40 transition">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 3. トレーニング画面
// ---------------------------------------------------------
const WorkoutScreen = ({ mode, onSave }: { mode: 'UPPER_BODY' | 'FULL_BODY', onSave: (count: number) => void }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logicState = useRef({ isSquatting: false, baselineY: 0, countdown: 3 });
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("準備中...");

  useEffect(() => { countRef.current = count; }, [count]);
  useEffect(() => { return () => { if (countRef.current > 0) onSave(countRef.current); }; }, []);

  const handleReset = () => {
    logicState.current.countdown = 3;
    setCountdownDisplay(3);
    const timer = setInterval(() => {
      logicState.current.countdown -= 1;
      if (logicState.current.countdown > 0) { setCountdownDisplay(logicState.current.countdown); } 
      else { clearInterval(timer); setCountdownDisplay(null); setStatusMessage("RESET OK!"); setTimeout(() => setStatusMessage(""), 1000); }
    }, 1000);
  };

  useEffect(() => {
    if (isCameraReady && isModelReady && logicState.current.countdown > 0 && countdownDisplay === null) {
      setCountdownDisplay(3);
      const timer = setInterval(() => {
        logicState.current.countdown -= 1;
        if (logicState.current.countdown > 0) { setCountdownDisplay(logicState.current.countdown); } 
        else { clearInterval(timer); setCountdownDisplay(null); setStatusMessage("GO!"); setTimeout(() => setStatusMessage(""), 1000); }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isCameraReady, isModelReady]);

  useEffect(() => {
    let camera: any = null;
    let pose: any = null;
    const onResults = (results: any) => {
      if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;
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
          if (results.poseLandmarks) {
              const leftShoulder = results.poseLandmarks[11];
              const rightShoulder = results.poseLandmarks[12];
              if (leftShoulder && rightShoulder) logicState.current.baselineY = (leftShoulder.y + rightShoulder.y) / 2;
          }
          ctx.strokeStyle = "yellow"; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(0, logicState.current.baselineY * videoHeight); ctx.lineTo(videoWidth, logicState.current.baselineY * videoHeight); ctx.stroke();
          ctx.restore(); return;
      }

      if (results.poseLandmarks) {
        if (mode === 'UPPER_BODY') {
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
      ctx.restore();
    };

    const loadMediaPipe = async () => {
      try {
        const poseModule = await import('@mediapipe/pose'); const cameraModule = await import('@mediapipe/camera_utils');
        pose = new poseModule.Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(onResults);
        if (webcamRef.current && webcamRef.current.video) {
          camera = new cameraModule.Camera(webcamRef.current.video, {
            onFrame: async () => { if (webcamRef.current?.video && pose) await pose.send({ image: webcamRef.current.video }); },
            width: 480, height: 360,
          });
          camera.start(); setIsModelReady(true);
        }
      } catch (e) { console.error(e); }
    };
    loadMediaPipe();
    return () => { if (camera) camera.stop(); if (pose) pose.close(); };
  }, [mode]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
      <div className="relative border-4 border-gray-800 rounded-lg overflow-hidden w-full max-w-md aspect-[3/4] bg-gray-900">
        <Webcam ref={webcamRef} onUserMedia={() => setIsCameraReady(true)} className="absolute top-0 left-0 w-full h-full object-cover opacity-0" mirrored={true} playsInline={true} videoConstraints={{ facingMode: 'user', width: 480, height: 360 }} />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
        {!isModelReady && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20"><p className="text-yellow-400 font-bold animate-pulse">SYSTEM LOADING...</p></div>}
        {countdownDisplay !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30"><p className="text-9xl font-black text-white animate-ping">{countdownDisplay}</p></div>}
        {statusMessage && <div className="absolute top-1/2 left-0 w-full text-center z-30 transform -translate-y-1/2"><p className="text-6xl font-black text-yellow-400 drop-shadow-lg">{statusMessage}</p></div>}
        <div className="absolute top-16 left-4 bg-gray-900/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10"><p className="text-xs text-gray-400 mb-1">COUNT</p><p className="text-6xl font-bold text-yellow-400 leading-none font-mono">{count}</p></div>
        <div className="absolute top-16 right-4 bg-blue-900/80 px-3 py-1 rounded-full backdrop-blur-md border border-blue-500 z-10"><p className="text-xs font-bold text-blue-200">{mode === 'UPPER_BODY' ? '上半身' : '全身'}</p></div>
        {mode === 'UPPER_BODY' && countdownDisplay === null && <button onClick={handleReset} className="absolute bottom-4 right-4 bg-gray-800/80 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-xs font-bold border border-gray-600 z-40 shadow-lg">↻ 位置リセット</button>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 4. メインレイアウト
// ---------------------------------------------------------
export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentMode, setCurrentMode] = useState<Mode>('UPPER_BODY');
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleSaveSession = useCallback((count: number) => {
    if (count === 0) return;
    const newSession: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mode: currentMode === 'UPPER_BODY' ? 'UPPER' : 'FULL',
      count: count
    };
    const saved = localStorage.getItem('squat_sessions');
    const sessions = saved ? JSON.parse(saved) : [];
    sessions.push(newSession);
    localStorage.setItem('squat_sessions', JSON.stringify(sessions));
    setRefreshHistory(prev => prev + 1);
  }, [currentMode]);

  const goHome = () => {
    if(confirm("トップ画面に戻りますか？")) {
      setHasStarted(false);
    }
  };

  if (!hasStarted) return <StartScreen onStart={() => setHasStarted(true)} />;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      <button onClick={goHome} className="absolute top-4 left-4 z-50 flex flex-col items-start leading-none group active:scale-95 transition">
        <span className="font-black italic text-lg text-yellow-400 tracking-tighter group-hover:text-green-400 transition-colors">SQUAT<br/>MASTER</span>
      </button>

      <div className="flex-1 relative overflow-hidden">
        {currentMode === 'HISTORY' ? (
          <HistoryScreen onDelete={() => setRefreshHistory(prev => prev + 1)} />
        ) : (
          <WorkoutScreen key={currentMode} mode={currentMode === 'UPPER_BODY' ? 'UPPER_BODY' : 'FULL_BODY'} onSave={handleSaveSession} />
        )}
      </div>
      <div className="h-20 bg-gray-900 border-t border-gray-800 flex justify-around items-center px-2 pb-2">
        <button onClick={() => setCurrentMode('UPPER_BODY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'UPPER_BODY' ? 'text-blue-400' : 'text-gray-500'}`}><span className="text-2xl">👤</span><span className="text-xs font-bold">上半身(肩)</span></button>
        <button onClick={() => setCurrentMode('FULL_BODY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'FULL_BODY' ? 'text-green-400' : 'text-gray-500'}`}><span className="text-2xl">🦵</span><span className="text-xs font-bold">全身(膝)</span></button>
        <button onClick={() => setCurrentMode('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'HISTORY' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl">📊</span><span className="text-xs font-bold">履歴/編集</span></button>
      </div>
      <div className="absolute top-0 right-0 p-1 pointer-events-none z-50"><span className="text-[10px] text-gray-600 font-mono">{APP_VERSION}</span></div>
    </div>
  );
}