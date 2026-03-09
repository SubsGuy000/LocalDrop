import React, { useState, useEffect, useRef } from 'react';
import { filesize } from 'filesize';
import { 
  UploadCloud, 
  File as FileIcon, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Copy, 
  Check, 
  Share2, 
  User, 
  Send,
  Wifi,
  ShieldCheck
} from 'lucide-react';
import { Peer, DataConnection } from 'peerjs';
import { motion, AnimatePresence } from 'motion/react';

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  sender: string;
  timestamp: number;
}

export default function App() {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<SharedFile[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize PeerJS
    const newPeer = new Peer();

    newPeer.on('open', (id) => {
      setMyId(id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (conn) => {
      setupConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setError(`Connection error: ${err.type}`);
      setIsConnecting(false);
    });

    return () => {
      newPeer.destroy();
    };
  }, []);

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      setConnection(conn);
      setTargetId(conn.peer);
      setIsConnecting(false);
      setError(null);
    });

    conn.on('data', (data: any) => {
      if (data.type === 'file') {
        const newFile: SharedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: data.name,
          size: data.size,
          type: data.fileType,
          data: data.payload,
          sender: conn.peer,
          timestamp: Date.now(),
        };
        setReceivedFiles(prev => [newFile, ...prev]);
      }
    });

    conn.on('close', () => {
      setConnection(null);
      setError('Connection closed by peer.');
    });
  };

  const connectToPeer = () => {
    if (!peer || !targetId || targetId === myId) return;
    setIsConnecting(true);
    setError(null);
    const conn = peer.connect(targetId);
    setupConnection(conn);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && connection) {
      await sendFile(e.target.files[0]);
    }
  };

  const sendFile = async (file: File) => {
    if (!connection) return;
    setIsSending(true);
    
    try {
      const buffer = await file.arrayBuffer();
      connection.send({
        type: 'file',
        name: file.name,
        size: file.size,
        fileType: file.type,
        payload: buffer,
      });
      setError(null);
    } catch (err) {
      console.error('Send error:', err);
      setError('Failed to send file.');
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadFile = (file: SharedFile) => {
    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                <Wifi className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">LocalDrop P2P</h1>
            </div>
            <p className="text-stone-500">Direct device-to-device sharing. No server storage.</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Your ID</p>
                  <p className="font-mono font-medium text-emerald-600">{myId || 'Generating...'}</p>
                </div>
              </div>
              <button 
                onClick={copyId}
                className="p-2 hover:bg-stone-50 rounded-lg transition-colors text-stone-400 hover:text-emerald-600"
                title="Copy ID"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium self-end">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Netlify Ready (Serverless)</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Connection */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-500" />
                Connect
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">Peer ID</label>
                  <input 
                    type="text" 
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="Enter friend's ID"
                    disabled={!!connection}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-mono"
                  />
                </div>
                {!connection ? (
                  <button 
                    onClick={connectToPeer}
                    disabled={!targetId || isConnecting}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-200 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isConnecting ? 'Connecting...' : 'Connect to Peer'}
                  </button>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Connected to Peer</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Sharing */}
          <div className="md:col-span-2 space-y-8">
            {/* Upload Area */}
            <div 
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300
                ${connection ? 'border-indigo-300 bg-white hover:border-indigo-400 hover:shadow-md' : 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'}
                ${isSending ? 'animate-pulse' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                className={`absolute inset-0 w-full h-full opacity-0 ${connection ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                onChange={handleFileChange}
                disabled={!connection || isSending}
              />
              <div className="flex flex-col items-center justify-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${connection ? 'bg-indigo-50 text-indigo-600' : 'bg-stone-100 text-stone-400'}`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xl font-bold text-stone-800">
                    {!connection ? 'Connect to a peer first' : isSending ? 'Sending file...' : 'Click to share a file'}
                  </p>
                  <p className="text-stone-500 mt-1">
                    Files are sent directly to your connected peer.
                  </p>
                </div>
              </div>
            </div>

            {/* Received Files */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 px-2">
                <Download className="w-5 h-5 text-emerald-500" />
                Received Files
              </h2>
              
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <AnimatePresence initial={false}>
                  {receivedFiles.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-16 text-center flex flex-col items-center"
                    >
                      <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4 text-stone-300">
                        <FileIcon className="w-8 h-8" />
                      </div>
                      <p className="text-stone-500 font-medium">No files received yet</p>
                      <p className="text-stone-400 text-sm mt-1">Connect and ask your peer to send a file</p>
                    </motion.div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {receivedFiles.map((file) => (
                        <motion.li 
                          key={file.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-5 hover:bg-stone-50 transition-colors flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                              <FileIcon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-stone-900 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                                <span className="font-medium">{filesize(file.size, { standard: "jedec" })}</span>
                                <span>&bull;</span>
                                <span>From: {file.sender.slice(0, 6)}...</span>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => downloadFile(file)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
