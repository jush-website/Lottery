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

    // ==========================================
    // 1. 賓果賓果爬蟲 (即時抓取台彩官方 API)
    // ==========================================
    if (type === 'bingoBingo') {
      console.log(`開始抓取 Bingo Bingo 近 ${limit} 期資料...`);
      // 使用 limit 參數抓取對應的最新期數
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
             drawDate: `第 ${item.period} 期`, // 這裡包含完整的期數號碼
             numbers: item.blueBall ? item.blueBall.split(',').map(n => parseInt(n)) : [], 
             special: item.superLottoNo ? parseInt(item.superLottoNo) : null,
             bigSmall: item.bigSmall
           }));
        }
      } catch (apiError) {
        console.warn('Bingo API 抓取失敗:', apiError.message);
      }
    } else {
      // 威力彩/大樂透 爬蟲保留...
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
           // 模擬產生遞減的期數 (新 -> 舊)
           drawDate: `模擬 第 ${115014200 - i} 期`,
           numbers: Array.from(nums),
           special: Math.floor(Math.random() * (type === 'superLotto' ? 8 : 80)) + 1
         });
      }
    }

    // ==========================================
    // 2. 大數據分析：未出現(冷) vs 常出現(熱)
    // ==========================================
    const frequency = {};
    for (let i = 1; i <= maxNum; i++) frequency[i] = 0;

    historyData.forEach(draw => {
      draw.numbers.forEach(num => {
        if (frequency[num] !== undefined) frequency[num]++;
      });
    });

    // 熱門號碼 (出現次數多到少)
    const hotNumbers = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1]) 
      .map(item => parseInt(item[0]));

    // 冷門/未出現號碼 (出現次數少到多，優先取 0 次的)
    const coldNumbers = Object.entries(frequency)
      .sort((a, b) => a[1] - b[1]) 
      .map(item => parseInt(item[0]));

    // ==========================================
    // 3. AI 智慧選號演算法 (混合冷熱)
    // ==========================================
    const generateAiNumbers = () => {
       const selection = new Set();
       
       if (type === 'bingoBingo') {
           // 策略：一半取熱門常出現，一半取冷門未出現 (根據使用者選的星數分配)
           const hotCount = Math.ceil(starCount / 2);
           
           let hIdx = 0, cIdx = 0;
           // 挑選常出現號碼
           while(selection.size < hotCount && hIdx < hotNumbers.length) {
               selection.add(hotNumbers[hIdx]);
               hIdx++;
           }
           // 挑選未出現號碼
           while(selection.size < starCount && cIdx < coldNumbers.length) {
               selection.add(coldNumbers[cIdx]);
               cIdx++;
           }
           // 萬一不夠則隨機補滿
           while(selection.size < starCount) {
               selection.add(Math.floor(Math.random() * maxNum) + 1);
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

    res.status(200).json({
      success: true,
      data: {
        gameType: type,
        analyzedDraws: historyData.length,
        hotNumbers: hotNumbers.slice(0, 10),  // 傳回前10名常出現
        coldNumbers: coldNumbers.slice(0, 10), // 傳回前10名未出現/極少出現
        aiRecommendation: generateAiNumbers(),
        lastDraw: historyData[0] || null, // 最新一期
        firstDraw: historyData[historyData.length - 1] || null // 最舊一期 (用來顯示區間)
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: '分析失敗', details: error.message });
  }
}
