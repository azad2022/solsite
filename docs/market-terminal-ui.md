# Solmint Live Market UI

The homepage market component is intentionally a read-only market surface, not a trading terminal. The visual language uses a compact exchange-inspired board: dense market cards, explicit LIVE state, update timestamp, source labels, controlled motion, and a clear separation between market data and trading actions.

The widget is driven by the `meme-price-ticker` public feed and is hidden when the feed is disabled or has no usable prices. Admin visibility remains controlled by the market ticker configuration kill switch.
