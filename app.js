let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let aprValue = 0;

// Chart
let chart, chartData = [];

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const priceArrowEl = document.getElementById("priceArrow");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
const priceLineEl = document.getElementById("priceLine");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");
const priceOpenEl = document.getElementById("priceOpen");

const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");

const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");

const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");
const rewardPercentEl = document.getElementById("rewardPercent");

const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");

let arrowTimeout;

// Helper fetch
const fetchJSON = async url => { 
  try { 
    const res = await fetch(url); 
    return await res.json(); 
  } catch(e) { 
    console.error("Fetch error:", url, e); 
    return {}; 
  }
};

// Input
addressInput.value = address;
addressInput.onchange = e => { 
  address = e.target.value.trim(); 
  localStorage.setItem("inj_address", address); 
  loadData(); 
};

// Load data Injective
async function loadData(){
  if(!address) return;
  try{
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom==="inj");
    availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens||0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens||0);
    aprValue = (inflationRes.inflation*(bonded+notBonded)/bonded)*100;
  } catch(e){ console.error("Errore dati Injective:",e);}
}
loadData();
setInterval(loadData,60000);

// Price history
async function fetchHistory(){
  try{
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await res.json();
    chartData = d.map(c=>+c[4]);
    price24hOpen = +d[0][1];
    price24hLow = Math.min(...chartData);
    price24hHigh = Math.max(...chartData);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error("Errore price history:", e);}
}
fetchHistory();

// Draw chart
function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// Binance WS
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => { 
    const p = +JSON.parse(e.data).p; 
    targetPrice = p; 
    if(p > price24hHigh) price24hHigh = p; 
    if(p < price24hLow) price24hLow = p; 
  };
  ws.onclose = ()=>setTimeout(startWS,3000);
}
startWS();

// Animazione cifra per cifra
function animateDigits(element, current, target, decimals = 4) {
    current = Number(current) || 0;
    target = Number(target) || 0;

    if(current.toFixed(decimals) === target.toFixed(decimals)) {
        element.innerHTML = target.toFixed(decimals);
        element.style.color = "#f9fafb";
        return target;
    }

    const step = (target - current) * 0.1;
    const next = current + step;

    const currentStr = current.toFixed(decimals);
    const nextStr = next.toFixed(decimals);
    let html = "";

    for(let i = 0; i < nextStr.length; i++) {
        if(currentStr[i] !== nextStr[i]) {
            const isUp = next > current;
            html += `<span style="color:${isUp ? "#22c55e" : "#ef4444"}">${nextStr[i]}</span>`;
        } else {
            html += `<span style="color:#f9fafb">${nextStr[i]}</span>`;
        }
    }

    element.innerHTML = html;
    return next;
}

// Update numeri e barre
function animate(){
    const center = 50;

    // Price con freccia
    let oldPrice = displayedPrice;
    displayedPrice = animateDigits(priceEl, displayedPrice, targetPrice, 4);

    if(Math.abs(displayedPrice - oldPrice) > 0.00001){
        const up = displayedPrice > oldPrice;
        priceArrowEl.style.color = up ? "#22c55e" : "#ef4444";
        priceArrowEl.innerText = up ? "▲" : "▼";
        priceArrowEl.style.display = "inline";
        clearTimeout(arrowTimeout);
        arrowTimeout = setTimeout(() => { priceArrowEl.style.display = "none"; }, 1500);
    }

    // Delta 24h
    const delta = ((displayedPrice - price24hOpen) / price24hOpen) * 100;
    price24hEl.innerText = (delta > 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
    price24hEl.className = "sub " + (delta > 0 ? "up" : delta < 0 ? "down" : "");

    // Barra prezzo
    const percent = Math.min(Math.abs(displayedPrice - price24hOpen) / Math.max(price24hHigh - price24hLow,0.0001)*50,50);
    let linePos;
    if(displayedPrice >= price24hOpen){
        linePos = center + percent;
        priceBarEl.style.left = `${center}%`;
        priceBarEl.style.width = `${linePos-center}%`;
        priceBarEl.style.background="linear-gradient(to right,#22c55e,#10b981)";
    } else {
        linePos = center - percent;
        priceBarEl.style.left = `${linePos}%`;
        priceBarEl.style.width = `${center-linePos}%`;
        priceBarEl.style.background="linear-gradient(to right,#ef4444,#f87171)";
    }
    priceLineEl.style.left = `${linePos}%`;

    // Min/Open/Max
    priceMinEl.innerText = price24hLow.toFixed(4);
    priceMaxEl.innerText = price24hHigh.toFixed(4);
    priceOpenEl.innerText = price24hOpen.toFixed(4);

    // Available
    displayedAvailable = animateDigits(availableEl, displayedAvailable, availableInj, 6);
    availableUsdEl.innerText = (displayedAvailable * displayedPrice).toFixed(2);

    // Stake
    displayedStake = animateDigits(stakeEl, displayedStake, stakeInj, 4);
    stakeUsdEl.innerText = (displayedStake * displayedPrice).toFixed(2);

    // Rewards
    displayedRewards = animateDigits(rewardsEl, displayedRewards, rewardsInj, 6);
    rewardsUsdEl.innerText = (displayedRewards * displayedPrice).toFixed(2);

    // Barra reward 0-0.05
    const maxReward = 0.05;
    const targetPercent = Math.min(displayedRewards / maxReward * 100, 100);
    let currentWidth = parseFloat(rewardBarEl.style.width) || 0;
    rewardBarEl.style.width = currentWidth + (targetPercent - currentWidth) * 0.1 + "%";
    rewardPercentEl.innerText = Math.round(Math.min(currentWidth + (targetPercent - currentWidth) * 0.1, 100)) + "%";

    // APR (solo testo, senza animazione cifre)
    aprEl.innerText = aprValue.toFixed(2) + "%";

    // Last update
    updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

    requestAnimationFrame(animate);
}
animate();
