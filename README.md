# 🛡️ DisposableCheck API

**Free Disposable Email Detection API**

[![API Docs](https://img.shields.io/badge/API-Documentation-green)](https://disposablecheck.irensaltali.com/api)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-orange)](https://disposablecheck.irensaltali.com/api)

A fast, free API to detect disposable email addresses. Built on Cloudflare Workers for global low-latency performance.

🔗 **API Base URL**: `https://disposablecheck.irensaltali.com/api`

---

## ✨ Features

- 🚀 **Real-time detection** — Instant response times globally
- 🆓 **Free tier** — 1,000 requests/day at no cost
- 📚 **OpenAPI 3.1** — Auto-generated documentation & Swagger UI
- 🔒 **Secure** — API key authentication with rate limiting
- 🌍 **Global** — Deployed on Cloudflare's edge network
- 📧 **20,000+ domains** — Comprehensive disposable domain database

---

## 🚀 Quick Start

### 1. Get Your Free API Key

Visit [disposablecheck.irensaltali.com/get-api-key](https://disposablecheck.irensaltali.com/get-api-key)

### 2. Check an Email

```bash
curl -X GET \
  'https://disposablecheck.irensaltali.com/api/v1/check?email=user@tempmail.com' \
  -H 'X-API-Key: your_api_key_here'
```

### 3. Get Response

```json
{
  "email": "user@tempmail.com",
  "domain": "tempmail.com",
  "is_disposable": true,
  "is_valid_format": true,
  "checked_at": "2026-01-27T10:30:00Z"
}
```

---

## 📖 API Endpoints

### Check Email
```
GET /api/v1/check?email={email}
Header: X-API-Key: your_api_key
```

### Request API Key
```
POST /api/v1/keys
Body: { "email": "you@example.com", "turnstileToken": "..." }
```

### Get Key Info
```
GET /api/v1/keys/{email}
```

📚 **Full Documentation**: [disposablecheck.irensaltali.com/api](https://disposablecheck.irensaltali.com/api)

---

## 💻 Code Examples

### JavaScript / Node.js
```javascript
const response = await fetch(
  'https://disposablecheck.irensaltali.com/api/v1/check?email=user@example.com',
  { headers: { 'X-API-Key': 'your_api_key_here' } }
);

const data = await response.json();
console.log(data.is_disposable); // true or false
```

### Python
```python
import requests

response = requests.get(
    'https://disposablecheck.irensaltali.com/api/v1/check',
    params={'email': 'user@example.com'},
    headers={'X-API-Key': 'your_api_key_here'}
)

data = response.json()
print(data['is_disposable'])  # True or False
```

---

## 🎯 Use Cases

| Use Case | Description |
|----------|-------------|
| **Registration Forms** | Block fake signups with disposable emails |
| **Newsletter Sign-ups** | Ensure subscribers use real addresses |
| **Lead Generation** | Improve lead quality and data accuracy |
| **E-commerce** | Prevent fraud and fake accounts |
| **SaaS Platforms** | Reduce churn from fake users |

---

## ⚡ Rate Limits

| Tier | Daily Limit | Requirements |
|------|-------------|--------------|
| **Free** | 1,000 requests | Attribution backlink |
| **Pro** | 100,000 requests | Paid subscription |

---

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono + chanfana (OpenAPI)
- **Storage**: Cloudflare Durable Objects, R2
- **Email**: Resend

---

## 🏗️ Development

### Prerequisites
- Node.js 18+
- Wrangler CLI
- Cloudflare account

### Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Start local dev server
wrangler dev

# Deploy to production
wrangler deploy --env production
```

### Project Structure

```
src/
├── index.ts          # Main router & app config
├── endpoints/        # API endpoint handlers
│   ├── emailCheck.ts # Email validation endpoint
│   ├── createKey.ts  # API key creation
│   └── getKeyInfo.ts # Key info retrieval
├── ApiKeyManager.ts  # Durable Object for keys
├── domainList.ts     # Domain list management
├── turnstile.ts      # Turnstile validation
└── types.ts          # TypeScript types
```

---

## 🔧 Configuration

### Environment Variables

Set secrets using Wrangler:

```bash
wrangler secret put RESEND_API_KEY --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
```

### Wrangler Configuration

See `wrangler.jsonc` for full configuration including:
- R2 buckets for domain lists
- Durable Objects for API key management
- Route configuration for custom domain

---

## 📝 License

MIT License - free to use for personal and commercial projects.

---

## 🔗 Links

- 🌐 **Website**: [disposablecheck.irensaltali.com](https://disposablecheck.irensaltali.com)
- 📚 **API Docs**: [disposablecheck.irensaltali.com/api](https://disposablecheck.irensaltali.com/api)
- 🔑 **Get API Key**: [disposablecheck.irensaltali.com/get-api-key](https://disposablecheck.irensaltali.com/get-api-key)

---

Made with ❤️ by [İren Saltalı](https://irensaltali.com)
