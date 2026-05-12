from app.services.data_service import get_ohlcv

def test_binance_data():
    df = get_ohlcv('BTCUSDT', '1d', 10)
    
    if df is None:
        print("❌ ÉCHEC : Aucune donnée reçue")
        return

    # Vérification des colonnes (Critère B-03)
    expected_cols = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
    if all(col in df.columns for col in expected_cols):
        print("✅ Colonnes : OK")
    else:
        print(f"❌ Colonnes : Erreur (Trouvées: {df.columns})")

    # Vérification du format (Critère B-03)
    if str(df['timestamp'].dtype) == 'datetime64[ns, UTC]':
        print("✅ Format Timestamp : OK (UTC)")
    else:
        print(f"❌ Format Timestamp : Erreur ({df['timestamp'].dtype})")

    # Vérification des types numériques
    if df['close'].dtype == 'float64':
        print("✅ Types numériques : OK")
    
    print("\n--- Aperçu des données ---")
    print(df.head())

if __name__ == "__main__":
    test_binance_data()