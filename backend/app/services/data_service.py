import pandas as pd
import requests
from datetime import datetime

def get_ohlcv(symbol: str, interval: str, limit: int = 365):
    """
    Récupère les données OHLCV depuis Binance et retourne un DataFrame propre.
    Critère B-03 : DataFrame avec colonnes open/high/low/close/volume/timestamp[cite: 29].
    """
    url = "https://api.binance.com/api/v3/klines"
    params = {
        'symbol': symbol,
        'interval': interval,
        'limit': limit
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        return f"Erreur API: {response.status_code}"

    # Transformation des données en DataFrame
    data = response.json()
    df = pd.DataFrame(data, columns=[
        'timestamp', 'open', 'high', 'low', 'close', 'volume',
        'close_time', 'quote_asset_volume', 'number_of_trades',
        'taker_buy_base_asset_volume', 'taker_buy_quote_asset_volume', 'ignore'
    ])

    # Nettoyage selon tes critères (UTC et colonnes spécifiques) [cite: 29]
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms', utc=True).dt.as_unit('ns')
    cols_to_keep = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
    df = df[cols_to_keep]
    
    # Conversion des prix en nombres (Binance renvoie des strings)
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col])
        
    return df

# Test rapide
if __name__ == "__main__":
    print(get_ohlcv('BTCUSDT', '1d', 5))