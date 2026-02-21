import axios from 'axios';
import * as cheerio from 'cheerio';

// Vercel Serverless Function Handler
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

  // 接收前端傳來的參數：遊戲類型 (type) 與 回溯期數 (periods)
  // 前端目前設定為回溯 50 期來做大數據母體
  const { type = 'superLotto', periods = 50 } = req.query;
  
  // 限制抓取期數範圍 (2 ~ 100)，保護 API 不超時
  const limit = Math.min(Math.max(parseInt(periods) || 50, 2), 100);

  try {
    let historyData = [];
    let maxNum = 38;

    // ==========================================
    // 1. 賓果賓果爬蟲邏輯 (使用官方 JSON API)
    // ==========================================
    if (type === 'bingoBingo') {
      maxNum = 80;
      console.log(`開始抓取 Bingo Bingo 近 ${limit} 期資料...`);
      
      // 台彩官網新版 API 端點
      const apiUrl = `https://api.taiwanlottery.com/TLCAPI/api/Lotto/BingoBingo/Result?limit=${limit}`; 
      
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
          },
          timeout: 8000 // 8秒超時限制
        });

        // 解析回傳的 JSON 結構
        if (response.data && response.data.content && response.data.content.bingoBingoResult) {
           historyData = response.data.content.bingoBingoResult.map(item => ({
             drawDate: `第 ${item.period} 期`,
             // 將逗號分隔的字串轉為數字陣列
             numbers: item.blueBall ? item.blueBall.split(',').map(n => parseInt(n)) : [], 
             special: item.superLottoNo ? parseInt(item.superLottoNo) : null,
             bigSmall: item.bigSmall
           }));
        }
      } catch (apiError) {
        console.warn('Bingo API 抓取失敗:', apiError.message);
      }

    // ==========================================
    // 2. 威力彩 / 大樂透爬蟲邏輯 (HTML 解析)
    // ==========================================
    } else {
      let url = '';
      if (type === 'superLotto') {
        url = 'https://www.taiwanlottery.com.tw/lotto/superlotto638/history.aspx';
        maxNum = 38;
      } else if (type === 'lotto649') {
        url = 'https://www.taiwanlottery.com.tw/lotto/Lotto649/history.aspx';
        maxNum = 49;
      }

      if (url) {
        console.log(`開始抓取 ${type} HTML 資料`);
        const response = await axios.get(url, { timeout: 8000 });
        const $ = cheerio.load(response.data);
        const tableRows = $('table.td_hm tr');
        
        tableRows.each((index, element) => {
          const rowText = $(element).text().trim();
          if (!rowText) return;

          const balls = [];
          const special = [];

          // 抓取一般號碼
          $(element).find('span[id*="SNo"]').each((i, el) => {
             const num = parseInt($(el).text(), 10);
             if (!isNaN(num)) balls.push(num);
          });
          
          // 抓取特別號
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

    // ==========================================
    // 3. 備用機制 (若爬蟲失敗，產生模擬大數據)
    // ==========================================
    if (historyData.length === 0) {
      console.log('無法取得真實數據，產生模擬分析數據');
      const count = type === 'bingoBingo' ? 20 : 6;
      for (let i = 0; i < limit; i++) {
         const nums = new Set();
         while(nums.size < count) nums.add(Math.floor(Math.random() * maxNum) + 1);
         historyData.push({
           drawDate: `模擬數據 第 ${113000000 + i} 期`,
           numbers: Array.from(nums),
           special: Math.floor(Math.random() * (type==='superLotto'?8:80)) + 1
         });
      }
    }

    // ==========================================
    // 4. 大數據統計與選號演算法
    // ==========================================
    // 初始化頻率表
    const frequency = {};
    for (let i = 1; i <= maxNum; i++) frequency[i] = 0;

    // 計算每個號碼出現的次數
    historyData.forEach(draw => {
      draw.numbers.forEach(num => {
        if (frequency[num] !== undefined) frequency[num]++;
      });
    });

    // 依照出現次數進行降冪排序 (最常出現的在最前面)
    const sortedNumbers = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a) 
      .map(([num]) => parseInt(num));

    // 取出最熱門與最冷門的號碼供前端顯示
    const hotNumbers = sortedNumbers.slice(0, 20); 
    const coldNumbers = sortedNumbers.slice(-20).reverse();

    // 產生最終 AI 推薦選號
    const generateAiNumbers = () => {
       if (type === 'bingoBingo') {
         // 賓果賓果：直接回傳所有已排序的熱門號碼陣列
         // 前端會根據使用者選的星數 (例如 5 星)，直接從這裡 slice(0, 5) 取出前五個最熱門的
         return sortedNumbers; 
       }

       // 威力彩/大樂透：混合熱門(3個) + 冷門(1個) + 隨機(補滿)
       const selection = new Set();
       while (selection.size < 3) selection.add(hotNumbers[Math.floor(Math.random() * 10)]);
       while (selection.size < 4) selection.add(coldNumbers[Math.floor(Math.random() * 10)]);
       while (selection.size < 6) selection.add(Math.floor(Math.random() * maxNum) + 1);
       return Array.from(selection).sort((a, b) => a - b);
    };

    // 回傳結果給前端
    res.status(200).json({
      success: true,
      data: {
        gameType: type,
        analyzedDraws: historyData.length, // 回傳實際分析了幾期
        hotNumbers: hotNumbers.slice(0, 10), // 儀表板顯示前 10 熱門
        coldNumbers: coldNumbers.slice(0, 10), // 儀表板顯示前 10 冷門
        aiRecommendation: generateAiNumbers(),
        lastDraw: historyData[0] || null, // 提供最新一期的資訊
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: '資料分析失敗', details: error.message });
  }
}
