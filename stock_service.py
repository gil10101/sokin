import yfinance as yf
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Optional, Any
import os
from dotenv import load_dotenv
import asyncio
import threading
import time
import json

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, firestore, auth
from google.cloud.firestore_v1.base_query import FieldFilter
from functools import wraps
from collections import defaultdict

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# Initialize SocketIO for real-time updates
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000"])

# Rate limiting storage
rate_limit_storage = defaultdict(lambda: defaultdict(list))
RATE_LIMITS = {
    'default': {'requests': 60, 'window': 60},  # 60 requests per minute
    'authenticated': {'requests': 120, 'window': 60},  # 120 requests per minute for authenticated users
    'websocket': {'requests': 10, 'window': 10},  # 10 websocket events per 10 seconds
}

def rate_limit(limit_type='default'):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get client identifier
            client_ip = request.remote_addr
            user_id = get_user_from_request()
            identifier = user_id if user_id else client_ip
            
            # Get rate limit configuration
            config = RATE_LIMITS.get(limit_type, RATE_LIMITS['default'])
            max_requests = config['requests']
            window_seconds = config['window']
            
            # Clean old requests
            now = time.time()
            rate_limit_storage[limit_type][identifier] = [
                timestamp for timestamp in rate_limit_storage[limit_type][identifier]
                if now - timestamp < window_seconds
            ]
            
            # Check if rate limit exceeded
            if len(rate_limit_storage[limit_type][identifier]) >= max_requests:
                logger.warning(f"Rate limit exceeded for {identifier} on {limit_type}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retryAfter': window_seconds
                }), 429
            
            # Add current request
            rate_limit_storage[limit_type][identifier].append(now)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_auth(f):
    """Authentication required decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_user_from_request()
        if not user_id:
            logger.warning(f"Unauthorized access attempt to {request.endpoint}")
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def validate_input(schema):
    """Input validation decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Validate query parameters
                if hasattr(schema, 'query'):
                    for param, validator in schema.query.items():
                        value = request.args.get(param)
                        if validator.get('required', False) and not value:
                            return jsonify({'error': f'Missing required parameter: {param}'}), 400
                        if value and 'pattern' in validator:
                            import re
                            if not re.match(validator['pattern'], value):
                                return jsonify({'error': f'Invalid format for parameter: {param}'}), 400
                
                # Validate path parameters
                if hasattr(schema, 'params'):
                    for param, validator in schema.params.items():
                        value = kwargs.get(param)
                        if validator.get('required', False) and not value:
                            return jsonify({'error': f'Missing required parameter: {param}'}), 400
                        if value and 'pattern' in validator:
                            import re
                            if not re.match(validator['pattern'], value):
                                return jsonify({'error': f'Invalid format for parameter: {param}'}), 400
                
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Input validation error: {str(e)}")
                return jsonify({'error': 'Invalid input'}), 400
        return decorated_function
    return decorator

# Input validation schemas
class ValidationSchemas:
    symbol = {
        'params': {
            'symbol': {
                'required': True,
                'pattern': r'^[A-Z^]{1,10}$'
            }
        }
    }
    
    user_id = {
        'params': {
            'user_id': {
                'required': True,
                'pattern': r'^[a-zA-Z0-9_-]+$'
            }
        }
    }
    
    search = {
        'query': {
            'q': {
                'required': True,
                'pattern': r'^[a-zA-Z0-9\s\.\-]+$'
            }
        }
    }

