import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Helper to get server's local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Middleware to check if request is from local network
function checkLocalNetwork(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '';
  
  // Check for common private IP ranges
  const isLocal = 
    clientIp === '127.0.0.1' || 
    clientIp === '::1' || 
    clientIp.startsWith('192.168.') || 
    clientIp.startsWith('10.') || 
    (clientIp.startsWith('172.') && parseInt(clientIp.split('.')[1]) >= 16 && parseInt(clientIp.split('.')[1]) <= 31) ||
    clientIp.startsWith('::ffff:127.0.0.1') ||
    clientIp.startsWith('::ffff:192.168.') ||
    clientIp.startsWith('::ffff:10.') ||
    clientIp.startsWith('fe80:');

  // Special case for AI Studio preview environment: allow it so the user can see the app working
  const isCloud = !!(process.env.APP_URL && process.env.APP_URL.includes('.run.app'));

  if (!isLocal && !isCloud) {
    return res.status(403).json({ 
      error: 'Access Denied', 
      message: 'File sharing is only allowed on a local network (WiFi/LAN). Public internet access is blocked for security.' 
    });
  }
  next();
}

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve original filename but ensure it's unique if a file with the same name exists
    let filename = file.originalname;
    let ext = path.extname(filename);
    let base = path.basename(filename, ext);
    let counter = 1;
    
    while (fs.existsSync(path.join(UPLOADS_DIR, filename))) {
      filename = `${base}-${counter}${ext}`;
      counter++;
    }
    
    cb(null, filename);
  }
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Get network info
  app.get('/api/network-info', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const isCloud = !!(process.env.APP_URL && process.env.APP_URL.includes('.run.app'));
    
    res.json({
      serverIp: getLocalIpAddress(),
      clientIp: clientIp,
      isLocal: true, // If they can reach this, we'll tell them if they're allowed
      isCloud: isCloud
    });
  });

  // Apply security check to all file operations
  app.use('/api/files', checkLocalNetwork);

  // List all files
  app.get('/api/files', (req, res) => {
    try {
      const files = fs.readdirSync(UPLOADS_DIR).map(filename => {
        const filePath = path.join(UPLOADS_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          name: filename,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      });
      
      // Sort by newest first
      files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      res.json(files);
    } catch (error) {
      console.error('Error reading files:', error);
      res.status(500).json({ error: 'Failed to read files' });
    }
  });

  // Upload a file
  app.post('/api/files', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
      message: 'File uploaded successfully',
      file: {
        name: req.file.filename,
        size: req.file.size,
      }
    });
  });

  // Download a file
  app.get('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
  });

  // Delete a file
  app.delete('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    try {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
