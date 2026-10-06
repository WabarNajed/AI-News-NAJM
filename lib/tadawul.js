import * as cheerio from 'cheerio';

export const INSURANCE_SYMBOLS = [
  '8010', '8012', '8020', '8030', '8040', '8050', '8060', '8070', '8100',
  '8120', '8150', '8160', '8170', '8180', '8190', '8200', '8210', '8230',
  '8240', '8250', '8260', '8280', '8300', '8310', '8311',
];

const PROFILE_URL = 'https://www.saudiexchange.sa/wps/portal/saudiexchange/hidden/company-profile-main/?companySymbol=';
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; AI-News-NAJM/1.0; +https://ai-news-najm.vercel.app)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
};
const memoryCache = new Map();
const UPSTREAM_TIMEOUT_MS = 12_000;

async function fetchSaudiExchange(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`Saudi Exchange returned ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
function absoluteUrl(href) {
  if (!href) return null;
  try { return new URL(href, 'https://www.saudiexchange.sa').toString(); } catch { return null; }
}
function cells($, row) {
  return $(row).find('th,td').map((_, cell) => text($(cell).text())).get().filter(Boolean);
}
function parseDate(value) {
  const normalized = text(value);
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? normalized || null : new Date(parsed).toISOString();
}
function looksFinancialResult(title) {
  return /interim\s+financial\s+results|annual\s+financial\s+results|financial\s+results/i.test(title);
}
function tableRows($, table) {
  return $(table).find('tr').map((_, row) => cells($, row)).get().filter((row) => row.length > 0);
}
function detectPeriod(value) {
  const source = text(value);
  const year = (source.match(/20\d{2}/) || [])[0] || null;
  const lower = source.toLowerCase();
  const quarter = /q2|second quarter|three[- ]month/.test(lower) && /june|30[\/.-]?06|second quarter/.test(lower) ? 'Q2'
    : /q3|third quarter/.test(lower) ? 'Q3'
    : /q4|fourth quarter/.test(lower) ? 'Q4'
    : /q1|first quarter|three[- ]month/.test(lower) ? 'Q1' : null;
  const ytd = /h1|half.?year|six[- ]month/.test(lower) ? 'H1'
    : /9m|nine[- ]month/.test(lower) ? '9M'
    : /fy|annual|year ended|twelve[- ]month/.test(lower) ? 'FY' : null;
  return { year: year ? Number(year) : null, period: quarter || ytd || null, periodType: quarter ? 'quarter' : ytd === 'FY' ? 'annual' : ytd ? 'ytd' : null };
}
function parseFinancialTable($, table, context) {
  const rows = tableRows($, table);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const dataRows = rows.slice(1).map((row) => ({
    label: row[0],
    values: row.slice(1).map((value) => value || null),
  })).filter((row) => row.label && row.values.length);
  if (!dataRows.length) return null;
  const metadata = `${context.descriptor || ''} | ${rows.flat().join(' | ')}`;
  const detectedPeriod = detectPeriod(metadata);
  const unit = (metadata.match(/\b(thousands|millions|billions)\b/i) || [])[1] || null;
  const currency = (metadata.match(/\b(SAR|Saudi Riyal|Riyals?)\b/i) || [])[1] || null;
  const lastUpdateDate = (metadata.match(/last\s+update\s+date\s*[:\-]?\s*([^|]+)/i) || [])[1] || null;
  return {
    year: detectedPeriod.year,
    period: detectedPeriod.period || headers.slice(1).find(Boolean) || null,
    periodType: detectedPeriod.periodType,
    statement: context.statement || 'Financial Statement',
    unit,
    currency,
    lastUpdateDate: lastUpdateDate ? parseDate(lastUpdateDate) : context.lastUpdateDate || null,
    rows: dataRows.map((row) => ({ label: row.label, value: row.values[0] ?? null, comparableValue: row.values[1] ?? null })),
  };
}

export function parseCompanyProfile(html, symbol) {
  const $ = cheerio.load(html);
  const pageText = text($('body').text());
  const company = text($('h1').first().text()) || text($('[class*="company"] [class*="name"]').first().text()) || symbol;
  const diagnostics = { symbol, hasAnnouncements: /announcements/i.test(pageText), hasFinancials: /financials/i.test(pageText), tableCount: $('table').length };

  const announcements = [];
  $('a[href]').each((_, anchor) => {
    const href = absoluteUrl($(anchor).attr('href'));
    if (!href || !/issuer-announcements-details/i.test(href)) return;
    const row = $(anchor).closest('tr,li,article,div');
    const values = cells($, row);
    const title = text($(anchor).text()) || values.find((value) => value.length > 20) || null;
    if (!title || announcements.some((item) => item.url === href)) return;
    const dateText = values.find((value) => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(value)) || null;
    announcements.push({
      title,
      publishedAt: parseDate(dateText),
      url: href,
      category: values.find((value) => /announcement|financial|corporate|dividend|capital/i.test(value)) || null,
      isFinancialResults: looksFinancialResult(title),
    });
  });

  const financials = { annual: [], quarterly: [] };
  $('table').each((_, table) => {
    const nearby = text($(table).prevAll('h1,h2,h3,h4,h5,h6,[role="heading"],strong,b').slice(0, 8).text());
    const sectionHeading = text($(table).closest('section,article').find('h1,h2,h3,h4,h5,h6,[role="heading"],strong,b').first().text());
    const descriptor = `${nearby} ${sectionHeading}`;
    if (!/balance sheet|statement of income|cash flows|financial statements|financials/i.test(descriptor)) return;
    const type = /quarterly/i.test(descriptor) ? 'quarterly' : /annually|annual/i.test(descriptor) ? 'annual' : null;
    if (!type) return;
    const statement = /balance sheet/i.test(descriptor) ? 'Balance Sheet'
      : /statement of income/i.test(descriptor) ? 'Statement of Income'
      : /cash flows/i.test(descriptor) ? 'Cash Flows' : 'Financial Statement';
    const parsed = parseFinancialTable($, table, { statement, descriptor });
    if (parsed) financials[type].push(parsed);
  });

  diagnostics.announcementCount = announcements.length;
  diagnostics.annualTableCount = financials.annual.length;
  diagnostics.quarterlyTableCount = financials.quarterly.length;
  if (!diagnostics.hasAnnouncements && !diagnostics.hasFinancials) {
    return { symbol, company, parsingError: 'Saudi Exchange profile did not contain recognizable announcements or financial sections', announcements: [], ...financials, diagnostics };
  }
  const periods = [...financials.quarterly, ...financials.annual].map((statement) => ({
    symbol,
    companyName: company,
    year: statement.year,
    period: statement.period,
    periodType: statement.periodType,
    statement: statement.statement,
    unit: statement.unit,
    currency: statement.currency,
    lastUpdateDate: statement.lastUpdateDate,
    rows: statement.rows,
  }));
  return { symbol, company, announcements, ...financials, periods, diagnostics };
}

function extractAnnouncementContent(html) {
  const $ = cheerio.load(html);
  const candidates = $('main,article,[role="main"],.content').map((_, node) => text($(node).text())).get();
  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}
async function enrichAnnouncementDetails(profile) {
  const announcements = await Promise.all(profile.announcements.slice(0, 10).map(async (announcement) => {
    try {
      const response = await fetchSaudiExchange(announcement.url);
      const content = extractAnnouncementContent(await response.text());
      return content ? { ...announcement, content } : announcement;
    } catch {
      return announcement;
    }
  }));
  return { ...profile, announcements: [...announcements, ...profile.announcements.slice(10)] };
}
async function mapWithConcurrency(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      try { output[index] = await mapper(values[index]); }
      catch (error) { output[index] = { symbol: values[index], company: values[index], parsingError: error.message, announcements: [], annual: [], quarterly: [], periods: [] }; }
    }
  }));
  return output;
}

export async function loadProfiles(kind) {
  const now = new Date().toISOString();
  const cacheKey = 'profiles';
  const cached = memoryCache.get(cacheKey);
  const companies = await mapWithConcurrency(INSURANCE_SYMBOLS, 4, async (symbol) => {
    const response = await fetchSaudiExchange(`${PROFILE_URL}${encodeURIComponent(symbol)}`);
    const profile = parseCompanyProfile(await response.text(), symbol);
    return profile.parsingError ? profile : enrichAnnouncementDetails(profile);
  });
  const cachedBySymbol = new Map((cached?.companies || []).map((company) => [company.symbol, company]));
  let stale = false;
  const mergedCompanies = companies.map((company) => {
    if (!company.parsingError || !cachedBySymbol.has(company.symbol)) return company;
    stale = true;
    return cachedBySymbol.get(company.symbol);
  });
  const successful = mergedCompanies.filter((company) => !company.parsingError).length;
  if (successful > 0) {
    const payload = { source: 'Saudi Exchange', lastChecked: now, lastSuccessfulUpdate: now, stale, companies: mergedCompanies };
    memoryCache.set(cacheKey, payload);
    console.log(JSON.stringify({ event: 'tadawul-parser', kind, diagnostics: companies.map(({ symbol, diagnostics, parsingError }) => ({ symbol, diagnostics, parsingError })) }));
    return payload;
  }
  if (cached) return { ...cached, lastChecked: now, stale: true };
  return { source: 'Saudi Exchange', lastChecked: now, lastSuccessfulUpdate: null, stale: true, companies };
}