# Initialize Firebase Admin
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not firebase_admin._apps:
            # Check for individual service account credentials in environment variables
            has_service_account_env_vars = (
                os.getenv('FIREBASE_PRIVATE_KEY') and 
                os.getenv('FIREBASE_CLIENT_EMAIL') and 
                os.getenv('FIREBASE_PROJECT_ID')
            )

            if has_service_account_env_vars:
                # Construct service account from individual environment variables
                service_account = {
                    "type": "service_account",
                    "project_id": os.getenv('FIREBASE_PROJECT_ID'),
                    "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                    "private_key": os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
                    "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
                    "client_id": os.getenv('FIREBASE_CLIENT_ID'),
                    "auth_uri": os.getenv('FIREBASE_AUTH_URI', "https://accounts.google.com/o/oauth2/auth"),
                    "token_uri": os.getenv('FIREBASE_TOKEN_URI', "https://oauth2.googleapis.com/token"),
                    "auth_provider_x509_cert_url": os.getenv('FIREBASE_AUTH_PROVIDER_X509_CERT_URL', "https://www.googleapis.com/oauth2/v1/certs"),
                    "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_X509_CERT_URL')
                }
                
                cred = credentials.Certificate(service_account)
                logger.info("Firebase initialized with service account from environment variables")
            elif os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH') and os.path.exists(os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')):
                # Check for service account JSON file
                service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
                cred = credentials.Certificate(service_account_path)
                logger.info("Firebase initialized with service account file")
            elif os.getenv('FIREBASE_SERVICE_ACCOUNT'):
                # Check for service account JSON string
                service_account = json.loads(os.getenv('FIREBASE_SERVICE_ACCOUNT'))
                cred = credentials.Certificate(service_account)
                logger.info("Firebase initialized with service account JSON from environment")
            else:
                # Use default credentials (for development/testing)
                cred = credentials.ApplicationDefault()
                logger.info("Firebase initialized with application default credentials")
            
            firebase_admin.initialize_app(cred, {
                'projectId': os.getenv('FIREBASE_PROJECT_ID', 'personalexpensetracker-ff87a'),
            })
            
        return firestore.client()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {str(e)}")
        return None

# Initialize Firebase
db = initialize_firebase()

# Cache for storing data (simple in-memory cache)
cache = {}
CACHE_DURATION = 300  # 5 minutes

# Real-time price tracking
price_subscribers = {}  # {symbol: set(session_ids)}
price_update_thread = None
price_update_running = False

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

def verify_firebase_token(token: str) -> Optional[Dict]:
    """Verify Firebase ID token and return user info"""
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        return None

