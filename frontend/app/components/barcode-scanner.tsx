"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type BarcodeScannerHandle = {
  start: (
    cameraConfig: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number }; aspectRatio: number },
    onSuccess: (decodedText: string) => void,
    onError: (errorMessage: string) => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  getRunningTrackCapabilities: () => MediaTrackCapabilities;
  applyVideoConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
};

type BarcodeScannerProps = {
  label: string;
  helperText?: string;
  onDetected: (code: string) => void;
  preferredZoom?: number;
  closeSignal?: number;
};

const SOUND_STORAGE_KEY = "library-scanner-sound-enabled";

function isIosUserAgent(userAgent: string) {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function playScanBeep() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    // @ts-expect-error Safari legacy fallback
    window.webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.08);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.14);

  setTimeout(() => {
    void context.close().catch(() => undefined);
  }, 220);
}

export function BarcodeScanner({
  label,
  helperText,
  onDetected,
  preferredZoom = 2,
  closeSignal,
}: BarcodeScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<BarcodeScannerHandle | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("等待啟動掃描器");
  const [cameraSupported, setCameraSupported] = useState(true);
  const [secureHint, setSecureHint] = useState<string | null>(null);
  const [selectedZoom, setSelectedZoom] = useState(preferredZoom);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [hardwareZoomActive, setHardwareZoomActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === "undefined") {
      return;
    }

    const secure = window.isSecureContext;
    const ios = isIosUserAgent(window.navigator.userAgent);

    try {
      setSoundEnabled(window.localStorage.getItem(SOUND_STORAGE_KEY) === "true");
    } catch {
      // ignore localStorage issues
    }

    if (!secure) {
      setCameraSupported(false);
      setSecureHint(
        ios
          ? "iPhone 需要在 HTTPS 環境下才能開啟相機，請改用 Safari 開啟內網 HTTPS 網址。"
          : "相機需要安全環境才能啟用，請改用 HTTPS 或 localhost。",
      );
      setStatus("目前環境不支援相機");
      return;
    }

    setCameraSupported(true);
    setSecureHint(null);
  }, []);

  useEffect(() => {
    setSelectedZoom(preferredZoom);
  }, [preferredZoom]);

  useEffect(() => {
    if (closeSignal === undefined) {
      return;
    }

    setIsOpen(false);
  }, [closeSignal]);

  async function applyZoom(nextZoom: number) {
    setSelectedZoom(nextZoom);

    const scanner = scannerRef.current;
    const range = zoomRange;

    if (!scanner || !range) {
      setStatus(`已切換為 ${nextZoom.toFixed(1)}x 預覽倍率`);
      return;
    }

    const appliedZoom = Math.min(Math.max(nextZoom, range.min), range.max);

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: appliedZoom } as MediaTrackConstraintSet],
      });
      setHardwareZoomActive(true);
      setStatus(`相機已套用 ${appliedZoom.toFixed(1)}x 變焦`);
    } catch {
      setHardwareZoomActive(false);
      setStatus(`硬體變焦不可用，已改用 ${appliedZoom.toFixed(1)}x 預覽倍率`);
    }
  }

  useEffect(() => {
    if (!isOpen || !isMounted) {
      return;
    }

    const region = document.getElementById(regionId);
    const video = region?.querySelector("video");

    if (!video) {
      return;
    }

    video.style.transform = hardwareZoomActive ? "scale(1)" : `scale(${Math.max(selectedZoom, 1)})`;
    video.style.transformOrigin = "center center";
  }, [hardwareZoomActive, isMounted, isOpen, regionId, selectedZoom]);

  useEffect(() => {
    if (!isOpen || !isMounted || !cameraSupported) {
      return;
    }

    let mounted = true;
    let scannerInstance: BarcodeScannerHandle | null = null;
    let scannerStarted = false;

    function safeClearScanner(instance: BarcodeScannerHandle | null) {
      if (!instance) {
        return;
      }

      try {
        instance.clear();
      } catch {
        // ignore cleanup errors from partially initialized scanners
      }
    }

    async function startScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

        if (!mounted) {
          return;
        }

        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        }) as BarcodeScannerHandle;

        scannerInstance = scanner;
        scannerRef.current = scanner;
        setStatus("相機啟動中...");

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 300, height: 140 },
            aspectRatio: 2,
          },
          (decodedText: string) => {
            if (!mounted) {
              return;
            }

            if (soundEnabled) {
              playScanBeep();
            }

            onDetected(decodedText);
            setStatus(`已掃描：${decodedText}`);
            setIsOpen(false);
          },
          () => {
            if (mounted) {
              setStatus("相機已啟動，請將條碼對準掃描框。");
            }
          },
        );
        scannerStarted = true;

        try {
          const capabilities = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
            zoom?: { min?: number; max?: number };
          };

          if (typeof capabilities.zoom === "object" && capabilities.zoom) {
            const nextRange = {
              min: capabilities.zoom.min ?? 1,
              max: capabilities.zoom.max ?? 3,
            };
            if (mounted) {
              setZoomRange(nextRange);
            }

            const appliedZoom = Math.min(Math.max(selectedZoom, nextRange.min), nextRange.max);
            await scanner.applyVideoConstraints({
              advanced: [{ zoom: appliedZoom } as MediaTrackConstraintSet],
            });

            if (mounted) {
              setHardwareZoomActive(true);
              setStatus(`相機已啟動，已套用 ${appliedZoom.toFixed(1)}x 變焦`);
            }
          } else if (mounted) {
            setZoomRange(null);
            setHardwareZoomActive(false);
            setStatus(`相機已啟動，裝置不支援硬體變焦；目前使用 ${selectedZoom.toFixed(1)}x 預覽倍率。`);
          }
        } catch {
          if (mounted) {
            setZoomRange(null);
            setHardwareZoomActive(false);
            setStatus(`相機已啟動，但無法調整硬體變焦；目前使用 ${selectedZoom.toFixed(1)}x 預覽倍率。`);
          }
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "無法啟動掃描器");
      }
    }

    void startScanner();

    return () => {
      mounted = false;
      scannerRef.current = null;
      setZoomRange(null);
      setHardwareZoomActive(false);

      if (scannerInstance) {
        if (scannerStarted) {
          try {
            void scannerInstance
              .stop()
              .catch(() => undefined)
              .finally(() => {
                safeClearScanner(scannerInstance);
              });
          } catch {
            safeClearScanner(scannerInstance);
          }
        } else {
          safeClearScanner(scannerInstance);
        }
      }
    };
  }, [cameraSupported, isMounted, isOpen, onDetected, regionId, selectedZoom, soundEnabled]);

  const effectiveHelperText = useMemo(() => {
    if (secureHint) {
      return secureHint;
    }

    return helperText ?? "開啟相機後可直接掃描書籍條碼或 ISBN。";
  }, [helperText, secureHint]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // ignore localStorage issues
      }
    }
  }

  return (
    <section className="scanner-card">
      <div className="scanner-head">
        <div>
          <p className="eyebrow">Camera scan</p>
          <h3>{label}</h3>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setIsOpen((current) => !current)}
          disabled={!cameraSupported}
        >
          {isOpen ? "關閉掃描" : "開啟掃描"}
        </button>
      </div>

      <p className="scanner-text">{effectiveHelperText}</p>

      <div className="inline-actions">
        {[1, 2, 3].map((zoom) => (
          <button
            key={zoom}
            type="button"
            className={`ghost-button ${selectedZoom === zoom ? "zoom-button-active" : ""}`}
            onClick={() => void applyZoom(zoom)}
            disabled={!cameraSupported}
          >
            {zoom}x
          </button>
        ))}

        <button
          type="button"
          className={`ghost-button ${soundEnabled ? "zoom-button-active" : ""}`}
          onClick={toggleSound}
        >
          {soundEnabled ? "提示音開" : "提示音關"}
        </button>
      </div>

      {isMounted && isOpen && cameraSupported ? (
        <div id={regionId} className="scanner-region" />
      ) : null}

      <div className="scanner-status">
        {status}
        {zoomRange ? ` 可用倍率 ${zoomRange.min.toFixed(1)}x - ${zoomRange.max.toFixed(1)}x` : ""}
        {soundEnabled ? " / 掃描成功會播放提示音" : ""}
      </div>
    </section>
  );
}
