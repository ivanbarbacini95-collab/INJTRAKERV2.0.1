const PRICE_DECIMALS = 4;
const INJ_DECIMALS = 6;
const REWARD_MAX = 0.05;

let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;
let price24hLow = 0;
let price24hHigh = 0;

let availableInj = 0;
let stakeInj = 0;
let rewardsInj = 0;
let apr = 0;

let displayedAvailable = 0;
let displayedStake = 0;
let displayedRewards = 0;

let chart;
let chartData = [];

/* ---------------- DOM ---------------- */

const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
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

/* ---------------- Helpers ---------------- */

const fetchJSON = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

const updateNumber = (el, oldV, newV, fixed) => {
  el.innerText = newV.toFixed(fixed);
  if (newV > oldV) el.classList.add("up");
  else if (newV < oldV) el.classList.add("down");
  setTimeout(() => el.classList.remove("up", "down"), 400);
};

/* ---------------- Address ---------------- */

addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadInjectiveData();
};

/* ---------------- Injective Data ---------------- */

async function loadInjectiveData() {
  if (!address) return;

  const balanceRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
  );
  const injBal = balanceRes.balances?.find(b => b.denom === "inj");
  availableInj = injBal ? Number(injBal.amount) / 1e18 : 0;

  const stakeRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
  );
  stakeInj =
    stakeRes.delegation_responses?.reduce(
      (s, d) => s + Number(d.balance.amount || 0),
      0
    ) / 1e18 || 0;

  const rewardsRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
  );
  rewardsInj =
    rewardsRes.rewards?.reduce(
      (sum, r) =>
        sum +
        (r.reward?.reduce((s, x) => s + Number(x.amount || 0), 0) || 0),
      0
    ) / 1e18 || 0;

  const inflationRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/mint/v1beta1/inflation`
  );
  const poolRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/staking/v1beta1/pool`
  );

  const inflation = Number(inflationRes.inflation);
  const bonded = Number(poolRes.pool?.bonded_tokens || 0);
  const notBonded = Number(poolRes.pool?.not_bonded_tokens || 0);

  apr = bonded
    ? (inflation * (bonded + notBonded) / bonded) * 100
    : 0;
}

loadInjectiveData();
setInterval(loadInjectiveData, 60000);

/* ---------------- Price History ---------------- */

async function fetchHistory() {
  const res = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96"
  );
  const data = await res.json();

  chartData = data.map(c => +c[4]);
  price24hOpen = +data[0][1]; // open approssimato (15m candles)
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);

  drawChart();
}

fetchHistory();

/* ---------------- Chart ---------------- */

function drawChart() {
  const ctx = document.getElementById("priceChart");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false } }
    }
  });
}

/* ---------------- Binance WS ---------------- */

function startWS() {
  const ws = new WebSocket(
    "wss://stream.binance.com:9443/ws/injusdt@trade"
  );

  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;
    if (p > price24hHigh) price24hHigh = p;
    if (p < price24hLow) price24hLow = p;
  };

  ws.onclose = () => setTimeout(startWS, 3000);
}

startWS();

/* ---------------- Animate ---------------- */

function animate() {
  const prevPrice = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(priceEl, prevPrice, displayedPrice, PRICE_DECIMALS);

  const delta =
    ((displayedPrice - price24hOpen) / price24hOpen) * 100;
  price24hEl.innerText =
    (delta > 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta >= 0 ? "up" : "down");

  const range = price24hHigh - price24hLow || 1;
  const offset =
    ((displayedPrice - price24hOpen) / range) * 100 + 50;
  priceBarEl.style.left = offset >= 50 ? "50%" : offset + "%";
  priceBarEl.style.width = Math.abs(offset - 50) + "%";
  priceBarEl.style.background =
    displayedPrice >= price24hOpen ? "#22c55e" : "#ef4444";

  updateNumber(priceMinEl, Number(priceMinEl.innerText), price24hLow, PRICE_DECIMALS);
  updateNumber(priceOpenEl, Number(priceOpenEl.innerText), price24hOpen, PRICE_DECIMALS);
  updateNumber(priceMaxEl, Number(priceMaxEl.innerText), price24hHigh, PRICE_DECIMALS);

  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, prevA, displayedAvailable, INJ_DECIMALS);
  updateNumber(
    availableUsdEl,
    prevA * displayedPrice,
    displayedAvailable * displayedPrice,
    2
  );

  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, prevS, displayedStake, PRICE_DECIMALS);
  updateNumber(
    stakeUsdEl,
    prevS * displayedPrice,
    displayedStake * displayedPrice,
    2
  );

  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  rewardsEl.innerText = displayedRewards.toFixed(INJ_DECIMALS);
  rewardsUsdEl.innerText = (displayedRewards * displayedPrice).toFixed(2);

  const rewardPct = Math.min(
    (displayedRewards / REWARD_MAX) * 100,
    100
  );
  rewardBarEl.style.width = rewardPct + "%";
  rewardPercentEl.innerText = rewardPct.toFixed(1) + "%";

  aprEl.innerText = apr.toFixed(2) + "%";
  updatedEl.innerText =
    "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
