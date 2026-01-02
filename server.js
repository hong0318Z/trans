const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Google Translate 무료 API 사용 (더 안정적)
async function translateText(text, sourceLang, targetLang) {
  if (!text.trim()) return '';

  // Google Translate 무료 엔드포인트
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const contentType = response.headers.get('content-type');

    // HTML 응답 체크 (에러 페이지)
    if (contentType && contentType.includes('text/html')) {
      throw new Error('번역 서비스에 연결할 수 없습니다');
    }

    const text_response = await response.text();

    try {
      const data = JSON.parse(text_response);
      // Google Translate 응답 형식: [[["translated","original",...],...],...]
      if (data && data[0]) {
        return data[0].map(item => item[0]).join('');
      }
      throw new Error('번역 결과를 파싱할 수 없습니다');
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Response:', text_response.substring(0, 200));
      throw new Error('번역 응답 파싱 실패');
    }
  } catch (error) {
    console.error('Translation error:', error.message);
    throw error;
  }
}

// 쉼표 또는 문장 단위로 분리
function splitIntoItems(text) {
  // 쉼표가 있으면 쉼표로 분리 (단어 모드)
  if (text.includes(',')) {
    return text
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // 쉼표가 없으면 문장 종결 기호로 분리
  const sentences = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.length > 0 ? sentences : [text.trim()];
}

// 번역 API - 단어/문장 단위로 번역하고 매핑 정보 반환
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: '필수 파라미터가 없습니다.' });
    }

    // 쉼표 또는 문장 단위로 분리
    const items = splitIntoItems(text);
    const isWordMode = text.includes(',');

    // 각 항목을 개별적으로 번역
    const translations = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const translated = await translateText(items[i], sourceLang, targetLang);
        translations.push({
          id: i,
          original: items[i],
          translated: translated
        });
        // API 요청 간 약간의 딜레이 (rate limit 방지)
        if (i < items.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (err) {
        // 개별 번역 실패 시 원본 유지
        translations.push({
          id: i,
          original: items[i],
          translated: `[번역실패] ${items[i]}`
        });
      }
    }

    res.json({
      success: true,
      mappings: translations,
      originalText: text,
      translatedText: translations.map(t => t.translated).join(isWordMode ? ', ' : ' '),
      isWordMode: isWordMode
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 단일 항목 번역
app.post('/api/translate-single', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const translated = await translateText(text, sourceLang, targetLang);
    res.json({ success: true, translated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Translation Sync Server running at http://localhost:${PORT}`);
});
