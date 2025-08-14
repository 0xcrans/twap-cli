# 🚀 TWAP Calculator CLI - Solana AMM Pool Analysis

A powerful command-line tool for calculating Time-Weighted Average Price (TWAP) and detecting price manipulation in Solana AMM pools.

## 📊 Features

- ✅ **TWAP Calculation** - Accurate time-weighted average price computation
- ✅ **Manipulation Detection** - Advanced algorithms to detect suspicious price movements
- ✅ **Risk Analysis** - Comprehensive risk assessment with confidence scoring
- ✅ **Trading Recommendations** - Actionable insights based on analysis
- ✅ **Multiple Input Methods** - JSON files, inline JSON, or interactive mode
- ✅ **Real-time Analysis** - Works with live Solana AMM pool data

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd skytrade
```

2. Make sure you have Node.js installed (v14+ recommended)

3. The CLI is ready to use - no additional dependencies required!

## 🎯 Usage

### Method 1: JSON Files (Recommended)

```bash
node twap-cli.js --pool-file pool_data.json --obs-file observations_data.json
```

### Method 2: Interactive Mode

```bash
node twap-cli.js
```
Then paste your JSON data or provide file paths when prompted.

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

## 📈 Output Analysis

The CLI provides detailed analysis including:

### TWAP Results
- **TWAP Tick**: The calculated time-weighted average tick
- **TWAP Price**: Adjusted price considering token decimals
- **Current Price**: Latest price for comparison
- **Price Difference**: Percentage difference between TWAP and current price

### Risk Analysis
- **Manipulation Risk Levels**:
  - 🟢 **LOW**: Normal market conditions
  - 🟡 **MEDIUM**: Some volatility detected
  - 🟠 **HIGH**: Potential manipulation signs
  - 🔴 **CRITICAL**: High manipulation risk detected

### Risk Factors Detected
- **EXTREME_PRICE_DIFF**: >50% price difference (possible pump/dump)
- **HIGH_PRICE_DIFF**: >30% price difference 
- **RAPID_PRICE_CHANGE**: Quick changes in short timeframes
- **TICK_SPIKE**: Sudden tick movements
- **REPETITIVE_PATTERNS**: Possible wash trading
- **INSUFFICIENT_DATA**: Not enough data for reliable analysis

### Recommendations
Based on risk level, you'll receive actionable recommendations:
- 🚨 **CRITICAL**: Do not trade, wait for stabilization
- ⚠️ **HIGH**: Trade with extreme caution, use smaller positions
- ⚡ **MEDIUM**: Consider market volatility, cross-check indicators
- ✅ **LOW**: Normal conditions, safe to trade with standard risk management

## 📋 Examples

### Example 1: Using provided sample files
```bash
node twap-cli.js --pool-file example_pool.json --obs-file example_observations.json
```

### Example 2: Interactive mode
```bash
$ node twap-cli.js
============================================================
🚀 TWAP CALCULATOR CLI - Solana AMM Pool Analysis
============================================================
📝 Interactive mode - please provide data:
You can paste JSON data or provide file paths
🏊 PoolState (JSON or file path): example_pool.json
📊 ObservationState (JSON or file path): example_observations.json
```

### Example Output
```
============================================================
🚀 TWAP CALCULATOR CLI - Solana AMM Pool Analysis
============================================================

📊 POOL INFORMATION:
Token 0 Decimals: 9
Token 1 Decimals: 6
Current Tick: -16520
Liquidity: 221871739500047

🧮 Calculating TWAP...
Found 99 valid observations
Time range: 1755187080 to 1755188942

=== TWAP RESULTS ===
TWAP Tick: -16445.502685
Raw Price: 0.193115263816
Decimal adjustment factor: 0.001
Adjusted TWAP Price: 0.00019312

=== MANIPULATION ANALYSIS ===
Price difference: 0.7477%
Manipulation risk: LOW
Confidence: 65%
Risk factors: NORMAL_MOVEMENT

=== RECOMMENDATIONS ===
✅ Normal market conditions
📈 Safe to trade with normal risk management
```

## 🧮 How TWAP is Calculated

The CLI uses the standard TWAP formula for AMM pools:

1. **Filter valid observations** (timestamp > 0)
2. **Calculate tick difference**: `newest_tick_cumulative - oldest_tick_cumulative`
3. **Calculate time difference**: `newest_timestamp - oldest_timestamp`
4. **TWAP Tick**: `tick_difference / time_difference`
5. **Convert to price**: `price = 1.0001^twap_tick`
6. **Adjust for decimals**: `adjusted_price = price * 10^(decimals1 - decimals0)`

## 🔧 Configuration

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--pool-file <path>` | Path to PoolState JSON file | `--pool-file pool.json` |
| `--obs-file <path>` | Path to ObservationState JSON file | `--obs-file obs.json` |
| `--pool-json <json>` | PoolState as JSON string | `--pool-json '{...}'` |
| `--obs-json <json>` | ObservationState as JSON string | `--obs-json '{...}'` |
| `--help, -h` | Show help message | `--help` |

## ⚠️ Important Notes

1. **Minimum Data Requirements**: At least 2 valid observations with timestamps > 0
2. **Time Period**: Longer observation periods provide more reliable TWAP calculations
3. **Market Conditions**: Consider overall market volatility when interpreting results
4. **Risk Management**: Always use appropriate position sizing regardless of analysis

## 🔍 Troubleshooting

### Common Issues

**Error: "Missing required field in PoolState"**
- Ensure your PoolState JSON includes `tick_current`, `mint_decimals_0`, and `mint_decimals_1`

**Error: "Need at least 2 valid observations"**
- Check that your ObservationState has observations with `block_timestamp > 0`

**Error: "File not found"**
- Verify file paths are correct and files exist

**Error: "Error parsing JSON"**
- Validate your JSON syntax using a JSON validator

## 📚 Technical Details

### Files Structure
```
skytrade/
├── twap-cli.js           # Main CLI application
├── twap_calculator.js    # Core TWAP calculation logic
├── example_pool.json     # Sample PoolState data
├── example_observations.json # Sample ObservationState data
└── README.md            # This file
```

### Core Functions
- `calculateTWAPCLI()`: Main TWAP calculation with CLI output
- `detectManipulation()`: Risk analysis and manipulation detection
- `validatePoolState()`: PoolState data validation
- `validateObservationState()`: ObservationState data validation

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the TWAP Calculator CLI.

## 📄 License

This project is open source. Please check the license file for details.

---

**⚡ Built for Solana DeFi traders and developers**

For questions or support, please open an issue in the repository.
