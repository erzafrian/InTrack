import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const videoConstraints = {
  width: 480,
  height: 480,
  facingMode: 'user',
};

export default function WebcamCapture({ onCapture, guidanceText, disabled, autoCapture = false, autoDelay = 2500 }) {
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('waiting'); // waiting | countdown | capturing | done
  const [countdown, setCountdown] = useState(1);
  const countdownRef = useRef(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setStatus('capturing');
    fetch(imageSrc)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], 'face.jpg', { type: 'image/jpeg' });
        onCapture(file, imageSrc);
        setStatus('done');
      });
  }, [onCapture]);

  // Auto-capture: start countdown when webcam is ready
  useEffect(() => {
    if (!autoCapture || disabled || status === 'done' || status === 'capturing') return;

    // Capture directly after delay (no countdown)
    timerRef.current = setTimeout(() => {
      setStatus('countdown');
      // Brief flash then capture
      countdownRef.current = setTimeout(() => {
        capture();
      }, 400);
    }, autoDelay);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(countdownRef.current);
    };
  }, [autoCapture, disabled, autoDelay, capture, status]);

  // Reset when key changes (new step)
  useEffect(() => {
    return () => {
      setStatus('waiting');
      setCountdown(3);
    };
  }, []);

  const retake = () => {
    setStatus('waiting');
    setCountdown(3);
    onCapture(null, null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-2xl overflow-hidden border-2"
        style={{
          width: '100%',
          maxWidth: 320,
          aspectRatio: '1',
          borderColor:
            status === 'done' ? 'var(--color-success)' :
            status === 'countdown' ? 'var(--color-primary)' :
            'var(--color-border)',
          background: 'var(--color-surface-alt)',
          transition: 'border-color 0.3s ease',
        }}
      >
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          mirrored
          className="w-full h-full object-cover"
          style={status === 'done' ? { filter: 'brightness(0.7)' } : {}}
        />

        {/* Face guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-full border-2 border-dashed"
            style={{
              width: '65%',
              height: '75%',
              borderColor:
                status === 'done' ? 'rgba(16,185,129,0.6)' :
                  status === 'countdown' ? 'rgba(230,230,230,0.8)' :
                'rgba(255,255,255,0.3)',
              transition: 'border-color 0.3s ease',
            }}
          />
        </div>

        {/* Countdown overlay */}
        {status === 'countdown' && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-semibold text-white animate-pulse"
              style={{ background: 'rgba(17,18,20,0.85)', backdropFilter: 'blur(4px)' }}
            >
              {countdown}
            </div>
          </div>
        )}

        {/* Capturing spinner */}
        {status === 'capturing' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <Loader2 size={36} className="text-white animate-spin" />
          </div>
        )}

        {/* Done overlay */}
        {status === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 size={40} className="text-white drop-shadow-lg" />
              <span className="text-sm font-semibold text-white drop-shadow-lg">Photo captured</span>
            </div>
          </div>
        )}
      </div>

      {/* Status text */}
      <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
        {status === 'waiting' && (guidanceText || 'Preparing camera...')}
        {status === 'countdown' && "Hold still, capturing photo..."}
        {status === 'capturing' && 'Processing...'}
        {status === 'done' && (
          <button type="button" onClick={retake} className="underline" style={{ color: 'var(--color-primary)' }} disabled={disabled}>
            Retake
          </button>
        )}
      </p>

      {/* Scanning indicator */}
      {(status === 'waiting' || status === 'countdown') && autoCapture && (
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--color-primary)' }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--color-primary)' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Scanning face...</span>
        </div>
      )}
    </div>
  );
}
