const crypto = require('crypto');
const { validateSafeUrl } = require('../utils/ssrfFilter');
const redisService = require('./redisService');
const logger = require('../utils/logger');

/**
 * Extracts a regex match group or returns fallback
 */
const extractMatch = (html, regex) => {
  const match = html.match(regex);
  return match && match[1] ? match[1].trim() : '';
};

/**
 * Normalizes relative URLs into absolute URLs
 */
const resolveUrl = (relative, base) => {
  if (!relative) return '';
  try {
    return new URL(relative, base).toString();
  } catch (e) {
    return relative;
  }
};

/**
 * HTML unescape helper for title / description
 */
const unescapeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const linkPreviewService = {
  /**
   * Fetches OpenGraph and metadata preview with strict SSRF protection,
   * 5s timeout, 1MB max body limit, and Redis caching.
   *
   * @param {string} rawUrl
   * @returns {Promise<Object>}
   */
  async getPreview(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Valid URL is required for preview.');
    }

    // 1. SSRF validation
    const parsedUrl = await validateSafeUrl(rawUrl);
    const validUrl = parsedUrl.toString();

    // 2. Check Redis cache (24 hours TTL)
    const urlHash = crypto.createHash('sha256').update(validUrl).digest('hex');
    const cacheKey = `pocket:preview:${urlHash}`;

    try {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed reading preview from Redis cache');
    }

    // 3. Fetch with 5-second timeout & AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let html = '';
    try {
      const response = await fetch(validUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (FlashChat LinkPreviewBot/1.0; +https://flashchat.app)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      // Verify the final redirected URL is also safe from SSRF!
      if (response.url && response.url !== validUrl) {
        await validateSafeUrl(response.url);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        // Not HTML, return generic info
        const simpleResult = {
          title: parsedUrl.hostname,
          description: '',
          image: '',
          favicon: `${parsedUrl.origin}/favicon.ico`,
          siteName: parsedUrl.hostname,
          url: validUrl
        };
        await redisService.set(cacheKey, simpleResult, 'EX', 86400);
        return simpleResult;
      }

      // Read at most 1MB of the response
      const buffer = await response.arrayBuffer();
      const maxBytes = 1024 * 1024; // 1 MB
      const sliced = buffer.byteLength > maxBytes ? buffer.slice(0, maxBytes) : buffer;
      html = new TextDecoder('utf-8').decode(sliced);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error('Link preview request timed out (5s limit).');
      }
      throw fetchErr;
    }

    // 4. Extract OpenGraph & HTML meta tags
    const ogTitle = extractMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                    extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const twitterTitle = extractMatch(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
                         extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
    const htmlTitle = extractMatch(html, /<title[^>]*>([^<]+)<\/title>/i);

    const title = unescapeHtml(ogTitle || twitterTitle || htmlTitle || parsedUrl.hostname);

    const ogDesc = extractMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                   extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const twitterDesc = extractMatch(html, /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i) ||
                        extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:description["']/i);
    const metaDesc = extractMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                     extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const description = unescapeHtml(ogDesc || twitterDesc || metaDesc || '');

    const ogImage = extractMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twitterImage = extractMatch(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                         extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    const rawImage = ogImage || twitterImage || '';
    const image = resolveUrl(rawImage, validUrl);

    const ogSiteName = extractMatch(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                       extractMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    const siteName = unescapeHtml(ogSiteName || parsedUrl.hostname);

    const iconMatch = extractMatch(html, /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
                      extractMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
    const favicon = resolveUrl(iconMatch || '/favicon.ico', validUrl);

    const previewResult = {
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      image,
      favicon,
      siteName: siteName.slice(0, 100),
      url: validUrl
    };

    // 5. Cache preview in Redis
    try {
      await redisService.set(cacheKey, previewResult, 'EX', 86400);
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to save preview to Redis');
    }

    return previewResult;
  }
};

module.exports = linkPreviewService;
