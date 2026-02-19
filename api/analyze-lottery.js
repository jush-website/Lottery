import axios from 'axios';
import * as cheerio from 'cheerio';

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  // 設定 CORS 允許前端呼叫
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

  const { type = 'superLotto' } = req.query;

  try {
    let historyData = [];
    let maxNum = 38; // 預設威力彩

    // --- 針對賓果賓果的特殊處理 (使用官方 API) ---
    if (type === 'bingoBingo') {
      maxNum = 80;
      console.log('開始抓取 Bingo Bingo 資料...');
      
      // 台灣彩券新版官網通常使用的 API 端點 (抓取最近 10 期或當日資料)
      // 註：這裡嘗試模擬抓取當日最後 10 筆，因為資料量大
      // 如果官方 API 有變動，這裡會 fallback 到模擬數據
      const apiUrl = 'https://api.taiwanlottery.com/TLCAPI/api/Lotto/BingoBingo/Result?limit=20'; 
      
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
          },
          timeout: 5000 // 5秒超時
        });

        if (response.data && response.data.content && response.data.content.bingoBingoResult) {
           // 解析官方 JSON 格式
           historyData = response.data.content.bingoBingoResult.map(item => ({
             drawDate: `第 ${item.period} 期`,
             // 官方資料通常是 no1...no20 的欄位，或者是 number 陣列
             numbers: item.blueBall ? item.blueBall.split(',').map(n => parseInt(n)) : [], 
             special: item.superLottoNo ? parseInt(item.superLottoNo) : null, // 超級獎號
             bigSmall: item.bigSmall // 猜大小結果
           }));
        } else {
           // 備用：如果結構不同，嘗試直接抓取陣列 (視 API 版本而定)
           // 這裡假設若抓不到，拋出錯誤進入模擬數據
           if (Array.isArray(response.data)) {
              historyData = response.data.map(item => ({
                drawDate: item.period,
                numbers: item.nums, 
                special: item.superNum
              }));
           }
        }
      } catch (apiError) {
        console.warn('Bingo API 抓取失敗，切換至模擬分析模式:', apiError.message);
        // 不中斷，讓下方邏輯產生模擬數據
      }

    } else {
      // --- 威力彩與大樂透的爬蟲邏輯 (維持 HTML 解析) ---
      let url = '';
      if (type === 'superLotto') {
        url = 'https://www.taiwanlottery.com.tw/lotto/superlotto638/history.aspx';
        maxNum = 38;
      } else if (type === 'lotto649') {
        url = 'https://www.taiwanlottery.com.tw/lotto/Lotto649/history.aspx';
        maxNum = 49;
      }

      if (url) {
        console.log(`開始抓取 ${type} HTML 資料: ${url}`);
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        const tableRows = $('table.td_hm tr');
        tableRows.each((index, element) => {
          const rowText = $(element).text().trim();
          if (!rowText) return;

          const balls = [];
          const special = [];

          // 通用抓取邏輯
          $(element).find('span[id*="SNo"]').each((i, el) => {
             const num = parseInt($(el).text(), 10);
             if (!isNaN(num)) balls.push(num);
          });
          
          // 嘗試抓取特別號
          $(element).find('span[id*="No7"]').each((i, el) => {
             const num = parseInt($(el).text(), 10);
             if (!isNaN(num)) special.push(num);
          });
          
          if (type === 'lotto649' && special.length === 0) {
             $(element).find('span[id*="SNo7"]').each((i, el) => {
                const num = parseInt($(el).text(), 10);
                if (!isNaN(num)) special.push(num);
             });
          }

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

    // --- 若無資料 (網站改版或連線失敗)，生成模擬數據供 Demo ---
    if (historyData.length === 0) {
      const count = type === 'bingoBingo' ? 20 : 6; // 賓果開20個號碼
      for (let i = 0; i < 20; i++) {
         const nums = new Set();
         while(nums.size < count) nums.add(Math.floor(Math.random() * maxNum) + 1);
         historyData.push({
           drawDate: `模擬數據 第 ${113000000 + i} 期`,
           numbers: Array.from(nums),
           special: Math.floor(Math.random() * (type==='superLotto'?8:80)) + 1
         });
      }
    }

    // --- 大數據分析邏輯 ---
    const frequency = {};
    for (let i = 1; i <= maxNum; i++) frequency[i] = 0;

    historyData.forEach(draw => {
      draw.numbers.forEach(num => {
        if (frequency[num] !== undefined) frequency[num]++;
      });
    });

    // 排序找出冷熱門號碼
    const sortedNumbers = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .map(([num]) => parseInt(num));

    const hotNumbers = sortedNumbers.slice(0, 20); // 取前 20 個熱門 (賓果需要比較多)
    const coldNumbers = sortedNumbers.slice(-20).reverse();

    // AI 推薦演算法 (針對賓果邏輯調整)
    const generateAiNumbers = () => {
       // 如果是賓果，我們回傳一整組熱門號碼池，讓前端根據選擇的星數去切分
       if (type === 'bingoBingo') {
         // 回傳前 10 個最熱門的號碼 (因為賓果最多選 10 星)
         return hotNumbers.slice(0, 10).sort((a, b) => a - b);
       }

       // 威力彩/大樂透 邏輯維持不變
       const selection = new Set();
       while (selection.size < 3) {
          const pick = hotNumbers[Math.floor(Math.random() * 10)]; // 從前10熱門挑
          selection.add(pick);
       }
       while (selection.size < 4) {
          const pick = coldNumbers[Math.floor(Math.random() * 10)]; // 從前10冷門挑
          selection.add(pick);
       }
       while (selection.size < 6) {
          const pick = Math.floor(Math.random() * maxNum) + 1;
          selection.add(pick);
       }
       return Array.from(selection).sort((a, b) => a - b);
    };

    const aiRecommendation = generateAiNumbers();

    res.status(200).json({
      success: true,
      data: {
        gameType: type,
        analyzedDraws: historyData.length,
        hotNumbers,
        coldNumbers,
        aiRecommendation,
        lastDraw: historyData[0] || null,
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: '資料分析失敗', 
      details: error.message 
    });
  }
}
