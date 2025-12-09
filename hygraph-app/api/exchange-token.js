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
    // Extract base region from full region string (e.g., "api-eu-central-1-shared-euc1-02" -> "eu-central-1")
    let baseRegion = region;
    if (region) {
      // Try to extract standard region like "eu-central-1" or "us-east-1" from complex strings
      const regionMatch = region.match(/(eu-central-1|eu-west-1|us-east-1|us-west-1|ap-southeast-1|ap-northeast-1|ca-central-1)/);
      baseRegion = regionMatch ? regionMatch[1] : null;
    }
    
    const managementEndpoint = baseRegion 
      ? `https://${baseRegion}.api.hygraph.com/graphql`
      : 'https://management.hygraph.com/graphql';
    
    console.log('Step 2: Fetching content API token');
    console.log('- Original region:', region);
    console.log('- Base region:', baseRegion);
    console.log('- Management endpoint:', managementEndpoint);
    console.log('- Project ID:', projectId);
    
    // Query Management API for content token
    // Using the exact format from Hygraph Slack integration
    const contentTokenResponse = await fetch(managementEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appToken}`
      },
      body: JSON.stringify({
        query: `query Viewer {
          _viewer {
            ... on UserViewer {
              id
              project(id: "${projectId}") {
                environment(id: "master") {
                  authToken
                  endpoint
                }
              }
            }
            ... on AppTokenViewer {
              id
              project(id: "${projectId}") {
                environment(id: "master") {
                  authToken
                  endpoint
                }
              }
            }
          }
        }`
      })
    });
    
    const contentResponseText = await contentTokenResponse.text();
    console.log('Content token raw response:', contentResponseText);
    
    if (!contentTokenResponse.ok) {
      console.error('Content token fetch failed:', contentResponseText);
      return res.status(200).json({ 
        appToken, 
        contentToken: null,
        mgmtError: contentResponseText.substring(0, 500)
      });
    }
    
    let contentData;
    try {
      contentData = JSON.parse(contentResponseText);
    } catch (e) {
      console.error('Failed to parse content token response:', e);
      return res.status(200).json({ appToken, contentToken: null, parseError: contentResponseText.substring(0, 200) });
    }
    
    console.log('Content token parsed:', JSON.stringify(contentData, null, 2));
    
    // Check both viewer types
    const viewer = contentData.data?._viewer;
    const contentToken = viewer?.project?.environment?.authToken;
    const endpoint = viewer?.project?.environment?.endpoint;
    
    if (contentData.errors) {
      console.error('GraphQL errors:', contentData.errors);
      return res.status(200).json({ 
        appToken, 
        contentToken: null, 
        graphqlErrors: contentData.errors.map(e => e.message).join(', ')
      });
    }
    
    // Return both tokens
    return res.status(200).json({ 
      appToken,
      contentToken,
      endpoint
    });
    
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack?.split('\n').slice(0,3).join(' ')
    });
  }
}

