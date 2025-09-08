
import React, { useState, useRef, useCallback } from 'react';

interface CameraCaptureProps {
    onCapture: (dataUrl: string) => void;
    disabled: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, disabled }) => {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = useCallback(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "environment" } 
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraOpen(true);
                setError(null);
            } catch (err) {
                console.error("Error accessing camera: ", err);
                setError("Could not access camera. Please check permissions.");
                setIsCameraOpen(false);
            }
        } else {
            setError("Camera not supported on this device.");
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    }, []);

    const takePicture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if(context){
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
            stopCamera();
        }
    };

    const handleToggleCamera = () => {
        if (isCameraOpen) {
            stopCamera();
        } else {
            startCamera();
        }
    };

    return (
        <div className="flex-1 flex flex-col">
            {isCameraOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-4xl">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg shadow-2xl"></video>
                        <button onClick={takePicture} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-slate-300 ring-2 ring-white ring-offset-2 ring-offset-black/50 hover:bg-slate-200 transition-colors focus:outline-none">
                            <div className="w-12 h-12 bg-red-500 rounded-full mx-auto"></div>
                        </button>
                        <button onClick={stopCamera} className="absolute top-2 right-2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
            <button
                onClick={handleToggleCamera}
                disabled={disabled}
                className="w-full flex items-center justify-center px-4 py-6 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-slate-600 transition-colors duration-200 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
            </button>
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
        </div>
    );
};
