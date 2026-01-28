// =====================
// STATE
// =====================
let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0;
let displayedPrice = 0;

let price24hOpen = 0;
let price24hLow = 0;
let price24hHigh = 0;

let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;

let apr = 0;

let chart;
let chartData = [];

let ws;

// =====================
// DOM
// =====================
const addressInput = document.getElementById("addressInput");

const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");

const priceBarEl = document.getElementById("priceBar");
const priceLineEl = document.getElementById("priceLine");

const priceMinEl = document.getElementById("priceMin");
const priceOpenEl = document.getElementById("priceOpen");
const priceMaxEl = document.getElementById("priceMax");

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

// =====================
// HELPERS
// =====================
const fetchJSON = async url => {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {
    console.error("Fetch error:", url, e);
    return {};
  }
};

const lerp = (a, b, f) => a + (b - a) * f;

function colorNumber(el, newVal, oldVal, decimals) {
  const o = oldVal.toFixed(decimals);
  const n = newVal.toFixed(decimals);
  let html = "";
  for (let i = 0; i < n.length; i++) {
    if (n[i] !== o[i]) {
      html += `<span style="color:${newVal > oldVal ? "#22c55e" : "#ef4444"}">${n[i]}</span>`;
    } else {
      html += `<span>${n[i]}</span>`;
    }
  }
  el.innerHTML = html;
}

// =====================
// ADDRESS INPUT
// =====================
addressInput.value = address;

addressInput.addEventListener("change", e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadInjectiveData();
});

addressInput.addEventListener("keydown", e => {
  if (e.key === "Enter") loadInjectiveData();
});

// =====================
// INJECTIVE DATA
// =====================
async function loadInjectiveData() {
  if (!address) return;

  // Balance
  const bal = await fetchJSON(
    `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
  );
  const inj = bal.balances?.find(b => b.denom === "inj");
  availableInj = inj ? Number(inj.amount) / 1e18 : 0;

  // Stake
  const stake = await fetchJSON(
    `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
  );
  stakeInj =
    stake.delegation_responses?.reduce(
      (s, d) => s + Number(d.balance.amount || 0),
      0
    ) / 1e18 || 0;

  // Rewards (multi-validator fix)
  const rew = await fetchJSON(
    `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
  );
  rewardsInj =
    rew.rewards?.reduce(
      (sum, r) =>
        sum +
        r.reward.reduce((s, rw) => s + Number(rw.amount), 0),
      0
    ) / 1e18 || 0;

  // APR
  const inflation = await fetchJSON(
    `https://lcd.injective.network/cosmos/mint/v1beta1/inflation`
  );
  apr = Number(inflation.inflation || 0) * 100;
}

loadInjectiveData();
setInterval(loadInjectiveData, 60000);

// =====================
// PRICE HISTORY (INIT)
// =====================
async function fetchHistory() {
  const r = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24`
  );
  const d = await r.json();

  chartData = d.map(c => +c[4]);

  price24hOpen = +d[0][1];
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);

  initChart();
}

fetchHistory();

// =====================
// CHART
// =====================
function initChart() {
  const ctx = document.getElementById("priceChart");

  const gradient = ctx
    .getContext("2d")
    .createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, "rgba(34,197,94,0.3)");
  gradient.addColorStop(1, "rgba(34,197,94,0)");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array(chartData.length).fill(""),
      datasets: [
        {
          data: chartData,
          borderColor: "#22c55e",
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          grid: { color: "#1e293b" },
          ticks: { color: "#9ca3af" }
        }
      }
    }
  });
}

function updateChart(price) {
  if (!chart) return;
  chart.data.datasets[0].data.push(price);
  chart.data.datasets[0].data.shift();
  chart.update("none");
}

// =====================
// WEBSOCKET
// =====================
function startWS() {
  if (ws) ws.close();

  ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");

  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;

    if (p > price24hHigh) price24hHigh = p;
    if (p < price24hLow) price24hLow = p;

    updateChart(p);
  };

  ws.onclose = () => setTimeout(startWS, 3000);
}

startWS();

// =====================
// ANIMATION LOOP
// =====================
function animate() {
  // PRICE
  const oldPrice = displayedPrice;
  displayedPrice = lerp(displayedPrice, targetPrice, 0.1);
  colorNumber(priceEl, displayedPrice, oldPrice, 4);

  const delta = ((displayedPrice - price24hOpen) / price24hOpen) * 100;
  price24hEl.innerText =
    (delta > 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta > 0 ? "up" : "down");

  // PRICE BAR
  const center = 50;
  const range = Math.max(price24hHigh - price24hLow, price24hOpen * 0.01);
  const percent = Math.min(
    Math.abs(displayedPrice - price24hOpen) / range * 50,
    50
  );

  let linePos;
  if (displayedPrice >= price24hOpen) {
    linePos = center + percent;
    priceBarEl.style.left = `${center}%`;
    priceBarEl.style.width = `${linePos - center}%`;
    priceBarEl.style.background =
      "linear-gradient(to right,#22c55e,#10b981)";
  } else {
    linePos = center - percent;
    priceBarEl.style.left = `${linePos}%`;
    priceBarEl.style.width = `${center - linePos}%`;
    priceBarEl.style.background =
      "linear-gradient(to right,#ef4444,#f87171)";
  }

  priceLineEl.style.left = `${linePos}%`;

  priceMinEl.innerText = price24hLow.toFixed(3);
  priceOpenEl.innerText = price24hOpen.toFixed(3);
  priceMaxEl.innerText = price24hHigh.toFixed(3);

  // AVAILABLE
  const oldAvail = displayedAvailable;
  displayedAvailable = lerp(displayedAvailable, availableInj, 0.1);
  colorNumber(availableEl, displayedAvailable, oldAvail, 6);
  availableUsdEl.innerText =
    "≈ $" + (displayedAvailable * displayedPrice).toFixed(2);

  // STAKE
  const oldStake = displayedStake;
  displayedStake = lerp(displayedStake, stakeInj, 0.1);
  colorNumber(stakeEl, displayedStake, oldStake, 4);
  stakeUsdEl.innerText =
    "≈ $" + (displayedStake * displayedPrice).toFixed(2);

  // REWARDS
  const oldRew = displayedRewards;
  displayedRewards = lerp(displayedRewards, rewardsInj, 0.1);
  colorNumber(rewardsEl, displayedRewards, oldRew, 7);
  rewardsUsdEl.innerText =
    "≈ $" + (displayedRewards * displayedPrice).toFixed(2);

  const rewardPercent = Math.min(displayedRewards / 0.05 * 100, 100);
  rewardBarEl.style.width = rewardPercent + "%";
  rewardPercentEl.innerText = rewardPercent.toFixed(1) + "%";

  // APR
  aprEl.innerText = apr.toFixed(2) + "%";

  // LAST UPDATE
  updatedEl.innerText =
    "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
