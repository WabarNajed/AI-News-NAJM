import { loadProfiles } from '../lib/tadawul.js';
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const payload = await loadProfiles('financials');
  response.setHeader('CDN-Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  return response.status(200).json({ ...payload, companies: payload.companies.map(({ symbol, company, annual, quarterly, periods, parsingError }) => ({ symbol, company, annual, quarterly, periods, ...(parsingError ? { parsingError } : {}) })) });
}
