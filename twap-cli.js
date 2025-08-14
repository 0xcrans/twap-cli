#!/usr/bin/env node

// TWAP CLI - Universal Time-Weighted Average Price Calculator
// Usage: node twap-cli.js [options]
// Author: Paul Koala

const fs = require('fs');
const path = require('path');

// Import only the detection function, we'll implement our own TWAP calc to avoid the hardcoded data
const { detectManipulation } = require('./twap_calculator');



function parseArguments() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--pool-file':
                options.poolFile = args[++i];
                break;
            case '--obs-file':
                options.obsFile = args[++i];
                break;
            case '--pool-json':
                options.poolJson = args[++i];
                break;
            case '--obs-json':
                options.obsJson = args[++i];
                break;
            case '--interactive':
            case '-i':
                options.interactive = true;
                break;
            default:
                console.error(`Unknown option: ${args[i]}`);
                process.exit(1);
        }
    }
    
    return options;
}

function loadFromFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`❌ Error loading file ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

function validatePoolState(poolState) {
    const required = ['tick_current', 'mint_decimals_0', 'mint_decimals_1'];
    
    for (const field of required) {
        if (!poolState[field] || poolState[field].data === undefined) {
            throw new Error(`Missing required field in PoolState: ${field}`);
        }
    }
    
    return true;
}

function validateObservationState(obsState) {
    if (!obsState.observations || !obsState.observations.data || !Array.isArray(obsState.observations.data)) {
        throw new Error('Invalid ObservationState: missing observations.data array');
    }
    
    const validObs = obsState.observations.data.filter(obs => obs.block_timestamp > 0);
    if (validObs.length < 2) {
        throw new Error('Need at least 2 valid observations with timestamps > 0');
    }
    
    return true;
}

async function promptForData() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        console.log('📝 Interactive mode - please provide data:');
        console.log('You can paste JSON data or provide file paths');
        
        rl.question('🏊 PoolState (JSON or file path): ', (poolInput) => {
            rl.question('📊 ObservationState (JSON or file path): ', (obsInput) => {
                rl.close();
                
                let poolState, obsState;
                
                try {
                    // Try to parse as JSON first, then as file path
                    try {
                        poolState = JSON.parse(poolInput);
                    } catch {
                        poolState = loadFromFile(poolInput);
                    }
                    
                    try {
                        obsState = JSON.parse(obsInput);
                    } catch {
                        obsState = loadFromFile(obsInput);
                    }
                    
                    resolve({ poolState, obsState });
                } catch (error) {
                    console.error(`❌ Error parsing input: ${error.message}`);
                    process.exit(1);
                }
            });
        });
    });
}

function printHeader() {
    console.log('='.repeat(60));
    console.log('🚀 TWAP CALCULATOR CLI - Solana AMM Pool Analysis');
    console.log('='.repeat(60));
}

function printPoolInfo(poolState) {
    console.log('\n📊 POOL INFORMATION:');
    console.log(`Token 0 Decimals: ${poolState.mint_decimals_0?.data || 'N/A'}`);
    console.log(`Token 1 Decimals: ${poolState.mint_decimals_1?.data || 'N/A'}`);
    console.log(`Current Tick: ${poolState.tick_current?.data || 'N/A'}`);
    console.log(`Liquidity: ${poolState.liquidity?.data || 'N/A'}`);
    
    if (poolState.token_mint_0?.data && poolState.token_mint_1?.data) {
        console.log(`Token 0 Mint: ${poolState.token_mint_0.data}`);
        console.log(`Token 1 Mint: ${poolState.token_mint_1.data}`);
    }
}

async function main() {
    try {
        const options = parseArguments();
        
        printHeader();
        
        let poolState, obsState;
        
        // Determine how to get the data
        if (options.poolFile && options.obsFile) {
            console.log('📁 Loading data from files...');
            poolState = loadFromFile(options.poolFile);
            obsState = loadFromFile(options.obsFile);
        } else if (options.poolJson && options.obsJson) {
            console.log('📝 Parsing JSON data...');
            try {
                poolState = JSON.parse(options.poolJson);
                obsState = JSON.parse(options.obsJson);
            } catch (error) {
                console.error(`❌ Error parsing JSON: ${error.message}`);
                process.exit(1);
            }
        } else if (options.interactive || Object.keys(options).length === 0) {
            const data = await promptForData();
            poolState = data.poolState;
            obsState = data.obsState;
        } else {
            console.error('❌ Please provide both pool and observation data');
            process.exit(1);
        }
        
        // Validate data
        console.log('✅ Validating data...');
        validatePoolState(poolState);
        validateObservationState(obsState);
        
        // Print pool info
        printPoolInfo(poolState);
        
        // Calculate TWAP with our existing function
        console.log('\n🧮 Calculating TWAP...');
        const result = calculateTWAPCLI(poolState, obsState);
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📈 ANALYSIS COMPLETE');
        console.log('='.repeat(60));
        console.log(`✅ TWAP calculated successfully`);
        console.log(`📊 Risk level: ${result.manipulationAnalysis.level}`);
        console.log(`🎯 Confidence: ${result.manipulationAnalysis.confidence}%`);
        
        if (result.manipulationAnalysis.level !== 'LOW') {
            console.log(`⚠️  Action required: Check manipulation analysis above`);
        }
        
    } catch (error) {
        console.error(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Modified TWAP calculation for CLI (without hardcoded data)
function calculateTWAPCLI(poolState, observationState) {
    const observations = observationState.observations.data;
    const currentTick = poolState.tick_current.data;
    
    // Filter out observations with timestamp 0 (empty slots)
    const validObservations = observations.filter(obs => obs.block_timestamp > 0);
    
    // Sort observations by timestamp
    validObservations.sort((a, b) => a.block_timestamp - b.block_timestamp);
    
    console.log(`Found ${validObservations.length} valid observations`);
    console.log(`Time range: ${validObservations[0].block_timestamp} to ${validObservations[validObservations.length - 1].block_timestamp}`);
    
    if (validObservations.length < 2) {
        throw new Error("Need at least 2 observations to calculate TWAP");
    }
    
    // Calculate TWAP using tick cumulative values
    const oldestObs = validObservations[0];
    const newestObs = validObservations[validObservations.length - 1];
    
    const timeDiff = newestObs.block_timestamp - oldestObs.block_timestamp;
    const tickCumulativeDiff = parseInt(newestObs.tick_cumulative) - parseInt(oldestObs.tick_cumulative);
    
    const twapTick = tickCumulativeDiff / timeDiff;
    
    console.log(`Oldest observation: timestamp=${oldestObs.block_timestamp}, tick_cumulative=${oldestObs.tick_cumulative}`);
    console.log(`Newest observation: timestamp=${newestObs.block_timestamp}, tick_cumulative=${newestObs.tick_cumulative}`);
    console.log(`Time difference: ${timeDiff} seconds (${(timeDiff / 3600).toFixed(2)} hours)`);
    console.log(`Tick cumulative difference: ${tickCumulativeDiff}`);
    console.log(`TWAP tick: ${twapTick.toFixed(6)}`);
    
    // Convert tick to price
    const price = Math.pow(1.0001, twapTick);
    
    // Adjust for decimal differences
    const decimals0 = poolState.mint_decimals_0.data;
    const decimals1 = poolState.mint_decimals_1.data;
    const decimalAdjustment = Math.pow(10, decimals1 - decimals0);
    
    const adjustedPrice = price * decimalAdjustment;
    
    console.log(`\n=== TWAP RESULTS ===`);
    console.log(`TWAP Tick: ${twapTick.toFixed(6)}`);
    console.log(`Raw Price: ${price.toFixed(12)}`);
    console.log(`Decimal adjustment factor: ${decimalAdjustment} (decimals0=${decimals0}, decimals1=${decimals1})`);
    console.log(`Adjusted TWAP Price: ${adjustedPrice.toFixed(8)}`);
    
    // Current price for comparison
    const currentPrice = Math.pow(1.0001, currentTick) * decimalAdjustment;
    console.log(`Current Price (for comparison): ${currentPrice.toFixed(8)}`);
    console.log(`Price difference: ${((adjustedPrice - currentPrice) / currentPrice * 100).toFixed(4)}%`);
    
    // Manipulation detection
    const priceDiffPercent = Math.abs((adjustedPrice - currentPrice) / currentPrice * 100);
    const manipulationRisk = detectManipulation(priceDiffPercent, timeDiff / 3600, validObservations);
    
    console.log(`\n=== MANIPULATION ANALYSIS ===`);
    console.log(`Price difference: ${priceDiffPercent.toFixed(4)}%`);
    console.log(`Manipulation risk: ${manipulationRisk.level}`);
    console.log(`Confidence: ${manipulationRisk.confidence}%`);
    console.log(`Risk factors: ${manipulationRisk.factors.join(', ')}`);
    if (manipulationRisk.warning) {
        console.log(`⚠️  WARNING: ${manipulationRisk.warning}`);
    }
    
    console.log(`\n=== RECOMMENDATIONS ===`);
    manipulationRisk.recommendations.forEach(rec => console.log(rec));

    return {
        twapTick: twapTick,
        twapPrice: adjustedPrice,
        currentPrice: currentPrice,
        timePeriodHours: timeDiff / 3600,
        observationCount: validObservations.length,
        priceDifferencePercent: priceDiffPercent,
        manipulationAnalysis: manipulationRisk
    };
}

// Run the CLI
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { calculateTWAPCLI, validatePoolState, validateObservationState };
