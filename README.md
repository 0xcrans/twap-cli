# 🚀 TWAP Calculator CLI - Solana AMM Pool Analysis

## How To Use

### Method 1: JSON Files

```bash
node twap-cli.js --pool-file pool_data.json --obs-file observations_data.json
```

### Method 2: Interactive Mode

```bash
node twap-cli.js
```
Follow the rabbit

### Method 3: Inline JSON

```bash
node twap-cli.js --pool-json '{"tick_current":{"data":-16520},...}' --obs-json '{"observations":{"data":[...]}}'
```

### Help

```bash
node twap-cli.js --help
```

## 📁 Data Format

### PoolState JSON Structure

Your pool data should include:
```json
{
  "tick_current": {"data": -16520},
  "mint_decimals_0": {"data": 9},
  "mint_decimals_1": {"data": 6},
  "liquidity": {"data": "221871739500047"},
  "token_mint_0": {"data": "So11111111111111111111111111111111111111112"},
  "token_mint_1": {"data": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
}
```

### ObservationState JSON Structure

Your observation data should include:
```json
{
  "observations": {
    "data": [
      {
        "block_timestamp": 1755188764,
        "tick_cumulative": "-576729025280"
      }
    ]
  }
}
```

## 📈 Output

### TWAP Results
- **TWAP Tick**: The calculated time-weighted average tick
- **TWAP Price**: Adjusted price considering token decimals
- **Current Price**: Latest price for comparison
- **Price Difference**: Percentage difference between TWAP and current price

### Risk Factors Detected
- **EXTREME_PRICE_DIFF**: >50% price difference (possible pump/dump)
- **HIGH_PRICE_DIFF**: >30% price difference 
- **RAPID_PRICE_CHANGE**: Quick changes in short timeframes
- **TICK_SPIKE**: Sudden tick movements
- **REPETITIVE_PATTERNS**: Possible wash trading
- **INSUFFICIENT_DATA**: Not enough data for reliable analysis




