'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Script from 'next/script';

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 状態
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState("Loading...");
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [mode, setMode] = useState<"FULL_BODY" | "UPPER_BODY">("FULL_BODY");
  const [popCount, setPopCount] = useState<number | null>(null);

  const statusRef = useRef("UP");
  const baselineYRef = useRef<number | null>(null); // 上半身モードの基準位置

  // 音声読み上げ
  useEffect(() => {
    if (count > 0) {
      setPopCount(count);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const uttr = new SpeechSynthesisUtterance(`${count}`);
        uttr.lang = "ja-JP";
        uttr.rate = 1.5;
        window.speechSynthesis.speak(uttr);
      }
      const timer = setTimeout(() => setPopCount(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [count]);

  const calculateAngle = (a: any, b: any, c: any) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const drawLine = (ctx: CanvasRenderingContext2D, p1: any, p2: any, color: string, width: number = 6) => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  const processLogic = (landmarks: any, width: number, height: number, ctx: CanvasRenderingContext2D) => {
    let isCountAction = false;

    // --- 全身モード (膝角度) ---
    if (mode === "FULL_BODY") {
      const lHip = landmarks[23];
      const lKnee = landmarks[25];
      const lAnkle = landmarks[27];
      const rHip = landmarks[24];
      const rKnee = landmarks[26];
      const rAnkle = landmarks[28];
      
      let targetAngle = 180;
      let isVisible = false;

      // 見えている足を採用
      if ((lHip.visibility > 0.5 && lKnee.visibility > 0.5) || (rHip.visibility > 0.5 && rKnee.visibility > 0.5)) {
        isVisible = true;
        const lAngle = calculateAngle(lHip, lKnee, lAnkle);
        const rAngle = calculateAngle(rHip, rKnee, rAnkle);
        targetAngle = Math.min(lAngle, rAngle);
        
        // 描画
        const drawLeg = (h:any, k:any, a:any, color:string) => {
            if(h.visibility < 0.5) return;
            drawLine(ctx, {x:h.x*width, y:h.y*height}, {x:k.x*width, y:k.y*height}, {x:a.x*width, y:a.y*height}, color);
        };
        // 簡易描画関数
        const drawL = (p1:any, p2:any, p3:any, col:string) => {
            drawLine(ctx, {x:p1.x*width, y:p1.y*height}, {x:p2.x*width, y:p2.y*height}, col);
            drawLine(ctx, {x:p2.x*width, y:p2.y*height}, {x:p3.x*width, y:p3.y*height}, col);
        }
        if (lHip.visibility > 0.5) drawL(lHip, lKnee, lAnkle, '#00FFFF');
        if (rHip.visibility > 0.5) drawL(rHip, rKnee, rAnkle, '#FF00FF');
      }

      if (isVisible) {
        if (targetAngle < 140) {
            if (statusRef.current === "UP") { statusRef.current = "DOWN"; setFeedback("UP!"); }
        }
        if (targetAngle > 160 && statusRef.current === "DOWN") {
            isCountAction = true;
        }
      } else {
        setFeedback("全身を映して");
      }
    }

    // --- 上半身モード (肩の高さ) ---
    if (mode === "UPPER_BODY") {
      const lShoulder = landmarks[11];
      const rShoulder = landmarks[12];
      
      if (lShoulder.visibility > 0.5 && rShoulder.visibility > 0.5) {
        const currentY = (lShoulder.y + rShoulder.y) / 2;
        
        // 基準位置の更新 (一番高い位置)
        if (baselineYRef.current === null || currentY < baselineYRef.current) {
            baselineYRef.current = currentY; 
        }

        // しゃがみ目標ライン (基準 + 画面高さの15%)
        const targetLineY = baselineYRef.current + 0.15;

        // ガイドライン描画
        const lineYPixel = targetLineY * height;
        ctx.beginPath();
        ctx.moveTo(0, lineYPixel);
        ctx.lineTo(width, lineYPixel);
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]); // 点線
        ctx.stroke();
        ctx.setLineDash([]); // リセット
        
        // 肩の位置描画
        const shoulderYPixel = currentY * height;
        ctx.beginPath();
        ctx.arc(width/2, shoulderYPixel, 10, 0, 2*Math.PI);
        ctx.fillStyle = "orange";
        ctx.fill();

        // 判定
        if (currentY > targetLineY) { // ラインを超えたら
            if (statusRef.current === "UP") { statusRef.current = "DOWN"; setFeedback("UP!"); }
        } else if (currentY < (baselineYRef.current + 0.05) && statusRef.current === "DOWN") {
            isCountAction = true;
        }
      } else {
        setFeedback("上半身を映して");
      }
    }

    if (isCountAction) {
        statusRef.current = "UP";
        setCount(c => c + 1);
        setFeedback("OK!");
    }
  };

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !webcamRef.current?.video) return;
    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, videoWidth, videoHeight);
    ctx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

    if (results.poseLandmarks) {
        processLogic(results.poseLandmarks, videoWidth, videoHeight, ctx);
    }
  }, [mode]);

  useEffect(() => {
    if (!isScriptLoaded) return;
    // @ts-ignore
    const pose = new window.Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onResults);
    setFeedback("START");

    let animationFrameId: number;
    const loop = async () => {
      if (webcamRef.current?.video?.readyState === 4) { await pose.send({ image: webcamRef.current.video }); }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(animationFrameId); pose.close(); };
  }, [isScriptLoaded, onResults]);

  return (
    <main className="fixed inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center">
      <Script 
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" 
        strategy="afterInteractive"
        onLoad={() => setIsScriptLoaded(true)}
      />

      {/* 映像エリア: object-containで比率維持＆全画面フィット */}
      <div className="relative w-full h-full flex items-center justify-center">
        {!isScriptLoaded && <div className="text-white animate-pulse">System Booting...</div>}
        <Webcam ref={webcamRef} className="absolute opacity-0 w-0 h-0" mirrored={false} />
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>

      {/* UIレイヤー: 映像の上に重ねる */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 safe-area-inset">
          
          {/* 上部コントロール */}
          <div className="flex justify-between items-start pointer-events-auto mt-2">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <p className="text-xs text-gray-400 font-bold">TOTAL</p>
                <p className="text-3xl font-black text-yellow-400 font-mono leading-none">{count}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setMode("FULL_BODY"); setCount(0); statusRef.current = "UP"; }} 
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${mode === "FULL_BODY" ? "bg-yellow-500 text-black shadow-lg" : "bg-black/60 text-gray-300 border border-white/20"}`}>
                    全身(膝)
                </button>
                <button onClick={() => { setMode("UPPER_BODY"); setCount(0); statusRef.current = "UP"; baselineYRef.current = null; }} 
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${mode === "UPPER_BODY" ? "bg-orange-500 text-black shadow-lg" : "bg-black/60 text-gray-300 border border-white/20"}`}>
                    上半身(肩)
                </button>
              </div>
          </div>

          {/* 中央ポップアップ */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {popCount !== null && (
                <div 
                    className="font-black text-yellow-400 animate-ping-once select-none"
                    style={{ 
                        fontSize: '30vh', // 画面高さの30%
                        textShadow: '0 10px 30px rgba(0,0,0,1)' 
                    }}
                >
                    {popCount}
                </div>
            )}
          </div>

          {/* 下部フィードバック (位置を底上げ) */}
          <div className="flex justify-center mb-10">
             <span className={`px-8 py-3 rounded-full text-2xl font-black shadow-2xl backdrop-blur-lg transition-all duration-200 border-2 border-white/10 ${feedback === 'OK!' ? 'bg-green-500 text-white scale-110' : 'bg-blue-600/80 text-white'}`}>
                {feedback}
            </span>
          </div>
      </div>
    </main>
  );
}