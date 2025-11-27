/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

const APP_VERSION = "v0.2.1 (History Graph)";

// ---------------------------------------------------------
// 型定義 & ユーティリティ
// ---------------------------------------------------------
type Mode = 'SQUAT' | 'PUSHUP' | 'HISTORY';
type SquatSubMode = 'UPPER' | 'FULL';

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

// ---------------------------------------------------------
// 1. スタート画面 (ヒートマップ)
// ---------------------------------------------------------
const StartScreen = ({ onStart }: { onStart: () => void }) => {
  const [heatmapData, setHeatmapData] = useState<{date: string, count: number, status: string}[]>([]);
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
      parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTotalCount(parsed.reduce((sum, s) => sum + s.count, 0));
    }

    const workoutMap: {[key: string]: number} = {};
    let firstWorkoutDateStr = "";

    parsed.forEach(s => {
      const d = new Date(s.date);
      const dateStr = d.toISOString().split('T')[0];
      workoutMap[dateStr] = (workoutMap[dateStr] || 0) + s.count;
      if (firstWorkoutDateStr === "") firstWorkoutDateStr = dateStr;
    });

    const today = new Date();
    const tempDate = new Date();
    tempDate.setDate(today.getDate() - 100);

    const dataArray = [];
    let lastWorkoutDaysAgo = -1;

    while (tempDate <= today) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const count = workoutMap[dateStr] || 0;
      let status = 'empty';

      if (firstWorkoutDateStr && dateStr >= firstWorkoutDateStr) {
        if (count > 0) {
          status = 'workout';
          lastWorkoutDaysAgo = 0;
        } else {
          if (lastWorkoutDaysAgo >= 0) {
            lastWorkoutDaysAgo++;
            if (lastWorkoutDaysAgo === 1) status = 'rest-1';
            else if (lastWorkoutDaysAgo === 2) status = 'rest-2';
            else if (lastWorkoutDaysAgo === 3) status = 'rest-3';
            else status = 'warning';
          }
        }
      }
      dataArray.push({ date: dateStr, count, status });
      tempDate.setDate(tempDate.getDate() + 1);
    }

    setHeatmapData(dataArray);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6 relative z-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-green-500">
            SQUAT<br/>MASTER
          </h1>
          <p className="text-gray-400 text-sm">Total Workouts: <span className="text-white font-bold">{totalCount}</span></p>
        </div>

        <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700 overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto" ref={scrollContainerRef}>
            <div className="min-w-[500px]">
              <CalendarHeatmap
                startDate={startDate}
                endDate={today}
                values={heatmapData}
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
             <div className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>運動</div>
             <div className="flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>回復</div>
             <div className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>警告</div>
          </div>
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

        <div className="text-center pt-8">
          <p className="text-xs text-gray-600 font-mono">{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. 履歴画面 (グラフ & リスト & CSV)
// ---------------------------------------------------------
const HistoryScreen = ({ onDelete }: { onDelete: () => void }) => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('squat_sessions');
    if (saved) {
      const parsed: WorkoutSession[] = JSON.parse(saved);
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 新しい順
      setSessions(parsed);
    }
  }, [onDelete]);

  // ★グラフ用データの集計 (直近7日間)
  const graphData = useMemo(() => {
    const data = [];
    // 今日を含めて過去7日
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      
      // その日の合計回数
      const count = sessions
        .filter(s => s.date.startsWith(key))
        .reduce((sum, s) => sum + s.count, 0);
      
      data.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`, // 11/27 形式
        count: count,
        isToday: i === 0
      });
    }
    return data;
  }, [sessions]);

  // グラフの最大値（Y軸のスケール用、最低10回）
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
    link.setAttribute('download', `workout_backup_${new Date().toISOString().split('T')[0]}.csv`);
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
      
      {/* ★週間グラフ (CSSで描画) */}
      <div className="mb-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 mb-4">Last 7 Days</h3>
        <div className="flex items-end justify-between h-32 space-x-2">
          {graphData.map((d, i) => (
            <div key={i} className="flex flex-col items-center flex-1 group">
              {/* バー */}
              <div className="relative w-full flex items-end justify-center h-full">
                 <div 
                   className={`w-full max-w-[20px] rounded-t-md transition-all duration-500 ease-out ${d.isToday ? 'bg-green-400' : 'bg-blue-500/60 group-hover:bg-blue-400'}`}
                   style={{ height: `${(d.count / maxCount) * 100}%` }}
                 >
                    {/* 数値（バーの上に表示） */}
                    {d.count > 0 && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white">
                            {d.count}
                        </span>
                    )}
                 </div>
              </div>
              {/* 日付ラベル */}
              <span className={`text-[10px] mt-2 ${d.isToday ? 'text-green-400 font-bold' : 'text-gray-500'}`}>
                {d.label}
              </span>
            </div>
          ))}
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
                    <span className="text-lg">{icon}</span>
                    <span className={`text-xs font-bold ${textColor}`}>{label}</span>
                    <span className="font-bold text-lg ml-2">{session.count} 回</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(session.id)} className="bg-red-900/20 text-red-400 p-2 rounded-full hover:bg-red-900/40 transition">🗑️</button>
              </div>
            );
        })}
      </div>

      {/* ★CSVボタン (最下部へ移動) */}
      <div className="mt-auto pt-8 pb-4 border-t border-gray-800">
        <p className="text-[10px] text-center text-gray-600 mb-3">Data Management</p>
        <div className="flex justify-center space-x-4">
            <button onClick={handleExport} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center transition">
            📤 バックアップ
            </button>
            <button onClick={handleImportClick} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center transition">
            📥 復元
            </button>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 3. トレーニング画面
// ---------------------------------------------------------
const WorkoutScreen = ({ mode, onSave, videoRef }: { mode: 'SQUAT' | 'PUSHUP', onSave: (count: number, modeStr: string) => void, videoRef: React.RefObject<HTMLVideoElement> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [squatSubMode, setSquatSubMode] = useState<SquatSubMode>('UPPER');
  const [isPaused, setIsPaused] = useState(false);
  const logicState = useRef({ isSquatting: false, baselineY: 0, countdown: 3 });
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("AI準備中...");

  useEffect(() => { countRef.current = count; }, [count]);
  
  useEffect(() => {
    return () => {
      if (countRef.current > 0) {
          const modeStr = mode === 'PUSHUP' ? 'PUSHUP' : squatSubMode;
          onSave(countRef.current, modeStr);
      }
    };
  }, [onSave, mode, squatSubMode]);

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    logicState.current.countdown = 3;
    setCountdownDisplay(3);
    const timer = setInterval(() => {
      logicState.current.countdown -= 1;
      if (logicState.current.countdown > 0) { setCountdownDisplay(logicState.current.countdown); } 
      else { clearInterval(timer); setCountdownDisplay(null); setStatusMessage("RESET OK!"); setTimeout(() => setStatusMessage(""), 1000); }
    }, 1000);
  };

  const togglePause = () => { setIsPaused(prev => !prev); };

  useEffect(() => {
    if (isModelReady && logicState.current.countdown > 0 && countdownDisplay === null) {
      setCountdownDisplay(3);
      const timer = setInterval(() => {
        logicState.current.countdown -= 1;
        if (logicState.current.countdown > 0) { setCountdownDisplay(logicState.current.countdown); } 
        else { clearInterval(timer); setCountdownDisplay(null); setStatusMessage("GO!"); setTimeout(() => setStatusMessage(""), 1000); }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isModelReady]);

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
            const rShoulder = results.poseLandmarks[12]; const rElbow = results.poseLandmarks[14]; const rWrist = results.poseLandmarks[16];
            const lShoulder = results.poseLandmarks[11]; const lElbow = results.poseLandmarks[13]; const lWrist = results.poseLandmarks[15];
            let targetS, targetE, targetW;
            if (rShoulder && rElbow && rWrist && rElbow.visibility > 0.5) { targetS = rShoulder; targetE = rElbow; targetW = rWrist; } 
            else { targetS = lShoulder; targetE = lElbow; targetW = lWrist; }

            if (targetS && targetE && targetW) {
                const elbowAngle = calculateAngle(targetS, targetE, targetW);
                ctx.beginPath(); ctx.moveTo(targetS.x * videoWidth, targetS.y * videoHeight); ctx.lineTo(targetE.x * videoWidth, targetE.y * videoHeight); ctx.lineTo(targetW.x * videoWidth, targetW.y * videoHeight);
                ctx.lineWidth = 4; ctx.strokeStyle = "#FFA500"; ctx.stroke();
                if (elbowAngle < 90) { if (!logicState.current.isSquatting) logicState.current.isSquatting = true; } 
                else if (elbowAngle > 160) { if (logicState.current.isSquatting) { logicState.current.isSquatting = false; setCount(c => c + 1); } }
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

        const loop = async () => {
          if (videoRef.current && pose) {
            await pose.send({ image: videoRef.current });
          }
          animationFrameId = requestAnimationFrame(loop);
        };
        loop();

      } catch (e) { console.error(e); }
    };

    loadMediaPipe();
    return () => { 
      cancelAnimationFrame(animationFrameId);
      if (pose) pose.close(); 
    };
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
            {countdownDisplay !== null && !isPaused && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30"><p className="text-9xl font-black text-white animate-ping">{countdownDisplay}</p></div>}
            {statusMessage && <div className="absolute top-1/2 left-0 w-full text-center z-30 transform -translate-y-1/2"><p className="text-6xl font-black text-yellow-400 drop-shadow-lg">{statusMessage}</p></div>}
            
            {isPaused && (
                <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center space-y-2">
                    <p className="text-6xl font-black text-white tracking-widest animate-pulse">PAUSED</p>
                    <p className="text-xs text-gray-300 uppercase tracking-[0.2em]">Tap to Resume</p>
                </div>
            )}

            <div className="absolute top-16 left-4 bg-gray-900/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10">
                <p className="text-xs text-gray-400 mb-1">COUNT</p>
                <p className="text-6xl font-bold text-yellow-400 leading-none font-mono">{count}</p>
            </div>
            
            <div className={`absolute top-16 right-4 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 z-10 ${modeBadgeClass}`}>
                <p className="text-xs font-bold text-white">{modeLabel}</p>
            </div>

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
  
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleUserMedia = () => {
    if (webcamRef.current && webcamRef.current.video) {
      // @ts-ignore
      videoRef.current = webcamRef.current.video;
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

  const goHome = () => {
    if(confirm("トップ画面に戻りますか？\n(現在のカウントは保存されません)")) {
      setHasStarted(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {hasStarted && (
           <Webcam ref={webcamRef} onUserMedia={handleUserMedia} className="absolute top-0 left-0 w-full h-full object-cover opacity-50" mirrored={true} playsInline={true} videoConstraints={{ facingMode: 'user', width: 480, height: 360 }} />
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col h-full">
        {hasStarted && (
          <button onClick={goHome} className="absolute top-4 left-4 z-50 flex flex-col items-start leading-none group active:scale-95 transition">
            <span className="font-black italic text-lg text-yellow-400 tracking-tighter group-hover:text-green-400 transition-colors">SQUAT<br/>MASTER</span>
          </button>
        )}

        <div className="flex-1 relative overflow-hidden">
          {!hasStarted ? (
            <StartScreen onStart={() => setHasStarted(true)} />
          ) : (
            currentMode === 'HISTORY' ? (
              <HistoryScreen onDelete={() => setRefreshHistory(prev => prev + 1)} />
            ) : (
              <WorkoutScreen key={currentMode} mode={currentMode === 'SQUAT' ? 'SQUAT' : 'PUSHUP'} onSave={handleSaveSession} videoRef={videoRef as React.RefObject<HTMLVideoElement>} />
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
    </div>
  );
}