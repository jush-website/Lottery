import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // 設定 CORS 允許前端跨域呼叫
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 接收前端參數：type(類型), periods(回溯期數 2~12), stars(玩法星數 1~10)
  const { type = 'bingoBingo', periods = 2, stars = 5 } = req.query;
  
  // 確保期數在 2~12 之間
  const limit = Math.min(Math.max(parseInt(periods) || 2, 2), 12);
  const starCount = Math.min(Math.max(parseInt(stars) || 5, 1), 10);

  try {
    let historyData = [];
    let maxNum = 80;

    // ★ 變數準備：儲存從外部網頁抓取到的 AI 資料
    let externalAiNumbers = [];
    let externalConfidence = null;

    // ==========================================
    // 1. 賓果賓果專屬爬蟲 (台彩官方 + 外部 jyb.one AI)
    // ==========================================
    if (type === 'bingoBingo') {
      console.log(`開始抓取 Bingo Bingo 近 ${limit} 期資料...`);
      // (A) 抓取台彩歷史資料
      const apiUrl = `https://api.taiwanlottery.com/TLCAPI/api/Lotto/BingoBingo/Result?limit=${limit}`; 
      
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 5000
        });

        if (response.data?.content?.bingoBingoResult) {
           historyData = response.data.content.bingoBingoResult.map(item => ({
             drawDate: `第 ${item.period} 期`,
             numbers: item.blueBall ? item.blueBall.split(',').map(n => parseInt(n)) : [], 
             special: item.superLottoNo ? parseInt(item.superLottoNo) : null,
             bigSmall: item.bigSmall
           }));
        }
      } catch (apiError) {
        console.warn('Bingo 台彩 API 抓取失敗:', apiError.message);
      }

      // (B) 嘗試抓取外部網站 (jyb.one/bingo) 的 AI 推薦數據與信心指數
      try {
        console.log('開始抓取外部 AI 推薦 (https://jyb.one/bingo)...');
        const jybRes = await axios.get('https://jyb.one/bingo', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml'
          },
          timeout: 5000 // 避免超時卡住
        });
        
        const $jyb = cheerio.load(jybRes.data);
        
        // 【提醒】：以下選擇器 (.ai-number, .confidence 等) 為假設的 Class 名稱。
        // 若抓不到資料，您需要打開瀏覽器 F12 觀察 jyb.one/bingo 網站實際的 HTML 結構並修改這裡的字串。
        // 尋找推薦號碼
        $jyb('.ai-number, .recommend-num, .ball-number, .recommend-box span').each((i, el) => {
           const num = parseInt($jyb(el).text().trim(), 10);
           if (!isNaN(num) && num >= 1 && num <= 80) {
             externalAiNumbers.push(num);
           }
        });
        
        // 尋找信心指數 (如 "85%" 或 "高信心")
        const confidenceText = $jyb('.confidence-index, .score, .confidence-score').first().text().trim();
        if (confidenceText) {
           externalConfidence = confidenceText;
        }

        // 去除重複的號碼
        externalAiNumbers = [...new Set(externalAiNumbers)];
        console.log('外部 AI 號碼擷取:', externalAiNumbers, '信心指數:', externalConfidence);

      } catch (err) {
        console.warn('外部 jyb.one 抓取失敗，將自動回退至本地大數據演算法:', err.message);
      }

    } else {
      // 威力彩/大樂透 爬蟲
      let url = type === 'superLotto' 
        ? 'https://www.taiwanlottery.com.tw/lotto/superlotto638/history.aspx'
        : 'https://www.taiwanlottery.com.tw/lotto/Lotto649/history.aspx';
      maxNum = type === 'superLotto' ? 38 : 49;

      if (url) {
        const response = await axios.get(url, { timeout: 8000 });
        const $ = cheerio.load(response.data);
        $('table.td_hm tr').each((index, element) => {
          const rowText = $(element).text().trim();
          if (!rowText) return;
          const balls = [];
          const special = [];
          $(element).find('span[id*="SNo"]').each((i, el) => {
             const num = parseInt($(el).text(), 10);
             if (!isNaN(num)) balls.push(num);
          });
          $(element).find('span[id*="No7"], span[id*="SNo7"]').each((i, el) => {
             const num = parseInt($(el).text(), 10);
             if (!isNaN(num)) special.push(num);
          });
          if (balls.length >= 6) {
            historyData.push({
              drawDate: $(element).find('span[id*="DrawDate"]').text(),
              numbers: balls.slice(0, 6),
              special: special[0] || null
            });
          }
        });
      }
    }

    // 若抓取失敗的備用模擬資料
    if (historyData.length === 0) {
      const count = type === 'bingoBingo' ? 20 : 6;
      for (let i = 0; i < limit; i++) {
         const nums = new Set();
         while(nums.size < count) nums.add(Math.floor(Math.random() * maxNum) + 1);
         historyData.push({
           drawDate: `模擬 第 ${115014200 - i} 期`,
           numbers: Array.from(nums),
           special: Math.floor(Math.random() * (type === 'superLotto' ? 8 : 80)) + 1
         });
      }
    }

    // ==========================================
    // 2. 本地大數據分析：未出現(冷) vs 常出現(熱)
    // ==========================================
    const frequency = {};
    for (let i = 1; i <= maxNum; i++) frequency[i] = 0;

    historyData.forEach(draw => {
      draw.numbers.forEach(num => {
        if (frequency[num] !== undefined) frequency[num]++;
      });
    });

    const hotNumbers = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1]) 
      .map(item => parseInt(item[0]));

    const coldNumbers = Object.entries(frequency)
      .sort((a, b) => a[1] - b[1]) 
      .map(item => parseInt(item[0]));

    // ==========================================
    // 3. AI 智慧選號演算法 (混合外部AI與冷熱)
    // ==========================================
    const generateAiNumbers = () => {
       const selection = new Set();
       
       if (type === 'bingoBingo') {
           // ★ 優先放入從外部網站爬蟲到的 AI 號碼
           let eIdx = 0;
           while (selection.size < starCount && eIdx < externalAiNumbers.length) {
               selection.add(externalAiNumbers[eIdx]);
               eIdx++;
           }

           // 如果外部號碼不夠填滿使用者選擇的星數，用本地演算法補齊
           const remainingNeeded = starCount - selection.size;
           if (remainingNeeded > 0) {
               const hotTarget = Math.ceil(remainingNeeded / 2);
               let hIdx = 0, cIdx = 0;
               
               while(selection.size < starCount && hIdx < hotNumbers.length) {
                   if (selection.size < (starCount - remainingNeeded + hotTarget)) {
                       selection.add(hotNumbers[hIdx]);
                   }
                   hIdx++;
               }
               while(selection.size < starCount && cIdx < coldNumbers.length) {
                   selection.add(coldNumbers[cIdx]);
                   cIdx++;
               }
               while(selection.size < starCount) {
                   selection.add(Math.floor(Math.random() * maxNum) + 1);
               }
           }
           return Array.from(selection).sort((a, b) => a - b);
       } else {
           // 威力彩/大樂透邏輯
           while (selection.size < 3) selection.add(hotNumbers[Math.floor(Math.random() * 10)]);
           while (selection.size < 4) selection.add(coldNumbers[Math.floor(Math.random() * 10)]);
           while (selection.size < 6) selection.add(Math.floor(Math.random() * maxNum) + 1);
           return Array.from(selection).sort((a, b) => a - b);
       }
    };

    // 將資料打包回傳至前端
    res.status(200).json({
      success: true,
      data: {
        gameType: type,
        analyzedDraws: historyData.length,
        hotNumbers: hotNumbers.slice(0, 10),  
        coldNumbers: coldNumbers.slice(0, 10), 
        aiRecommendation: generateAiNumbers(),
        lastDraw: historyData[0] || null, 
        firstDraw: historyData[historyData.length - 1] || null,
        confidenceIndex: externalConfidence // ★ 輸出信心指數給前端顯示
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: '分析失敗', details: error.message });
  }
}
