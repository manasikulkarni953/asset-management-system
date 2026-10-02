'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScannerState,
} from 'html5-qrcode';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cleanBarcodeScan } from '@/lib/barcode';
import {
  Camera,
  RefreshCw,
  Search,
  AlertCircle,
  SlidersHorizontal,
  Zap,
  ZapOff,
  VideoOff,
  ShieldAlert,
} from 'lucide-react';

export type ScannerStateType =
  | 'IDLE'
  | 'PREPARING_CAMERA'
  | 'REQUESTING_PERMISSION'
  | 'READY'
  | 'SCANNING'
  | 'SCAN_SUCCESS'
  | 'PERMISSION_DENIED'
  | 'NOT_AVAILABLE'
  | 'INIT_FAILED'
  | 'BARCODE_NOT_DETECTED'
  | 'ASSET_NOT_FOUND';

export interface CameraDevice {
  id: string;
  label: string;
  isBack?: boolean;
}

export interface BarcodeScannerProps {
  onScan: (assetNumber: string) => void | Promise<void>;
  onError?: (error: string) => void;
  onReady?: () => void;
  onCameraChange?: (cameraId: string) => void;
  className?: string;
  autoStart?: boolean;
  showManualInput?: boolean;
  scannerTitle?: string;
  scannerSubtitle?: string;
}

// Gentle pleasant audio beep on successful barcode acquisition
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    // Ignore audio permission or playback restrictions silently
  }
}

