// Vercel Serverless Function: Exchange installation code for App Token
// This keeps APP_CLIENT_SECRET secure on the server

export default async function handler(req, res) {
  // CORS headers for Hygraph iframe
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { code, environmentId } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing exchange code' });
  }
  
  const clientId = process.env.HYGRAPH_APP_CLIENT_ID;
  const clientSecret = process.env.HYGRAPH_APP_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ 
      error: 'App not configured. Set HYGRAPH_APP_CLIENT_ID and HYGRAPH_APP_CLIENT_SECRET in Vercel.' 
    });
  }
  
  try {
    const response = await fetch('https://management.hygraph.com/app-exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientSecret,
        exchangeCode: code,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      return res.status(response.status).json({ 
        error: 'Token exchange failed', 
        details: error 
      });
    }
    
    const { appToken } = await response.json();
    
    // Return the app token to the client
    // The client will store it in localStorage
    return res.status(200).json({ 
      appToken,
      environmentId 
    });
    
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

