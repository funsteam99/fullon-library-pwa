"use client";

import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  label?: string;
  onCapture: (file: File, previewUrl: string) => void;
};

const DEFAULT_ZOOM = 2;

export function CameraCapture({
  label = "封面照片",
  onCapture,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedZoom, setSelectedZoom] = useState(DEFAULT_ZOOM);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [hardwareZoomActive, setHardwareZoomActive] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia));

    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsReady(false);
    setZoomRange(null);
    setHardwareZoomActive(false);
  }

  async function applyZoom(nextZoom: number) {
    setSelectedZoom(nextZoom);

    const track = streamRef.current?.getVideoTracks?.()[0];
    const range = zoomRange;

    if (!track || !range) {
      setStatus(`已切換為 ${nextZoom.toFixed(1)}x 預覽倍率`);
      return;
    }

    const appliedZoom = Math.min(Math.max(nextZoom, range.min), range.max);

    try {
      await track.applyConstraints({
        advanced: [{ zoom: appliedZoom } as MediaTrackConstraintSet],
      });
      setHardwareZoomActive(true);
      setStatus(`相機已套用 ${appliedZoom.toFixed(1)}x 變焦`);
    } catch {
      setHardwareZoomActive(false);
      setStatus(`硬體變焦不可用，已改用 ${appliedZoom.toFixed(1)}x 預覽倍率`);
    }
  }

  async function startCamera() {
    if (!supported) {
      setStatus("此裝置不支援相機擷取。");
      return;
    }

    setIsStarting(true);
    setStatus(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);

      try {
        const [videoTrack] = stream.getVideoTracks();
        const capabilities = videoTrack?.getCapabilities?.() as MediaTrackCapabilities & {
          zoom?: { min?: number; max?: number };
        };
        const zoomCapability = capabilities?.zoom;

        if (typeof zoomCapability === "object" && zoomCapability) {
          const nextRange = {
            min: zoomCapability.min ?? 1,
            max: zoomCapability.max ?? DEFAULT_ZOOM,
          };
          setZoomRange(nextRange);

          const appliedZoom = Math.min(
            Math.max(selectedZoom, nextRange.min),
            nextRange.max,
          );

          await videoTrack.applyConstraints({
            advanced: [{ zoom: appliedZoom } as MediaTrackConstraintSet],
          });

          setHardwareZoomActive(true);
          setStatus(`相機已啟動，已套用 ${appliedZoom.toFixed(1)}x 變焦`);
        } else {
          setZoomRange(null);
          setHardwareZoomActive(false);
          setStatus(`相機已啟動，裝置不支援硬體變焦；目前使用 ${selectedZoom.toFixed(1)}x 預覽倍率。`);
        }
      } catch {
        setZoomRange(null);
        setHardwareZoomActive(false);
        setStatus(`相機已啟動，但無法調整硬體變焦；目前使用 ${selectedZoom.toFixed(1)}x 預覽倍率。`);
      }
    } catch {
      setStatus("無法開啟相機，請確認瀏覽器權限與 HTTPS 環境。");
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const sourceWidth = video.videoWidth || 960;
    const sourceHeight = video.videoHeight || 1280;
    const effectiveZoom = hardwareZoomActive ? 1 : Math.max(selectedZoom, 1);
    const cropWidth = sourceWidth / effectiveZoom;
    const cropHeight = sourceHeight / effectiveZoom;
    const cropX = (sourceWidth - cropWidth) / 2;
    const cropY = (sourceHeight - cropHeight) / 2;
    const width = sourceWidth;
    const height = sourceHeight;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setStatus("無法建立拍照畫布。");
      return;
    }

    context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setStatus("拍照失敗，請再試一次。");
      return;
    }

    const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const previewUrl = URL.createObjectURL(file);
    onCapture(file, previewUrl);
    setStatus("已拍照並套用到表單。");
    stopCamera();
  }

  return (
    <section className="camera-card">
      <div className="camera-head">
        <div>
          <h3>{label}</h3>
          <p className="scanner-text">
            桌機 Chrome 可直接開 webcam 拍照，現在可切換 1x / 2x / 3x 倍率。
          </p>
        </div>
      </div>

      <div className="camera-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => void startCamera()}
          disabled={isStarting}
        >
          {isStarting ? "啟動中..." : "開啟相機"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={handleCapture}
          disabled={!isReady}
        >
          拍照套用
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={stopCamera}
          disabled={!isReady}
        >
          關閉相機
        </button>
      </div>

      <div className="inline-actions">
        {[1, 2, 3].map((zoom) => (
          <button
            key={zoom}
            type="button"
            className={`ghost-button ${selectedZoom === zoom ? "zoom-button-active" : ""}`}
            onClick={() => void applyZoom(zoom)}
            disabled={!supported}
          >
            {zoom}x
          </button>
        ))}
      </div>

      <div className="camera-preview-shell">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          style={{
            transform: hardwareZoomActive ? "scale(1)" : `scale(${Math.max(selectedZoom, 1)})`,
            transformOrigin: "center center",
          }}
        />
        <canvas ref={canvasRef} hidden />
      </div>

      {status ? (
        <div className="scanner-status">
          {status}
          {zoomRange ? ` 可用倍率 ${zoomRange.min.toFixed(1)}x - ${zoomRange.max.toFixed(1)}x` : ""}
        </div>
      ) : null}
    </section>
  );
}
