# Solmint Live Market Ticker

The homepage market ticker is read-only and uses public market data. It is enabled by default through `market_ticker_config` and can be disabled from the admin panel as an emergency kill switch.

## Data sources

- Binance public 24h ticker for major USDT pairs.
- Jupiter Price API v3 for selected Solana tokens.

The Edge Function queries both sources concurrently. A failure in one provider does not hide valid prices returned by the other provider. If no usable prices are returned, the public feed returns an empty dataset and the frontend hides the widget rather than displaying stale or fabricated prices.

## Admin control

`market_ticker_config.enabled` is the authoritative public visibility switch. The default production configuration is enabled. Admins can turn it off without redeploying the website.

## Refresh

The public widget refreshes every 20 seconds by default. Animation and data refresh intervals are configurable from the admin panel.
