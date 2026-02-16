import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, CircleDollarSign, Ticket, RefreshCw, Trophy, Smartphone, Monitor } from 'lucide-react';

const App = () => {
  const [gameType, setGameType] = useState('superLotto'); // superLotto, lotto649, scratch
  const [numbers, setNumbers] = useState([]);
  const [specialNumber, setSpecialNumber] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [scratchCovered, setScratchCovered] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // --- 自動載入 Tailwind CSS (修復樣式遺失問題) ---
  useEffect(() => {
    // 檢查是否已經有 Tailwind，如果沒有則動態插入 CDN
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // 偵測裝置尺寸
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 格式化數字，小於10補0
  const formatNumber = (num) => {
    if (num === null) return '??';
    return num < 10 ? `0${num}` : `${num}`;
  };

  // 產生不重複隨機數字
  const generateUniqueNumbers = (count, min, max) => {
    const nums = new Set();
    while (nums.size < count) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(nums).sort((a, b) => a - b);
  };

  // 主要開獎邏輯
  const handleGenerate = useCallback(() => {
    setIsRolling(true);
    setScratchCovered(true); // 重置刮刮樂覆蓋層

    // 設定動畫時間與間隔
    let intervalId;
    const duration = 800; // 滾動總時間
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
        setNumbers([Math.floor(Math.random() * 999) + 1]);
        setSpecialNumber(null);
      }

      if (now - startTime > duration) {
        clearInterval(intervalId);
        setIsRolling(false);
        finalizeNumbers();
      }
    };

    intervalId = setInterval(updateNumbers, 50);
  }, [gameType]);

  const finalizeNumbers = () => {
    if (gameType === 'superLotto') {
      setNumbers(generateUniqueNumbers(6, 1, 38));
      setSpecialNumber(Math.floor(Math.random() * 8) + 1);
    } else if (gameType === 'lotto649') {
      setNumbers(generateUniqueNumbers(6, 1, 49));
    } else if (gameType === 'scratch') {
      setNumbers([Math.floor(Math.random() * 999) + 1]);
      setScratchCovered(false);
    }
  };

  useEffect(() => {
    setNumbers([]);
    setSpecialNumber(null);
    setIsRolling(false);
    setScratchCovered(true);
  }, [gameType]);

  // UI 元件：彩球
  const LottoBall = ({ num, colorClass, label }) => (
    <div className="flex flex-col items-center animate-bounce-short">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-start sm:justify-center font-sans sm:p-4">
      {/* 主要卡片容器：手機版全寬，平板以上圓角置中 */}
      <div className="bg-white w-full max-w-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-gray-100 flex flex-col min-h-screen sm:min-h-0 sm:h-auto">
        
        {/* Header：根據裝置調整高度與內距 */}
        <div className="bg-indigo-600 p-4 sm:p-8 text-center relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
             <div className="absolute top-20 right-10 w-20 h-20 bg-yellow-300 rounded-full mix-blend-overlay filter blur-xl"></div>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white flex items-center justify-center gap-2 sm:gap-3">
              <Trophy className="w-6 h-6 sm:w-10 sm:h-10 text-yellow-300" />
              台灣幸運選號王
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-indigo-200 text-xs sm:text-sm">
                {isMobile ? "手機版介面" : "電腦版介面"}
              </p>
              {isMobile ? <Smartphone className="w-3 h-3 text-indigo-200"/> : <Monitor className="w-3 h-3 text-indigo-200"/>}
            </div>
          </div>
        </div>

        {/* Tabs：手機版更緊湊 */}
        <div className="flex bg-gray-50 border-b border-gray-200 sticky top-0 z-20 sm:static">
          <button
            onClick={() => setGameType('superLotto')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'superLotto' 
                ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" /> 威力彩
          </button>
          <button
            onClick={() => setGameType('lotto649')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'lotto649' 
                ? 'bg-white text-yellow-600 border-b-4 border-yellow-500' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <CircleDollarSign className="w-5 h-5 sm:w-4 sm:h-4" /> 大樂透
          </button>
          <button
            onClick={() => setGameType('scratch')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              gameType === 'scratch' 
                ? 'bg-white text-pink-600 border-b-4 border-pink-500' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Ticket className="w-5 h-5 sm:w-4 sm:h-4" /> 刮刮樂
          </button>
        </div>

        {/* Main Content Area：彈性高度，確保內容置中 */}
        <div className="flex-grow p-4 sm:p-10 flex flex-col items-center justify-start sm:justify-center bg-gray-50/50 min-h-[50vh] sm:min-h-[300px]">
          
          {/* 威力彩顯示區 */}
          {gameType === 'superLotto' && (
            <div className="w-full text-center animate-fade-in">
              <div className="mb-4 sm:mb-6">
                <div className="mb-3 text-indigo-900 font-semibold bg-indigo-100 inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm shadow-sm">第一區 (01-38)</div>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                  {numbers.length > 0 ? (
                    numbers.map((num, idx) => (
                      <LottoBall key={idx} num={num} colorClass="bg-gradient-to-br from-teal-400 to-teal-600" />
                    ))
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
                     <div className="absolute -inset-2 bg-red-100 rounded-full blur-md opacity-70"></div>
                     <div className="relative">
                        <LottoBall num={specialNumber} colorClass="bg-gradient-to-br from-red-500 to-red-700" />
                     </div>
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
                  numbers.map((num, idx) => (
                    <LottoBall key={idx} num={num} colorClass="bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-yellow-200" />
                  ))
                ) : (
                  <div className="text-gray-400 italic py-8 text-sm sm:text-base">按下按鈕，幸運降臨</div>
                )}
              </div>
            </div>
          )}

          {/* 刮刮樂顯示區 */}
          {gameType === 'scratch' && (
            <div className="w-full flex flex-col items-center animate-fade-in">
              <div className="mb-6 text-pink-800 font-semibold bg-pink-100 inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm shadow-sm">隨機號碼 (1-999)</div>
              
              {/* 響應式刮刮卡容器 */}
              <div className="relative w-full max-w-[280px] sm:max-w-md aspect-[2/1] bg-gray-200 rounded-xl shadow-inner border-4 border-gray-300 overflow-hidden cursor-pointer select-none transition-transform active:scale-95"
                   onClick={() => !isRolling && setScratchCovered(false)}>
                
                {/* 底層數字 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white pattern-dots">
                  <span className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 transform transition-all duration-500 ${
                    isRolling ? 'scale-75 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'
                  }`} style={{ fontSize: 'clamp(3rem, 15vw, 5rem)' }}>
                    {numbers.length > 0 ? numbers[0] : '???'}
                  </span>
                </div>

                {/* 銀漆層 */}
                <div className={`absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 flex flex-col items-center justify-center transition-all duration-700 ${scratchCovered && numbers.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none transform scale-110'}`}>
                   <span className="text-gray-100 font-bold text-xl sm:text-3xl drop-shadow-md">幸運刮刮樂</span>
                   <span className="text-gray-200 text-xs sm:text-sm mt-2 border border-gray-200 px-2 py-1 rounded">點擊刮開</span>
                </div>
                
                {/* 裝飾紋路 */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black to-transparent pointer-events-none"></div>
              </div>
              
              <p className="mt-6 text-sm text-gray-500 animate-pulse">
                {numbers.length > 0 && !isRolling ? (scratchCovered ? "👇 點擊卡片刮開號碼" : "🎉 恭喜獲得幸運號碼！") : "✨ 試試手氣！"}
              </p>
            </div>
          )}

        </div>

        {/* Footer / Action：手機版為 Sticky Bottom，電腦版為一般區塊 */}
        <div className={`
          p-4 bg-white border-t border-gray-100 flex justify-center
          ${isMobile ? 'sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]' : ''}
        `}>
          <button
            onClick={handleGenerate}
            disabled={isRolling}
            className={`
              w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 rounded-xl sm:rounded-full text-white font-bold text-base sm:text-lg shadow-xl
              flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95
              ${isRolling ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200 hover:ring-2 hover:ring-indigo-300'}
            `}
          >
            <RefreshCw className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
            {isRolling ? '選號中...' : '立即電腦選號'}
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.5s ease-in-out;
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
        .pattern-dots {
          background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
          background-size: 10px 10px;
        }
      `}} />
    </div>
  );
};

export default App;
