import { gql } from 'graphql-request';

import { createHygraphClient } from './client';

export interface LayoutPageEntry {
  id: string;
  title: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

const PUBLISHED_LAYOUT_PAGES_QUERY = gql`
  query PublishedLayoutPages {
    layoutPages(stage: PUBLISHED, orderBy: updatedAt_DESC) {
      id
      title
      slug
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

function getHygraphCredentials() {
  const endpoint = process.env.HYGRAPH_ENDPOINT;
  const token = process.env.HYGRAPH_TOKEN;

  if (!endpoint || !token) {
    throw new Error(
      'Missing Hygraph credentials. Please define HYGRAPH_ENDPOINT and HYGRAPH_TOKEN.',
    );
  }

  return { endpoint, token };
}

export async function fetchPublishedLayoutPages(): Promise<LayoutPageEntry[]> {
  const { endpoint, token } = getHygraphCredentials();
  const client = createHygraphClient(endpoint, token);

  const { layoutPages } = await client.request<{ layoutPages: LayoutPageEntry[] }>(
    PUBLISHED_LAYOUT_PAGES_QUERY,
  );

  return layoutPages;
}





