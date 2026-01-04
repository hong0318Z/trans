// 생성된 파일들 저장
let files = [];

// DOM 요소
const inputText = document.getElementById('inputText');
const parseBtn = document.getElementById('parseBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearBtn = document.getElementById('clearBtn');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');

// 토스트 메시지
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// 입력 텍스트 파싱
function parseInput(text) {
  if (!text.trim()) return [];

  // ; 로 분리
  const entries = text.split(';').map(s => s.trim()).filter(s => s.length > 0);

  const result = [];
  for (const entry of entries) {
    // 첫 번째 - 로 분리 (내용에 - 가 있을 수 있으므로)
    const dashIndex = entry.indexOf(' - ');
    if (dashIndex === -1) {
      // - 가 없으면 파일명만 있는 것으로 처리
      const simpleDash = entry.indexOf('-');
      if (simpleDash !== -1) {
        const name = entry.substring(0, simpleDash).trim();
        const content = entry.substring(simpleDash + 1).trim();
        if (name) {
          result.push({ name: sanitizeFilename(name), content });
        }
      }
      continue;
    }

    const name = entry.substring(0, dashIndex).trim();
    const content = entry.substring(dashIndex + 3).trim();

    if (name) {
      result.push({
        name: sanitizeFilename(name),
        content: content
      });
    }
  }

  return result;
}

// 파일명에서 유효하지 않은 문자 제거
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 파일 목록 렌더링
function renderFiles() {
  if (files.length === 0) {
    fileList.innerHTML = '<div class="empty-preview">파일이 생성되면 여기에 표시됩니다</div>';
    fileCount.textContent = '0개';
    downloadAllBtn.disabled = true;
    return;
  }

  fileCount.textContent = `${files.length}개`;
  downloadAllBtn.disabled = false;

  fileList.innerHTML = files.map((file, index) => `
    <div class="file-item" data-index="${index}">
      <div class="file-header">
        <span class="file-name">${escapeHtml(file.name)}</span>
      </div>
      <div class="file-content">${escapeHtml(file.content)}</div>
      <div class="file-actions">
        <button class="btn-download" onclick="downloadFile(${index})">다운로드</button>
        <button class="btn-copy" onclick="copyContent(${index})">복사</button>
        <button class="btn-delete" onclick="deleteFile(${index})">×</button>
      </div>
    </div>
  `).join('');
}

// 파일 파싱 및 생성
function generateFiles() {
  const text = inputText.value;
  const parsed = parseInput(text);

  if (parsed.length === 0) {
    showToast('파싱할 수 있는 파일이 없습니다. 형식을 확인해주세요.', true);
    return;
  }

  files = parsed;
  renderFiles();
  showToast(`${files.length}개 파일이 생성되었습니다`);
}

// 단일 파일 다운로드
function downloadFile(index) {
  const file = files[index];
  if (!file) return;

  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${file.name}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`${file.name}.txt 다운로드됨`);
}

// 전체 ZIP 다운로드
async function downloadAllAsZip() {
  if (files.length === 0) return;

  try {
    const zip = new JSZip();

    files.forEach(file => {
      zip.file(`${file.name}.txt`, file.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'txt_files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${files.length}개 파일이 ZIP으로 다운로드됨`);
  } catch (error) {
    showToast('ZIP 생성 실패', true);
    console.error(error);
  }
}

// 내용 복사
function copyContent(index) {
  const file = files[index];
  if (!file) return;

  navigator.clipboard.writeText(file.content).then(() => {
    showToast('내용이 복사되었습니다');
  }).catch(() => {
    showToast('복사 실패', true);
  });
}

// 파일 삭제
function deleteFile(index) {
  files.splice(index, 1);
  renderFiles();
  showToast('파일이 삭제되었습니다');
}

// 초기화
function clearAll() {
  files = [];
  inputText.value = '';
  renderFiles();
  showToast('초기화되었습니다');
}

// 이벤트 리스너
parseBtn.addEventListener('click', generateFiles);
downloadAllBtn.addEventListener('click', downloadAllAsZip);
clearBtn.addEventListener('click', clearAll);

// Ctrl+Enter로 파일 생성
inputText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    generateFiles();
  }
});

// 초기 렌더링
renderFiles();