def get_user_from_request() -> Optional[str]:
    """Extract and verify user ID from request headers"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split('Bearer ')[1]
    user_info = verify_firebase_token(token)
    return user_info.get('uid') if user_info else None

# Real-time price update functions
def start_price_updates():
    """Start the background thread for real-time price updates"""
    global price_update_thread, price_update_running
    
    if price_update_thread is None or not price_update_thread.is_alive():
        price_update_running = True
        price_update_thread = threading.Thread(target=price_update_worker, daemon=True)
        price_update_thread.start()
        logger.info("Price update thread started")

def stop_price_updates():
    """Stop the background thread for real-time price updates"""
    global price_update_running
    price_update_running = False
    logger.info("Price update thread stopped")

def price_update_worker():
    """Background worker to fetch and broadcast price updates"""
    global price_update_running
    
    while price_update_running:
        try:
            if price_subscribers:
                symbols = list(price_subscribers.keys())
                logger.info(f"Updating prices for {len(symbols)} symbols: {symbols}")
                
                # Batch fetch current prices
                updated_prices = {}
                for symbol in symbols:
                    try:
                        ticker = yf.Ticker(symbol)
                        hist = ticker.history(period='1d', interval='1m')
                        if len(hist) > 0:
                            current_price = float(hist['Close'].iloc[-1])
                            prev_close = float(hist['Close'].iloc[0])
                            change = current_price - prev_close
                            change_percent = (change / prev_close) * 100 if prev_close != 0 else 0
                            
                            updated_prices[symbol] = {
                                'symbol': symbol,
                                'price': round(current_price, 2),
                                'change': round(change, 2),
                                'changePercent': round(change_percent, 2),
                                'timestamp': datetime.now().isoformat()
                            }
                    except Exception as e:
                        logger.error(f"Error updating price for {symbol}: {str(e)}")
                
                # Broadcast updates
                if updated_prices:
                    socketio.emit('price_updates', updated_prices, broadcast=True)
                    logger.info(f"Broadcasted price updates for {len(updated_prices)} symbols")
            
            # Wait before next update (30 seconds for real-time feel)
            time.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in price update worker: {str(e)}")
            time.sleep(60)  # Wait longer on error

# WebSocket event handlers with authentication and rate limiting
@socketio.on('connect')
def handle_connect(auth_data=None):
    """Handle WebSocket connection with optional authentication"""
    try:
        logger.info(f"Client connecting: {request.sid}")
        
        # Check for authentication token in auth_data or query parameters
        token = None
        if auth_data and isinstance(auth_data, dict):
            token = auth_data.get('token')
        
        if not token:
            # Try to get token from query parameters
            token = request.args.get('token')
        
        user_id = None
        if token:
            try:
                user_info = verify_firebase_token(token)
                user_id = user_info.get('uid') if user_info else None
                logger.info(f"Authenticated WebSocket connection for user: {user_id}")
            except Exception as e:
                logger.warning(f"WebSocket authentication failed: {str(e)}")
        
        # Store user info in session (even if anonymous)
        session['user_id'] = user_id
        session['authenticated'] = user_id is not None
        
        emit('connected', {
            'status': 'Connected to stock price updates',
            'authenticated': session['authenticated']
        })
        
        logger.info(f"Client connected: {request.sid} (authenticated: {session['authenticated']})")
        
    except Exception as e:
        logger.error(f"Error in WebSocket connect handler: {str(e)}")
        emit('error', {'message': 'Connection failed'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info(f"Client disconnected: {request.sid}")
    # Remove from all symbol subscriptions
    for symbol in list(price_subscribers.keys()):
        if request.sid in price_subscribers[symbol]:
            price_subscribers[symbol].discard(request.sid)
            if not price_subscribers[symbol]:
                del price_subscribers[symbol]

@socketio.on('subscribe_prices')
@rate_limit('websocket')
def handle_subscribe_prices(data):
    """Subscribe to price updates for specific symbols"""
    try:
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid subscription data'})
            return
        
        symbols = data.get('symbols', [])
        
        # Validate symbols format
        if not isinstance(symbols, list) or len(symbols) == 0:
            emit('error', {'message': 'Invalid symbols list'})
            return
        
        # Limit number of symbols per subscription (prevent abuse)
        if len(symbols) > 20:
            emit('error', {'message': 'Too many symbols in subscription (max 20)'})
            return
        
        # Validate each symbol format
        import re
        symbol_pattern = re.compile(r'^[A-Z^]{1,10}$')
        valid_symbols = [s for s in symbols if isinstance(s, str) and symbol_pattern.match(s)]
        
        if len(valid_symbols) != len(symbols):
            emit('error', {'message': 'Invalid symbol format detected'})
            return
        
        logger.info(f"Client {request.sid} subscribing to: {valid_symbols}")
        
        for symbol in valid_symbols:
            if symbol not in price_subscribers:
                price_subscribers[symbol] = set()
            price_subscribers[symbol].add(request.sid)
        
        # Start price updates if not already running
        if price_subscribers and not price_update_running:
            start_price_updates()
        
        emit('subscribed', {'symbols': valid_symbols, 'status': 'Subscribed to price updates'})
        
    except Exception as e:
        logger.error(f"Error in subscribe_prices: {str(e)}")
        emit('error', {'message': 'Subscription failed'})

@socketio.on('unsubscribe_prices')
@rate_limit('websocket')
def handle_unsubscribe_prices(data):
    """Unsubscribe from price updates for specific symbols"""
    try:
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid unsubscription data'})
            return
        
        symbols = data.get('symbols', [])
        
        if not isinstance(symbols, list):
            emit('error', {'message': 'Invalid symbols list'})
            return
        
        logger.info(f"Client {request.sid} unsubscribing from: {symbols}")
        
        for symbol in symbols:
            if symbol in price_subscribers and request.sid in price_subscribers[symbol]:
                price_subscribers[symbol].discard(request.sid)
                if not price_subscribers[symbol]:
                    del price_subscribers[symbol]
        
        emit('unsubscribed', {'symbols': symbols, 'status': 'Unsubscribed from price updates'})
        
    except Exception as e:
        logger.error(f"Error in unsubscribe_prices: {str(e)}")
        emit('error', {'message': 'Unsubscription failed'})

@app.route('/health')
def health_check():
    """Health check endpoint"""
    firebase_status = "connected" if db else "disconnected"
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "firebase": firebase_status,
        "active_subscriptions": len(price_subscribers)
    })

@app.route('/api/market-indices')
@rate_limit('default')
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
@rate_limit('default')
@validate_input(ValidationSchemas.symbol)
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
@rate_limit('default')
@validate_input(ValidationSchemas.search)
def search_stocks():
    """Search stocks by symbol or name with enhanced capabilities"""
    query = request.args.get('q', '').strip().upper()
    if not query:
        return jsonify([])
    
    try:
        results = []
        
        # First, try direct symbol lookup if query looks like a symbol (3-5 chars, all caps)
        if len(query) >= 1 and len(query) <= 5 and query.isalpha():
            try:
                ticker = yf.Ticker(query)
                info = ticker.info
                hist = ticker.history(period='5d')
                
                # Check if we got valid data
                if len(hist) >= 1 and info.get('symbol'):
                    current_price = float(hist['Close'].iloc[-1])
                    prev_price = float(hist['Close'].iloc[-2]) if len(hist) >= 2 else current_price
                    change = current_price - prev_price
                    change_percent = (change / prev_price) * 100 if prev_price != 0 else 0
                    
                    results.append({
                        'symbol': query,
                        'name': info.get('longName', info.get('shortName', query)),
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
                    
                    logger.info(f"Direct symbol lookup for '{query}' successful")
                    return jsonify(results)
                    
            except Exception as e:
                logger.info(f"Direct symbol lookup for '{query}' failed: {str(e)}")
        
        # Extended popular and commonly searched symbols list
        extended_symbols = [
            # Tech Giants
            'AAPL', 'GOOGL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'ORCL',
            'CRM', 'ADBE', 'PYPL', 'INTC', 'CSCO', 'AMD', 'UBER', 'LYFT', 'ZOOM', 'SPOT',
            'SQ', 'SHOP', 'ROKU', 'TWLO', 'OKTA', 'SNOW', 'PLTR', 'RBLX', 'U', 'NET',
            
            # Traditional Blue Chips
            'JNJ', 'PG', 'KO', 'PEP', 'WMT', 'HD', 'MCD', 'DIS', 'NKE', 'V', 'MA',
            'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AXP', 'BRK.A', 'BRK.B',
            
            # Healthcare & Pharma
            'PFE', 'MRK', 'ABBV', 'TMO', 'DHR', 'ABT', 'LLY', 'UNH', 'CVS', 'AMGN',
            'GILD', 'REGN', 'VRTX', 'BIIB', 'MRNA', 'JNJ', 'BMY', 'MDT', 'SYK',
            
            # Energy & Utilities
            'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'KMI', 'OKE', 'WMB', 'NEE', 'D',
            'SO', 'DUK', 'AEP', 'EXC', 'XEL', 'WEC', 'ES', 'PEG', 'ED', 'FE',
            
            # Financial Services
            'BRK.A', 'BRK.B', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AXP', 'USB',
            'PNC', 'TFC', 'COF', 'SCHW', 'BLK', 'SPGI', 'ICE', 'CME', 'MCO',
            
            # Consumer & Retail
            'AMZN', 'WMT', 'HD', 'COST', 'TGT', 'LOW', 'SBUX', 'MCD', 'CMG', 'YUM',
            'NKE', 'LULU', 'TJX', 'ROST', 'GPS', 'M', 'ETSY', 'EBAY', 'BKNG',
            
            # Industrial & Manufacturing
            'GE', 'CAT', 'BA', 'MMM', 'HON', 'UPS', 'FDX', 'LMT', 'RTX', 'NOC',
            'GD', 'DE', 'EMR', 'ETN', 'PH', 'CMI', 'ITW', 'IR', 'ROK', 'DOV',
            
            # Materials & Chemicals
            'LIN', 'APD', 'DD', 'DOW', 'PPG', 'SHW', 'ECL', 'EMN', 'IFF', 'ALB',
            
            # Real Estate & REITs
            'PLD', 'AMT', 'CCI', 'EQIX', 'SPG', 'O', 'WELL', 'AVB', 'EQR', 'DLR',
            
            # ETFs and Popular Funds
            'SPY', 'QQQ', 'IWM', 'VTI', 'VEA', 'VWO', 'AGG', 'GLD', 'SLV', 'TLT',
            'HYG', 'LQD', 'EFA', 'EEM', 'FXI', 'EWJ', 'IEMG', 'ITOT', 'IXUS',
            
            # Emerging & Growth Stocks
            'SNOW', 'PLTR', 'RBLX', 'COIN', 'HOOD', 'AFRM', 'SQ', 'SOFI', 'UPST',
            'OPEN', 'Z', 'ZILLOW', 'REDFIN', 'CARG', 'CVNA', 'NKLA', 'LCID', 'RIVN',
            
            # Biotech & Healthcare
            'MRNA', 'BNTX', 'NVAX', 'JNJ', 'PFE', 'GILD', 'AMGN', 'CELG', 'REGN',
            'VRTX', 'BIIB', 'ILMN', 'ISRG', 'DXCM', 'ALGN', 'IDEXX', 'IDXX',
            
            # International ADRs
            'BABA', 'JD', 'PDD', 'BIDU', 'NIO', 'XPEV', 'LI', 'TSM', 'ASML', 'SAP',
            'NVO', 'NESN', 'RHHBY', 'UL', 'SNY', 'GSK', 'AZN', 'NVS', 'TM', 'HMC'
        ]
        
        # Search through extended symbols
        for symbol in extended_symbols:
            # Check if query matches symbol or is contained in symbol
            if query in symbol or symbol.startswith(query):
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    name = info.get('longName', info.get('shortName', symbol))
                    
                    # Also check if query matches part of the company name
                    if query in symbol or (name and query in name.upper()):
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
                            
                            if len(results) >= 15:  # Limit results to improve performance
                                break
                                
                except Exception as e:
                    logger.error(f"Error searching for {symbol}: {str(e)}")
                    continue
        
        # Sort results by relevance (exact symbol match first, then partial matches)
        def sort_key(stock):
            symbol = stock['symbol']
            if symbol == query:
                return 0  # Exact match
            elif symbol.startswith(query):
                return 1  # Starts with query
            else:
                return 2  # Contains query
                
        results.sort(key=sort_key)
        
        logger.info(f"Search for '{query}' returned {len(results)} results")
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error in search_stocks: {str(e)}")
        return jsonify({"error": "Search failed"}), 500

@app.route('/api/portfolio/<user_id>')
@require_auth
@rate_limit('authenticated')
@validate_input(ValidationSchemas.user_id)
def get_user_portfolio(user_id: str):
    """Get user's stock portfolio from Firestore"""
    if not db:
        return jsonify({"error": "Database connection not available"}), 500
    
    # Verify user authentication
    request_user_id = get_user_from_request()
    if not request_user_id or request_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    try:
        # Fetch portfolio holdings from Firestore
        portfolios_ref = db.collection('portfolios')
        query = portfolios_ref.where(filter=FieldFilter('userId', '==', user_id))
        holdings = query.stream()
        
        portfolio_data = []
        for holding_doc in holdings:
            holding = holding_doc.to_dict()
            try:
                symbol = holding.get('symbol')
                shares = holding.get('shares', 0)
                average_price = holding.get('averagePrice', 0)
                
                if not symbol or shares <= 0:
                    continue
                
                # Get current stock data
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period='2d')
                info = ticker.info
                
                if len(hist) < 1:
                    logger.warning(f"No price data available for {symbol}")
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                prev_price = float(hist['Close'].iloc[-2]) if len(hist) >= 2 else current_price
                change = current_price - prev_price
                change_percent = (change / prev_price) * 100 if prev_price != 0 else 0
                
                total_value = current_price * shares
                gain_loss = (current_price - average_price) * shares
                gain_loss_percent = ((current_price - average_price) / average_price) * 100 if average_price != 0 else 0
                
                portfolio_data.append({
                    'symbol': symbol,
                    'name': info.get('longName', symbol),
                    'price': round(current_price, 2),
                    'change': round(change, 2),
                    'changePercent': round(change_percent, 2),
                    'shares': shares,
                    'totalValue': round(total_value, 2),
                    'purchasePrice': average_price,
                    'gainLoss': round(gain_loss, 2),
                    'gainLossPercent': round(gain_loss_percent, 2)
                })
                
            except Exception as e:
                logger.error(f"Error processing portfolio holding {holding.get('symbol', 'unknown')}: {str(e)}")
                continue
        
        logger.info(f"Portfolio data fetched for user {user_id}: {len(portfolio_data)} holdings")
        return jsonify(portfolio_data)
        
    except Exception as e:
        logger.error(f"Error in get_user_portfolio: {str(e)}")
        return jsonify({"error": "Failed to fetch portfolio data"}), 500

