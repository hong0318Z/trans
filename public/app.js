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

  // 호버 시 매핑된 항목 하이라이트
  div.addEventListener('mouseenter', () => highlightPair(mapping.id, true));
  div.addEventListener('mouseleave', () => highlightPair(mapping.id, false));

  // 삭제 버튼 클릭
  div.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSentence(mapping.id);
  });

  return div;
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 매핑된 쌍 하이라이트
function highlightPair(id, highlight) {
  const originalItem = originalSentences.querySelector(`[data-id="${id}"]`);
  const translatedItem = translatedSentences.querySelector(`[data-id="${id}"]`);

  if (originalItem) {
    originalItem.classList.toggle('highlighted', highlight);
  }
  if (translatedItem) {
    translatedItem.classList.toggle('highlighted', highlight);
  }
}

// 항목 삭제 (양방향 동기화)
function deleteSentence(id) {
  const originalItem = originalSentences.querySelector(`[data-id="${id}"]`);
  const translatedItem = translatedSentences.querySelector(`[data-id="${id}"]`);

  // 삭제 애니메이션 적용
  if (originalItem) originalItem.classList.add('deleting');
  if (translatedItem) translatedItem.classList.add('deleting');

  // 애니메이션 후 실제 삭제
  setTimeout(() => {
    // mappings에서 제거
    mappings = mappings.filter(m => m.id !== id);

    // DOM에서 제거
    if (originalItem) originalItem.remove();
    if (translatedItem) translatedItem.remove();

    // ID 재정렬 및 UI 업데이트
    mappings = mappings.map((m, index) => ({
      ...m,
      id: index
    }));

    // 결과 업데이트
    updateResults();
    updateCounts();

    const label = isWordMode ? '단어가' : '문장이';
    showToast(`${label} 양쪽 모두에서 삭제되었습니다`);
  }, 300);
}

// 결과 텍스트 업데이트
function updateResults() {
  const separator = isWordMode ? ', ' : ' ';
  originalResult.textContent = mappings.map(m => m.original).join(separator);
  translatedResult.textContent = mappings.map(m => m.translated).join(separator);
}

// 항목 개수 업데이트
function updateCounts() {
  const count = mappings.length;
  const label = isWordMode ? '단어' : '문장';
  originalCount.textContent = `${count} ${label}`;
  translatedCount.textContent = `${count} ${label}`;
}

// UI 렌더링
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
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        sourceLang: sourceLang.value,
        targetLang: targetLang.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '번역 실패');
    }

    mappings = data.mappings;
    isWordMode = data.isWordMode || false;
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

// 언어 교체
function swapLanguages() {
  const temp = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = temp;

  // 이미 번역된 내용이 있으면 원본/번역 교체
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

// 복사 기능
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

// Enter 키로 번역
sourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    translate();
  }
});

// 복사 버튼
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    copyToClipboard(btn.dataset.target);
  });
});

// 초기 렌더링
renderSentences();
