// TWAP Calculator for Solana AMM Pool
// Calculates Time-Weighted Average Price from PoolState and ObservationState data

function detectManipulation(priceDiffPercent, timePeriodHours, observations) {
    const factors = [];
    let riskLevel = "LOW";
    let warning = null;
    
    // Factor 1: Extreme price difference
    if (priceDiffPercent > 50) {
        factors.push("EXTREME_PRICE_DIFF");
        riskLevel = "CRITICAL";
        warning = "Extreme price difference detected! Possible pump/dump or flash loan attack";
    } else if (priceDiffPercent > 30) {
        factors.push("HIGH_PRICE_DIFF");
        riskLevel = "HIGH";
        warning = "Very high price difference - investigate for manipulation";
    } else if (priceDiffPercent > 15) {
        factors.push("MODERATE_PRICE_DIFF");
        riskLevel = "MEDIUM";
    }
    
    // Factor 2: Short time period with big changes
    if (timePeriodHours < 1 && priceDiffPercent > 20) {
        factors.push("RAPID_PRICE_CHANGE");
        if (riskLevel === "LOW") riskLevel = "HIGH";
        warning = warning || "Rapid price change in short timeframe - possible manipulation";
    }
    
    // Factor 3: Analysis of tick movements pattern
    const tickMovements = [];
    for (let i = 1; i < observations.length; i++) {
        const timeDiff = observations[i].block_timestamp - observations[i-1].block_timestamp;
        const tickDiff = parseInt(observations[i].tick_cumulative) - parseInt(observations[i-1].tick_cumulative);
        if (timeDiff > 0) {
            tickMovements.push(tickDiff / timeDiff);
        }
    }
    
    // Check for suspicious patterns
    const avgTickMovement = tickMovements.reduce((a, b) => a + b, 0) / tickMovements.length;
    const maxMovement = Math.max(...tickMovements.map(m => Math.abs(m)));
    const minMovement = Math.min(...tickMovements.map(m => Math.abs(m)));
    
    // Detect sudden spikes
    if (maxMovement > Math.abs(avgTickMovement) * 10) {
        factors.push("TICK_SPIKE");
        if (riskLevel === "LOW" || riskLevel === "MEDIUM") riskLevel = "HIGH";
    }
    
    // Factor 4: Very short observation window
    if (timePeriodHours < 0.1) { // Less than 6 minutes
        factors.push("INSUFFICIENT_DATA");
        warning = warning || "Very short observation period - results may not be reliable";
    }
    
    // Factor 5: Check for wash trading indicators (repetitive patterns)
    const tickCumulatives = observations.map(obs => parseInt(obs.tick_cumulative));
    const uniqueRatios = new Set();
    for (let i = 1; i < tickCumulatives.length; i++) {
        const ratio = Math.round((tickCumulatives[i] - tickCumulatives[i-1]) * 1000);
        uniqueRatios.add(ratio);
    }
    
    // If too many repetitive patterns
    if (uniqueRatios.size < observations.length * 0.3) {
        factors.push("REPETITIVE_PATTERNS");
        if (riskLevel === "LOW") riskLevel = "MEDIUM";
    }
    
    // No factors found = legitimate movement
    if (factors.length === 0) {
        factors.push("NORMAL_MOVEMENT");
    }
    
    return {
        level: riskLevel,
        factors: factors,
        warning: warning,
        confidence: calculateConfidence(factors, timePeriodHours),
        recommendations: getRecommendations(riskLevel, factors)
    };
}

function calculateConfidence(factors, timePeriodHours) {
    let confidence = 50; // Base confidence
    
    if (timePeriodHours > 1) confidence += 20;
    if (timePeriodHours > 6) confidence += 15;
    if (factors.includes("NORMAL_MOVEMENT")) confidence += 15;
    if (factors.includes("EXTREME_PRICE_DIFF")) confidence += 25;
    if (factors.includes("INSUFFICIENT_DATA")) confidence -= 30;
    
    return Math.min(Math.max(confidence, 0), 100);
}

