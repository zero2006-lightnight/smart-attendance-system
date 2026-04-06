import React, { useState, useEffect, useRef, useCallback } from 'react';
import { recognition } from '../services/api';

interface LivenessCheckerProps {
  onVerified?: () => void;
  onFailed?: (message: string) => void;
  onComplete?: (success: boolean) => void;
}

type LivenessState = 'idle' | 'countdown' | 'verifying' | 'success' | 'failed';

const LivenessChecker: React.FC<LivenessCheckerProps> = ({
  onVerified,
  onFailed,
  onComplete,
}) => {
  const [state, setState] = useState<LivenessState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [blinkCount, setBlinkCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<{ frame: string; timestamp: number }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<number | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setMessage('Failed to access camera');
      setState('failed');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    const base64 = dataUrl.split(',')[1];
    
    if (base64) {
      framesRef.current.push({
        frame: base64,
        timestamp: Date.now()
      });
    }
  }, []);

  const verifyLiveness = async () => {
    setState('verifying');
    setMessage('Analyzing for liveness...');

    try {
      const response = await recognition.checkLiveness(framesRef.current);
      
      setBlinkCount(response.blink_count);
      
      if (response.is_live) {
        setState('success');
        setMessage('Liveness verified successfully!');
        onVerified?.();
        onComplete?.(true);
      } else {
        setState('failed');
        setMessage(response.message || 'Liveness verification failed');
        onFailed?.(response.message);
        onComplete?.(false);
      }
    } catch (err) {
      console.error('Liveness check error:', err);
      setState('failed');
      setMessage('Verification failed - please try again');
      onFailed?.('Verification failed');
      onComplete?.(false);
    }

    stopCamera();
  };

  const startVerification = async () => {
    framesRef.current = [];
    setState('countdown');
    setCountdown(3);
    setProgress(0);
    setMessage('Please look at the camera');
    
    await startCamera();

    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start capturing frames
    setState('verifying');
    setMessage('Please blink naturally...');

    const captureInterval = setInterval(() => {
      captureFrame();
    }, 100); // Capture every 100ms

    // Capture for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    clearInterval(captureInterval);

    // Verify
    await verifyLiveness();
  };

  const reset = () => {
    stopCamera();
    framesRef.current = [];
    setState('idle');
    setCountdown(3);
    setProgress(0);
    setMessage('');
    setBlinkCount(0);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Progress animation during verification
  useEffect(() => {
    if (state === 'verifying') {
      const startTime = Date.now();
      const duration = 3000;
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(100, (elapsed / duration) * 100);
        setProgress(newProgress);
        
        if (newProgress < 100) {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      };
      
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [state]);

  if (state === 'idle') {
    return (
      <div className="bg-white/5 rounded-xl p-6 text-center">
        <div className="mb-4">
          <svg 
            className="w-16 h-16 mx-auto text-neon-green opacity-80" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Liveness Verification</h3>
        <p className="text-text-secondary mb-6">
          To prevent proxy attendance, we need to verify you're a real person.
          This requires a 3-second video with blink detection.
        </p>
        <button
          onClick={startVerification}
          className="px-8 py-3 bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30 transition-colors font-medium"
        >
          Start Verification
        </button>
      </div>
    );
  }

  if (state === 'countdown') {
    return (
      <div className="bg-white/5 rounded-xl p-6 text-center">
        <div className="text-6xl font-bold text-neon-green mb-4">{countdown}</div>
        <p className="text-text-secondary">{message}</p>
        <div className="mt-4">
          <video
            ref={videoRef}
            className="w-64 h-48 mx-auto rounded-lg object-cover"
            playsInline
            muted
          />
        </div>
      </div>
    );
  }

  if (state === 'verifying') {
    return (
      <div className="bg-white/5 rounded-xl p-6 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto border-4 border-neon-green border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-xl font-semibold mb-2">{message}</h3>
        
        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mt-4">
          <div 
            className="bg-neon-green h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-text-secondary text-sm mt-2">
          Analyzing {framesRef.current.length} frames...
        </p>
        
        <div className="mt-4">
          <video
            ref={videoRef}
            className="w-64 h-48 mx-auto rounded-lg object-cover"
            playsInline
            muted
          />
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="bg-white/5 rounded-xl p-6 text-center">
        <div className="mb-4">
          <svg 
            className="w-16 h-16 mx-auto text-neon-green" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-neon-green mb-2">Verified!</h3>
        <p className="text-text-secondary mb-4">{message}</p>
        <p className="text-sm text-text-secondary">
          Blinks detected: {blinkCount}
        </p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="bg-white/5 rounded-xl p-6 text-center">
        <div className="mb-4">
          <svg 
            className="w-16 h-16 mx-auto text-red-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-red-400 mb-2">Verification Failed</h3>
        <p className="text-text-secondary mb-4">{message}</p>
        <p className="text-sm text-text-secondary mb-4">
          Blinks detected: {blinkCount} (need at least 2)
        </p>
        <button
          onClick={reset}
          className="px-8 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
};

export default LivenessChecker;
