const PRICE_DECIMALS = 4;
const INJ_DECIMALS = 6;
const REWARD_MAX = 0.05;

let address = localStorage.getItem("inj_address") || "";

/* -------- valori target -------- */
let targetPrice = 0;
let price24hOpen = 0;
let price24hLow = 0;
let price24hHigh = 0;

let availableInj = 0;
let stakeInj = 0;
let rewardsInj = 0;
let apr = 0;

/* -------- valori animati -------- */
let displayedPrice = 0;
let displayedAvailable = 0;
let displayedStake = 0;
let displayedRewards = 0;

/* -------- riferimenti per cambio colore -------- */
const prevTargets = {
  price: { value: null },
  available: { value: null },
  stake: { value: null },
  rewards: { value: null }
};

/* -------- DOM -------- */
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

/* -------- helpers -------- */
const fetchJSON = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

function updateAnimatedNumber(el, displayed, target, decimals, ref) {
  el.innerText = displayed.toFixed(decimals);

  if (ref.value !== null && target !== ref.value) {
    el.classList.add(target > ref.value ? "up" : "down");
    setTimeout(() => el.classList.remove("up", "down"), 400);
  }

  ref.value = target;
}

/* -------- address -------- */
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadInjectiveData();
};

/* -------- Injective data -------- */
async function loadInjectiveData() {
  if (!address) return;

  const bal = await fetchJSON(
    `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
  );
  const inj = bal.balances?.find(b => b.denom === "inj");
  availableInj = inj ? Number(inj.amount) / 1e18 : 0;

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

  apr = bonded ? (inflation * (bonded + notBonded) / bonded) * 100 : 0;
}

loadInjectiveData();
setInterval(loadInjectiveData, 60000);

/* -------- price history -------- */
async function fetchHistory() {
  const res = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96"
  );
  const data = await res.json();

  const prices = data.map(c => +c[4]);
  price24hOpen = +data[0][1];
  price24hLow = Math.min(...prices);
  price24hHigh = Math.max(...prices);
  targetPrice = prices.at(-1);
}

fetchHistory();

/* -------- Binance WS -------- */
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

/* -------- animate -------- */
function animate() {
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateAnimatedNumber(
    priceEl,
    displayedPrice,
    targetPrice,
    PRICE_DECIMALS,
    prevTargets.price
  );

  const delta = ((displayedPrice - price24hOpen) / price24hOpen) * 100;
  price24hEl.innerText =
    (delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta >= 0 ? "up" : "down");

  const range = price24hHigh - price24hLow || 1;
  const offset =
    ((displayedPrice - price24hOpen) / range) * 100 + 50;
  priceBarEl.style.left = offset >= 50 ? "50%" : offset + "%";
  priceBarEl.style.width = Math.abs(offset - 50) + "%";
  priceBarEl.style.background =
    displayedPrice >= price24hOpen ? "#22c55e" : "#ef4444";

  updateAnimatedNumber(priceMinEl, price24hLow, price24hLow, PRICE_DECIMALS, { value: null });
  updateAnimatedNumber(priceOpenEl, price24hOpen, price24hOpen, PRICE_DECIMALS, { value: null });
  updateAnimatedNumber(priceMaxEl, price24hHigh, price24hHigh, PRICE_DECIMALS, { value: null });

  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateAnimatedNumber(
    availableEl,
    displayedAvailable,
    availableInj,
    INJ_DECIMALS,
    prevTargets.available
  );
  availableUsdEl.innerText =
    (displayedAvailable * displayedPrice).toFixed(2);

  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateAnimatedNumber(
    stakeEl,
    displayedStake,
    stakeInj,
    PRICE_DECIMALS,
    prevTargets.stake
  );
  stakeUsdEl.innerText =
    (displayedStake * displayedPrice).toFixed(2);

  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  updateAnimatedNumber(
    rewardsEl,
    displayedRewards,
    rewardsInj,
    INJ_DECIMALS,
    prevTargets.rewards
  );
  rewardsUsdEl.innerText =
    (displayedRewards * displayedPrice).toFixed(2);

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
