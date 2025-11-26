'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// ★バージョン番号（修正のたびにここを変えると分かりやすいです）
const APP_VERSION = "v0.0.2 (Lite Model)";

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [isSquatting, setIsSquatting] = useState(false);
  const [feedback, setFeedback] = useState("ロード中...");
  const [cameraActive, setCameraActive] = useState(false);

  // 膝の角度を計算する関数
  const calculateAngle = (a: any, b: any, c: any) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    // willReadFrequently: true でパフォーマンス警告を抑制
    const canvasCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
    
    // 映像を描画（左右反転）
    canvasCtx.translate(videoWidth, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

    if (results.poseLandmarks) {
      const hip = results.poseLandmarks[24];
      const knee = results.poseLandmarks[26];
      const ankle = results.poseLandmarks[28];

      if (hip && knee && ankle) {
        const angle = calculateAngle(hip, knee, ankle);

        // 角度表示
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '30px Arial';
        canvasCtx.lineWidth = 5;
        canvasCtx.strokeText(Math.round(angle).toString(), knee.x * videoWidth, knee.y * videoHeight);
        canvasCtx.fillText(Math.round(angle).toString(), knee.x * videoWidth, knee.y * videoHeight);

        // 判定ロジック
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
        // 全身が映っていない場合
        setFeedback("全身を映してください");
    }
    canvasCtx.restore();
  }, [isSquatting]);

  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    pose.setOptions({
      // ★ここを 0 (Lite) に変更して最軽量化
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
             // エラーハンドリング追加
            try {
                await pose.send({ image: webcamRef.current.video });
            } catch (e) {
                console.error("Pose send error:", e);
            }
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
      setCameraActive(true);
    }
  }, [onResults]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 overflow-hidden">
      {/* ヘッダー部分 */}
      <div className="w-full flex justify-between items-end mb-4 max-w-md">
        <h1 className="text-2xl font-bold text-yellow-400">Squat AI</h1>
        <span className="text-xs text-gray-500 font-mono">{APP_VERSION}</span>
      </div>
      
      <div className="relative border-4 border-gray-800 rounded-lg overflow-hidden w-full max-w-md aspect-[3/4] bg-gray-900">
        {!cameraActive && (
             <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                 カメラ起動中...
             </div>
        )}
        <Webcam
          ref={webcamRef}
          className="absolute top-0 left-0 w-full h-full object-cover opacity-0"
          mirrored={true}
          playsInline={true}
          videoConstraints={{
            facingMode: 'user',
            width: 640,
            height: 480,
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        
        {/* UIオーバーレイ */}
        <div className="absolute top-4 left-4 bg-gray-900/80 p-3 rounded-xl backdrop-blur-sm border border-gray-700">
          <p className="text-xs text-gray-400 mb-1">COUNT</p>
          <p className="text-4xl font-bold text-yellow-400 leading-none">{count}</p>
        </div>

        <div className="absolute bottom-8 left-0 w-full text-center px-4">
          <span className="inline-block bg-blue-600/90 px-6 py-2 rounded-full text-lg font-bold shadow-lg backdrop-blur-md">
            {feedback}
          </span>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-600">
          iPhoneの方は省電力モードを解除してください
      </div>
    </div>
  );
}