// ==========================================
// Injective Dashboard – Realtime + Timeframe
// ==========================================

// ---------- STATE ----------
let address = localStorage.getItem("inj_address") || "";

let timeframe = "24h";
const TF = {
  "1h": { interval: "1m", limit: 60 },
  "4h": { interval: "5m", limit: 48 },
  "24h": { interval: "15m", limit: 96 }
};

// Price
let targetPrice = 0;
let displayedPrice = 0;
let priceOpen = 0;
let priceLow = Infinity;
let priceHigh = -Infinity;

// Wallet
let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let apr = 0;

// Chart
let chart, chartData = [];

// ---------- DOM ----------
const $ = id => document.getElementById(id);

const priceEl = $("price");
const price24hEl = $("price24h");
const priceBarEl = $("priceBar");
const priceLineEl = $("priceLine");
const priceMinEl = $("priceMin");
const priceMaxEl = $("priceMax");
const priceOpenEl = $("priceOpen");

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

const addressInput = $("addressInput");

// ---------- HELPERS ----------
const fetchJSON = async url => {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch {
    return {};
  }
};

function animateDigits(el, cur, tgt, dec) {
  if (!isFinite(tgt)) return cur;
  const c = cur.toFixed(dec);
  const t = tgt.toFixed(dec);
  if (c === t) return cur;

  el.classList.add(tgt > cur ? "up" : "down");
  setTimeout(() => el.classList.remove("up", "down"), 300);
  el.innerText = t;
  return tgt;
}

// ---------- ADDRESS ----------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadWallet();
};

// ---------- WALLET (2s) ----------
async function loadWallet() {
  if (!address) return;

  const bal = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
  const inj = bal.balances?.find(b => b.denom === "inj");
  availableInj = inj ? +inj.amount / 1e18 : 0;

  const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
  stakeInj = stake.delegation_responses?.reduce((s, d) => s + Number(d.balance.amount || 0), 0) / 1e18 || 0;

  const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
  rewardsInj = rewards.rewards?.reduce((s, r) => s + Number(r.reward[0]?.amount || 0), 0) / 1e18 || 0;

  const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
  const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
  const bonded = Number(pool.pool?.bonded_tokens || 0);
  const total = bonded + Number(pool.pool?.not_bonded_tokens || 0);
  apr = bonded ? (inflation.inflation * total / bonded) * 100 : 0;
}
loadWallet();
setInterval(loadWallet, 2000);

// ---------- TIMEFRAME INIT ----------
async function initTimeframe(tf) {
  timeframe = tf;
  const cfg = TF[tf];

  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=${cfg.interval}&limit=${cfg.limit}`
  );
  const d = await res.json();

  chartData = d.map(c => +c[4]);
  priceOpen = +d[0][1];
  priceLow = Math.min(...d.map(c => +c[3]));
  priceHigh = Math.max(...d.map(c => +c[2]));

  targetPrice = chartData.at(-1);
  displayedPrice = targetPrice;

  drawChart();
  updateBarImmediate();
}
initTimeframe("24h");

// ---------- TOGGLE ----------
document.querySelectorAll(".timeframe-toggle button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".timeframe-toggle button")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    initTimeframe(btn.dataset.tf);
  };
});

// ---------- BINANCE WS ----------
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");

  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;

    if (p < priceLow) priceLow = p;
    if (p > priceHigh) priceHigh = p;

    chartData.push(p);
    if (chartData.length > TF[timeframe].limit) chartData.shift();
    if (chart) {
      chart.data.datasets[0].data = chartData;
      chart.update();
    }
  };

  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ---------- CHART ----------
function drawChart() {
  const ctx = $("priceChart");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,.2)",
        tension: .3,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false } }
    }
  });
}

// ---------- BAR INIT ----------
function updateBarImmediate() {
  const center = 50;
  let pos = center;

  if (displayedPrice >= priceOpen) {
    pos = center + Math.min((displayedPrice - priceOpen) / (priceHigh - priceOpen) * 50, 50);
    priceBarEl.style.left = "50%";
    priceBarEl.style.width = (pos - center) + "%";
    priceBarEl.style.background = "linear-gradient(to right,#22c55e,#10b981)";
  } else {
    pos = center - Math.min((priceOpen - displayedPrice) / (priceOpen - priceLow) * 50, 50);
    priceBarEl.style.left = pos + "%";
    priceBarEl.style.width = (center - pos) + "%";
    priceBarEl.style.background = "linear-gradient(to right,#ef4444,#f87171)";
  }

  priceLineEl.style.left = pos + "%";
}

// ---------- MAIN LOOP ----------
function animate() {
  displayedPrice += (targetPrice - displayedPrice) * 0.15;
  displayedPrice = animateDigits(priceEl, displayedPrice, targetPrice, 4);

  const delta = ((displayedPrice - priceOpen) / priceOpen) * 100;
  price24hEl.innerText = (delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta >= 0 ? "up" : "down");

  const center = 50;
  let pos = center;
  let flash = false;

  if (displayedPrice >= priceOpen) {
    pos = center + Math.min((displayedPrice - priceOpen) / (priceHigh - priceOpen) * 50, 50);
    priceBarEl.style.left = "50%";
    priceBarEl.style.width = (pos - center) + "%";
    flash = displayedPrice >= priceHigh;
    priceBarEl.style.background = flash ? "#facc15" : "linear-gradient(to right,#22c55e,#10b981)";
  } else {
    pos = center - Math.min((priceOpen - displayedPrice) / (priceOpen - priceLow) * 50, 50);
    priceBarEl.style.left = pos + "%";
    priceBarEl.style.width = (center - pos) + "%";
    flash = displayedPrice <= priceLow;
    priceBarEl.style.background = flash ? "#facc15" : "linear-gradient(to right,#ef4444,#f87171)";
  }

  priceLineEl.style.left = pos + "%";
  priceMinEl.innerText = priceLow.toFixed(4);
  priceMaxEl.innerText = priceHigh.toFixed(4);
  priceOpenEl.innerText = priceOpen.toFixed(4);

  displayedAvailable = animateDigits(availableEl, displayedAvailable, availableInj, 6);
  availableUsdEl.innerText = (displayedAvailable * displayedPrice).toFixed(2);

  displayedStake = animateDigits(stakeEl, displayedStake, stakeInj, 4);
  stakeUsdEl.innerText = (displayedStake * displayedPrice).toFixed(2);

  displayedRewards = animateDigits(rewardsEl, displayedRewards, rewardsInj, 7);
  rewardsUsdEl.innerText = (displayedRewards * displayedPrice).toFixed(2);

  const rp = Math.min(displayedRewards / 0.1 * 100, 100);
  rewardBarEl.style.width = rp + "%";
  rewardPercentEl.innerText = rp.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + "%";

  aprEl.innerText = apr.toFixed(2) + "%";
  updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
