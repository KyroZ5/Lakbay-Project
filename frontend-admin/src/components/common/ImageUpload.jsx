import React, { useState, useRef, useId } from 'react';
import { storage } from '../../firebase/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { notify } from '../../lib/notify';
import {
  UploadCloud,
  X,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Plus,
  ExternalLink,
} from 'lucide-react';

// Matches the file picker's accept list; drag-and-drop bypasses `accept`, and Storage rules allow
// any image/* (incl. SVG, which can carry scripts), so enforce the allowlist here.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const ImageUpload = ({
  value = [],
  onChange,
  folder = 'catalog',
  maxFiles = 8,
  maxSizeMB = 5,
  label = 'Photos & Images',
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef(null);
  const errorId = useId();

  // Parse value into a clean array of URLs
  const urlList = Array.isArray(value)
    ? value.filter(Boolean)
    : typeof value === 'string'
    ? value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const updateUrls = (newList) => {
    if (onChange) {
      onChange(newList);
    }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setErrorMessage('');

    const filesToUpload = Array.from(files);

    if (urlList.length + filesToUpload.length > maxFiles) {
      setErrorMessage(`Maximum of ${maxFiles} images allowed. Please select fewer files.`);
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    for (const file of filesToUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMessage(`"${file.name}" is not an image. Only PNG, JPEG, and WebP files are allowed.`);
        return;
      }
      // Storage rules require size < limit (strictly less)
      if (file.size >= maxBytes) {
        setErrorMessage(`"${file.name}" exceeds the ${maxSizeMB}MB file size limit.`);
        return;
      }
    }

    const uploadedUrls = [];
    try {
      setUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${folder}/${Date.now()}_${cleanName}`;
        const fileRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(fileRef, file, {
          contentType: file.type,
        });

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const filePct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              const overallPct = Math.round(((i + filePct / 100) / filesToUpload.length) * 100);
              setUploadProgress(overallPct);
            },
            (error) => {
              console.error('Firebase Storage upload error:', error);
              reject(error);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedUrls.push(downloadUrl);
                resolve();
              } catch (urlErr) {
                reject(urlErr);
              }
            }
          );
        });
      }

      updateUrls([...urlList, ...uploadedUrls]);
    } catch (err) {
      // Keep files that finished uploading before the failure
      if (uploadedUrls.length > 0) updateUrls([...urlList, ...uploadedUrls]);
      notify.error(err, 'Failed to upload image to storage. You may also paste an image URL directly.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveImage = (indexToRemove) => {
    const updated = urlList.filter((_, idx) => idx !== indexToRemove);
    updateUrls(updated);
  };

  const handleAddManualUrl = (e) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;

    if (urlList.length >= maxFiles) {
      setErrorMessage(`Maximum of ${maxFiles} images allowed.`);
      return;
    }

    const clean = manualUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      setErrorMessage('Please enter a valid HTTP/HTTPS image URL.');
      return;
    }

    updateUrls([...urlList, clean]);
    setManualUrl('');
    setShowUrlInput(false);
    setErrorMessage('');
  };

  const openFilePicker = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span>{label}</span>
          <span className="text-[11px] text-slate-400 font-normal">
            ({urlList.length}/{maxFiles})
          </span>
        </div>

        <Button
          type="button"
          variant="link"
          onClick={() => setShowUrlInput(!showUrlInput)}
          aria-expanded={showUrlInput}
          className="h-auto p-0 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          {showUrlInput ? 'Hide URL input' : 'Paste Image URL'}
        </Button>
      </div>

      {/* Manual URL Input Bar */}
      {showUrlInput && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <Input
            type="url"
            placeholder="https://images.unsplash.com/..."
            aria-label="Image URL"
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className="h-8 text-xs bg-white"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddManualUrl}
            className="text-xs h-8 px-3 shrink-0"
          >
            Add URL
          </Button>
        </div>
      )}

      {/* Validation message (file count/type/size, invalid URL) — upload failures are toasted */}
      {errorMessage && (
        <div
          id={errorId}
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      {urlList.length < maxFiles && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-disabled={uploading}
          aria-label={`${label}: click to browse or drag and drop photos`}
          className={`relative rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/60 scale-[0.99]'
              : uploading
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          {uploading ? (
            <div className="space-y-2 py-2" role="status" aria-live="polite">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
              <div className="text-xs font-semibold text-slate-700">
                Uploading to Firebase Storage ({uploadProgress}%)...
              </div>
              <div className="w-48 mx-auto h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <UploadCloud className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" />
              <div className="text-xs font-semibold text-slate-700">
                <span className="text-emerald-700 hover:underline">Click to browse</span> or drag and drop photos here
              </div>
              <p className="text-[11px] text-slate-400">
                PNG, JPEG, WebP up to {maxSizeMB}MB each. Uploads directly to Firebase Storage.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Thumbnails Preview Grid */}
      {urlList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {urlList.map((url, idx) => (
            <div
              key={idx}
              className="group relative rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs aspect-video"
            >
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=400&q=80';
                }}
              />

              {/* Cover Photo Badge on first item */}
              {idx === 0 && (
                <div className="absolute top-1.5 left-1.5">
                  <Badge className="bg-emerald-600/95 text-white text-[9px] px-1.5 py-0 font-bold backdrop-blur-xs shadow-xs">
                    Cover Photo
                  </Badge>
                </div>
              )}

              {/* Remove Button Overlay */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(idx);
                    }}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-slate-900/70 text-white hover:bg-red-600 hover:text-white shadow-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove photo</TooltipContent>
              </Tooltip>

              {/* External preview link */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Open photo ${idx + 1} in a new tab`}
                    className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded bg-slate-900/60 text-white hover:bg-slate-900 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Open full image</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
