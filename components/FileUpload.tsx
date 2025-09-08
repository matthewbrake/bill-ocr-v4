
import React, { useState, useCallback } from 'react';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
    disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileUpload(event.target.files[0]);
        }
    };

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);
    
    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (!disabled && e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileUpload(e.dataTransfer.files[0]);
        }
    }, [onFileUpload, disabled]);

    const baseClasses = "flex-1 flex flex-col items-center justify-center px-4 py-6 rounded-lg border-2 border-dashed transition-colors duration-200";
    const disabledClasses = "bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-50";
    const activeClasses = "bg-white dark:bg-slate-700 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-slate-600 cursor-pointer";
    const dragClasses = "border-sky-500 bg-sky-100 dark:bg-slate-600 ring-2 ring-sky-500";
    
    return (
        <label
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`${baseClasses} ${disabled ? disabledClasses : activeClasses} ${isDragging ? dragClasses : 'border-slate-300 dark:border-slate-600'}`}
        >
            <svg className="w-10 h-10 mb-3 text-slate-400 dark:text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold text-sky-600 dark:text-sky-400">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">PNG, JPG, WEBP</p>
            <input 
                type="file" 
                className="hidden" 
                onChange={handleFileChange} 
                accept="image/png, image/jpeg, image/webp" 
                disabled={disabled} 
            />
        </label>
    );
};
