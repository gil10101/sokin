import yfinance as yf
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Cache for storing data (simple in-memory cache)
cache = {}
CACHE_DURATION = 300  # 5 minutes

def get_cached_data(key: str) -> Optional[Dict]:
    """Get cached data if it exists and is not expired"""
    if key in cache:
        data, timestamp = cache[key]
        if datetime.now().timestamp() - timestamp < CACHE_DURATION:
            return data
    return None

def set_cached_data(key: str, data: Dict) -> None:
    """Set data in cache with current timestamp"""
    cache[key] = (data, datetime.now().timestamp())

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/market-indices')
def get_market_indices():
    """Get major market indices data"""
    cache_key = "market_indices"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        logger.info("Returning cached market indices data")
        return jsonify(cached_data)
    
    try:
        symbols = ['^IXIC', '^DJI', '^GSPC']
        indices = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period='2d')
                info = ticker.info
                
                if len(hist) < 2:
                    logger.warning(f"Insufficient data for {symbol}")
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                prev_price = float(hist['Close'].iloc[-2])
                change = current_price - prev_price
                change_percent = (change / prev_price) * 100
                
                # Map symbols to readable names
                name_mapping = {
                    '^IXIC': 'NASDAQ Composite',
                    '^DJI': 'Dow Jones Industrial Average',
                    '^GSPC': 'S&P 500'
                }
                
                indices.append({
                    'symbol': symbol,
                    'name': name_mapping.get(symbol, info.get('longName', symbol)),
                    'price': round(current_price, 2),
                    'change': round(change, 2),
                    'changePercent': round(change_percent, 2)
                })
                
                logger.info(f"Successfully fetched data for {symbol}")
                
            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {str(e)}")
                continue
        
        if indices:
            set_cached_data(cache_key, indices)
            logger.info(f"Successfully fetched {len(indices)} market indices")
            return jsonify(indices)
        else:
            logger.error("No market indices data could be fetched")
            return jsonify({"error": "No data available"}), 500
            
    except Exception as e:
        logger.error(f"Error in get_market_indices: {str(e)}")
        return jsonify({"error": "Failed to fetch market indices"}), 500

