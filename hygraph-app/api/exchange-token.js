// Vercel Serverless Function: Exchange installation code for App Token
// Then use App Token to get Content API auth token
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
  
  const { code, projectId, region } = req.body;
  
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
    // Step 1: Exchange code for App Token
    console.log('Step 1: Exchanging code for app token...');
    const tokenResponse = await fetch('https://management.hygraph.com/app-exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientSecret,
        exchangeCode: code,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.status(tokenResponse.status).json({ 
        error: 'Token exchange failed', 
        details: error 
      });
    }
    
    const { appToken } = await tokenResponse.json();
    console.log('Got app token');
    
    // Step 2: Use App Token to get Content API auth token from Management API
    // The Management API endpoint varies by region
    const managementEndpoint = region 
      ? `https://${region}.api.hygraph.com/graphql`
      : 'https://api.hygraph.com/graphql';
    
    console.log('Step 2: Fetching content API token from:', managementEndpoint);
    
    const contentTokenResponse = await fetch(managementEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appToken}`
      },
      body: JSON.stringify({
        query: `query GetContentToken($projectId: ID!) {
          _viewer {
            ... on UserViewer {
              project(id: $projectId) {
                environment(id: "master") {
                  authToken
                  endpoint
                }
              }
            }
          }
        }`,
        variables: { projectId }
      })
    });
    
    if (!contentTokenResponse.ok) {
      const error = await contentTokenResponse.text();
      console.error('Content token fetch failed:', error);
      // Return app token anyway - client can still use it for some operations
      return res.status(200).json({ appToken, contentToken: null });
    }
    
    const contentData = await contentTokenResponse.json();
    console.log('Content token response:', JSON.stringify(contentData, null, 2));
    
    const contentToken = contentData.data?._viewer?.project?.environment?.authToken;
    const endpoint = contentData.data?._viewer?.project?.environment?.endpoint;
    
    // Return both tokens
    return res.status(200).json({ 
      appToken,
      contentToken,
      endpoint
    });
    
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

