import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, CircleDollarSign, Ticket, RefreshCw, Trophy, Smartphone, Monitor, Brain, Flame, Snowflake, Download, Share } from 'lucide-react';

const App = () => {
  const [gameType, setGameType] = useState('superLotto');
  const [numbers, setNumbers] = useState([]);
  const [specialNumber, setSpecialNumber] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [scratchStates, setScratchStates] = useState([]); 
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI 分析相關狀態
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null); 
  const [useAi, setUseAi] = useState(false); 

  // PWA 安裝相關狀態
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // --- 1. 自動載入 Tailwind CSS ---
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="tailwindcss"]');
    const handleLoadComplete = () => setTimeout(() => setIsLoading(false), 1200);

    if (existingScript) {
      handleLoadComplete();
    } else {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      script.onload = handleLoadComplete;
      script.onerror = handleLoadComplete;
      document.head.appendChild(script);
    }
    const safetyTimeout = setTimeout(() => setIsLoading(false), 4000);
    return () => clearTimeout(safetyTimeout);
  }, []);

  // --- 2. PWA 初始化與 Meta 標籤注入 ---
  useEffect(() => {
    // 2.1 注入 Meta Tags (讓手機版看起來像 App)
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: '選號王' },
      { name: 'theme-color', content: '#4f46e5' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' } // 禁止縮放，像原生App
    ];

    metaTags.forEach(tag => {
      if (!document.querySelector(`meta[name="${tag.name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = tag.name;
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });

    // 2.2 動態產生 Manifest (App 設定檔)
    // 使用 Data URI 生成一個簡單的獎盃 Icon
    const iconSvg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <rect width="512" height="512" fill="#4f46e5"/>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="250">🏆</text>
      </svg>
    `);
    const iconDataUrl = `data:image/svg+xml;charset=utf-8,${iconSvg}`;

    const manifest = {
      "name": "彩券選號王",
      "short_name": "選號王",
      "start_url": ".",
      "display": "standalone",
      "background_color": "#ffffff",
      "theme_color": "#4f46e5",
      "orientation": "portrait",
      "icons": [
        {
          "src": iconDataUrl,
          "sizes": "512x512",
          "type": "image/svg+xml"
        }
      ]
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], {type: 'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = manifestURL;

    // 2.3 監聽安裝事件 (Android/Desktop)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 觸發安裝
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // 偵測裝置尺寸
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const formatNumber = (num) => {
    if (num === null) return '??';
    return num < 10 ? `0${num}` : `${num}`;
  };

  const generateUniqueNumbers = (count, min, max, sort = true) => {
    const nums = new Set();
    while (nums.size < count) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    const arr = Array.from(nums);
    return sort ? arr.sort((a, b) => a - b) : arr;
  };

  const fetchAiNumbers = async () => {
    try {
      const apiUrl = `/api/analyze-lottery?type=${gameType}`;
      const res = await fetch(apiUrl);
      const json = await res.json();
      
      if (json.success) {
        return json.data;
      } else {
        throw new Error(json.error || 'API Error');
      }
    } catch (error) {
      console.error("AI Analysis Failed, falling back to random:", error);
      return null;
    }
  };

  const handleGenerate = useCallback(async (mode = 'random') => {
    if (isRolling || isAiAnalyzing) return;
    if (gameType === 'scratch') mode = 'random';

    setUseAi(mode === 'ai');
    setIsRolling(true);
    if (mode === 'ai') setIsAiAnalyzing(true);
    
    if (gameType === 'scratch') {
      setScratchStates(Array(6).fill(true));
    }
    
    if (mode === 'random') setAnalysisData(null);

    let aiResult = null;
    if (mode === 'ai') {
      aiResult = await fetchAiNumbers();
      if (aiResult) {
        setAnalysisData({
          hot: aiResult.hotNumbers,
          cold: aiResult.coldNumbers,
          lastDraw: aiResult.lastDraw
        });
      }
    }

    setIsAiAnalyzing(false);

    let intervalId;
    const duration = 800;
    const startTime = Date.now();

    const updateNumbers = () => {
      const now = Date.now();
      
      if (gameType === 'superLotto') {
        setNumbers(generateUniqueNumbers(6, 1, 38));
        setSpecialNumber(Math.floor(Math.random() * 8) + 1);
      } else if (gameType === 'lotto649') {
        setNumbers(generateUniqueNumbers(6, 1, 49));
        setSpecialNumber(null);
      } else if (gameType === 'scratch') {
        const smallNums = generateUniqueNumbers(3, 1, 99, false);
        const bigNums = generateUniqueNumbers(3, 100, 999, false);
        setNumbers([...smallNums, ...bigNums]);
        setSpecialNumber(null);
      }

      if (now - startTime > duration) {
        clearInterval(intervalId);
        setIsRolling(false);
        
        if (mode === 'ai' && aiResult) {
          setNumbers(aiResult.aiRecommendation);
          if (gameType === 'superLotto') {
             setSpecialNumber(Math.floor(Math.random() * 8) + 1);
          }
        } else {
          finalizeRandomNumbers();
        }
      }
    };

    intervalId = setInterval(updateNumbers, 50);
  }, [gameType]);

  const finalizeRandomNumbers = () => {
    if (gameType === 'superLotto') {
      setNumbers(generateUniqueNumbers(6, 1, 38));
      setSpecialNumber(Math.floor(Math.random() * 8) + 1);
    } else if (gameType === 'lotto649') {
      setNumbers(generateUniqueNumbers(6, 1, 49));
    } else if (gameType === 'scratch') {
      const smallNums = generateUniqueNumbers(3, 1, 99, false);
      const bigNums = generateUniqueNumbers(3, 100, 999, false);
      setNumbers([...smallNums, ...bigNums]);
    }
  };

  useEffect(() => {
    setNumbers([]);
    setSpecialNumber(null);
    setIsRolling(false);
    setAnalysisData(null);
    setUseAi(false);
    setScratchStates(Array(6).fill(true));
  }, [gameType]);

  const handleScratchClick = (index) => {
    if (isRolling) return;
    const newStates = [...scratchStates];
    newStates[index] = false;
    setScratchStates(newStates);
  };

  const LottoBall = ({ num, colorClass, label, isHot, isCold }) => (
    <div className="flex flex-col items-center animate-bounce-short relative group">
      {isHot && <div className="absolute -top-2 -right-2 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 z-10 animate-pulse border border-white">🔥</div>}
      {isCold && <div className="absolute -top-2 -right-2 text-xs bg-blue-400 text-white rounded-full px-1.5 py-0.5 z-10 border border-white">❄️</div>}
      
      <div className={`
        w-10 h-10 text-lg 
        sm:w-16 sm:h-16 sm:text-2xl 
        md:w-20 md:h-20 md:text-3xl
        rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white/30 ${colorClass} text-white transition-all duration-300`}>
        {formatNumber(num)}
      </div>
      {label && <span className="text-[10px] sm:text-xs text-gray-500 mt-1">{label}</span>}
    </div>
  );

  // --- 載入畫面 ---
  if (isLoading) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, #3730a3, #4f46e5)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes custom-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
          @keyframes custom-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        `}} />
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
           <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
             <div style={{ width: '2rem', height: '2rem', backgroundColor: '#2dd4bf', borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(45, 212, 191, 0.5)', animation: 'custom-bounce 0.6s infinite ease-in-out', animationDelay: '0ms' }}></div>
             <div style={{ width: '2rem', height: '2rem', backgroundColor: '#facc15', borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(250, 204, 21, 0.5)', animation: 'custom-bounce 0.6s infinite ease-in-out', animationDelay: '150ms' }}></div>
             <div style={{ width: '2rem', height: '2rem', backgroundColor: '#ec4899', borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(236, 72, 153, 0.5)', animation: 'custom-bounce 0.6s infinite ease-in-out', animationDelay: '300ms' }}></div>
           </div>
        </div>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>彩券選號王</h2>
        <p style={{ color: 'rgba(224, 231, 255, 0.9)', fontSize: '0.875rem', animation: 'custom-pulse 2s infinite ease-in-out' }}>正在準備您的幸運號碼...</p>
      </div>
    );
  }

  // --- 主應用程式 ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-start sm:justify-center font-sans sm:p-4">
      <div className="bg-white w-full max-w-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-gray-100 flex flex-col min-h-screen sm:min-h-0 sm:h-auto transition-all duration-500 relative">
        
        {/* 安裝按鈕 (僅在可安裝時顯示) */}
        {showInstallBtn && (
          <button 
            onClick={handleInstallClick}
            className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 text-xs font-bold animate-pulse hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-3 h-3" /> 安裝 App
          </button>
        )}

        {/* Header */}
        <div className="bg-indigo-600 p-4 sm:p-8 text-center relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
             <div className="absolute top-20 right-10 w-20 h-20 bg-yellow-300 rounded-full mix-blend-overlay filter blur-xl"></div>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white flex items-center justify-center gap-2 sm:gap-3">
              <Trophy className="w-6 h-6 sm:w-10 sm:h-10 text-yellow-300" />
              彩券選號王
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-indigo-200 text-xs sm:text-sm">
                {isMobile ? "手機版介面" : "電腦版介面"}
              </p>
              {isMobile ? <Smartphone className="w-3 h-3 text-indigo-200"/> : <Monitor className="w-3 h-3 text-indigo-200"/>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-50 border-b border-gray-200 sticky top-0 z-20 sm:static">
          <button
            onClick={() => setGameType('superLotto')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'superLotto' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" /> 威力彩
          </button>
          <button
            onClick={() => setGameType('lotto649')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'lotto649' ? 'bg-white text-yellow-600 border-b-4 border-yellow-500' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <CircleDollarSign className="w-5 h-5 sm:w-4 sm:h-4" /> 大樂透
          </button>
          <button
            onClick={() => setGameType('scratch')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'scratch' ? 'bg-white text-pink-600 border-b-4 border-pink-500' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Ticket className="w-5 h-5 sm:w-4 sm:h-4" /> 刮刮樂
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow p-4 sm:p-10 flex flex-col items-center justify-start sm:justify-center bg-gray-50/50 min-h-[50vh] sm:min-h-[300px]">
          
          {/* AI 分析提示區 */}
          {useAi && analysisData && (
            <div className="w-full max-w-lg mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-3 sm:p-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-800">大數據分析結果</h3>
                <span className="text-xs text-gray-500 ml-auto">{analysisData.lastDraw ? `更新至: ${analysisData.lastDraw.drawDate}` : '模擬數據分析'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Flame className="w-3 h-3 text-red-500" /> 近期熱門
                  </div>
                  <div className="text-sm font-bold text-gray-800 tracking-wide">
                    {analysisData.hot.slice(0, 5).map(n => formatNumber(n)).join(' ')}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Snowflake className="w-3 h-3 text-blue-400" /> 近期冷門
                  </div>
                  <div className="text-sm font-bold text-gray-800 tracking-wide">
                    {analysisData.cold.slice(0, 5).map(n => formatNumber(n)).join(' ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 威力彩顯示區 */}
          {gameType === 'superLotto' && (
            <div className="w-full text-center animate-fade-in">
              <div className="mb-4 sm:mb-6">
                <div className="mb-3 text-indigo-900 font-semibold bg-indigo-100 inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm shadow-sm">第一區 (01-38)</div>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                  {numbers.length > 0 ? (
                    numbers.map((num, idx) => {
                      const isHot = analysisData?.hot.includes(num);
                      const isCold = analysisData?.cold.includes(num);
                      return <LottoBall key={idx} num={num} colorClass="bg-gradient-to-br from-teal-400 to-teal-600" isHot={isHot} isCold={isCold} />;
                    })
                  ) : (
                    <div className="text-gray-400 italic py-8 text-sm sm:text-base">準備好迎接財富了嗎？</div>
                  )}
                </div>
              </div>
              
              {specialNumber !== null && (
                <div className="mt-6 sm:mt-8">
                  <div className="flex items-center justify-center mb-4 opacity-50">
                     <div className="h-px w-10 sm:w-20 bg-gray-400"></div>
                     <span className="mx-3 text-gray-500 text-xs sm:text-sm">特別號</span>
                     <div className="h-px w-10 sm:w-20 bg-gray-400"></div>
                  </div>
                  <div className="inline-block relative">
                     <LottoBall num={specialNumber} colorClass="bg-gradient-to-br from-red-500 to-red-700" />
                  </div>
                  <div className="mt-2 text-red-800 font-medium text-xs sm:text-sm">第二區 (01-08)</div>
                </div>
              )}
            </div>
          )}

          {/* 大樂透顯示區 */}
          {gameType === 'lotto649' && (
            <div className="w-full text-center animate-fade-in">
              <div className="mb-8 text-yellow-800 font-semibold bg-yellow-100 inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm shadow-sm">01 ~ 49 任選 6 碼</div>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-5 max-w-lg mx-auto">
                {numbers.length > 0 ? (
                  numbers.map((num, idx) => {
                    const isHot = analysisData?.hot.includes(num);
                    const isCold = analysisData?.cold.includes(num);
                    return <LottoBall key={idx} num={num} colorClass="bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-yellow-200" isHot={isHot} isCold={isCold} />;
                  })
                ) : (
                  <div className="text-gray-400 italic py-8 text-sm sm:text-base">按下按鈕，幸運降臨</div>
                )}
              </div>
            </div>
          )}

          {/* 刮刮樂顯示區 (6個號碼：3小 + 3大) */}
          {gameType === 'scratch' && (
            <div className="w-full flex flex-col items-center animate-fade-in">
              <div className="mb-6 text-pink-800 font-semibold bg-pink-100 inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm shadow-sm">
                幸運號碼 (1-99 三組 + 100-999 三組)
              </div>
              
              <div className="flex flex-wrap justify-center gap-4 w-full">
                {numbers.length > 0 ? (
                  numbers.map((num, index) => (
                    <div 
                      key={index}
                      className="relative w-24 h-24 sm:w-32 sm:h-32 bg-gray-200 rounded-xl shadow-inner border-2 sm:border-4 border-gray-300 overflow-hidden cursor-pointer select-none transition-transform active:scale-95 hover:shadow-lg"
                      onClick={() => handleScratchClick(index)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-white pattern-dots">
                        <span className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 transform transition-all duration-500 ${
                          isRolling ? 'scale-75 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'
                        } text-2xl sm:text-4xl`}>
                          {num}
                        </span>
                      </div>
                      <div className={`absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 flex flex-col items-center justify-center transition-all duration-500 ${
                        scratchStates[index] ? 'opacity-100' : 'opacity-0 pointer-events-none transform scale-110'
                      }`}>
                         <span className="text-gray-100 font-bold text-sm sm:text-lg drop-shadow-md">刮</span>
                      </div>
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black to-transparent pointer-events-none"></div>
                    </div>
                  ))
                ) : (
                  <div className="relative w-full max-w-xs aspect-[2/1] bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                    點擊按鈕產生 6 組幸運號碼
                  </div>
                )}
              </div>
              <p className="mt-6 text-sm text-gray-500 animate-pulse">
                {numbers.length > 0 && !isRolling ? "👇 點擊個別卡片刮開號碼" : "✨ 試試手氣！包含大小號碼！"}
              </p>
            </div>
          )}

        </div>

        {/* Footer / Action */}
        <div className={`
          p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-center items-center
          ${isMobile ? 'sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]' : ''}
        `}>
          <button
            onClick={() => handleGenerate('random')}
            disabled={isRolling || isAiAnalyzing}
            className={`
              w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full text-gray-700 font-bold text-base shadow-sm border border-gray-200
              flex items-center justify-center gap-2 transition-all active:scale-95
              ${(isRolling && !useAi) ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}
            `}
          >
            <RefreshCw className={`w-5 h-5 ${(isRolling && !useAi) ? 'animate-spin' : ''}`} />
            {(isRolling && !useAi) ? '選號中...' : '隨機選號'}
          </button>

          {gameType !== 'scratch' && (
            <button
              onClick={() => handleGenerate('ai')}
              disabled={isRolling || isAiAnalyzing}
              className={`
                w-full sm:w-auto px-8 py-3 rounded-xl sm:rounded-full text-white font-bold text-base shadow-xl
                flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95
                ${(isRolling && useAi) || isAiAnalyzing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-indigo-200 hover:ring-2 hover:ring-indigo-300'}
              `}
            >
              {isAiAnalyzing ? (
                <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   分析數據中...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  AI 大數據選號
                </>
              )}
            </button>
          )}
          
          {gameType === 'scratch' && (
             <button
             onClick={() => handleGenerate('random')}
             disabled={isRolling}
             className={`
               w-full sm:w-auto px-8 py-3 rounded-xl sm:rounded-full text-white font-bold text-base shadow-xl
               flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95
               ${isRolling ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-pink-200'}
             `}
           >
             <Ticket className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
             {isRolling ? '準備中...' : '開始刮刮樂'}
           </button>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-bounce-short { animation: bounce-short 0.5s ease-in-out; }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .pattern-dots { background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 10px 10px; }
      `}} />
    </div>
  );
};

export default App;