function getRecommendations(riskLevel, factors) {
    const recommendations = [];
    
    switch(riskLevel) {
        case "CRITICAL":
            recommendations.push("🚨 DO NOT TRADE - High manipulation risk");
            recommendations.push("📊 Wait for market stabilization");
            recommendations.push("🔍 Investigate recent transactions");
            break;
        case "HIGH":
            recommendations.push("⚠️ Trade with extreme caution");
            recommendations.push("📈 Use smaller position sizes");
            recommendations.push("⏰ Wait for longer observation period");
            break;
        case "MEDIUM":
            recommendations.push("⚡ Consider market volatility");
            recommendations.push("📊 Cross-check with other indicators");
            break;
        case "LOW":
            recommendations.push("✅ Normal market conditions");
            recommendations.push("📈 Safe to trade with normal risk management");
            break;
    }
    
    if (factors.includes("INSUFFICIENT_DATA")) {
        recommendations.push("⏱️ Collect more historical data");
    }
    
    return recommendations;
}

function calculateTWAP(poolState, observationState) {
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
    // Price = 1.0001^tick (for token0/token1)
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

// Your pool and observation data
const poolState = {"bump":{"type":{"array":["u8",1]},"data":[255]},"amm_config":{"type":"pubkey","data":"3h2e43PunVA5K34vwKCLHWhZF4aZpyaC9RmxvshGAQpL"},"owner":{"type":"pubkey","data":"CJKrW95iMGECdjWtdDnWDAx2cBH7pFE9VywnULfwMapf"},"token_mint_0":{"type":"pubkey","data":"So11111111111111111111111111111111111111112"},"token_mint_1":{"type":"pubkey","data":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},"token_vault_0":{"type":"pubkey","data":"4ct7br2vTPzfdmY3S5HLtTxcGSBfn6pnw98hsS6v359A"},"token_vault_1":{"type":"pubkey","data":"5it83u57VRrVgc51oNV19TTmAJuffPx5GtGwQr7gQNUo"},"observation_key":{"type":"pubkey","data":"3Y695CuQ8AP4anbwAqiEBeQF9KxqHFr8piEwvw3UePnQ"},"mint_decimals_0":{"type":"u8","data":9},"mint_decimals_1":{"type":"u8","data":6},"tick_spacing":{"type":"u16","data":"1"},"liquidity":{"type":"u128","data":"221871739500047"},"sqrt_price_x64":{"type":"u128","data":"8076501978988086272"},"tick_current":{"type":"i32","data":"-16520"},"padding3":{"type":"u16","data":"0"},"padding4":{"type":"u16","data":"0"},"fee_growth_global_0_x64":{"type":"u128","data":"3381721419088572096"},"fee_growth_global_1_x64":{"type":"u128","data":"590790291031117588"},"protocol_fees_token_0":{"type":"u64","data":"231494397"},"protocol_fees_token_1":{"type":"u64","data":"32524126"},"swap_in_amount_token_0":{"type":"u128","data":"41507672950621760"},"swap_out_amount_token_1":{"type":"u128","data":"6586181125219725"},"swap_in_amount_token_1":{"type":"u128","data":"6609195825838900"},"swap_out_amount_token_0":{"type":"u128","data":"41623942746970359"},"status":{"type":"u8","data":0},"padding":{"type":{"array":["u8",7]},"data":[0,0,0,0,0,0,0]},"reward_infos":{"type":{"array":[{"defined":{"name":"RewardInfo"}},3]},"data":[{"reward_state":2,"open_time":"1753396200","end_time":"1756420200","last_update_time":"1755188956","emissions_per_second_x64":"30500568904943041694000","reward_total_emissioned":"34969927792","reward_claimed":"34354403137","token_mint":"4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R","token_vault":"HsBUudV9Y2Z2dJTieWFgK3zhrpX4ELvnfHcAwSBVqDGX","authority":"NCV2Uo3hfW5LSZXAJe19y6SpC5K98PuQwShCSZgTki3","reward_growth_global_x64":"116064167743426412"},{"reward_state":0,"open_time":"0","end_time":"0","last_update_time":"0","emissions_per_second_x64":"0","reward_total_emissioned":"0","reward_claimed":"0","token_mint":"11111111111111111111111111111111","token_vault":"11111111111111111111111111111111","authority":"CJKrW95iMGECdjWtdDnWDAx2cBH7pFE9VywnULfwMapf","reward_growth_global_x64":"0"},{"reward_state":0,"open_time":"0","end_time":"0","last_update_time":"0","emissions_per_second_x64":"0","reward_total_emissioned":"0","reward_claimed":"0","token_mint":"11111111111111111111111111111111","token_vault":"11111111111111111111111111111111","authority":"CJKrW95iMGECdjWtdDnWDAx2cBH7pFE9VywnULfwMapf","reward_growth_global_x64":"0"}]},"tick_array_bitmap":{"type":{"array":["u64",16]},"data":["13233894920445562880","18443928426009067443","18446744073709551615","18446744073709551615","18446744073709551615","328774602847582695","72070788177467936","1075839120","1073807377","72057594037927936","0","0","0","0","0","0"]},"total_fees_token_0":{"type":"u64","data":"13946585844508"},"total_fees_claimed_token_0":{"type":"u64","data":"13471786454134"},"total_fees_token_1":{"type":"u64","data":"2220696868964"},"total_fees_claimed_token_1":{"type":"u64","data":"2134158380589"},"fund_fees_token_0":{"type":"u64","data":"2292304"},"fund_fees_token_1":{"type":"u64","data":"185648"},"open_time":{"type":"u64","data":"1723037622"},"recent_epoch":{"type":"u64","data":"833"},"padding1":{"type":{"array":["u64",24]},"data":["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]},"padding2":{"type":{"array":["u64",32]},"data":["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]}};

const observationState = {"initialized":{"type":"bool","data":true},"recent_epoch":{"type":"u64","data":"653"},"observation_index":{"type":"u16","data":"11"},"pool_id":{"type":"pubkey","data":"3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv"},"observations":{"type":{"array":[{"defined":{"name":"Observation"}},100]},"data":[{"block_timestamp":1755188764,"tick_cumulative":"-576729025280","padding":["0","0","0","0"]},{"block_timestamp":1755188780,"tick_cumulative":"-576729289136","padding":["0","0","0","0"]},{"block_timestamp":1755188801,"tick_cumulative":"-576729635762","padding":["0","0","0","0"]},{"block_timestamp":1755188816,"tick_cumulative":"-576729883667","padding":["0","0","0","0"]},{"block_timestamp":1755188831,"tick_cumulative":"-576730131752","padding":["0","0","0","0"]},{"block_timestamp":1755188846,"tick_cumulative":"-576730380017","padding":["0","0","0","0"]},{"block_timestamp":1755188861,"tick_cumulative":"-576730627997","padding":["0","0","0","0"]},{"block_timestamp":1755188877,"tick_cumulative":"-576730892493","padding":["0","0","0","0"]},{"block_timestamp":1755188894,"tick_cumulative":"-576731173520","padding":["0","0","0","0"]},{"block_timestamp":1755188912,"tick_cumulative":"-576731471006","padding":["0","0","0","0"]},{"block_timestamp":1755188927,"tick_cumulative":"-576731718956","padding":["0","0","0","0"]},{"block_timestamp":1755188942,"tick_cumulative":"-576731966831","padding":["0","0","0","0"]},{"block_timestamp":1755187080,"tick_cumulative":"-576701345305","padding":["0","0","0","0"]},{"block_timestamp":1755187104,"tick_cumulative":"-576701737537","padding":["0","0","0","0"]},{"block_timestamp":1755187140,"tick_cumulative":"-576702325957","padding":["0","0","0","0"]},{"block_timestamp":1755187157,"tick_cumulative":"-576702603754","padding":["0","0","0","0"]},{"block_timestamp":1755187200,"tick_cumulative":"-576703306761","padding":["0","0","0","0"]},{"block_timestamp":1755187215,"tick_cumulative":"-576703552056","padding":["0","0","0","0"]},{"block_timestamp":1755187239,"tick_cumulative":"-576703944552","padding":["0","0","0","0"]},{"block_timestamp":1755187256,"tick_cumulative":"-576704222672","padding":["0","0","0","0"]},{"block_timestamp":1755187271,"tick_cumulative":"-576704467967","padding":["0","0","0","0"]},{"block_timestamp":1755187287,"tick_cumulative":"-576704729535","padding":["0","0","0","0"]},{"block_timestamp":1755187322,"tick_cumulative":"-576705301820","padding":["0","0","0","0"]},{"block_timestamp":1755187337,"tick_cumulative":"-576705547085","padding":["0","0","0","0"]},{"b_timestamp":1755187352,"tick_cumulative":"-576705792470","padding":["0","0","0","0"]},{"block_timestamp":1755187367,"tick_cumulative":"-576706037870","padding":["0","0","0","0"]},{"block_timestamp":1755187401,"tick_cumulative":"-576706593906","padding":["0","0","0","0"]},{"block_timestamp":1755187437,"tick_cumulative":"-576707182902","padding":["0","0","0","0"]},{"block_timestamp":1755187453,"tick_cumulative":"-576707444646","padding":["0","0","0","0"]},{"block_timestamp":1755187488,"tick_cumulative":"-576708017246","padding":["0","0","0","0"]},{"block_timestamp":1755187503,"tick_cumulative":"-576708262961","padding":["0","0","0","0"]},{"block_timestamp":1755187518,"tick_cumulative":"-576708508826","padding":["0","0","0","0"]},{"block_timestamp":1755187534,"tick_cumulative":"-576708771098","padding":["0","0","0","0"]},{"block_timestamp":1755187549,"tick_cumulative":"-576709017173","padding":["0","0","0","0"]},{"block_timestamp":1755187565,"tick_cumulative":"-576709279781","padding":["0","0","0","0"]},{"block_timestamp":1755187580,"tick_cumulative":"-576709526141","padding":["0","0","0","0"]},{"block_timestamp":1755187595,"tick_cumulative":"-576709772276","padding":["0","0","0","0"]},{"block_timestamp":1755187612,"tick_cumulative":"-576710051212","padding":["0","0","0","0"]},{"block_timestamp":1755187627,"tick_cumulative":"-576710297092","padding":["0","0","0","0"]},{"block_timestamp":1755187651,"tick_cumulative":"-576710690644","padding":["0","0","0","0"]},{"block_timestamp":1755187668,"tick_cumulative":"-576710969682","padding":["0","0","0","0"]},{"block_timestamp":1755187683,"tick_cumulative":"-576711216072","padding":["0","0","0","0"]},{"block_timestamp":1755187702,"tick_cumulative":"-576711528223","padding":["0","0","0","0"]},{"block_timestamp":1755187717,"tick_cumulative":"-576711774643","padding":["0","0","0","0"]},{"block_timestamp":1755187735,"tick_cumulative":"-576712070275","padding":["0","0","0","0"]},{"block_timestamp":1755187752,"tick_cumulative":"-576712349653","padding":["0","0","0","0"]},{"block_timestamp":1755187768,"tick_cumulative":"-576712612501","padding":["0","0","0","0"]},{"block_timestamp":1755187783,"tick_cumulative":"-576712859011","padding":["0","0","0","0"]},{"block_timestamp":1755187802,"tick_cumulative":"-576713171257","padding":["0","0","0","0"]},{"block_timestamp":1755187820,"tick_cumulative":"-576713466961","padding":["0","0","0","0"]},{"block_timestamp":1755187835,"tick_cumulative":"-576713713681","padding":["0","0","0","0"]},{"block_timestamp":1755187852,"tick_cumulative":"-576713993399","padding":["0","0","0","0"]},{"block_timestamp":1755187867,"tick_cumulative":"-576714240164","padding":["0","0","0","0"]},{"block_timestamp":1755187882,"tick_cumulative":"-576714486899","padding":["0","0","0","0"]},{"block_timestamp":1755187899,"tick_cumulative":"-576714766600","padding":["0","0","0","0"]},{"block_timestamp":1755187925,"tick_cumulative":"-576715194456","padding":["0","0","0","0"]},{"block_timestamp":1755187942,"tick_cumulative":"-576715474123","padding":["0","0","0","0"]},{"block_timestamp":1755187957,"tick_cumulative":"-576715720978","padding":["0","0","0","0"]},{"block_timestamp":1755187975,"tick_cumulative":"-576716017204","padding":["0","0","0","0"]},{"block_timestamp":1755187991,"tick_cumulative":"-576716280692","padding":["0","0","0","0"]},{"block_timestamp":1755188018,"tick_cumulative":"-576716725436","padding":["0","0","0","0"]},{"block_timestamp":1755188038,"tick_cumulative":"-576717055016","padding":["0","0","0","0"]},{"block_timestamp":1755188059,"tick_cumulative":"-576717401075","padding":["0","0","0","0"]},{"block_timestamp":1755188076,"tick_cumulative":"-576717681320","padding":["0","0","0","0"]},{"block_timestamp":1755188098,"tick_cumulative":"-576718044100","padding":["0","0","0","0"]},{"block_timestamp":1755188114,"tick_cumulative":"-576718308340","padding":["0","0","0","0"]},{"block_timestamp":1755188129,"tick_cumulative":"-576718555705","padding":["0","0","0","0"]},{"block_timestamp":1755188144,"tick_cumulative":"-576718803460","padding":["0","0","0","0"]},{"block_timestamp":1755188160,"tick_cumulative":"-576719067748","padding":["0","0","0","0"]},{"block_timestamp":1755188175,"tick_cumulative":"-576719315788","padding":["0","0","0","0"]},{"block_timestamp":1755188196,"tick_cumulative":"-576719662834","padding":["0","0","0","0"]},{"block_timestamp":1755188211,"tick_cumulative":"-576719910799","padding":["0","0","0","0"]},{"block_timestamp":1755188226,"tick_cumulative":"-576720158374","padding":["0","0","0","0"]},{"block_timestamp":1755188241,"tick_cumulative":"-576720405799","padding":["0","0","0","0"]},{"block_timestamp":1755188256,"tick_cumulative":"-576720653044","padding":["0","0","0","0"]},{"block_timestamp":1755188271,"tick_cumulative":"-576720900289","padding":["0","0","0","0"]},{"block_timestamp":1755188288,"tick_cumulative":"-576721180364","padding":["0","0","0","0"]},{"block_timestamp":1755188305,"tick_cumulative":"-576721460439","padding":["0","0","0","0"]},{"block_timestamp":1755188325,"tick_cumulative":"-576721790119","padding":["0","0","0","0"]},{"block_timestamp":1755188340,"tick_cumulative":"-576722037364","padding":["0","0","0","0"]},{"block_timestamp":1755188362,"tick_cumulative":"-576722399770","padding":["0","0","0","0"]},{"block_timestamp":1755188377,"tick_cumulative":"-576722647000","padding":["0","0","0","0"]},{"block_timestamp":1755188404,"tick_cumulative":"-576723092365","padding":["0","0","0","0"]},{"block_timestamp":1755188421,"tick_cumulative":"-576723372627","padding":["0","0","0","0"]},{"block_timestamp":1755188437,"tick_cumulative":"-576723636371","padding":["0","0","0","0"]},{"block_timestamp":1755188470,"tick_cumulative":"-576724180178","padding":["0","0","0","0"]},{"block_timestamp":1755188486,"tick_cumulative":"-576724443810","padding":["0","0","0","0"]},{"block_timestamp":1755188501,"tick_cumulative":"-576724690695","padding":["0","0","0","0"]},{"block_timestamp":1755188517,"tick_cumulative":"-576724954039","padding":["0","0","0","0"]},{"block_timestamp":1755188534,"tick_cumulative":"-576725234012","padding":["0","0","0","0"]},{"block_timestamp":1755188565,"tick_cumulative":"-576725744520","padding":["0","0","0","0"]},{"block_timestamp":1755188590,"tick_cumulative":"-576726156295","padding":["0","0","0","0"]},{"block_timestamp":1755188606,"tick_cumulative":"-576726420087","padding":["0","0","0","0"]},{"block_timestamp":1755188625,"tick_cumulative":"-576726733473","padding":["0","0","0","0"]},{"block_timestamp":1755188646,"tick_cumulative":"-576727079868","padding":["0","0","0","0"]},{"block_timestamp":1755188664,"tick_cumulative":"-576727376760","padding":["0","0","0","0"]},{"block_timestamp":1755188682,"tick_cumulative":"-576727673526","padding":["0","0","0","0"]},{"block_timestamp":1755188700,"tick_cumulative":"-576727970202","padding":["0","0","0","0"]},{"block_timestamp":1755188719,"tick_cumulative":"-576728283474","padding":["0","0","0","0"]},{"block_timestamp":1755188741,"tick_cumulative":"-576728646056","padding":["0","0","0","0"]}]},"padding":{"type":{"array":["u64",4]},"data":["0","0","0","0"]}};

// Calculate TWAP - commented out to avoid auto-execution when imported
// Uncomment below lines if you want to run this file directly for testing
/*
try {
    const result = calculateTWAP(poolState, observationState);
    
    console.log("\n" + "=".repeat(50));
    console.log("FINAL TWAP SUMMARY");
    console.log("=".repeat(50));
    console.log(`Time period: ${result.timePeriodHours.toFixed(2)} hours`);
    console.log(`Observations used: ${result.observationCount}`);
    console.log(`TWAP Tick: ${result.twapTick.toFixed(6)}`);
    console.log(`TWAP Price: ${result.twapPrice.toFixed(8)}`);
    console.log(`Current Price: ${result.currentPrice.toFixed(8)}`);
    console.log(`Difference: ${((result.twapPrice - result.currentPrice) / result.currentPrice * 100).toFixed(4)}%`);
    
} catch (error) {
    console.error("Error calculating TWAP:", error.message);
}
*/

// Export the functions for reuse
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        calculateTWAP, 
        detectManipulation,
        calculateConfidence,
        getRecommendations
    };
}
