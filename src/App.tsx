import React, { useState, useEffect, useRef } from 'react';
import { filesize } from 'filesize';
import { UploadCloud, File as FileIcon, Download, Trash2, RefreshCw, AlertCircle, Copy, Check, Share2 } from 'lucide-react';

interface FileData {
  name: string;
  size: number;
  createdAt: string;
}

interface NetworkInfo {
  serverIp: string;
  clientIp: string;
  isLocal: boolean;
  isCloud: boolean;
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch network info', err);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/files');
      
      if (res.status === 403) {
        setIsAccessDenied(true);
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data);
      setError(null);
      setIsAccessDenied(false);
    } catch (err) {
      setError('Could not load files. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkInfo();
    fetchFiles();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      await fetchFiles();
    } catch (err) {
      setError('Failed to upload file.');
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Delete failed');
      
      await fetchFiles();
    } catch (err) {
      setError('Failed to delete file.');
      console.error(err);
    }
  };

  const downloadFile = (filename: string) => {
    window.open(`/api/files/${encodeURIComponent(filename)}`, '_blank');
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const getFileUrl = (filename: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/files/${encodeURIComponent(filename)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">LocalDrop</h1>
            <p className="text-slate-500 mt-1">Share files easily across your network</p>
          </div>
          <div className="flex items-center gap-3">
            {networkInfo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm">
                <span className="text-slate-500">Server IP: </span>
                <span className="font-mono font-medium text-indigo-600">{networkInfo.serverIp}</span>
                <button 
                  onClick={() => copyToClipboard(`http://${networkInfo.serverIp}:3000`, 'app-url')}
                  className="ml-1 p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                  title="Copy App URL"
                >
                  {copiedId === 'app-url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            <button 
              onClick={fetchFiles}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-colors"
              title="Refresh files"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {isAccessDenied ? (
          <div className="bg-white rounded-2xl shadow-md border-2 border-red-100 p-8 md:p-12 text-center max-w-2xl mx-auto my-12">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Restricted</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              For security reasons, LocalDrop only allows file sharing over a <strong>local network (WiFi or LAN)</strong>. 
              Public internet access is currently blocked.
            </p>
            <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500 mb-8">
              <p>Your current IP: <span className="font-mono font-medium text-slate-700">{networkInfo?.clientIp || 'Unknown'}</span></p>
            </div>
            <p className="text-sm text-slate-400">
              Please connect to the same WiFi network as the server to use this app.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div 
              className={`mb-8 relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ease-in-out
                ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}
                ${uploading ? 'opacity-50 pointer-events-none' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
                disabled={uploading}
              />
              <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
                <div className={`p-4 rounded-full ${dragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-700">
                    {uploading ? 'Uploading...' : 'Click or drag file to this area to upload'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Support for a single file upload. No size limit.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-800">Shared Files</h2>
              </div>
              
              {loading && files.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <FileIcon className="w-8 h-8" />
                  </div>
                  <p className="text-slate-600 font-medium">No files shared yet</p>
                  <p className="text-slate-400 text-sm mt-1">Upload a file above to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {files.map((file) => (
                    <li key={file.name} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors group flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            <span>{filesize(file.size, { standard: "jedec" })}</span>
                            <span>&bull;</span>
                            <span>{new Date(file.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyToClipboard(getFileUrl(file.name), file.name)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Copy Download Link"
                        >
                          {copiedId === file.name ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => downloadFile(file.name)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteFile(file.name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
