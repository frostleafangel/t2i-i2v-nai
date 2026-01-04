import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PREFIX } from "../constants";

// The user is asking for a helper to convert natural language to the complex XML format.
export const convertToNewBieXml = async (naturalLanguage: string): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing");
    return naturalLanguage;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an expert prompt engineer for the "NewBie" Anime AI model.
    Your task is to convert user natural language descriptions (which may be in Chinese or English) into the specific XML format required by this model.
    
    IMPORTANT: The content INSIDE the XML tags must be in ENGLISH Danbooru-style tags. If the user input is Chinese, translate it to English tags.
    
    Structure Rules:
    1. Wrap the entire prompt in curly braces { ... }.
    2. Use <character_1>, <character_2> blocks for characters.
    3. Inside character blocks, use:
       <n>name</n>
       <gender>1girl/1boy</gender>
       <appearance>comma separated tags (ENGLISH)</appearance>
       <clothing>comma separated tags (ENGLISH)</clothing>
       <expression>comma separated tags (ENGLISH)</expression>
       <action>comma separated tags (ENGLISH)</action>
       <position>comma separated tags (ENGLISH)</position>
    4. Use <general_tags> block for global settings:
       <count>number of subjects</count>
       <style>anime_style, digital_art</style>
       <background>tags (ENGLISH)</background>
       <atmosphere>tags (ENGLISH)</atmosphere>
       <quality>high_resolution, detailed</quality>
       <objects>tags (ENGLISH)</objects>
    
    5. Always use Danbooru-style tags (underscores instead of spaces, e.g., long_hair, blue_eyes).
    6. Do NOT include the "You are an assistant..." prefix in your output, just the XML content inside the braces.
    
    Example Input: "一个蓝头发的初音未来穿着校服在笑"
    Example Output:
    {
      <character_1>
        <n>hatsune_miku</n>
        <gender>1girl</gender>
        <appearance>blue_hair, long_hair, twin_tails</appearance>
        <clothing>school_uniform, serafuku</clothing>
        <expression>smile, happy</expression>
        <action>standing</action>
      </character_1>
      <general_tags>
        <count>1girl</count>
        <style>anime_style</style>
        <quality>high_resolution</quality>
      </general_tags>
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Convert this description to NewBie XML (Translate Chinese to English tags): "${naturalLanguage}"`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7, 
      },
    });

    // Clean up response if it included markdown code blocks
    let text = response.text || "";
    text = text.replace(/```xml/g, "").replace(/```/g, "").trim();
    
    return text;
  } catch (error) {
    console.error("Gemini conversion failed:", error);
    return naturalLanguage; // Fallback
  }
};