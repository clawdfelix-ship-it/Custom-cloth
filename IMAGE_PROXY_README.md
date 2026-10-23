# M-ZAKKA Image Proxy System

## Overview
A high-performance image proxy for serving 235,000+ M-ZAKKA product images with local caching, on-the-fly resizing, and elegant Japanese-style placeholders.

## Files Created/Modified

### 1. `utils/imageUtils.js` - Core Utilities
**Helper functions:**
- `extractHashFromUrl(url)` - Extracts MD5 hash from M-ZAKKA URL or computes it
- `toProxyUrl(url, options)` - Converts M-ZAKKA URL to local proxy URL with optional resize params
- `findLocalImage(hash)` - Checks local filesystem for image (235k+ library)
- `generatePlaceholder(productName, width, height)` - Creates elegant SVG placeholder with Japanese aesthetic
- `getRemoteUrl(hash)` - Constructs original M-ZAKKA remote URL

### 2. `app.js` - Main Express App
**Added `/image/:hash` endpoint with:**
- ✅ **Local-first lookup** - Checks 235k+ local images first before proxying
- ✅ **On-the-fly resizing** - Use `?w=400&h=400` query params (sharp-powered)
- ✅ **Aggressive caching** - `Cache-Control: public, max-age=31536000, immutable`
- ✅ **Remote proxy fallback** - Proper headers (User-Agent, Referer) for M-ZAKKA
- ✅ **SVG placeholder fallback** - Elegant Japanese-style gradient with initials
- ✅ **Abuse prevention** - Max dimension limit (2000px), hash validation
- ✅ **EJS template helper** - `toProxyUrl` available globally in views

### 3. `api/index.js` - API Version
Same image proxy endpoint added for the API version of the app.

## Usage Examples

### Basic Image URL
```html
<img src="/image/00004013e83868c1ba4bf965a46f181f" alt="Product">
```

### Resized Image
```html
<img src="/image/00004013e83868c1ba4bf965a46f181f?w=200&h=200" alt="Thumbnail">
```

### In EJS Templates
```html
<% products.forEach(product => { %>
  <img src="<%= product.image %>" alt="<%= product.name %>">
<% }) %>

<!-- Or with resizing directly in template -->
<img src="<%= toProxyUrl(product.rawImageUrl, { w: 400 }) %>">
```

### Convert URLs in Code
```javascript
const { toProxyUrl } = require('./utils/imageUtils');

const proxyUrl = toProxyUrl('https://i.mzakka.com/imgs/abc123...xyz.jpg');
// Returns: /image/abc123...xyz

const thumbUrl = toProxyUrl('https://i.mzakka.com/imgs/abc123...xyz.jpg', { w: 200 });
// Returns: /image/abc123...xyz?w=200
```

## Performance Features
1. **Local filesystem first** - 235k+ images already cached locally at `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/images/`
2. **Sharp resizing** - Fast, high-quality image processing
3. **Browser caching** - 1-year cache with immutable flag for repeat visits
4. **Progressive JPEG** - For better perceived loading performance
5. **Multiple format support** - JPG, PNG, WebP, GIF

## Error Handling
- Invalid hash format → 400 Bad Request
- Invalid dimensions → 400 Bad Request
- Missing image (local + remote fail) → SVG placeholder fallback
- Remote timeout → SVG placeholder fallback

## Placeholder Design
Japanese minimalist aesthetic:
- Subtle gradient backgrounds (10 elegant color options)
- Product name initials centered
- Decorative lines for visual interest
- M-ZAKKA brand watermark
- Consistent color selection based on product name hash