# New endpoints for portfolio management
@app.route('/api/portfolio/transaction', methods=['POST'])
def execute_portfolio_transaction():
    """Execute a portfolio transaction (buy/sell)"""
    if not db:
        return jsonify({"error": "Database connection not available"}), 500
    
    # Verify user authentication
    user_id = get_user_from_request()
    if not user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    try:
        data = request.get_json()
        symbol = data.get('symbol', '').upper()
        transaction_type = data.get('type')  # 'buy' or 'sell'
        shares = int(data.get('shares', 0))
        price = float(data.get('price', 0))
        
        if not symbol or not transaction_type or shares <= 0 or price <= 0:
            return jsonify({"error": "Invalid transaction data"}), 400
        
        if transaction_type not in ['buy', 'sell']:
            return jsonify({"error": "Transaction type must be 'buy' or 'sell'"}), 400
        
        # Start a transaction
        transaction_ref = db.collection('stockTransactions').document()
        portfolio_ref = db.collection('portfolios')
        
        # Record the transaction
        transaction_data = {
            'userId': user_id,
            'symbol': symbol,
            'type': transaction_type,
            'shares': shares,
            'price': price,
            'totalValue': shares * price,
            'timestamp': datetime.now()
        }
        
        transaction_ref.set(transaction_data)
        
        # Update portfolio holdings
        portfolio_query = portfolio_ref.where(filter=FieldFilter('userId', '==', user_id)).where(filter=FieldFilter('symbol', '==', symbol))
        existing_holdings = list(portfolio_query.stream())
        
        if transaction_type == 'buy':
            if existing_holdings:
                # Update existing holding
                holding_doc = existing_holdings[0]
                holding_data = holding_doc.to_dict()
                current_shares = holding_data.get('shares', 0)
                current_avg_price = holding_data.get('averagePrice', 0)
                current_invested = holding_data.get('totalInvested', 0)
                
                new_shares = current_shares + shares
                new_invested = current_invested + (shares * price)
                new_avg_price = new_invested / new_shares
                
                holding_doc.reference.update({
                    'shares': new_shares,
                    'averagePrice': new_avg_price,
                    'totalInvested': new_invested,
                    'updatedAt': datetime.now()
                })
            else:
                # Create new holding
                new_holding = {
                    'userId': user_id,
                    'symbol': symbol,
                    'shares': shares,
                    'averagePrice': price,
                    'totalInvested': shares * price,
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
                portfolio_ref.add(new_holding)
        
        elif transaction_type == 'sell':
            if not existing_holdings:
                return jsonify({"error": "Cannot sell shares you don't own"}), 400
            
            holding_doc = existing_holdings[0]
            holding_data = holding_doc.to_dict()
            current_shares = holding_data.get('shares', 0)
            
            if current_shares < shares:
                return jsonify({"error": f"Cannot sell {shares} shares, only own {current_shares}"}), 400
            
            new_shares = current_shares - shares
            if new_shares == 0:
                # Remove holding entirely
                holding_doc.reference.delete()
            else:
                # Update holding
                current_invested = holding_data.get('totalInvested', 0)
                avg_price = holding_data.get('averagePrice', 0)
                new_invested = current_invested - (shares * avg_price)
                
                holding_doc.reference.update({
                    'shares': new_shares,
                    'totalInvested': new_invested,
                    'updatedAt': datetime.now()
                })
        
        logger.info(f"Transaction executed: {transaction_type} {shares} shares of {symbol} at ${price} for user {user_id}")
        return jsonify({"success": True, "message": f"Successfully {transaction_type} {shares} shares of {symbol}"})
        
    except Exception as e:
        logger.error(f"Error executing transaction: {str(e)}")
        return jsonify({"error": "Failed to execute transaction"}), 500

@app.route('/api/watchlist/<user_id>')
def get_user_watchlist(user_id: str):
    """Get user's stock watchlist from Firestore"""
    if not db:
        return jsonify({"error": "Database connection not available"}), 500
    
    # Verify user authentication
    request_user_id = get_user_from_request()
    if not request_user_id or request_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    try:
        watchlist_ref = db.collection('watchlists')
        query = watchlist_ref.where(filter=FieldFilter('userId', '==', user_id))
        watchlist_docs = list(query.stream())
        
        if not watchlist_docs:
            return jsonify([])
        
        watchlist_data = watchlist_docs[0].to_dict()
        symbols = watchlist_data.get('symbols', [])
        
        logger.info(f"Watchlist fetched for user {user_id}: {len(symbols)} symbols")
        return jsonify(symbols)
        
    except Exception as e:
        logger.error(f"Error fetching watchlist: {str(e)}")
        return jsonify({"error": "Failed to fetch watchlist"}), 500

@app.route('/api/watchlist/<user_id>', methods=['POST'])
def update_user_watchlist(user_id: str):
    """Update user's stock watchlist in Firestore"""
    if not db:
        return jsonify({"error": "Database connection not available"}), 500
    
    # Verify user authentication
    request_user_id = get_user_from_request()
    if not request_user_id or request_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        
        watchlist_ref = db.collection('watchlists')
        query = watchlist_ref.where(filter=FieldFilter('userId', '==', user_id))
        existing_watchlists = list(query.stream())
        
        watchlist_data = {
            'userId': user_id,
            'symbols': symbols,
            'updatedAt': datetime.now()
        }
        
        if existing_watchlists:
            # Update existing watchlist
            existing_watchlists[0].reference.update(watchlist_data)
        else:
            # Create new watchlist
            watchlist_data['createdAt'] = datetime.now()
            watchlist_ref.add(watchlist_data)
        
        logger.info(f"Watchlist updated for user {user_id}: {len(symbols)} symbols")
        return jsonify({"success": True, "message": "Watchlist updated successfully"})
        
    except Exception as e:
        logger.error(f"Error updating watchlist: {str(e)}")
        return jsonify({"error": "Failed to update watchlist"}), 500

# Additional security headers and logging for production
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response

# Apply security headers to all responses
@app.after_request
def apply_security_headers(response):
    return add_security_headers(response)

# Enhanced error handler for production security
@app.errorhandler(Exception)
def handle_exception(e):
    """Global exception handler with secure error responses"""
    # Log the full error for debugging
    logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    
    # Return generic error message to clients (don't leak internal details)
    return jsonify({
        'error': 'Internal server error occurred',
        'timestamp': datetime.now().isoformat(),
        'requestId': getattr(request, 'id', 'unknown')
    }), 500

# Additional validation for WebSocket events
def validate_websocket_data(data, required_fields=None):
    """Validate WebSocket event data"""
    if not isinstance(data, dict):
        return False, "Data must be an object"
    
    if required_fields:
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, None

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting stock service with Firebase integration and WebSocket support on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True) 