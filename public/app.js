// 전역 상태 관리
let mappings = []; // {id, original, translated} 배열
let isWordMode = false; // 쉼표 구분 단어 모드

// DOM 요소
const sourceText = document.getElementById('sourceText');
const translateBtn = document.getElementById('translateBtn');
const sourceLang = document.getElementById('sourceLang');
const targetLang = document.getElementById('targetLang');
const swapLangs = document.getElementById('swapLangs');
const originalSentences = document.getElementById('originalSentences');
const translatedSentences = document.getElementById('translatedSentences');
const originalResult = document.getElementById('originalResult');
const translatedResult = document.getElementById('translatedResult');
const originalCount = document.getElementById('originalCount');
const translatedCount = document.getElementById('translatedCount');

// 토스트 메시지 표시
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');

  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// 클라이언트에서 직접 Google Translate API 호출
async function translateText(text, sourceLang, targetLang) {
  if (!text.trim()) return '';

  // Google Translate 무료 엔드포인트 (CORS 프록시 사용)
  const corsProxy = 'https://corsproxy.io/?';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(corsProxy + encodeURIComponent(url));
    const data = await response.json();

    if (data && data[0]) {
      return data[0].map(item => item[0]).filter(Boolean).join('');
    }
    throw new Error('번역 실패');
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// 쉼표 또는 문장 단위로 분리
function splitIntoItems(text) {
  if (text.includes(',')) {
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  const sentences = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.length > 0 ? sentences : [text.trim()];
}

// 아이템 생성 (단어 또는 문장)
function createSentenceItem(mapping, type) {
  const div = document.createElement('div');
  div.className = 'sentence-item' + (isWordMode ? ' word-mode' : '');
  div.dataset.id = mapping.id;

  const text = type === 'original' ? mapping.original : mapping.translated;

  div.innerHTML = `
    <span class="sentence-number">${mapping.id + 1}</span>
    <span class="sentence-text">${escapeHtml(text)}</span>
    <button class="delete-btn" title="삭제 (양쪽 모두 삭제됨)">×</button>
  `;

  div.addEventListener('mouseenter', () => highlightPair(mapping.id, true));
  div.addEventListener('mouseleave', () => highlightPair(mapping.id, false));

  div.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSentence(mapping.id);
  });

  return div;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightPair(id, highlight) {
  const originalItem = originalSentences.querySelector(`[data-id="${id}"]`);
  const translatedItem = translatedSentences.querySelector(`[data-id="${id}"]`);

  if (originalItem) originalItem.classList.toggle('highlighted', highlight);
  if (translatedItem) translatedItem.classList.toggle('highlighted', highlight);
}

// 항목 삭제 (양방향 동기화)
function deleteSentence(id) {
  const originalItem = originalSentences.querySelector(`[data-id="${id}"]`);
  const translatedItem = translatedSentences.querySelector(`[data-id="${id}"]`);

  if (originalItem) originalItem.classList.add('deleting');
  if (translatedItem) translatedItem.classList.add('deleting');

  setTimeout(() => {
    mappings = mappings.filter(m => m.id !== id);

    if (originalItem) originalItem.remove();
    if (translatedItem) translatedItem.remove();

    mappings = mappings.map((m, index) => ({ ...m, id: index }));

    updateResults();
    updateCounts();

    const label = isWordMode ? '단어가' : '문장이';
    showToast(`${label} 양쪽 모두에서 삭제되었습니다`);
  }, 300);
}

function updateResults() {
  const separator = isWordMode ? ', ' : ' ';
  originalResult.textContent = mappings.map(m => m.original).join(separator);
  translatedResult.textContent = mappings.map(m => m.translated).join(separator);
}

function updateCounts() {
  const count = mappings.length;
  const label = isWordMode ? '단어' : '문장';
  originalCount.textContent = `${count} ${label}`;
  translatedCount.textContent = `${count} ${label}`;
}

function renderSentences() {
  originalSentences.innerHTML = '';
  translatedSentences.innerHTML = '';

  if (mappings.length === 0) {
    originalSentences.innerHTML = '<div class="empty-state">번역할 텍스트를 입력하세요<br><small>쉼표(,)로 구분하면 단어별로 처리됩니다</small></div>';
    translatedSentences.innerHTML = '<div class="empty-state">번역 결과가 여기에 표시됩니다</div>';
    return;
  }

  mappings.forEach(mapping => {
    originalSentences.appendChild(createSentenceItem(mapping, 'original'));
    translatedSentences.appendChild(createSentenceItem(mapping, 'translated'));
  });

  updateCounts();
  updateResults();
}

// 번역 실행
async function translate() {
  const text = sourceText.value.trim();

  if (!text) {
    showToast('번역할 텍스트를 입력하세요', true);
    return;
  }

  translateBtn.disabled = true;
  translateBtn.innerHTML = '<span class="loading"></span>번역 중...';

  try {
    const items = splitIntoItems(text);
    isWordMode = text.includes(',');

    const translations = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const translated = await translateText(items[i], sourceLang.value, targetLang.value);
        translations.push({
          id: i,
          original: items[i],
          translated: translated
        });
        // API 요청 간 딜레이
        if (i < items.length - 1) {
          await new Promise(r => setTimeout(r, 150));
        }
      } catch (err) {
        translations.push({
          id: i,
          original: items[i],
          translated: `[번역실패] ${items[i]}`
        });
      }
    }

    mappings = translations;
    renderSentences();

    const label = isWordMode ? '단어' : '문장';
    showToast(`${mappings.length}개 ${label}이(가) 번역되었습니다`);

  } catch (error) {
    showToast(error.message, true);
  } finally {
    translateBtn.disabled = false;
    translateBtn.innerHTML = '번역하기';
  }
}

function swapLanguages() {
  const temp = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = temp;

  if (mappings.length > 0) {
    mappings = mappings.map(m => ({
      ...m,
      original: m.translated,
      translated: m.original
    }));
    renderSentences();
    showToast('언어와 텍스트가 교체되었습니다');
  }
}

function copyToClipboard(targetId) {
  const element = document.getElementById(targetId);
  const text = element.textContent;

  if (!text) {
    showToast('복사할 내용이 없습니다', true);
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('클립보드에 복사되었습니다');
  }).catch(() => {
    showToast('복사 실패', true);
  });
}

// 이벤트 리스너
translateBtn.addEventListener('click', translate);
swapLangs.addEventListener('click', swapLanguages);

sourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    translate();
  }
});

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    copyToClipboard(btn.dataset.target);
  });
});

renderSentences();
