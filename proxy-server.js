// Simple proxy server to avoid CORS issues with Perplexity API
import express from 'express';
import cors from 'cors';

const app = express();

// Enable CORS for all origins (in production, restrict this)
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Proxy endpoint for Perplexity API
app.post('/api/perplexity', async (req, res) => {
  try {
    const PERPLEXITY_API_KEY = process.env.VITE_PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      return res.status(500).json({ 
        error: 'Perplexity API key not configured' 
      });
    }

    console.log('Proxying request to Perplexity API...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Perplexity API error:', response.status, errorData);
      return res.status(response.status).json({
        error: `Perplexity API error: ${response.status}`,
        details: errorData
      });
    }

    const data = await response.json();
    console.log('Successfully received response from Perplexity API');
    
    // Log the response content for debugging
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      console.log('Response content preview:', content.substring(0, 200));
    }
    
    res.json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request', 
      details: error.message 
    });
  }
});

// Export the app for Vercel
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Forwarding requests to Perplexity API`);
  });
}

