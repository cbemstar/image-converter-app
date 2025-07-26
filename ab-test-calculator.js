export function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('ab-test-form');
  const results = document.getElementById('results');
  const rateAEl = document.getElementById('rate-a');
  const rateBEl = document.getElementById('rate-b');
  const upliftEl = document.getElementById('uplift');
  const sigEl = document.getElementById('significance');
  const recEl = document.getElementById('recommendation');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const visitorsA = parseInt(document.getElementById('visitors-a').value || '0', 10);
    const convA = parseInt(document.getElementById('conversions-a').value || '0', 10);
    const visitorsB = parseInt(document.getElementById('visitors-b').value || '0', 10);
    const convB = parseInt(document.getElementById('conversions-b').value || '0', 10);
    if (visitorsA <= 0 || visitorsB <= 0) return;
    const rateA = convA / visitorsA;
    const rateB = convB / visitorsB;
    const uplift = ((rateB - rateA) / rateA) * 100;
    const p = (convA + convB) / (visitorsA + visitorsB);
    const se = Math.sqrt(p * (1 - p) * (1 / visitorsA + 1 / visitorsB));
    const z = (rateB - rateA) / se;
    const pval = 2 * (1 - normalCdf(Math.abs(z)));
    const sig = (1 - pval) * 100;

    rateAEl.textContent = `Variant A: ${(rateA * 100).toFixed(2)}%`;
    rateBEl.textContent = `Variant B: ${(rateB * 100).toFixed(2)}%`;
    upliftEl.textContent = `Uplift: ${uplift.toFixed(2)}%`;
    sigEl.textContent = `Significance: ${sig.toFixed(2)}%`;

    let rec;
    if (pval < 0.05) {
      rec = rateB > rateA ? 'Variant B is statistically better.' : 'Variant A is statistically better.';
    } else {
      rec = 'No significant difference yet. Collect more data.';
    }
    recEl.textContent = rec;

    results.style.display = '';
  });
});
