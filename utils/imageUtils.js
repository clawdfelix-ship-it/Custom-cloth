const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Local image directory path
const LOCAL_IMAGE_DIR = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/images';

/**
 * Extract MD5 hash from M-ZAKKA image URL or compute it
 * M-ZAKKA URL format: https://i.mzakka.com/imgs/md5hash.jpg
 * @param {string} url - M-ZAKKA image URL
 * @returns {string} MD5 hash
 */
function extractHashFromUrl(url) {
  if (!url) return null;
  
  // Try to extract hash from filename pattern
  const match = url.match(/([a-f0-9]{32})\.(jpg|jpeg|png|webp|gif)/i);
  if (match) {
    return match[1].toLowerCase();
  }

  return null;
}

/**
 * Convert M-ZAKKA image URL to local proxy URL
 * @param {string} url - Original M-ZAKKA image URL
 * @param {object} options - Resizing options { w, h }
 * @returns {string} Local proxy URL
 */
function toProxyUrl(url, options = {}) {
  const hash = extractHashFromUrl(url);
  if (!hash) return url; // Return original if we can't extract hash
  
  let proxyUrl = `/image/${hash}`;
  
  // Add query params for resizing
  const params = [];
  if (options.w) params.push(`w=${options.w}`);
  if (options.h) params.push(`h=${options.h}`);
  
  if (params.length > 0) {
    proxyUrl += `?${params.join('&')}`;
  }
  
  return proxyUrl;
}

/**
 * Check if image exists locally
 * @param {string} hash - Image hash
 * @returns {string|null} Local file path or null if not found
 */
function findLocalImage(hash) {
  const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  for (const ext of extensions) {
    const filePath = path.join(LOCAL_IMAGE_DIR, hash + ext);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * Generate SVG placeholder with product name/initials in Japanese style
 * @param {string} productName - Product name (Japanese supported)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} SVG string
 */
function generatePlaceholder(productName = 'M-ZAKKA', width = 400, height = 400) {
  // Get first 1-2 characters for initials
  const initials = productName
    .replace(/[^\p{L}\p{N}]/gu, '') // Keep only letters and numbers
    .slice(0, 2)
    .toUpperCase();
  
  // Japanese style colors - muted, elegant
  const colors = [
    { bg: '#667eea', text: '#ffffff' },
    { bg: '#764ba2', text: '#ffffff' },
    { bg: '#f093fb', text: '#333333' },
    { bg: '#60a5fa', text: '#ffffff' },
    { bg: '#34d399', text: '#ffffff' },
    { bg: '#fbbf24', text: '#333333' },
    { bg: '#ef4444', text: '#ffffff' },
    { bg: '#8b5cf6', text: '#ffffff' },
    { bg: '#ec4899', text: '#ffffff' },
    { bg: '#14b8a6', text: '#ffffff' },
  ];
  
  // Pick color based on product name hash for consistency
  const colorIndex = crypto.createHash('md5').update(productName).digest().readUInt8(0) % colors.length;
  const { bg, text } = colors[colorIndex];
  
  // Font size based on image dimensions
  const fontSize = Math.min(width, height) * 0.3;
  
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Gradient background - Japanese style -->
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${bg};stop-opacity:0.85" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.2"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  
  <!-- Subtle pattern overlay -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" opacity="0.95" />
  
  <!-- Decorative lines - Japanese minimalist style -->
  <line x1="${width * 0.1}" y1="${height * 0.1}" x2="${width * 0.1}" y2="${height * 0.9}" stroke="${text}" stroke-width="1" opacity="0.15" />
  <line x1="${width * 0.9}" y1="${height * 0.1}" x2="${width * 0.9}" y2="${height * 0.9}" stroke="${text}" stroke-width="1" opacity="0.15" />
  <line x1="${width * 0.1}" y1="${height * 0.5}" x2="${width * 0.9}" y2="${height * 0.5}" stroke="${text}" stroke-width="1" opacity="0.15" />
  
  <!-- Initials text -->
  <text 
    x="${width / 2}" 
    y="${height / 2}" 
    font-family="Noto Sans JP, Hiragino Kaku Gothic Pro, Meiryo, sans-serif" 
    font-size="${fontSize}" 
    font-weight="500"
    fill="${text}" 
    text-anchor="middle" 
    dominant-baseline="central"
    filter="url(#shadow)"
  >${initials}</text>
  
  <!-- Brand text at bottom -->
  <text 
    x="${width / 2}" 
    y="${height * 0.85}" 
    font-family="Noto Sans JP, sans-serif" 
    font-size="${fontSize * 0.25}" 
    font-weight="300"
    fill="${text}" 
    text-anchor="middle" 
    opacity="0.8"
  >M-ZAKKA</text>
</svg>
  `.trim();
}

/**
 * Get original M-ZAKKA URL from hash
 * @param {string} hash - Image hash
 * @returns {string} Original remote URL
 */
function getRemoteUrl(hash) {
  return `https://i.mzakka.com/imgs/${hash}.jpg`;
}

module.exports = {
  extractHashFromUrl,
  toProxyUrl,
  findLocalImage,
  generatePlaceholder,
  getRemoteUrl,
  LOCAL_IMAGE_DIR
};
