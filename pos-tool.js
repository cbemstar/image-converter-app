// pos-tool.js - Word to Parts of Speech tool

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('word-input');
  const btn = document.getElementById('analyze-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const wordOfDayEl = document.getElementById('word-of-day');
  const result = document.getElementById('result');
  const quizContainer = document.getElementById('quiz-container');
  const quizForm = document.getElementById('quiz-form');
  const quizResult = document.getElementById('quiz-result');
  const pointsEl = document.getElementById('points');
  const stageEl = document.getElementById('stage');

  const searchedWords = [];
  const partsMap = {};
  let points = 0;
  let correctCount = 0;
  const randomWords = [
    'apple','run','happy','quick','cloud','music','bright','learn','jump','ocean',
    'smile','write','grow','dream','play','strong','walk','swift','kind','build'
  ];
  function dayIndex() {
    return Math.floor(Date.now() / 86400000);
  }

  async function initWordOfDay() {
    const word = randomWords[dayIndex() % randomWords.length];
    try {
      const info = await fetchDefinition(word);
      displayInfo(wordOfDayEl, word, info);
    } catch (e) {
      wordOfDayEl.textContent = `Word of the Day: ${word}`;
    }
  }

  function updateScoreboard() {
    pointsEl.textContent = points;
    if (correctCount >= 15) stageEl.textContent = 'Gold';
    else if (correctCount >= 5) stageEl.textContent = 'Silver';
    else stageEl.textContent = 'Bronze';
  }

  updateScoreboard();

  async function fetchDefinition(word) {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!resp.ok) throw new Error('Not found');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length || !data[0].meanings || !data[0].meanings.length) {
      throw new Error('No results');
    }
    const meaning = data[0].meanings[0];
    const part = meaning.partOfSpeech;
    const definition = meaning.definitions[0].definition;
    let example = meaning.definitions.find(d => d.example)?.example;
    if (!example) example = `Here is an example sentence using the word "${word}".`;
    const synSet = new Set();
    meaning.definitions.forEach(d => {
      if (Array.isArray(d.synonyms)) d.synonyms.forEach(s => synSet.add(s));
    });
    if (Array.isArray(meaning.synonyms)) meaning.synonyms.forEach(s => synSet.add(s));
    const synonyms = Array.from(synSet).slice(0, 5);
    return { part, definition, example, synonyms };
  }

  function displayInfo(container, word, info) {
    const { part, definition, example, synonyms } = info;
    container.innerHTML = `
      <div class="border rounded p-4">
        <div class="text-xl font-semibold">${word}</div>
        <div class="italic mb-2">${part}</div>
        <div>${definition}</div>
        <div class="mt-2 text-sm">Example: ${example}</div>
        ${synonyms.length ? `<div class="mt-2 text-sm">Similar: ${synonyms.join(', ')}</div>` : ''}
      </div>`;
  }

  async function analyzeWord(word, store = true) {
    if (!word) {
      result.textContent = 'Please enter a word.';
      return;
    }
    result.textContent = 'Loading...';
    try {
      const info = await fetchDefinition(word);
      displayInfo(result, word, info);
      if (store) {
        partsMap[word] = info.part;
        if (!searchedWords.includes(word)) searchedWords.push(word);
        if (searchedWords.length > 3) searchedWords.shift();
        if (searchedWords.length === 3) buildQuiz();
      }
    } catch (err) {
      result.textContent = 'Sorry, could not find that word.';
    }
  }

  function analyze() {
    const word = input.value.trim().toLowerCase();
    analyzeWord(word);
  }

  function buildQuiz() {
    quizForm.innerHTML = '';
    searchedWords.forEach(w => {
      quizForm.innerHTML += `
        <div>
          <label class="block mb-1" for="${w}">${w}</label>
          <select id="${w}" name="${w}" class="shad-input">
            <option value="noun">Noun</option>
            <option value="verb">Verb</option>
            <option value="adjective">Adjective</option>
            <option value="adverb">Adverb</option>
            <option value="pronoun">Pronoun</option>
            <option value="preposition">Preposition</option>
            <option value="conjunction">Conjunction</option>
            <option value="interjection">Interjection</option>
            <option value="determiner">Determiner</option>
            <option value="other">Other</option>
          </select>
        </div>`;
    });
    quizForm.innerHTML += '<button type="submit" class="shad-btn">Submit Answers</button>';
    quizContainer.classList.remove('hidden');
  }

  quizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let correct = 0;
    searchedWords.forEach(w => {
      const ans = quizForm.elements[w].value.toLowerCase();
      const actual = partsMap[w]?.toLowerCase() || '';
      if (ans === actual) correct += 1;
    });
    points += correct * 10;
    correctCount += correct;
    updateScoreboard();
    quizResult.textContent = `You got ${correct} out of ${searchedWords.length} correct!`;
    searchedWords.length = 0;
    quizContainer.classList.add('hidden');
  });

  btn.addEventListener('click', analyze);
  shuffleBtn.addEventListener('click', () => {
    const word = randomWords[Math.floor(Math.random() * randomWords.length)];
    input.value = word;
    analyzeWord(word);
  });
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyze();
  });

  initWordOfDay();
});