export function BarcodeScanner({
  onScan,
  onError,
  onReady,
  onCameraChange,
  className = '',
  autoStart = false,
  showManualInput = true,
  scannerTitle = 'Code 128 Asset Barcode Scanner',
  scannerSubtitle = 'Position the asset sticker within the target frame. Works across phone, laptop, desktop webcam, and tablet.',
}: BarcodeScannerProps) {
  const rawId = useId();
  const readerElementId = 'barcode-reader-' + rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  // Scanner state machine
  const [scannerState, setScannerState] = useState<ScannerStateType>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('Camera is standby.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera devices
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isSecureContext, setIsSecureContext] = useState<boolean>(true);

  const [manualCode, setManualCode] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchActive, setTorchActive] = useState(false);

  // Refs for async lifecycle safety and React 19 Strict Mode idempotence
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const scanLockRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const onCameraChangeRef = useRef(onCameraChange);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
    onCameraChangeRef.current = onCameraChange;
  }, [onScan, onError, onReady, onCameraChange]);

  // ------------------------------------------------------------------
  // 1. Safe Scanner Shutdown
  // ------------------------------------------------------------------
  const stopScannerGracefully = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const scanner = scannerInstanceRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (
            state === Html5QrcodeScannerState.SCANNING ||
            state === Html5QrcodeScannerState.PAUSED
          ) {
            await scanner.stop();
          }
        } catch (stopErr) {
          console.warn('Notice while stopping html5-qrcode:', stopErr);
        }

        try {
          scanner.clear();
        } catch (clearErr) {
          console.warn('Notice while clearing html5-qrcode element:', clearErr);
        }
      }
    } finally {
      isStoppingRef.current = false;
      if (isMountedRef.current) {
        setTorchActive(false);
        setTorchAvailable(false);
      }
    }
  };

  // ------------------------------------------------------------------
  // 2. Camera Discovery & Smart Auto-Selection
  // ------------------------------------------------------------------
  const detectAvailableCameras = async (): Promise<CameraDevice[]> => {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext && !navigator?.mediaDevices?.getUserMedia) {
        return [];
      }

      if (!navigator?.mediaDevices?.enumerateDevices) {
        return [];
      }

      const devices = await Html5Qrcode.getCameras().catch(() => []);
      if (!devices || devices.length === 0) {
        return [];
      }

      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      const parsed: CameraDevice[] = devices.map((dev, idx) => {
        const lowerLabel = (dev.label || '').toLowerCase();
        const isBack =
          lowerLabel.includes('back') ||
          lowerLabel.includes('rear') ||
          lowerLabel.includes('environment') ||
          lowerLabel.includes('facing back') ||
          (!lowerLabel.includes('front') && isMobileDevice && idx === devices.length - 1);

        return {
          id: dev.id,
          label: dev.label || `Camera ${idx + 1} (${isBack ? 'Rear' : 'Webcam/Front'})`,
          isBack,
        };
      });

      if (isMountedRef.current && parsed.length > 0) {
        setAvailableCameras(parsed);
      }

      return parsed;
    } catch (err: any) {
      console.warn('Camera discovery notice:', err);
      return [];
    }
  };

  // ------------------------------------------------------------------
  // 3. Initialize & Start Scanner on Specified Camera
  // ------------------------------------------------------------------
  const startScannerOnCamera = async (targetCameraId?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setErrorMessage(null);
    setScannerState('PREPARING_CAMERA');
    setStatusMessage('Preparing camera feed and Code 128 scanner engine...');

    try {
      await stopScannerGracefully();

      if (typeof window !== 'undefined' && !window.isSecureContext && !navigator?.mediaDevices?.getUserMedia) {
        const host = window.location.hostname;
        const msg = `Mobile Browser Security Restriction: Camera access on plain HTTP is blocked by mobile browsers. Please open https://${host}:3000/scan (run 'npm run dev:https' on your PC) or use manual asset search below.`;
        if (isMountedRef.current) {
          setScannerState('INIT_FAILED');
          setErrorMessage(msg);
        }
        if (onErrorRef.current && isMountedRef.current) {
          onErrorRef.current(msg);
        }
        return;
      }

      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // On mobile devices, prefer environment (rear) camera by default for barcode stickers
      let cameraTarget: any;
      if (targetCameraId) {
        cameraTarget = targetCameraId;
      } else if (isMobileDevice) {
        cameraTarget = { facingMode: 'environment' };
      } else {
        let cams = availableCameras;
        if (cams.length === 0) {
          cams = await detectAvailableCameras();
        }
        if (cams.length > 0) {
          const physicalCam = cams.find(
            (c) =>
              !c.label.toLowerCase().includes('obs') &&
              !c.label.toLowerCase().includes('virtual')
          );
          cameraTarget = physicalCam ? physicalCam.id : cams[0].id;
        } else {
          cameraTarget = { facingMode: 'user' };
        }
      }

      const container = document.getElementById(readerElementId);
      if (!container) {
        throw new Error(`Target scanner DOM element #${readerElementId} was not found.`);
      }

      // 5. Instantiate Html5Qrcode with optimized barcode formats and native acceleration
      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });

      scannerInstanceRef.current = html5QrCode;
      scanLockRef.current = false;

      // 6. Camera launch configuration with 1D rectangular scan box (qrbox)
      const scanConfig = {
        fps: 15,
        disableFlip: false, // Decodes normal and mirrored camera views
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Dynamic rectangular scan zone tailored for Code 128 barcode stickers
          const width = Math.floor(Math.min(viewfinderWidth * 0.90, 480));
          const height = Math.floor(Math.min(width * 0.45, viewfinderHeight * 0.60, 180));
          return {
            width: Math.max(width, 240),
            height: Math.max(height, 100),
          };
        },
        videoConstraints: {
          facingMode: isMobileDevice ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const handleDecodeSuccess = async (decodedText: string) => {
        if (scanLockRef.current) return;

        const cleaned = cleanBarcodeScan(decodedText);
        if (!cleaned) return;

        scanLockRef.current = true;
        playSuccessBeep();

        console.log(`[BarcodeScanner] Barcode detected: "${cleaned}"`);

        if (isMountedRef.current) {
          setDetectedBarcode(cleaned);
          setScannerState('SCAN_SUCCESS');
          setStatusMessage(`Barcode detected: ${cleaned}`);
        }

        // Notify parent callback immediately so MySQL query runs without delay
        try {
          onScanRef.current(cleaned);
        } catch (cbErr) {
          console.error('[BarcodeScanner] onScan error:', cbErr);
        }

        // Gracefully release camera hardware
        await stopScannerGracefully();
      };

      try {
        await html5QrCode.start(
          cameraTarget,
          scanConfig,
          handleDecodeSuccess,
          () => {}
        );
      } catch (startErr: any) {
        console.warn('Initial camera start failed, attempting facingMode fallback:', startErr);
        await html5QrCode.start(
          { facingMode: isMobileDevice ? 'environment' : 'user' },
          scanConfig,
          handleDecodeSuccess,
          () => {}
        );
      }

      // Re-query camera devices now that camera permission has been granted
      detectAvailableCameras().then((devices) => {
        if (isMountedRef.current && devices.length > 0) {
          const currentCam = targetCameraId || (isMobileDevice ? devices.find(d => d.isBack)?.id : devices[0].id);
          if (currentCam) setSelectedCameraId(currentCam);
        }
      }).catch(() => {});

      if (isMountedRef.current) {
        setScannerState('SCANNING');
        setStatusMessage('Camera Ready — Align Code 128 barcode within rectangular frame.');

        try {
          const trackCaps = (html5QrCode as any).getRunningTrackCameraCapabilities?.();
          if (trackCaps && typeof trackCaps.hasTorch === 'function') {
            setTorchAvailable(trackCaps.hasTorch());
          }
        } catch {
          setTorchAvailable(false);
        }

        if (onReadyRef.current) onReadyRef.current();
      }
    } catch (err: any) {
      console.warn('Barcode scanner notice:', err?.message || err);
      const name = err?.name || '';
      const msg = err?.message || String(err);

      if (isMountedRef.current) {
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('Permission')) {
          setScannerState('PERMISSION_DENIED');
          setErrorMessage(
            'Camera permission denied. Please allow camera access in browser site settings and refresh.'
          );
        } else if (name === 'NotReadableError' || name === 'TrackStartError' || msg.includes('in use')) {
          setScannerState('INIT_FAILED');
          setErrorMessage(
            'The selected camera is currently in use by another application or tab (e.g. Teams, Zoom, or another browser window). Please close other camera apps and try again.'
          );
        } else if (name === 'OverconstrainedError') {
          setScannerState('INIT_FAILED');
          setErrorMessage(
            'The camera cannot satisfy resolution constraints. Try selecting a different camera from the selector.'
          );
        } else {
          setScannerState('INIT_FAILED');
          setErrorMessage(
            msg || 'Failed to start camera. Please verify device permissions or search manually.'
          );
        }
      }

      if (onErrorRef.current && isMountedRef.current) {
        onErrorRef.current(msg);
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  // ------------------------------------------------------------------
  // 4. Lifecycle: Check Security Context & Auto-start
  // ------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    if (typeof window !== 'undefined') {
      const isSec =
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      setIsSecureContext(isSec);
      if (!isSec && !navigator?.mediaDevices?.getUserMedia) {
        setScannerState('INIT_FAILED');
        setErrorMessage(
          'Mobile Browser Security Restriction: Camera access over a local network IP requires HTTPS or localhost. To enable your phone camera on this Wi-Fi network, start the server using HTTPS (npm run dev:https) or an HTTPS tunnel.'
        );
      }
    }

    if (autoStart) {
      startScannerOnCamera();
    }

    return () => {
      isMountedRef.current = false;
      stopScannerGracefully();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // ------------------------------------------------------------------
  // 5. Camera Switching Handler
  // ------------------------------------------------------------------
  const handleCameraChange = async (newCamId: string) => {
    if (!newCamId || newCamId === selectedCameraId) return;
    setSelectedCameraId(newCamId);
    if (onCameraChangeRef.current) onCameraChangeRef.current(newCamId);

    if (
      scannerState === 'SCANNING' ||
      scannerState === 'PREPARING_CAMERA' ||
      scannerState === 'READY'
    ) {
      await startScannerOnCamera(newCamId);
    }
  };

  // ------------------------------------------------------------------
  // 6. Flashlight / Torch Toggle
  // ------------------------------------------------------------------
  const toggleTorch = async () => {
    const scanner = scannerInstanceRef.current;
    if (!scanner || !torchAvailable) return;

    try {
      const nextTorch = !torchActive;
      await (scanner as any).applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchActive(nextTorch);
    } catch (err) {
      console.warn('Unable to toggle torch:', err);
    }
  };

  // ------------------------------------------------------------------
  // 7. Manual Asset Number Submission
  // ------------------------------------------------------------------
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanBarcodeScan(manualCode);
    if (!clean) return;

    stopScannerGracefully();
    onScanRef.current(clean);
  };

  const isLiveScanning = scannerState === 'SCANNING';
  const isPending =
    scannerState === 'PREPARING_CAMERA' || scannerState === 'REQUESTING_PERMISSION';

  return (
    <div className={`w-full max-w-xl mx-auto flex flex-col items-center ${className}`}>
      {/* Top Header Card */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-600" />
            <span>{scannerTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{scannerSubtitle}</p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isLiveScanning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Scanning Code 128
            </span>
          ) : isPending ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
              Connecting Camera
            </span>
          ) : scannerState === 'PERMISSION_DENIED' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              Permission Denied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Camera Standby
            </span>
          )}
        </div>
      </div>

      {/* Camera Selection Controls (Desktop / Tablet / Multi-camera phones) */}
      {availableCameras.length > 1 && (
        <div className="w-full mb-3 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="hidden sm:inline">Active Camera:</span>
          </div>
          <select
            value={selectedCameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={isPending}
            className="flex-1 max-w-[280px] bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium truncate"
          >
            {availableCameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Viewport Card */}
      <div className="w-full relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
        {/* DOM node where html5-qrcode attaches its video/canvas feed */}
        <div
          id={readerElementId}
          className="w-full min-h-[300px] flex items-center justify-center"
        />

        {/* 1D Reticle Framing Box & Laser Sweep Overlay (Visible only when scanning) */}
        {isLiveScanning && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* 1D Wide Box Overlay */}
            <div className="relative w-full max-w-[340px] sm:max-w-[440px] h-[160px] sm:h-[190px] border-2 border-cyan-400/40 rounded-xl bg-cyan-950/10 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col items-center justify-between p-2">
              {/* Corner reticles */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl-md" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr-md" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl-md" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br-md" />

              {/* Sweeping Laser Line Animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser" />

              {/* Subdued Guide Text inside scan frame */}
              {detectedBarcode ? (
                <span className="text-xs font-bold text-emerald-300 bg-slate-900/95 border border-emerald-400/80 px-3 py-1 rounded-full mt-1 shadow-md">
                  Detected Barcode: {detectedBarcode}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-200/90 bg-slate-900/70 px-2.5 py-0.5 rounded-full mt-1">
                  Hold Code 128 Barcode Inside Frame
                </span>
              )}
              <span className="text-[9px] text-slate-300/80 mb-0.5">
                Align Code 128 sticker horizontally across scan frame
              </span>
            </div>

            {/* Case A guidance: Helper banner while camera is scanning */}
            <div className="mt-2 text-center pointer-events-auto">
              <span className="text-[11px] text-slate-300/90 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700/80 shadow-sm">
                Unable to read the barcode? Keep the barcode inside the scanning frame and try again.
              </span>
            </div>

            {/* Quick floating control bar on active camera */}
            <div className="absolute bottom-3 flex items-center gap-2 pointer-events-auto z-30">
              {torchAvailable && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  title="Toggle Torch/Flashlight"
                  className={`p-2 rounded-full backdrop-blur-md border text-xs cursor-pointer transition ${
                    torchActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_#fbbf24]'
                      : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {torchActive ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              <Button
                variant="danger"
                size="sm"
                onClick={stopScannerGracefully}
                className="shadow-lg backdrop-blur-md"
              >
                Stop Camera
              </Button>
            </div>
          </div>
        )}

        {/* Idle / Permission / Not Available Overlay */}
        {!isLiveScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-white z-20 overflow-y-auto">
            {isPending ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 animate-pulse">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                </div>
                <h4 className="text-sm font-semibold text-white">Opening Camera Feed...</h4>
                <p className="text-xs text-slate-400 max-w-xs">{statusMessage}</p>
              </div>
            ) : scannerState === 'PERMISSION_DENIED' ? (
              <div className="flex flex-col items-center gap-3 max-w-sm">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-white">Camera Access Blocked</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Browser camera permission was denied or blocked.
                </p>

                {/* Step-by-step browser unblock instructions */}
                <div className="w-full text-left bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-1.5 mt-1">
                  <p className="font-semibold text-slate-200">How to allow camera access:</p>
                  <p>• <strong>Chrome / Edge (Desktop):</strong> Click the padlock / tune icon left of the URL bar → Toggle <em>Camera</em> to <strong>Allow</strong> → Refresh page.</p>
                  <p>• <strong>Safari (iOS / macOS):</strong> Tap <em>aA</em> in URL bar → <em>Website Settings</em> → <em>Camera</em> → <strong>Allow</strong>.</p>
                  <p>• <strong>Android Chrome:</strong> Tap three dots (⋮) → <em>Site Settings</em> → <em>Camera</em> → <strong>Allow</strong>.</p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button variant="primary" size="sm" onClick={() => startScannerOnCamera()}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : scannerState === 'NOT_AVAILABLE' ? (
              <div className="flex flex-col items-center gap-3 max-w-sm">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <VideoOff className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-white">No Camera Detected</h4>
                <p className="text-xs text-slate-300">
                  No camera or webcam was found on this device. Please connect a webcam or use manual asset search below.
                </p>
              </div>
            ) : (
              /* Standard Idle State ready to open camera */
              <div className="flex flex-col items-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 text-blue-400 flex items-center justify-center mb-3 border border-blue-500/30 shadow-lg">
                  <Camera className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-white">Asset Barcode Scanner</h4>
                <p className="text-xs text-slate-300 max-w-xs mt-1.5 mb-5 leading-relaxed">
                  Ready to scan 1D Code 128 asset stickers. Supports built-in laptop webcams, external USB webcams, and mobile rear cameras.
                </p>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => startScannerOnCamera()}
                  className="shadow-lg shadow-blue-500/20"
                  icon={<Camera className="w-4 h-4" />}
                >
                  Open Device Camera
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="w-full mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Scanner Notice</span>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Insecure Context (LAN IP) Advisory */}
      {!isSecureContext && (
        <div className="w-full mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Mobile Device LAN Testing Note</span>
            <p className="leading-relaxed">
              If accessing from a mobile browser using an IP like <code>http://192.168.x.x:3000</code>, modern browsers restrict camera access to HTTPS or localhost. To test camera scanning on mobile over Wi-Fi, run Next.js with HTTPS or tunnel via <code>ngrok http 3000</code>.
            </p>
          </div>
        </div>
      )}

      {/* Manual Asset Search Fallback Section */}
      {showManualInput && (
        <div className="w-full mt-5 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              Manual Asset Number Search
            </label>
            <span className="text-[11px] text-slate-400 font-mono">e.g. TGS-LAP-00001</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter Asset Number or ID..."
              className="font-mono uppercase text-sm"
            />
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={!manualCode.trim()}
              icon={<Search className="w-4 h-4" />}
            >
              Lookup
            </Button>
          </form>

          <div className="mt-2 text-[11px] text-slate-500">
            <span>Primary 1D Format: <strong>Code 128</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