@app.route('/api/trending-stocks')
def get_trending_stocks():
    """Get trending stocks data"""
    cache_key = "trending_stocks"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        logger.info("Returning cached trending stocks data")
        return jsonify(cached_data)
    
    try:
        # Popular stocks to track
        symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'ORCL']
        stocks = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                hist = ticker.history(period='1y')
                
                if len(hist) < 2:
                    logger.warning(f"Insufficient data for {symbol}")
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                prev_price = float(hist['Close'].iloc[-2])
                change = current_price - prev_price
                change_percent = (change / prev_price) * 100
                
                # Generate chart data (last 30 days)
                chart_data = hist['Close'].tail(30).tolist()
                chart_data = [float(x) for x in chart_data if not pd.isna(x)]
                
                # Calculate 52-week high/low
                week_high_52 = float(hist['High'].max())
                week_low_52 = float(hist['Low'].min())
                
                # Calculate 52-week change
                if len(hist) >= 252:  # Approximately 1 year of trading days
                    year_ago_price = float(hist['Close'].iloc[-252])
                    week_change_52 = ((current_price - year_ago_price) / year_ago_price) * 100
                else:
                    week_change_52 = ((current_price - hist['Close'].iloc[0]) / hist['Close'].iloc[0]) * 100
                
                stocks.append({
                    'symbol': symbol,
                    'name': info.get('longName', symbol),
                    'price': round(current_price, 2),
                    'change': round(change, 2),
                    'changePercent': round(change_percent, 2),
                    'volume': int(hist['Volume'].iloc[-1]) if not pd.isna(hist['Volume'].iloc[-1]) else 0,
                    'avgVolume': int(hist['Volume'].tail(30).mean()) if not pd.isna(hist['Volume'].tail(30).mean()) else 0,
                    'marketCap': info.get('marketCap', 'N/A'),
                    'peRatio': info.get('trailingPE'),
                    'weekHigh52': round(week_high_52, 2),
                    'weekLow52': round(week_low_52, 2),
                    'weekChange52': round(week_change_52, 2),
                    'chart': chart_data
                })
                
                logger.info(f"Successfully fetched data for {symbol}")
                
            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {str(e)}")
                continue
        
        if stocks:
            set_cached_data(cache_key, stocks)
            logger.info(f"Successfully fetched {len(stocks)} trending stocks")
            return jsonify(stocks)
        else:
            logger.error("No trending stocks data could be fetched")
            return jsonify({"error": "No data available"}), 500
            
    except Exception as e:
        logger.error(f"Error in get_trending_stocks: {str(e)}")
        return jsonify({"error": "Failed to fetch trending stocks"}), 500

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol: str):
    """Get detailed data for a specific stock"""
    cache_key = f"stock_{symbol.upper()}"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        logger.info(f"Returning cached data for {symbol}")
        return jsonify(cached_data)
    
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        hist = ticker.history(period='1y')
        
        if len(hist) < 2:
            return jsonify({"error": f"No data available for {symbol}"}), 404
        
        current_price = float(hist['Close'].iloc[-1])
        prev_price = float(hist['Close'].iloc[-2])
        change = current_price - prev_price
        change_percent = (change / prev_price) * 100
        
        # Generate chart data (last 30 days)
        chart_data = hist['Close'].tail(30).tolist()
        chart_data = [float(x) for x in chart_data if not pd.isna(x)]
        
        # Calculate 52-week high/low
        week_high_52 = float(hist['High'].max())
        week_low_52 = float(hist['Low'].min())
        
        # Calculate 52-week change
        if len(hist) >= 252:
            year_ago_price = float(hist['Close'].iloc[-252])
            week_change_52 = ((current_price - year_ago_price) / year_ago_price) * 100
        else:
            week_change_52 = ((current_price - hist['Close'].iloc[0]) / hist['Close'].iloc[0]) * 100
        
        stock_data = {
            'symbol': symbol.upper(),
            'name': info.get('longName', symbol.upper()),
            'price': round(current_price, 2),
            'change': round(change, 2),
            'changePercent': round(change_percent, 2),
            'volume': int(hist['Volume'].iloc[-1]) if not pd.isna(hist['Volume'].iloc[-1]) else 0,
            'avgVolume': int(hist['Volume'].tail(30).mean()) if not pd.isna(hist['Volume'].tail(30).mean()) else 0,
            'marketCap': info.get('marketCap', 'N/A'),
            'peRatio': info.get('trailingPE'),
            'weekHigh52': round(week_high_52, 2),
            'weekLow52': round(week_low_52, 2),
            'weekChange52': round(week_change_52, 2),
            'chart': chart_data
        }
        
        set_cached_data(cache_key, stock_data)
        logger.info(f"Successfully fetched data for {symbol}")
        return jsonify(stock_data)
        
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {str(e)}")
        return jsonify({"error": f"Failed to fetch data for {symbol}"}), 500

