import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Layers, Play, Zap, Info, MessageSquare, 
  Maximize, Minimize, Download, RefreshCcw, Copy
} from 'lucide-react';
import { processPyramidBlending, loadImageToCanvas, createGradientMask } from './services/imageProcessor';
import { streamGeminiResponse } from './services/geminiService';
import { ChatMessage } from './types';

// Default images (Placeholders)
const DEFAULT_IMG_A = 'https://picsum.photos/id/1080/800/800'; // Fruit (Strawberry)
const DEFAULT_IMG_B = 'https://picsum.photos/id/225/800/800'; // Tea/Texture

const App: React.FC = () => {
  // State
  const [imgA, setImgA] = useState<string>(DEFAULT_IMG_A);
  const [imgB, setImgB] = useState<string>(DEFAULT_IMG_B);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultCanvas, setResultCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pyramidLevels, setPyramidLevels] = useState<HTMLCanvasElement[]>([]);
  const [depth, setDepth] = useState(4);
  const [showPyramid, setShowPyramid] = useState(false);
  
  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '你好！我是你的计算机视觉专家。想用 MATLAB 实现融合算法吗？或者对原理有疑问？随时问我！', timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Process
  useEffect(() => {
    handleProcess();
  }, []); // Run once on mount

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const cA = await loadImageToCanvas(imgA);
      const cB = await loadImageToCanvas(imgB);
      
      // Ensure sizes match for the demo (simplification)
      const w = Math.min(cA.width, cB.width);
      const h = Math.min(cA.height, cB.height);
      
      const resizedA = document.createElement('canvas'); 
      resizedA.width = w; resizedA.height = h;
      resizedA.getContext('2d')?.drawImage(cA, 0, 0, w, h);

      const resizedB = document.createElement('canvas');
      resizedB.width = w; resizedB.height = h;
      resizedB.getContext('2d')?.drawImage(cB, 0, 0, w, h);
      
      const mask = createGradientMask(w, h, 'horizontal');
      
      const output = await processPyramidBlending(resizedA, resizedB, mask, depth);
      setResultCanvas(output.result);
      setPyramidLevels(output.laplacians);
    } catch (e) {
      console.error(e);
      alert("处理图像时出错，请尝试更换其他图片。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setImg: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImg(url);
    }
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      let currentResponse = '';
      await streamGeminiResponse([...messages, newMsg], (chunk) => {
        currentResponse += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === 'model' && last.timestamp > newMsg.timestamp) {
            // Update existing
            return [...prev.slice(0, -1), { ...last, text: currentResponse }];
          } else {
            // New message
            return [...prev, { role: 'model', text: currentResponse, timestamp: Date.now() }];
          }
        });
      });
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "抱歉，我现在无法连接到 AI 大脑，请稍后再试。", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const downloadResult = () => {
    if (resultCanvas) {
      const link = document.createElement('a');
      link.download = 'blended-result.png';
      link.href = resultCanvas.toDataURL();
      link.click();
    }
  };

  // Helper to render message with code block support
  const renderMessageContent = (text: string) => {
    // Simple split for ``` code blocks
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a code block
        // Remove first line (language name) usually
        const match = part.match(/^([a-z]*)\n([\s\S]*)$/);
        const codeContent = match ? match[2] : part.replace(/^[a-z]*\n/, '');
        
        return (
          <div key={index} className="my-3 relative group">
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mr-2">{match ? match[1] : 'CODE'}</span>
            </div>
            <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg overflow-x-auto text-xs font-mono border border-slate-700/50 shadow-inner">
              {codeContent}
            </pre>
          </div>
        );
      }
      // Regular text with basic bold/newline support
      return (
        <span key={index} dangerouslySetInnerHTML={{ 
          __html: part.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br />') 
        }} />
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">多频段图像融合 <span className="text-primary-500">演示</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition text-sm font-medium border border-slate-700"
            >
              <MessageSquare className="w-4 h-4 text-primary-500" />
              咨询 AI 专家
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
            <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-4">源图像</h2>
            
            <div className="space-y-4">
              {/* Image A */}
              <div className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-dashed border-slate-700 hover:border-primary-500 transition-colors">
                 <img src={imgA} alt="Source A" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                 <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 bg-black/50 transition duration-200">
                    <Upload className="w-8 h-8 text-white mb-2" />
                    <span className="text-xs font-bold text-white">更换图像 A</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setImgA)} />
                 </label>
                 <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono">图像 A</div>
              </div>

              {/* Image B */}
              <div className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-dashed border-slate-700 hover:border-primary-500 transition-colors">
                 <img src={imgB} alt="Source B" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                 <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 bg-black/50 transition duration-200">
                    <Upload className="w-8 h-8 text-white mb-2" />
                    <span className="text-xs font-bold text-white">更换图像 B</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setImgB)} />
                 </label>
                 <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono">图像 B</div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
             <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-4">参数配置</h2>
             <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">金字塔层数</span>
                    <span className="text-primary-500 font-mono">{depth} 层</span>
                  </div>
                  <input 
                    type="range" min="1" max="7" step="1" 
                    value={depth} onChange={(e) => setDepth(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    层数越高，低频部分的融合越平滑，但计算时间会增加。
                  </p>
                </div>

                <button 
                  onClick={handleProcess}
                  disabled={isProcessing}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 rounded-xl font-semibold text-white shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  {isProcessing ? '处理中...' : '开始融合'}
                </button>
             </div>
          </section>
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">融合结果</h2>
            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
               <button 
                onClick={() => setShowPyramid(false)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${!showPyramid ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
               >
                 最终效果
               </button>
               <button 
                onClick={() => setShowPyramid(true)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${showPyramid ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
               >
                 金字塔分解分析
               </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-1 min-h-[400px] flex items-center justify-center relative shadow-2xl overflow-hidden">
             {!resultCanvas ? (
               <div className="text-slate-500 flex flex-col items-center">
                 <Layers className="w-12 h-12 mb-4 opacity-20" />
                 <p>请加载图像并运行融合</p>
               </div>
             ) : (
               <>
                 <div className={`transition-opacity duration-500 w-full h-full flex flex-col items-center justify-center ${showPyramid ? 'hidden' : 'flex'}`}>
                    <div className="checkerboard rounded-lg p-2 inline-block shadow-inner bg-slate-950">
                      <img src={resultCanvas.toDataURL()} alt="Result" className="max-w-full max-h-[600px] rounded object-contain" />
                    </div>
                    <div className="mt-4 flex gap-4">
                      <button onClick={downloadResult} className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300">
                        <Download className="w-4 h-4" /> 保存结果图像
                      </button>
                    </div>
                 </div>

                 {showPyramid && (
                   <div className="w-full p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[700px]">
                      {pyramidLevels.map((canvas, i) => (
                        <div key={i} className="flex flex-col gap-2">
                           <div className="aspect-square bg-slate-950 rounded border border-slate-800 flex items-center justify-center p-2 relative">
                             <img src={canvas.toDataURL()} className="max-w-full max-h-full object-contain filter contrast-125" />
                             <span className="absolute top-1 left-1 text-[10px] font-mono bg-black/70 px-1 rounded text-slate-300">
                               第 {i} 层 (拉普拉斯)
                             </span>
                           </div>
                           <p className="text-xs text-slate-500 text-center">
                             {i === pyramidLevels.length - 1 ? '基底层 (高斯)' : '高频细节层'}
                           </p>
                        </div>
                      ))}
                   </div>
                 )}
               </>
             )}
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary-500" />
              原理解析
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              多频段融合（即拉普拉斯金字塔融合）通过将图像分解为不同的频段来进行处理。
              如果直接简单地拼接两张图片，会产生生硬的接缝。
              而此算法将图像分解后，在低频部分（颜色、光照）使用较宽的区域进行混合，而在高频部分（纹理、边缘）使用较窄的区域进行混合。
              这样可以在保留清晰细节的同时，实现无缝、自然的图像过渡，避免了常见的“鬼影”现象。
            </p>
          </div>
        </div>
      </main>

      {/* AI Chat Sidebar Overlay */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="font-bold text-slate-200">AI 视觉教授</h3>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white">
              <Minimize className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-primary-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  }`}
                >
                  {renderMessageContent(msg.text)}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                 <div className="bg-slate-800 text-slate-400 px-4 py-2 rounded-2xl rounded-bl-none text-xs flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                 </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-800 bg-slate-900">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="询问关于 MATLAB 代码、金字塔原理..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500 placeholder-slate-600"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isTyping}
                className="bg-primary-600 hover:bg-primary-500 text-white p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;