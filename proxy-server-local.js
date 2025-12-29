import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Perplexity/OpenAI handler removed as client-side processing is deprecated
// import perplexityHandler from './api/perplexity.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = 3001;

// Configure CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Mock Vercel response object if needed, or express res is compatible enough?
// api/perplexity.js uses:
// res.setHeader(...)
// res.status(...).end()
// res.status(...).json(...)
// Express response object supports these.

// Route removed
// app.all('/api/perplexity', async (req, res) => { ... });

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Targeting Perplexity API with key: ${process.env.PERPLEXITY_API_KEY ? 'Present' : 'Missing'}`);
});



