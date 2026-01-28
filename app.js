let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
const rewardMax = 0.05;

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
const priceLineEl = document.getElementById("priceLineCurrent");
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

// ------------------- FUNZIONE SCORRIMENTO CIFRA -------------------
function updateDigitNumber(el, oldValue, newValue, decimals = 2) {
  const oldStr = oldValue.toFixed(decimals);
  const newStr = newValue.toFixed(decimals);

  el.innerHTML = '';

  for (let i = 0; i < newStr.length; i++) {
    const oldChar = oldStr[i] || '';
    const newChar = newStr[i];

    const wrapper = document.createElement('span');
    wrapper.className = 'digit-wrapper';

    const inner = document.createElement('span');
    inner.className = 'digit-inner';
    inner.innerText = newChar;

    wrapper.appendChild(inner);
    el.appendChild(wrapper);

    // Anima solo se la cifra cambia
    if (oldChar !== newChar) {
      inner.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        inner.style.transform = 'translateY(0%)';
        el.classList.add(newValue > oldValue ? 'up' : 'down');
        setTimeout(() => el.classList.remove('up', 'down'), 300);
      }, 10);
    }
  }
}

// Sostituisce updateNumber
function updateNumber(el, oldV, newV, fixed) {
  updateDigitNumber(el, oldV, newV, fixed);
}

// ------------------- INPUT INDIRIZZO -------------------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ------------------- CARICAMENTO DATI INJECTIVE -------------------
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error("Fetch error:", url, e);
    return {};
  }
}

async function loadData() {
  if (!address) return;

  try {
    // Balance
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom === "inj");
    availableInj = injBalance ? Number(injBalance.amount) / 1e18 : 0;

    // Staking
    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum, d) => sum + Number(d.balance.amount || 0), 0) / 1e18 || 0;

    // Rewards
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum, r) => sum + Number(r.reward[0]?.amount || 0), 0) / 1e18 || 0;

    // Inflation & pool
    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens || 0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens || 0);
    apr = (inflationRes.inflation * (bonded + notBonded) / bonded) * 100;

  } catch (e) { console.error("Errore caricamento dati Injective:", e); }
}

loadData();
setInterval(loadData, 60000);

// ------------------- PRICE HISTORY -------------------
async function fetchHistory() {
  try {
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await res.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    price24hLow = Math.min(...chartData);
    price24hHigh = Math.max(...chartData);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch (e) { console.error("Errore price history:", e); }
}
fetchHistory();

// ------------------- DRAW CHART -------------------
function drawChart() {
  const ctx = document.getElementById("priceChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels: chartData.map((_, i) => i), datasets: [{ data: chartData, borderColor: "#22c55e", tension: 0.3, fill: true }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false } } }
  });
}

// ------------------- BINANCE WS -------------------
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;
    if (p > price24hHigh) price24hHigh = p;
    if (p < price24hLow) price24hLow = p;
  };
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ------------------- ANIMAZIONE -------------------
function animate() {
  // PRICE
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.2; // più sensibile
  updateNumber(priceEl, prevP, displayedPrice, 4);

  const delta = ((displayedPrice - price24hOpen) / price24hOpen) * 100;
  price24hEl.innerText = (delta > 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta > 0 ? "up" : delta < 0 ? "down" : "");

  // Price bar
  const minVal = price24hLow, maxVal = price24hHigh, range = maxVal - minVal || 1;
  let percentFromOpen = ((displayedPrice - price24hOpen) / range) * 50; // max 50%
  if (percentFromOpen > 50) percentFromOpen = 50;
  if (percentFromOpen < -50) percentFromOpen = -50;

  const barColor = displayedPrice >= price24hOpen ? "#22c55e" : "#ef4444";
  const left = 50 - (percentFromOpen < 0 ? Math.abs(percentFromOpen) : 0);
  const width = Math.abs(percentFromOpen);

  priceBarEl.style.left = left + "%";
  priceBarEl.style.width = width + "%";
  priceBarEl.style.background = barColor;

  // Linea gialla trascina barra
  priceLineEl.style.left = (50 + percentFromOpen) + "%";

  // Min / Max / Open
  updateNumber(priceMinEl, Number(priceMinEl.innerText), price24hLow, 4);
  updateNumber(priceMaxEl, Number(priceMaxEl.innerText), price24hHigh, 4);
  updateNumber(priceOpenEl, Number(priceOpenEl.innerText), price24hOpen, 4);

  // AVAILABLE
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  updateNumber(availableUsdEl, prevA * displayedPrice, displayedAvailable * displayedPrice, 2);

  // STAKE
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  updateNumber(stakeUsdEl, prevS * displayedPrice, displayedStake * displayedPrice, 2);

  // REWARDS
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  updateNumber(rewardsEl, prevR, displayedRewards, 6);
  updateNumber(rewardsUsdEl, prevR * displayedPrice, displayedRewards * displayedPrice, 2);

  // Barra reward
  const rewardPercent = Math.min(displayedRewards / rewardMax * 100, 100);
  rewardBarEl.style.width = rewardPercent + "%";
  rewardPercentEl.innerText = rewardPercent.toFixed(1) + "%";

  // APR
  updateNumber(aprEl, Number(aprEl.innerText) || 0, apr, 2);

  // Last Update
  updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ------------------- Aggiorna rewards ogni 3 secondi -------------------
setInterval(async () => {
  if (!address) return;
  try {
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum, r) => sum + Number(r.reward[0]?.amount || 0), 0) / 1e18 || 0;
  } catch (e) { console.error("Errore aggiornamento rewards:", e); }
}, 3000);
