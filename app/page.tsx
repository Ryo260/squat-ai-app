/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const APP_VERSION = "v0.1.1 (Fix Save & Reset)";

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

// 角度計算
const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

// ---------------------------------------------------------
// 1. 履歴画面コンポーネント
// ---------------------------------------------------------
const HistoryScreen = ({ onDelete }: { onDelete: () => void }) => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('squat_sessions');
    if (saved) {
      const parsed: WorkoutSession[] = JSON.parse(saved);
      // 新しい順
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(parsed);
      setTotalCount(parsed.reduce((sum, s) => sum + s.count, 0));
    }
  }, [onDelete]);

  const handleDelete = (id: string) => {
    if(!confirm('この記録を削除しますか？')) return;
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem('squat_sessions', JSON.stringify(newSessions));
    setSessions(newSessions);
    setTotalCount(newSessions.reduce((sum, s) => sum + s.count, 0));
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 overflow-y-auto">
      <div className="mb-6 text-center">
        <p className="text-gray-400 text-sm">TOTAL SQUATS</p>
        <p className="text-6xl font-black text-yellow-400 font-mono">{totalCount}</p>
      </div>
      <div className="space-y-3 pb-20">
        {sessions.length === 0 && <p className="text-center text-gray-500 py-10">記録なし</p>}
        {sessions.map((session) => (
          <div key={session.id} className="bg-gray-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-gray-400">
                {new Date(session.date).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded ${session.mode === 'UPPER' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                    {session.mode === 'UPPER' ? '上半身' : '全身'}
                </span>
                <span className="font-bold text-xl">{session.count} 回</span>
              </div>
            </div>
            <button onClick={() => handleDelete(session.id)} className="bg-red-900/30 text-red-400 p-3 rounded-full hover:bg-red-900/50 transition">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. トレーニング画面
// ---------------------------------------------------------
const WorkoutScreen = ({ mode, onSave }: { mode: 'UPPER_BODY' | 'FULL_BODY', onSave: (count: number) => void }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ロジック用Ref
  const logicState = useRef({
    isSquatting: false,
    baselineY: 0,
    countdown: 3,
  });

  const [count, setCount] = useState(0);
  // ★保存用に最新のカウントをRefにも入れておく（useEffect内で参照するため）
  const countRef = useRef(0);

  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("準備中...");

  // カウントが増えたらRefも更新
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  // ★修正ポイント：コンポーネントが「消える時だけ」保存する
  useEffect(() => {
    // マウント時の処理（特になし）
    return () => {
      // アンマウント時（タブ切り替え時）の処理
      // Refから最新の値を取るので、依存配列の影響を受けない
      if (countRef.current > 0) {
        onSave(countRef.current);
      }
    };
  }, []); // 依存配列を空にすることで、最初と最後だけ実行される

  // リセットボタン処理
  const handleReset = () => {
    // カウントダウンを再開させるだけで、ロジック側で自動的に基準を取り直します
    logicState.current.countdown = 3;
    setCountdownDisplay(3);
    
    // タイマー再始動
    const timer = setInterval(() => {
      logicState.current.countdown -= 1;
      if (logicState.current.countdown > 0) {
        setCountdownDisplay(logicState.current.countdown);
      } else {
        clearInterval(timer);
        setCountdownDisplay(null);
        setStatusMessage("RESET OK!");
        setTimeout(() => setStatusMessage(""), 1000);
      }
    }, 1000);
  };

  // 初回のカウントダウン開始
  useEffect(() => {
    if (isCameraReady && isModelReady && logicState.current.countdown > 0 && countdownDisplay === null) {
      setCountdownDisplay(3);
      const timer = setInterval(() => {
        logicState.current.countdown -= 1;
        if (logicState.current.countdown > 0) {
          setCountdownDisplay(logicState.current.countdown);
        } else {
          clearInterval(timer);
          setCountdownDisplay(null);
          setStatusMessage("GO!");
          setTimeout(() => setStatusMessage(""), 1000);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isCameraReady, isModelReady]);

  // AIループ
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

      // カウントダウン中（＝リセット中も含む）は基準値を取り続ける
      if (logicState.current.countdown > 0) {
          if (results.poseLandmarks) {
              const leftShoulder = results.poseLandmarks[11];
              const rightShoulder = results.poseLandmarks[12];
              if (leftShoulder && rightShoulder) {
                  // ★ここで常に最新の肩位置を基準として更新し続ける
                  logicState.current.baselineY = (leftShoulder.y + rightShoulder.y) / 2;
              }
          }
          // ガイド線を表示
          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, logicState.current.baselineY * videoHeight);
          ctx.lineTo(videoWidth, logicState.current.baselineY * videoHeight);
          ctx.stroke();
          
          ctx.restore();
          return;
      }

      if (results.poseLandmarks) {
        if (mode === 'UPPER_BODY') {
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];

            if (leftShoulder && rightShoulder) {
                const currentY = (leftShoulder.y + rightShoulder.y) / 2;
                const baselineYPx = logicState.current.baselineY * videoHeight;
                
                // 基準線
                ctx.beginPath();
                ctx.moveTo(0, baselineYPx);
                ctx.lineTo(videoWidth, baselineYPx);
                ctx.strokeStyle = "rgba(0,255,255,0.8)";
                ctx.lineWidth = 2;
                ctx.stroke();

                // 肩ポイント
                ctx.fillStyle = "#00FFFF";
                ctx.beginPath();
                ctx.arc(leftShoulder.x * videoWidth, leftShoulder.y * videoHeight, 8, 0, 2 * Math.PI);
                ctx.arc(rightShoulder.x * videoWidth, rightShoulder.y * videoHeight, 8, 0, 2 * Math.PI);
                ctx.fill();

                // 判定
                const thresholdDown = logicState.current.baselineY + 0.1; // 10%下がる
                const thresholdUp = logicState.current.baselineY + 0.03;  // ほぼ元に戻る

                if (currentY > thresholdDown) {
                    if (!logicState.current.isSquatting) logicState.current.isSquatting = true;
                } else if (currentY < thresholdUp) {
                    if (logicState.current.isSquatting) {
                        logicState.current.isSquatting = false;
                        setCount(c => c + 1);
                    }
                }
            }
        } else {
            // 全身モード
            const leftHip = results.poseLandmarks[23];
            const leftKnee = results.poseLandmarks[25];
            const leftAnkle = results.poseLandmarks[27];
            const rightHip = results.poseLandmarks[24];
            const rightKnee = results.poseLandmarks[26];
            const rightAnkle = results.poseLandmarks[28];
            
            // ... (全身モードのロジックは前回と同じなので省略なしで記述)
            const leftScore = (leftHip?.visibility || 0) + (leftKnee?.visibility || 0) + (leftAnkle?.visibility || 0);
            const rightScore = (rightHip?.visibility || 0) + (rightKnee?.visibility || 0) + (rightAnkle?.visibility || 0);
            let tHip, tKnee, tAnkle;
            if (leftScore > rightScore) { tHip = leftHip; tKnee = leftKnee; tAnkle = leftAnkle; }
            else { tHip = rightHip; tKnee = rightKnee; tAnkle = rightAnkle; }

            if (tHip && tKnee && tAnkle) {
                const angle = calculateAngle(tHip, tKnee, tAnkle);
                ctx.beginPath();
                ctx.moveTo(tHip.x * videoWidth, tHip.y * videoHeight);
                ctx.lineTo(tKnee.x * videoWidth, tKnee.y * videoHeight);
                ctx.lineTo(tAnkle.x * videoWidth, tAnkle.y * videoHeight);
                ctx.lineWidth = 4; ctx.strokeStyle = "#00FF00"; ctx.stroke();
                if (angle < 100) { if (!logicState.current.isSquatting) logicState.current.isSquatting = true; } 
                else if (angle > 160) { 
                    if (logicState.current.isSquatting) { 
                        logicState.current.isSquatting = false; setCount(c => c + 1); 
                    } 
                }
            }
        }
      }
      ctx.restore();
    };

    const loadMediaPipe = async () => {
      try {
        const poseModule = await import('@mediapipe/pose');
        const cameraModule = await import('@mediapipe/camera_utils');
        pose = new poseModule.Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(onResults);
        if (webcamRef.current && webcamRef.current.video) {
          camera = new cameraModule.Camera(webcamRef.current.video, {
            onFrame: async () => { if (webcamRef.current?.video && pose) await pose.send({ image: webcamRef.current.video }); },
            width: 480, height: 360,
          });
          camera.start();
          setIsModelReady(true);
        }
      } catch (e) { console.error(e); }
    };
    loadMediaPipe();
    return () => { if (camera) camera.stop(); if (pose) pose.close(); };
  }, [mode]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
      <div className="relative border-4 border-gray-800 rounded-lg overflow-hidden w-full max-w-md aspect-[3/4] bg-gray-900">
        <Webcam
          ref={webcamRef}
          onUserMedia={() => setIsCameraReady(true)}
          className="absolute top-0 left-0 w-full h-full object-cover opacity-0"
          mirrored={true}
          playsInline={true}
          videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
        
        {!isModelReady && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20"><p className="text-yellow-400 font-bold animate-pulse">SYSTEM LOADING...</p></div>}
        {countdownDisplay !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30"><p className="text-9xl font-black text-white animate-ping">{countdownDisplay}</p></div>}
        {statusMessage && <div className="absolute top-1/2 left-0 w-full text-center z-30 transform -translate-y-1/2"><p className="text-6xl font-black text-yellow-400 drop-shadow-lg">{statusMessage}</p></div>}

        {/* カウント表示 */}
        <div className="absolute top-4 left-4 bg-gray-900/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10">
          <p className="text-xs text-gray-400 mb-1">COUNT</p>
          <p className="text-6xl font-bold text-yellow-400 leading-none font-mono">{count}</p>
        </div>
        
        {/* モード表示 */}
        <div className="absolute top-4 right-4 bg-blue-900/80 px-3 py-1 rounded-full backdrop-blur-md border border-blue-500 z-10">
            <p className="text-xs font-bold text-blue-200">{mode === 'UPPER_BODY' ? '上半身' : '全身'}</p>
        </div>

        {/* ★リセットボタン（上半身モードのみ） */}
        {mode === 'UPPER_BODY' && countdownDisplay === null && (
            <button 
                onClick={handleReset}
                className="absolute bottom-4 right-4 bg-gray-800/80 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-xs font-bold border border-gray-600 z-40 shadow-lg"
            >
                ↻ 位置リセット
            </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 3. メインレイアウト
// ---------------------------------------------------------
export default function Home() {
  const [currentMode, setCurrentMode] = useState<Mode>('UPPER_BODY');
  const [refreshHistory, setRefreshHistory] = useState(0);

  // ★useCallbackで関数を固定（無駄な再レンダリング防止）
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

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        {currentMode === 'HISTORY' ? (
          <HistoryScreen onDelete={() => setRefreshHistory(prev => prev + 1)} />
        ) : (
          <WorkoutScreen 
            key={currentMode} 
            mode={currentMode === 'UPPER_BODY' ? 'UPPER_BODY' : 'FULL_BODY'} 
            onSave={handleSaveSession} 
          />
        )}
      </div>

      <div className="h-20 bg-gray-900 border-t border-gray-800 flex justify-around items-center px-2 pb-2">
        <button onClick={() => setCurrentMode('UPPER_BODY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'UPPER_BODY' ? 'text-blue-400' : 'text-gray-500'}`}>
          <span className="text-2xl">👤</span><span className="text-xs font-bold">上半身(肩)</span>
        </button>
        <button onClick={() => setCurrentMode('FULL_BODY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'FULL_BODY' ? 'text-green-400' : 'text-gray-500'}`}>
          <span className="text-2xl">🦵</span><span className="text-xs font-bold">全身(膝)</span>
        </button>
        <button onClick={() => setCurrentMode('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentMode === 'HISTORY' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl">📊</span><span className="text-xs font-bold">履歴/編集</span>
        </button>
      </div>
      <div className="absolute top-0 right-0 p-1 pointer-events-none z-50"><span className="text-[10px] text-gray-600 font-mono">{APP_VERSION}</span></div>
    </div>
  );
}