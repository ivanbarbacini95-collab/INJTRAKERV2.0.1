/* ===============================
   STATE
================================ */
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

/* ===============================
   DOM
================================ */
const $ = id => document.getElementById(id);

const addressInput = $("addressInput");
const priceEl = $("price");
const price24hEl = $("price24h");
const priceBarEl = $("priceBar");
const priceLineEl = $("priceLine");
const priceMinEl = $("priceMin");
const priceOpenEl = $("priceOpen");
const priceMaxEl = $("priceMax");

const availableEl = $("available");
const availableUsdEl = $("availableUsd");
const stakeEl = $("stake");
const stakeUsdEl = $("stakeUsd");
const rewardsEl = $("rewards");
const rewardsUsdEl = $("rewardsUsd");
const rewardBarEl = $("rewardBar");
const rewardPercentEl = $("rewardPercent");

const aprEl = $("apr");
const updatedEl = $("updated");

/* ===============================
   HELPERS
================================ */
const fetchJSON = async url => {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch {
    return {};
  }
};

const lerp = (a, b, f) => a + (b - a) * f;

function colorNumber(el, newVal, oldVal, decimals) {
  const n = newVal.toFixed(decimals);
  const o = oldVal.toFixed(decimals);
  let html = "";

  for (let i = 0; i < n.length; i++) {
    html += n[i] !== o[i]
      ? `<span style="color:${newVal > oldVal ? '#22c55e' : '#ef4444'}">${n[i]}</span>`
      : `<span>${n[i]}</span>`;
  }
  el.innerHTML = html;
}

/* ===============================
   ADDRESS
================================ */
addressInput.value = address;

addressInput.addEventListener("change", e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadAccountData();
});

/* ===============================
   ACCOUNT DATA
================================ */
async function loadAccountData() {
  if (!address) return;

  const [balanceRes, stakeRes, rewardsRes, inflationRes] = await Promise.all([
    fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`),
    fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`)
  ]);

  const inj = balanceRes.balances?.find(b => b.denom === "inj");
  availableInj = inj ? Number(inj.amount) / 1e18 : 0;

  stakeInj = stakeRes.delegation_responses
    ?.reduce((s, d) => s + Number(d.balance.amount), 0) / 1e18 || 0;

  rewardsInj = rewardsRes.rewards
    ?.reduce((s, r) =>
      s + r.reward.reduce((a, rw) => a + Number(rw.amount), 0), 0
    ) / 1e18 || 0;

  apr = Number(inflationRes.inflation || 0) * 100;
}

loadAccountData();
setInterval(loadAccountData, 60000);

/* ===============================
   PRICE HISTORY
================================ */
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();

  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);

  if (!chart) initChart();
}

fetchHistory();

/* ===============================
   CHART
================================ */
function initChart() {
  const ctx = $("priceChart").getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, "rgba(34,197,94,0.25)");
  gradient.addColorStop(1, "rgba(34,197,94,0)");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array(chartData.length).fill(""),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        backgroundColor: gradient,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { ticks: { color: "#9ca3af" }, grid: { color: "#1e293b" } }
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

/* ===============================
   WEBSOCKET
================================ */
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

/* ===============================
   ANIMATION LOOP
================================ */
function animate() {
  const oldPrice = displayedPrice;
  displayedPrice = lerp(displayedPrice, targetPrice, 0.1);
  colorNumber(priceEl, displayedPrice, oldPrice, 4);

  const delta = ((displayedPrice - price24hOpen) / price24hOpen) * 100;
  price24hEl.textContent = `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)}%`;
  price24hEl.className = "sub " + (delta > 0 ? "up" : "down");

  const range = Math.max(price24hHigh - price24hLow, price24hOpen * 0.01);
  const percent = Math.min(Math.abs(displayedPrice - price24hOpen) / range * 50, 50);
  const center = 50;

  const linePos = displayedPrice >= price24hOpen
    ? center + percent
    : center - percent;

  priceLineEl.style.left = `${linePos}%`;
  priceBarEl.style.left = `${Math.min(center, linePos)}%`;
  priceBarEl.style.width = `${Math.abs(linePos - center)}%`;

  priceMinEl.textContent = price24hLow.toFixed(3);
  priceOpenEl.textContent = price24hOpen.toFixed(3);
  priceMaxEl.textContent = price24hHigh.toFixed(3);

  displayedAvailable = lerp(displayedAvailable, availableInj, 0.1);
  colorNumber(availableEl, displayedAvailable, availableInj, 6);
  availableUsdEl.textContent = `≈ $${(displayedAvailable * displayedPrice).toFixed(2)}`;

  displayedStake = lerp(displayedStake, stakeInj, 0.1);
  colorNumber(stakeEl, displayedStake, stakeInj, 4);
  stakeUsdEl.textContent = `≈ $${(displayedStake * displayedPrice).toFixed(2)}`;

  displayedRewards = lerp(displayedRewards, rewardsInj, 0.1);
  colorNumber(rewardsEl, displayedRewards, rewardsInj, 7);
  rewardsUsdEl.textContent = `≈ $${(displayedRewards * displayedPrice).toFixed(2)}`;

  const rPct = Math.min(displayedRewards / 0.05 * 100, 100);
  rewardBarEl.style.width = `${rPct}%`;
  rewardPercentEl.textContent = rPct.toFixed(1) + "%";

  aprEl.textContent = apr.toFixed(2) + "%";

  updatedEl.textContent = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
