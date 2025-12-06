import { GraphQLClient } from 'graphql-request';

export function createHygraphClient(endpoint: string, token: string): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function validateConnection(endpoint: string, token: string): Promise<{
  valid: boolean;
  error?: string;
  projectInfo?: {
    modelsCount: number;
    hasContent: boolean;
  };
}> {
  try {
    const client = createHygraphClient(endpoint, token);
    
    // Simple introspection query to validate connection
    const query = `
      query ValidateConnection {
        __schema {
          queryType {
            name
          }
          types {
            name
            kind
          }
        }
      }
    `;
    
    const result = await client.request<{
      __schema: {
        queryType: { name: string };
        types: { name: string; kind: string }[];
      };
    }>(query);
    
    // Count user-defined models (exclude system types)
    const userTypes = result.__schema.types.filter(
      t => t.kind === 'OBJECT' && 
           !t.name.startsWith('__') && 
           !['Query', 'Mutation', 'Subscription'].includes(t.name) &&
           !t.name.endsWith('Connection') &&
           !t.name.endsWith('Edge') &&
           !t.name.endsWith('Aggregate') &&
           !t.name.endsWith('PageInfo')
    );
    
    return {
      valid: true,
      projectInfo: {
        modelsCount: userTypes.length,
        hasContent: userTypes.length > 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('401') || message.includes('Unauthorized')) {
      return { valid: false, error: 'Invalid token or unauthorized access' };
    }
    if (message.includes('404') || message.includes('Not Found')) {
      return { valid: false, error: 'Invalid endpoint URL' };
    }
    if (message.includes('ENOTFOUND') || message.includes('network')) {
      return { valid: false, error: 'Network error - check endpoint URL' };
    }
    
    return { valid: false, error: message };
  }
}


