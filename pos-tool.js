// pos-tool.js - Word to Parts of Speech tool

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('word-input');
  const btn = document.getElementById('analyze-btn');
  const result = document.getElementById('result');

  async function analyze() {
    const word = input.value.trim();
    if (!word) {
      result.textContent = 'Please enter a word.';
      return;
    }
    result.textContent = 'Loading...';
    try {
      const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!resp.ok) throw new Error('Not found');
      const data = await resp.json();
      if (!Array.isArray(data) || !data.length || !data[0].meanings || !data[0].meanings.length) {
        throw new Error('No results');
      }
      const meaning = data[0].meanings[0];
      const part = meaning.partOfSpeech;
      const example = (meaning.definitions[0] && meaning.definitions[0].example) || `Here is an example sentence using the word \"${word}\".`;
      result.innerHTML = `<p><strong>Part of Speech:</strong> ${part}</p><p><strong>Example:</strong> ${example}</p>`;
    } catch (err) {
      result.textContent = 'Sorry, could not find that word.';
    }
  }

  btn.addEventListener('click', analyze);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyze();
  });
});
