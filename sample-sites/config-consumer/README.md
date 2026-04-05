# Sample Consumer Site

A minimal standalone HTML page that demonstrates consuming configuration values from the platform's SDK endpoint.

## Quick Start

1. Open `index.html` directly in a browser (or serve it locally)
2. Ensure the backend is running at `http://localhost:3000`
3. Paste your **API Key** (generated from the dashboard's API Keys page)
4. Enter a config key name (e.g. `welcome.feature.enabled`)
5. Click **Fetch Config** to see the live value

## Features

- **Context-aware fetching**: Optionally pass `user_id`, `region`, and `tier` to test rule-based evaluation
- **Auto-refresh**: Toggle auto-refresh to poll the config every 5 seconds — change the value in the dashboard and watch it update live
- **Raw JSON view**: See the full API response

## How it works

The sample site calls:
```
GET http://localhost:3000/api/v1/sdk/config/{keyName}?user_id=...&region=...
```

with the header:
```
X-API-Key: <your-api-key>
```

This is exactly how a real client SDK would consume configs from the platform.
