# Solmint Publisher MCP

Dedicated MCP endpoint for controlled article publishing from an AI client.

## Endpoint

https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/solmint-mcp

## Tools

- list_articles — returns published article titles, slugs and categories.
- check_article — validates an article without publishing it.
- publish_article — performs the actual article publish operation after explicit approval.
- get_article — retrieves a published article by slug.

## Recommended workflow

1. list_articles
2. Draft the article and select a category
3. check_article
4. Obtain explicit approval
5. publish_article
6. get_article to verify the result

## Security

The MCP endpoint uses a server-side project secret and does not expose service-role credentials to the client. The publish operation is forwarded through the dedicated article publishing API.

Never commit or paste the authentication secret into source code, frontend code, GitHub, prompts, or screenshots.

## ChatGPT connection

Use the endpoint as a remote MCP server in a ChatGPT environment that supports custom MCP connectors. Configure authentication using the connector's secret/header mechanism rather than putting credentials in ordinary chat messages.
