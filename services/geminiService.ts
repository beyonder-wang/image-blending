import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../types';

const getClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const streamGeminiResponse = async (
  messages: ChatMessage[],
  onChunk: (text: string) => void
) => {
  const ai = getClient();
  
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));

  const lastMessage = messages[messages.length - 1];

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: `你是一位计算机视觉和图像处理领域的专家教授，精通算法原理及编程实现（MATLAB, Python/OpenCV）。
      你的目标是向学生清晰地解释“多频段融合”（Multi-band Blending）或“拉普拉斯金字塔融合”（Laplacian Pyramid Blending）技术。
      
      当被问及相关概念时，请重点解释：
      1. 高斯金字塔（Gaussian Pyramids）：即通过模糊和降采样获取图像的低频信息。
      2. 拉普拉斯金字塔（Laplacian Pyramids）：通过将当前层减去上一层（扩展后）的图像，来提取边缘和纹理等高频细节。
      3. 多频段融合的原理：在低频段使用宽阔的过渡区域（Mask 模糊程度大），在高频段使用狭窄的过渡区域（Mask 模糊程度小）。
      
      **关键指令**：
      如果用户询问如何实现（特别是 MATLAB 或 Python），请提供简洁、可运行的代码示例。
      - 对于 MATLAB，推荐使用 \`impyramid\` (reduce/expand), \`imresize\`, \`imfilter\` 等函数。
      - 代码块请使用 Markdown 格式（\`\`\`matlab ... \`\`\`）。
      
      请保持回答简洁、鼓励性强，并通俗易懂。请始终使用中文回答。`
    }
  });

  const result = await chat.sendMessageStream({ message: lastMessage.text });

  for await (const chunk of result) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
  }
};