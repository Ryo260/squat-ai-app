/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const APP_VERSION = "v0.0.8 (Lag Fix)";

// 角度計算
const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

// ---------------------------------------------------------
// 1. 筋トレ画面
// ---------------------------------------------------------
const WorkoutScreen = ({ onBack }: { onBack: () => void }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ★重要：AIの判定ロジックで使う変数を「Ref」に変更
  // これにより、値が変わってもAIの再読み込みが発生しなくなります
  const isSquattingRef = useRef(false); 
  const countdownRef = useRef<number | null>(null);

  // 画面表示用（こちらはStateのまま）
  const [count, setCount] = useState(0);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);

  // 準備完了チェック
  useEffect(() => {
    if (isCameraReady && isModelReady && countdownRef.current === null) {
      // 3秒カウントダウン開始
      countdownRef.current = 3;
      setCountdownDisplay(3);
      
      const timer = setInterval(() => {
        if (countdownRef.current !== null && countdownRef.current > 0) {
          countdownRef.current -= 1;
          setCountdownDisplay(countdownRef.current);
        } else {
          clearInterval(timer);
          countdownRef.current = 0; // 0になったらスタート
          setCountdownDisplay(null); // 表示を消す
        }
      }, 1000);
    }
  }, [isCameraReady, isModelReady]);

  // ★AI初期化処理（依存配列を [] にして、絶対に1回しか実行させない！）
  useEffect(() => {
    let camera: any = null;
    let pose: any = null;

    const onResults = (results: any) => {
      if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;

      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const canvasCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!canvasCtx) return;

      // 映像描画
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
      canvasCtx.translate(videoWidth, 0);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

      // カウントダウン終了後（0）のみ判定
      if (countdownRef.current === 0 && results.poseLandmarks) {
        const leftHip = results.poseLandmarks[23];
        const leftKnee = results.poseLandmarks[25];
        const leftAnkle = results.poseLandmarks[27];
        const rightHip = results.poseLandmarks[24];
        const rightKnee = results.poseLandmarks[26];
        const rightAnkle = results.poseLandmarks[28];

        // 信頼度判定
        const leftScore = (leftHip?.visibility || 0) + (leftKnee?.visibility || 0) + (leftAnkle?.visibility || 0);
        const rightScore = (rightHip?.visibility || 0) + (rightKnee?.visibility || 0) + (rightAnkle?.visibility || 0);

        let targetHip, targetKnee, targetAnkle;
        if (leftScore > rightScore) {
          targetHip = leftHip; targetKnee = leftKnee; targetAnkle = leftAnkle;
        } else {
          targetHip = rightHip; targetKnee = rightKnee; targetAnkle = rightAnkle;
        }

        if (targetHip && targetKnee && targetAnkle) {
          const angle = calculateAngle(targetHip, targetKnee, targetAnkle);

          // 緑の線を描画
          canvasCtx.beginPath();
          canvasCtx.moveTo(targetHip.x * videoWidth, targetHip.y * videoHeight);
          canvasCtx.lineTo(targetKnee.x * videoWidth, targetKnee.y * videoHeight);
          canvasCtx.lineTo(targetAnkle.x * videoWidth, targetAnkle.y * videoHeight);
          canvasCtx.lineWidth = 3;
          canvasCtx.strokeStyle = "#00FF00";
          canvasCtx.stroke();

          // ★Refを使った判定ロジック（ここが高速化の肝）
          if (angle < 100) {
            if (!isSquattingRef.current) {
               isSquattingRef.current = true; // Refを更新
            }
          } else if (angle > 160) {
            if (isSquattingRef.current) {
               isSquattingRef.current = false; // Refを更新
               setCount(prev => prev + 1); // ここだけReactに通知
            }
          }
        }
      }
      canvasCtx.restore();
    };

    const loadMediaPipe = async () => {
      try {
        const poseModule = await import('@mediapipe/pose');
        const cameraModule = await import('@mediapipe/camera_utils');

        pose = new poseModule.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(onResults);

        if (webcamRef.current && webcamRef.current.video) {
          camera = new cameraModule.Camera(webcamRef.current.video, {
            onFrame: async () => {
              if (webcamRef.current?.video && pose) {
                await pose.send({ image: webcamRef.current.video });
              }
            },
            width: 480,
            height: 360,
          });
          camera.start();
          setIsModelReady(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadMediaPipe();

    // クリーンアップ
    return () => {
      if (camera) camera.stop();
      if (pose) pose.close();
    };
  }, []); // ★依存配列が空＝最初の1回しか実行されない！

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="w-full max-w-md flex justify-between items-center mb-2 z-10">
        <button onClick={onBack} className="bg-gray-800 text-white px-3 py-1 rounded text-xs">終了</button>
        <span className="text-xs text-gray-500 font-mono">{APP_VERSION}</span>
      </div>

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
        
        {/* 準備中 */}
        {!isModelReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <p className="text-yellow-400 font-bold animate-pulse">SYSTEM LOADING...</p>
            </div>
        )}

        {/* カウントダウン */}
        {countdownDisplay !== null && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                 <p className="text-9xl font-black text-white animate-ping">{countdownDisplay}</p>
             </div>
        )}

        {/* カウント表示 */}
        <div className="absolute top-4 left-4 bg-gray-900/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10">
          <p className="text-xs text-gray-400 mb-1">COUNT</p>
          <p className="text-6xl font-bold text-yellow-400 leading-none font-mono">{count}</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. スタート画面
// ---------------------------------------------------------
const StartScreen = ({ onStart }: { onStart: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      <div className="text-center space-y-8 max-w-sm w-full">
        <h1 className="text-4xl font-black text-yellow-400 italic">SQUAT<br/>SIMPLE</h1>
        <button
          onClick={onStart}
          className="w-full py-6 bg-blue-600 rounded-xl text-2xl font-bold shadow-lg active:scale-95 transition"
        >
          START
        </button>
        <p className="text-xs text-gray-500">{APP_VERSION}</p>
      </div>
    </div>
  );
};

export default function Home() {
  const [isStarted, setIsStarted] = useState(false);
  return (
    <>
      {isStarted ? (
        <WorkoutScreen onBack={() => setIsStarted(false)} />
      ) : (
        <StartScreen onStart={() => setIsStarted(true)} />
      )}
    </>
  );
}