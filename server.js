const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MyMemory 무료 번역 API 사용
async function translateText(text, sourceLang, targetLang) {
  if (!text.trim()) return '';

  const langPair = `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200) {
      return data.responseData.translatedText;
    }
    throw new Error(data.responseDetails || '번역 실패');
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// 문장 단위로 분리 (마침표, 물음표, 느낌표, 줄바꿈 기준)
function splitIntoSentences(text) {
  // 문장 종결 기호로 분리하되, 빈 문장 제거
  const sentences = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.length > 0 ? sentences : [text];
}

// 번역 API - 문장 단위로 번역하고 매핑 정보 반환
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: '필수 파라미터가 없습니다.' });
    }

    // 문장 단위로 분리
    const sentences = splitIntoSentences(text);

    // 각 문장을 개별적으로 번역
    const translations = await Promise.all(
      sentences.map(async (sentence, index) => {
        const translated = await translateText(sentence, sourceLang, targetLang);
        return {
          id: index,
          original: sentence,
          translated: translated
        };
      })
    );

    res.json({
      success: true,
      mappings: translations,
      originalText: text,
      translatedText: translations.map(t => t.translated).join(' ')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 단일 문장 번역 (실시간 수정용)
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
  console.log(`🌐 Translation Sync Server running at http://localhost:${PORT}`);
});
