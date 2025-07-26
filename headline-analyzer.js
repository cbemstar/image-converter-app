import { showNotification } from './utils.js';

const commonWords = [
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an'
];

const powerWords = [
  'ultimate','guaranteed','powerful','proven','easy','quick','boost','free','best','top','secret','unlock','discover','new','save','win','exclusive'
];

const emotionalWords = [
  'amazing','exciting','shocking','surprising','incredible','heartwarming','love','fear','hate','happy','sad','thrilling','epic','unbelievable','awesome'
];

function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'');
  word = word.replace(/^y/,'');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function analyzeHeadline(text, keywords) {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const total = words.length || 1;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const syllables = words.reduce((acc,w)=>acc+countSyllables(w),0);
  const readingEase = 206.835 - 1.015*(total/sentences) - 84.6*(syllables/total);

  const counts = {
    power: 0,
    emotional: 0,
    common: 0
  };
  words.forEach(w => {
    if (powerWords.includes(w)) counts.power++;
    else if (emotionalWords.includes(w)) counts.emotional++;
    else if (commonWords.includes(w)) counts.common++;
  });
  const uncommon = total - counts.power - counts.emotional - counts.common;

  const matches = keywords.filter(k => text.toLowerCase().includes(k.toLowerCase()));

  const lengthScore = Math.max(0, 20 - Math.abs(total - 8) * 2);
  const readabilityScore = Math.max(0, Math.min(20, (readingEase/100) * 20));
  const seoScore = keywords.length ? (matches.length / keywords.length) * 20 : 10;
  const powerScore = Math.min(counts.power * 5, 15);
  const emotionalScore = Math.min(counts.emotional * 4, 15);
  const balanceScore = Math.max(0, Math.min(10, (uncommon/total) * 10));

  const score = Math.round(lengthScore + readabilityScore + seoScore + powerScore + emotionalScore + balanceScore);

  const suggestions = [];
  if (total < 6) suggestions.push('Consider making the headline longer for clarity.');
  if (total > 12) suggestions.push('Try shortening the headline to keep it concise.');
  if (readingEase < 60) suggestions.push('Simplify wording to improve readability.');
  if (keywords.length && matches.length < keywords.length) suggestions.push('Include missing keyword(s): ' + keywords.filter(k=>!matches.includes(k)).join(', '));
  if (counts.power === 0) suggestions.push('Add power words like "ultimate" or "proven".');
  if (counts.emotional === 0) suggestions.push('Use emotional language to engage readers.');

  return {
    score,
    counts: { ...counts, uncommon },
    total,
    readingEase: readingEase.toFixed(1),
    matches,
    suggestions
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const headlineInput = document.getElementById('headline-input');
  const seoInput = document.getElementById('seo-input');
  const analyzeBtn = document.getElementById('analyze-btn');
  const output = document.getElementById('analysis-output');

  if (!headlineInput || !analyzeBtn || !output) return;

  analyzeBtn.addEventListener('click', () => {
    const headline = headlineInput.value.trim();
    if (!headline) {
      showNotification('Please enter a headline', 'error');
      return;
    }
    const keywords = seoInput.value.split(',').map(k => k.trim()).filter(Boolean);
    const result = analyzeHeadline(headline, keywords);
    output.innerHTML = `
      <p><strong>Score:</strong> ${result.score}/100</p>
      <p><strong>Word count:</strong> ${result.total}</p>
      <p><strong>Reading ease:</strong> ${result.readingEase}</p>
      <p><strong>Power words:</strong> ${result.counts.power}</p>
      <p><strong>Emotional words:</strong> ${result.counts.emotional}</p>
      <p><strong>Uncommon words:</strong> ${result.counts.uncommon}</p>
      <p><strong>SEO keywords included:</strong> ${result.matches.join(', ') || 'None'}</p>
      <h3 class="font-semibold mt-2">Suggestions</h3>
      <ul class="list-disc ml-6">${result.suggestions.map(s=>`<li>${s}</li>`).join('') || '<li>No suggestions</li>'}</ul>
    `;
  });
});
