// src/components/RdoCamera.jsx
import React, { useState, useRef, useEffect } from "react";
import "./RdoCamera.css";

const CameraCaptureModal = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Iniciar câmera
  useEffect(() => {
    if (!isOpen) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
        setError(null);
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCapture = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        blob.name = `camera-${Date.now()}.jpg`;
        onCapture(blob);
        onClose();
      }
      setIsCapturing(false);
    }, "image/jpeg", 0.92);
  };

  if (!isOpen) return null;

  return (
    <div className="camera-modal-overlay" onClick={onClose}>
      <div className="camera-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="camera-header">
          <h3>Tirar Foto</h3>
          <button className="camera-close-btn" onClick={onClose}>&times;</button>
        </div>

        {error ? (
          <div className="camera-error">{error}</div>
        ) : (
          <>
            <div className="camera-video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
            </div>
            <div className="camera-actions">
              <button
                className="camera-capture-btn"
                onClick={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? "Capturando..." : "📸 Capturar Foto"}
              </button>
              <button className="camera-cancel-btn" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraCaptureModal;