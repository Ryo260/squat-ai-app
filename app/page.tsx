/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
// ★注意：ここで @mediapipe を import するとビルドエラーになるので削除しました。
// 代わりに下の方で「ダイナミックインポート」します。

// ★バージョン
const APP_VERSION = "v0.0.5 (Build Fix)";

// ---------------------------------------------------------
// 判定ロジック
// ---------------------------------------------------------
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
  const [count, setCount] = useState(0);
  const [isSquatting, setIsSquatting] = useState(false);
  const [feedback, setFeedback] = useState("AI読み込み中...");
  const [isLoading, setIsLoading] = useState(true);
  
  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;
    
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
    canvasCtx.translate(videoWidth, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

    if (results.poseLandmarks) {
      const hip = results.poseLandmarks[24];
      const knee = results.poseLandmarks[26];
      const ankle = results.poseLandmarks[28];

      if (hip && knee && ankle) {
        const angle = calculateAngle(hip, knee, ankle);

        // 骨格描画
        canvasCtx.beginPath();
        canvasCtx.moveTo(hip.x * videoWidth, hip.y * videoHeight);
        canvasCtx.lineTo(knee.x * videoWidth, knee.y * videoHeight);
        canvasCtx.lineTo(ankle.x * videoWidth, ankle.y * videoHeight);
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeStyle = "white";
        canvasCtx.stroke();

        // 角度テキスト
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '30px Arial';
        canvasCtx.fillText(Math.round(angle).toString(), knee.x * videoWidth, knee.y * videoHeight);

        // カウント判定
        if (angle < 100) {
          if (!isSquatting) {
            setIsSquatting(true);
            setFeedback("UP! (上がって)");
          }
        } else if (angle > 160) {
          if (isSquatting) {
            setIsSquatting(false);
            setCount(prev => prev + 1);
            setFeedback("Nice!");
          }
        }
      }
    } else {
        setFeedback("全身を映してください");
    }
    canvasCtx.restore();
  }, [isSquatting]);

  useEffect(() => {
    let camera: any = null;
    let pose: any = null;

    // ★重要：ここでAIを読み込みます（サーバービルド回避）
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
            width: 640,
            height: 480,
          });
          camera.start();
          setIsLoading(false);
          setFeedback("準備完了！");
        }
      } catch (error) {
        console.error("MediaPipe Load Error:", error);
        setFeedback("エラー:再読み込みしてください");
      }
    };

    loadMediaPipe();

    // クリーンアップ
    return () => {
      if (camera) camera.stop();
      if (pose) pose.close();
    };
  }, [onResults]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="w-full max-w-md flex justify-between items-center mb-4">
        <button 
          onClick={onBack}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
        >
          ← TOP
        </button>
        <span className="font-bold text-yellow-400">Squat AI</span>
      </div>

      <div className="relative border-4 border-gray-800 rounded-lg overflow-hidden w-full max-w-md aspect-[3/4] bg-gray-900">
        <Webcam
          ref={webcamRef}
          className="absolute top-0 left-0 w-full h-full object-cover opacity-0"
          mirrored={true}
          playsInline={true}
          videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
        
        {/* ローディング表示 */}
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <p className="text-white font-bold animate-pulse">AIモデル起動中...</p>
            </div>
        )}

        <div className="absolute top-4 left-4 bg-gray-900/80 p-3 rounded-xl backdrop-blur-sm border border-gray-700 z-20">
          <p className="text-xs text-gray-400 mb-1">COUNT</p>
          <p className="text-4xl font-bold text-yellow-400 leading-none">{count}</p>
        </div>

        <div className="absolute bottom-8 left-0 w-full text-center px-4 z-20">
          <span className="inline-block bg-blue-600/90 px-6 py-2 rounded-full text-lg font-bold shadow-lg backdrop-blur-md">
            {feedback}
          </span>
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
      <div className="text-center space-y-6 max-w-sm w-full">
        <div className="space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            SQUAT<br/>MASTER
          </h1>
          <p className="text-gray-400 text-sm">AI Training Assistant</p>
        </div>

        <button
          onClick={onStart}
          className="group relative w-full py-5 px-6 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-[0_10px_0_rgb(29,78,216)] active:shadow-[0_2px_0_rgb(29,78,216)] active:translate-y-2 transition-all duration-150 overflow-hidden"
        >
          <div className="relative z-10 flex items-center justify-center space-x-2">
            <span className="text-2xl font-black tracking-widest text-white">START</span>
            <span className="text-2xl">💪</span>
          </div>
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-2xl pointer-events-none"></div>
        </button>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-xs text-gray-600 font-mono">Current Version</p>
          <p className="text-sm font-bold text-gray-500">{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 3. メイン
// ---------------------------------------------------------
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