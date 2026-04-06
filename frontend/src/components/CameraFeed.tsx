import React, { useRef, useEffect, useState, useCallback } from 'react';
import { recognition, BoundingBox, RecognitionMatch } from '../services/api';

interface CameraFeedProps {
  onAttendanceMarked?: (user: RecognitionMatch) => void;
  width?: number;
  height?: number;
}

interface DetectionState {
  isProcessing: boolean;
  faces: BoundingBox[];
  matches: RecognitionMatch[];
  error: string | null;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ 
  onAttendanceMarked,
  width = 640,
  height = 480 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [detectionState, setDetectionState] = useState<DetectionState>({
    isProcessing: false,
    faces: [],
    matches: [],
    error: null,
  });
  
  const processingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const onAttendanceMarkedRef = useRef(onAttendanceMarked);
  
  // Keep ref updated
  useEffect(() => {
    onAttendanceMarkedRef.current = onAttendanceMarked;
  }, [onAttendanceMarked]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      setCameraError(null);
      setIsActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Failed to access camera. Please grant camera permission.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current || !isActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.paused || video.ended) {
      return;
    }

    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Capture frame for processing
    const frameData = canvas.toDataURL('image/jpeg', 0.7);
    const base64 = frameData.split(',')[1];

    if (!base64) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    processingRef.current = true;
    setDetectionState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Detect and recognize faces
      const response = await recognition.recognizeFaces(base64);
      
      setDetectionState({
        isProcessing: false,
        faces: response.matches.map(() => ({
          top: 100, right: 200, bottom: 200, left: 100
        })), // Placeholder - backend returns proper boxes
        matches: response.matches,
        error: null,
      });

      // Draw bounding boxes on canvas
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#00ff88';

      // Since we don't have actual bounding boxes from recognition,
      // we'll draw placeholder boxes - in production, use detect endpoint first
      response.matches.forEach((match, index) => {
        const boxSize = 150;
        const x = 50 + (index * 180);
        const y = 100;
        
        // Draw rectangle
        ctx.strokeRect(x, y, boxSize, boxSize);
        
        // Draw label
        ctx.fillText(
          `${match.name} (${Math.round(match.confidence * 100)}%)`,
          x,
          y - 10
        );
        
        // Call callback if attendance marked
        if (onAttendanceMarkedRef.current) {
          onAttendanceMarkedRef.current(match);
        }
      });

      // Handle unknown faces
      if (response.unknown_count > 0) {
        ctx.fillStyle = '#ff4444';
        ctx.fillText(
          `${response.unknown_count} unknown face(s)`,
          10,
          canvas.height - 20
        );
      }

    } catch (err) {
      console.error('Detection error:', err);
      setDetectionState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Detection failed'
      }));
    } finally {
      processingRef.current = false;
      
      // Continue processing if still active
      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    }
  }, [isActive]);

  // Start processing when camera is active
  useEffect(() => {
    if (isActive && stream) {
      const video = videoRef.current;
      if (video) {
        video.onloadedmetadata = () => {
          video.play();
          processFrame();
        };
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, stream, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleStartStop = () => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className="relative">
      {/* Video/Canvas Container */}
      <div className="relative rounded-xl overflow-hidden bg-black">
        {!isActive && (
          <div 
            className="flex items-center justify-center"
            style={{ width, height }}
          >
            <div className="text-center text-text-secondary">
              <svg 
                className="w-16 h-16 mx-auto mb-4 opacity-50" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                />
              </svg>
              <p>Click Start to enable camera</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className={`${isActive ? 'block' : 'hidden'}`}
          style={{ width, height }}
          playsInline
          muted
        />
        
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{ width, height }}
        />

        {/* Error overlay */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-red-400 text-center px-4">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-4">
        <button
          onClick={handleStartStop}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isActive 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30'
          }`}
        >
          {isActive ? 'Stop Camera' : 'Start Camera'}
        </button>

        {detectionState.isProcessing && (
          <span className="text-text-secondary flex items-center">
            <span className="w-2 h-2 bg-neon-green rounded-full animate-pulse mr-2"></span>
            Processing...
          </span>
        )}
      </div>

      {/* Status indicators */}
      {detectionState.matches.length > 0 && (
        <div className="mt-4 p-4 bg-white/5 rounded-xl">
          <h3 className="text-sm font-medium mb-2 text-text-secondary">Detected Faces</h3>
          <div className="space-y-2">
            {detectionState.matches.map((match, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-neon-green">{match.name}</span>
                <span className="text-sm text-text-secondary">
                  {Math.round(match.confidence * 100)}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFeed;
