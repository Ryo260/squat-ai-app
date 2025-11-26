/* eslint-disable */
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

// ★バージョン
const APP_VERSION = "v0.0.6 (Perf+Voice)";

// ---------------------------------------------------------
// ユーティリティ: 角度計算 & 音声
// ---------------------------------------------------------
const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

const speak = (text: string) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP'; // 日本語
    utter.rate = 1.0;     // 速度
    window.speechSynthesis.cancel(); // 前のをキャンセルして即読み上げ
    window.speechSynthesis.speak(utter);
  }
};

// ---------------------------------------------------------
// 1. 筋トレ画面
// ---------------------------------------------------------
const WorkoutScreen = ({ onBack }: { onBack: () => void }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 状態管理
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState("位置について...");
  const [currentAngle, setCurrentAngle] = useState(0); // 画面表示用
  const [countdown, setCountdown] = useState<number | null>(3); // 3秒カウントダウン
  const [isSquatting, setIsSquatting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // カウントダウン処理
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      speak(countdown.toString());
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      speak("スタート！");
      setFeedback("スクワット開始！");
    }
  }, [countdown]);

  const onResults = useCallback((results: any) => {
    // カウントダウン中は処理しない
    if (countdown !== null && countdown > 0) return;

    if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!canvasCtx) return;

    // 描画（高速化のため画像のみ）
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
    canvasCtx.translate(videoWidth, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

    if (results.poseLandmarks) {
      // 左右の足の「見えている確率（visibility）」をチェック
      const leftHip = results.poseLandmarks[23];
      const leftKnee = results.poseLandmarks[25];
      const leftAnkle = results.poseLandmarks[27];
      const rightHip = results.poseLandmarks[24];
      const rightKnee = results.poseLandmarks[26];
      const rightAnkle = results.poseLandmarks[28];

      // 信頼度が高い方の足を使う
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
        
        // Reactの再レンダリングを減らすため、角度の変化が大きい時だけ更新しても良いが
        // ここではリアルタイム性を重視しつつ、重いCanvas文字描画は廃止
        setCurrentAngle(Math.round(angle));

        // 骨格描画（シンプルに線だけ）
        canvasCtx.beginPath();
        canvasCtx.moveTo(targetHip.x * videoWidth, targetHip.y * videoHeight);
        canvasCtx.lineTo(targetKnee.x * videoWidth, targetKnee.y * videoHeight);
        canvasCtx.lineTo(targetAnkle.x * videoWidth, targetAnkle.y * videoHeight);
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeStyle = "#00FF00"; // 緑色で見やすく
        canvasCtx.stroke();

        // 判定ロジック
        if (countdown === 0) { // スタート後のみ判定
          if (angle < 100) {
            if (!isSquatting) {
              setIsSquatting(true);
              setFeedback("UP! (上がって)");
              speak("アップ");
            }
          } else if (angle > 160) {
            if (isSquatting) {
              setIsSquatting(false);
              setCount(prev => {
                const newCount = prev + 1;
                speak(newCount + "回"); // カウント読み上げ
                return newCount;
              });
              setFeedback("Nice!");
            }
          }
        }
      }
    }
    canvasCtx.restore();
  }, [isSquatting, countdown]);

  useEffect(() => {
    let camera: any = null;
    let pose: any = null;

    const loadMediaPipe = async () => {
      try {
        const poseModule = await import('@mediapipe/pose');
        const cameraModule = await import('@mediapipe/camera_utils');

        pose = new poseModule.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 0, // 最軽量
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
        }
      } catch (error) {
        console.error(error);
        setFeedback("エラー発生");
      }
    };

    loadMediaPipe();

    return () => {
      if (camera) camera.stop();
      if (pose) pose.close();
    };
  }, [onResults]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {/* 上部ヘッダー */}
      <div className="w-full max-w-md flex justify-between items-center mb-2 z-10">
        <button 
          onClick={onBack}
          className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition"
        >
          終了
        </button>
        <span className="text-xs text-gray-500 font-mono">{APP_VERSION}</span>
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
        
        {/* ローディング */}
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <p className="text-yellow-400 font-bold animate-pulse">AI準備中...</p>
            </div>
        )}

        {/* カウントダウンオーバーレイ */}
        {countdown !== null && countdown > 0 && !isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                 <p className="text-9xl font-black text-white animate-ping">{countdown}</p>
             </div>
        )}

        {/* 情報表示（CanvasではなくHTMLで描画して軽量化） */}
        <div className="absolute top-4 left-4 bg-gray-900/80 p-3 rounded-xl backdrop-blur-md border border-gray-700 z-10">
          <p className="text-xs text-gray-400 mb-1">COUNT</p>
          <p className="text-5xl font-bold text-yellow-400 leading-none font-mono">{count}</p>
        </div>

        {/* 膝の角度表示（リアルタイム） */}
        <div className="absolute top-4 right-4 bg-gray-900/80 p-2 rounded-lg backdrop-blur-md border border-gray-700 z-10">
           <p className="text-xs text-gray-400 text-center">ANGLE</p>
           <p className="text-2xl font-bold text-white font-mono text-center">{currentAngle}°</p>
        </div>

        <div className="absolute bottom-8 left-0 w-full text-center px-4 z-10">
          <span className={`inline-block px-6 py-3 rounded-full text-xl font-bold shadow-lg backdrop-blur-md transition-colors duration-200
            ${isSquatting ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
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
      <div className="text-center space-y-8 max-w-sm w-full">
        <div className="space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            SQUAT<br/>MASTER
          </h1>
          <p className="text-gray-400 text-sm">AI Training Assistant</p>
        </div>

        <button
          onClick={onStart}
          className="group relative w-full py-6 px-6 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-[0_10px_0_rgb(29,78,216)] active:shadow-[0_2px_0_rgb(29,78,216)] active:translate-y-2 transition-all duration-150 overflow-hidden"
        >
          <div className="relative z-10 flex items-center justify-center space-x-2">
            <span className="text-3xl font-black tracking-widest text-white">START</span>
          </div>
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-2xl pointer-events-none"></div>
        </button>

        <div className="pt-4 text-xs text-gray-500">
           音声が出ます 🔊 <br/>
           全身が映る位置に立ってください
        </div>
        <div className="pt-8 border-t border-gray-800">
          <p className="text-xs text-gray-600 font-mono">{APP_VERSION}</p>
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