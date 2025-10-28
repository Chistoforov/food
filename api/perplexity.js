// Serverless function for Vercel to proxy Perplexity API requests
// This avoids CORS issues when calling Perplexity API from the browser

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // On Vercel, use PERPLEXITY_API_KEY (without VITE_ prefix)
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.VITE_PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ 
        error: 'Perplexity API key not configured. Please set PERPLEXITY_API_KEY environment variable.' 
      });
    }

    console.log('Proxying request to Perplexity API...');
    console.log('Request body size:', JSON.stringify(req.body).length);
    
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
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request', 
      details: error.message 
    });
  }
}