@app.route('/api/search', methods=['GET'])
def search_stocks():
    """Search stocks by symbol or name"""
    query = request.args.get('q', '').strip().upper()
    if not query:
        return jsonify([])
    
    try:
        # For now, search within popular stocks
        # In a production environment, you might want to use a more comprehensive search
        popular_symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'ORCL', 
                          'CRM', 'ADBE', 'PYPL', 'INTC', 'CSCO', 'CMCSA', 'PEP', 'COST', 'TMUS', 'AVGO']
        
        results = []
        for symbol in popular_symbols:
            if query in symbol:
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    name = info.get('longName', symbol)
                    
                    if query in symbol or query in name.upper():
                        hist = ticker.history(period='5d')
                        if len(hist) >= 2:
                            current_price = float(hist['Close'].iloc[-1])
                            prev_price = float(hist['Close'].iloc[-2])
                            change = current_price - prev_price
                            change_percent = (change / prev_price) * 100
                            
                            results.append({
                                'symbol': symbol,
                                'name': name,
                                'price': round(current_price, 2),
                                'change': round(change, 2),
                                'changePercent': round(change_percent, 2),
                                'volume': int(hist['Volume'].iloc[-1]) if not pd.isna(hist['Volume'].iloc[-1]) else 0,
                                'avgVolume': int(hist['Volume'].tail(5).mean()) if not pd.isna(hist['Volume'].tail(5).mean()) else 0,
                                'marketCap': info.get('marketCap', 'N/A'),
                                'peRatio': info.get('trailingPE'),
                                'weekHigh52': round(float(hist['High'].max()), 2),
                                'weekLow52': round(float(hist['Low'].min()), 2),
                                'weekChange52': 0,  # Skip this for search results to improve performance
                                'chart': []  # Skip chart data for search results
                            })
                            
                            if len(results) >= 10:  # Limit results
                                break
                                
                except Exception as e:
                    logger.error(f"Error searching for {symbol}: {str(e)}")
                    continue
        
        logger.info(f"Search for '{query}' returned {len(results)} results")
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error in search_stocks: {str(e)}")
        return jsonify({"error": "Search failed"}), 500

@app.route('/api/portfolio/<user_id>')
def get_user_portfolio(user_id: str):
    """Get user's stock portfolio (placeholder - integrate with your user system)"""
    # This is a placeholder implementation
    # In a real application, you would fetch this from your database
    # based on the user_id and their actual portfolio holdings
    
    try:
        # Mock portfolio data - replace with actual database query
        mock_portfolio = [
            {"symbol": "AAPL", "shares": 150, "purchasePrice": 165.00},
            {"symbol": "TSLA", "shares": 75, "purchasePrice": 220.00},
            {"symbol": "MSFT", "shares": 40, "purchasePrice": 350.00},
            {"symbol": "GOOGL", "shares": 85, "purchasePrice": 125.00},
        ]
        
        portfolio_data = []
        for holding in mock_portfolio:
            try:
                ticker = yf.Ticker(holding["symbol"])
                hist = ticker.history(period='2d')
                info = ticker.info
                
                if len(hist) < 1:
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                prev_price = float(hist['Close'].iloc[-2]) if len(hist) >= 2 else current_price
                change = current_price - prev_price
                change_percent = (change / prev_price) * 100 if prev_price != 0 else 0
                
                shares = holding["shares"]
                purchase_price = holding["purchasePrice"]
                total_value = current_price * shares
                gain_loss = (current_price - purchase_price) * shares
                gain_loss_percent = ((current_price - purchase_price) / purchase_price) * 100 if purchase_price != 0 else 0
                
                portfolio_data.append({
                    'symbol': holding["symbol"],
                    'name': info.get('longName', holding["symbol"]),
                    'price': round(current_price, 2),
                    'change': round(change, 2),
                    'changePercent': round(change_percent, 2),
                    'shares': shares,
                    'totalValue': round(total_value, 2),
                    'purchasePrice': purchase_price,
                    'gainLoss': round(gain_loss, 2),
                    'gainLossPercent': round(gain_loss_percent, 2)
                })
                
            except Exception as e:
                logger.error(f"Error fetching portfolio data for {holding['symbol']}: {str(e)}")
                continue
        
        # Sort by total value descending
        portfolio_data.sort(key=lambda x: x['totalValue'], reverse=True)
        
        logger.info(f"Successfully fetched portfolio for user {user_id}")
        return jsonify(portfolio_data)
        
    except Exception as e:
        logger.error(f"Error in get_user_portfolio: {str(e)}")
        return jsonify({"error": "Failed to fetch portfolio"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting stock service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 