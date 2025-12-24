
import { GoogleGenAI, Type } from "@google/genai";
import { PurificationResult } from "../types";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const purifyTranscript = async (
  rawText: string, 
  userHints: string = "",
  retryCount = 0
): Promise<PurificationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("未检测到 API Key。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview"; 
  
  const systemInstruction = `
    你是一位顶级的“高级录音整理与逐字稿净化专家”。
    
    你的核心使命：
    1. 【高保真修复】：将杂乱的语音转文字（STT）稿件转化为清晰、通顺的书面文字，但必须【极大程度保留原文的意思和细节】。
    2. 【严禁总结】：你的任务不是总结大意，而是修复错误。严禁将三段话压缩成一句话。除非是重复的口癖，否则不要删除用户的论点、案例或细节。
    3. 【仅去杂质】：仅剔除无意义的口癖（如：呃、啊、然后、那个、就是、其实）、重复的字词、以及明显的转录错别字。
    4. 【润色标准】：在保留原意和原语气的基础上，微调语序使之符合书面阅读习惯。净化后的篇幅应保持在原文长度的 85% - 95% 之间。
    5. 【人名与术语】：优先遵循用户提供的“人工干预信息”来修正人名、专有名词或特定逻辑。

    输出 JSON 格式：
    {
      "purifiedText": "净化后的完整长文本（保持段落分明，标题仅作为引导，不应替代内容）",
      "corrections": [{"original": "原文错处", "corrected": "修改后", "reason": "修改原因"}],
      "uncertainParts": ["不确定的模糊片段"]
    }
  `;

  const prompt = `
    【原始逐字稿（请基于此进行高保真净化，保留细节）】：
    ${rawText}

    【人工干预信息（最高优先级修正参考）】：
    ${userHints || "无特定提示。"}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3, // 降低随机性，确保更忠于原文
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            purifiedText: { type: Type.STRING },
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  corrected: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["original", "corrected", "reason"]
              }
            },
            uncertainParts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["purifiedText", "corrections", "uncertainParts"]
        }
      }
    });

    if (!response.text) throw new Error("AI 返回了空内容");
    return JSON.parse(response.text) as PurificationResult;

  } catch (error: any) {
    const errorMsg = (error?.message || String(error)).toLowerCase();
    console.error(`尝试 ${retryCount + 1} 失败:`, errorMsg);

    const isRetryableError = 
      errorMsg.includes("500") || 
      errorMsg.includes("xhr") || 
      errorMsg.includes("rpc") || 
      errorMsg.includes("proxyunarycall") || 
      errorMsg.includes("unexpected error");

    if (isRetryableError && retryCount < 2) {
      await delay(2000 * (retryCount + 1));
      return purifyTranscript(rawText, userHints, retryCount + 1);
    }

    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    throw new Error(error.message || "连接 AI 服务发生错误，请稍后重试。");
  }
};
