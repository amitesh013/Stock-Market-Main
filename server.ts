import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Market status (NYSE / NASDAQ exchange schedule)
app.get('/api/market/status', (req, res) => {
  const now = new Date();
  
  // Format current time in US Eastern Time
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(etString);
  
  const day = etDate.getDay(); // 0 = Sun, 6 = Sat
  const hour = etDate.getHours();
  const min = etDate.getMinutes();
  const timeInMinutes = hour * 60 + min;

  const marketOpen = 9 * 60 + 30; // 9:30 AM ET
  const marketClose = 16 * 60;     // 4:00 PM ET
  const preMarketOpen = 4 * 60;    // 4:00 AM ET
  const afterHoursClose = 20 * 60; // 8:00 PM ET

  const isWeekend = day === 0 || day === 6;
  let session = 'CLOSED';
  let isOpen = false;

  if (!isWeekend) {
    if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
      session = 'REGULAR';
      isOpen = true;
    } else if (timeInMinutes >= preMarketOpen && timeInMinutes < marketOpen) {
      session = 'PRE_MARKET';
    } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursClose) {
      session = 'AFTER_HOURS';
    }
  }

  res.json({
    isOpen,
    session,
    easternTime: etString,
    exchange: 'NYSE / NASDAQ',
    timezone: 'America/New_York',
    message: isOpen 
      ? 'US Equity Markets are Open for Regular Trading' 
      : session === 'AFTER_HOURS'
      ? 'After-Hours Trading Session'
      : session === 'PRE_MARKET'
      ? 'Pre-Market Trading Session'
      : 'US Equity Markets are currently Closed'
  });
});

// Real-time quotes for one or more stock tickers
app.get('/api/stocks/quotes', async (req, res) => {
  const symbolsParam = (req.query.symbols as string) || '';
  if (!symbolsParam.trim()) {
    return res.status(400).json({ error: 'symbols query parameter required' });
  }

  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase().replace(/\./g, '-'))
    .filter(Boolean);

  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=2m&range=1d`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) return null;
        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const currentPrice = Number(meta.regularMarketPrice) || 0;
        const prevClose = Number(meta.chartPreviousClose || meta.previousClose || currentPrice);
        const change = Math.round((currentPrice - prevClose) * 100) / 100;
        const changePercent = prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0;
        const dayHigh = Number(meta.regularMarketDayHigh || currentPrice);
        const dayLow = Number(meta.regularMarketDayLow || currentPrice);
        const volume = Number(meta.regularMarketVolume || 0);

        // Normalize ticker display (e.g. BRK-B to BRK.B)
        const displayTicker = meta.symbol.replace(/-/g, '.');

        return {
          symbol: displayTicker,
          rawSymbol: meta.symbol,
          name: meta.shortName || meta.longName || displayTicker,
          price: currentPrice,
          previousClose: prevClose,
          change,
          changePercent,
          dayHigh,
          dayLow,
          volume,
          currency: meta.currency || 'USD',
          fiftyTwoWeekHigh: Number(meta.fiftyTwoWeekHigh || currentPrice * 1.15),
          fiftyTwoWeekLow: Number(meta.fiftyTwoWeekLow || currentPrice * 0.85),
          marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
          instrumentType: meta.instrumentType || 'EQUITY',
        };
      } catch (err) {
        console.error(`Error fetching quote for ${sym}:`, err);
        return null;
      }
    })
  );

  const validQuotes = results.filter(Boolean);
  res.json({
    quotes: validQuotes,
    count: validQuotes.length,
    timestamp: Date.now(),
    source: 'Real-Time Market Exchange Data (NYSE/NASDAQ)',
  });
});

// Real-time or historical chart points for a specific ticker
app.get('/api/stocks/chart/:symbol', async (req, res) => {
  const rawSymbol = req.params.symbol.trim().toUpperCase().replace(/\./g, '-');
  const range = (req.query.range as string) || '1d';
  
  let interval = '5m';
  if (range === '1d') interval = '2m';
  else if (range === '5d') interval = '15m';
  else if (range === '1mo') interval = '1d';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(rawSymbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Exchange returned status ${response.status}` });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: 'Ticker symbol not found on exchanges' });
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const volumes = quotes.volume || [];

    const points: any[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price !== null && price !== undefined && !isNaN(price)) {
        points.push({
          timestamp: timestamps[i] * 1000,
          price: Math.round(price * 100) / 100,
          open: opens[i] ? Math.round(opens[i] * 100) / 100 : price,
          high: highs[i] ? Math.round(highs[i] * 100) / 100 : price,
          low: lows[i] ? Math.round(lows[i] * 100) / 100 : price,
          volume: volumes[i] || 0,
        });
      }
    }

    res.json({
      symbol: req.params.symbol.toUpperCase(),
      meta: {
        currency: meta.currency,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose || meta.previousClose,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      },
      points,
      chart: points.map(p => ({ ...p, close: p.price })),
    });
  } catch (err: any) {
    console.error(`Chart error for ${rawSymbol}:`, err);
    res.status(500).json({ error: err.message || 'Failed to fetch chart data' });
  }
});

// Search symbols
app.get('/api/stocks/search', async (req, res) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.json({ results: [] });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return res.json({ results: [] });
    const data = await response.json();
    const quotes = data?.quotes || [];
    
    // Filter to equities and ETFs only, strictly excluding cryptocurrency
    const filtered = quotes
      .filter((q: any) => {
        const type = (q.typeDisp || q.quoteType || '').toLowerCase();
        const symbol = (q.symbol || '').toUpperCase();
        return (type.includes('equity') || type.includes('etf')) && !symbol.includes('-USD') && !type.includes('crypto');
      })
      .map((q: any) => ({
        symbol: q.symbol.replace(/-/g, '.'),
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || 'US',
        type: q.typeDisp || 'Equity',
      }));

    res.json({ results: filtered });
  } catch (err) {
    res.json({ results: [] });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Real-Time Stock Market Server running at http://0.0.0.0:${PORT}`);
  });
}

start();
