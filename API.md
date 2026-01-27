# DisposableCheck API Documentation

A free API to detect disposable email addresses. Protect your application from temporary/throwaway emails.

## Base URL

**Production**: `https://disposablecheck.irensaltali.com/api`

## OpenAPI Documentation

Interactive API documentation is available at the root URL:
- **Swagger UI**: [https://disposablecheck.irensaltali.com/api](https://disposablecheck.irensaltali.com/api)

---

## Authentication

Most endpoints require an API key passed via the `X-API-Key` header:

```
X-API-Key: your_api_key_here
```

### Get a Free API Key

Request a free API key by calling the `/v1/keys` endpoint with your email address. The key will be sent to your email.

---

## Endpoints

### 1. Check Email

Check if an email address is from a disposable email provider.

**Endpoint**: `GET /api/v1/check`

**Headers**:
| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Your API key |

**Query Parameters**:
| Parameter | Required | Description |
|-----------|----------|-------------|
| `email` | Yes | Email address to check |

**Example Request**:
```bash
curl -X GET \
  'https://disposablecheck.irensaltali.com/api/v1/check?email=user@tempmail.com' \
  -H 'X-API-Key: your_api_key_here'
```

**Success Response** (200):
```json
{
  "email": "user@tempmail.com",
  "domain": "tempmail.com",
  "is_disposable": true,
  "is_valid_format": true,
  "checked_at": "2026-01-27T10:30:00Z"
}
```

**Error Responses**:
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_EMAIL` | Invalid email format |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 429 | `RATE_LIMITED` | Daily rate limit exceeded |

---

### 2. Request API Key

Create a new API key and receive it via email.

**Endpoint**: `POST /api/v1/keys`

**Headers**:
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |

**Request Body**:
| Field | Required | Description |
|-------|----------|-------------|
| `email` | Yes | Your email address |
| `turnstileToken` | Yes | Cloudflare Turnstile verification token |

**Example Request**:
```bash
curl -X POST \
  'https://disposablecheck.irensaltali.com/api/v1/keys' \
  -H 'Content-Type: application/json' \
  -d '{"email": "developer@company.com", "turnstileToken": "xxx"}'
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "API key created and sent to your email"
}
```

**Error Responses**:
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_EMAIL` | Invalid email format |
| 400 | `DISPOSABLE_EMAIL` | Cannot use disposable email for registration |
| 400 | `TURNSTILE_REQUIRED` | Turnstile verification required |
| 400 | `TURNSTILE_FAILED` | Turnstile verification failed |
| 500 | `EMAIL_FAILED` | Failed to send email |

---

### 3. Get API Key Info

Get usage statistics for an API key.

**Endpoint**: `GET /api/v1/keys/:email`

**Path Parameters**:
| Parameter | Required | Description |
|-----------|----------|-------------|
| `email` | Yes | Email address associated with the API key |

**Example Request**:
```bash
curl -X GET \
  'https://disposablecheck.irensaltali.com/api/v1/keys/developer@company.com'
```

**Success Response** (200):
```json
{
  "exists": true,
  "requests_today": 42,
  "daily_limit": 1000,
  "created_at": "2026-01-15T10:30:00Z"
}
```

**Error Responses**:
| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | No API key found for this email |

---

### 4. Get Platform Statistics

Get aggregate platform statistics including total emails checked and domains tracked.

**Endpoint**: `GET /api/v1/stats`

**Authentication**: Not required

**Example Request**:
```bash
curl -X GET \
  'https://disposablecheck.irensaltali.com/api/v1/stats'
```

**Success Response** (200):
```json
{
  "total_emails_checked": 1247893,
  "total_disposable_domains": 4521,
  "community_reports": 23
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `total_emails_checked` | number | Total number of email checks performed via the API |
| `total_disposable_domains` | number | Total number of disposable domains in the blocklist |
| `community_reports` | number | Number of community-reported domains |

---

## Rate Limits

| Tier | Daily Limit | Requirements |
|------|-------------|--------------|
| **Free** | 1,000 requests/day | Attribution backlink required |
| **Pro** | 100,000 requests/day | Paid subscription |

### Attribution Requirement

Free tier requires a visible backlink to one of:
- [irensaltali.com](https://irensaltali.com)
- [sendfax.pro](https://sendfax.pro)
- [zenrise.app](https://zenrise.app)

---

## Code Examples

### JavaScript / Node.js

```javascript
const response = await fetch(
  'https://disposablecheck.irensaltali.com/api/v1/check?email=user@example.com',
  {
    headers: {
      'X-API-Key': 'your_api_key_here'
    }
  }
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

### cURL

```bash
curl -X GET \
  'https://disposablecheck.irensaltali.com/api/v1/check?email=user@example.com' \
  -H 'X-API-Key: your_api_key_here'
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_EMAIL` | 400 | Email format is invalid |
| `DISPOSABLE_EMAIL` | 400 | Disposable emails not allowed |
| `TURNSTILE_REQUIRED` | 400 | CAPTCHA verification required |
| `TURNSTILE_FAILED` | 400 | CAPTCHA verification failed |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Daily rate limit exceeded |
| `EMAIL_FAILED` | 500 | Email sending failed |
