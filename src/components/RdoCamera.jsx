// src/components/RdoCamera.jsx
import React, { useState, useRef, useEffect } from "react";
import "./RdoCamera.css";

// Modal de seleção: Tirar foto ou Carregar da galeria
const RdoCamera = ({ isOpen, onClose, onCapture }) => {
  const [mostrarCamera, setMostrarCamera] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleEscolherGaleria = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      onClose();
    }
  };

  const handleTirarFoto = () => {
    setMostrarCamera(true);
  };

  const handleCapturaCamera = (fotoBlob) => {
    onCapture(fotoBlob);
    setMostrarCamera(false);
    onClose();
  };

  if (mostrarCamera) {
    return (
      <CameraCaptureModal
        isOpen={true}
        onClose={() => {
          setMostrarCamera(false);
          onClose();
        }}
        onCapture={handleCapturaCamera}
      />
    );
  }

  return (
    <div className="camera-modal-overlay" onClick={onClose}>
      <div className="camera-modal-content camera-choice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camera-header">
          <h3>Adicionar Foto ao Pavimento</h3>
          <button className="camera-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="camera-choice-buttons">
          <button className="camera-choice-btn" onClick={handleEscolherGaleria}>
            🖼️ Escolher da Galeria
          </button>
          <button className="camera-choice-btn" onClick={handleTirarFoto}>
            📸 Tirar Foto
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

// Modal de captura de câmera
const CameraCaptureModal = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } // Preferir câmera traseira
        });
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

export default RdoCamera;