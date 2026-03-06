
import { GoogleGenAI } from "@google/genai";
import { JobMedia } from "../types";

// Lazy initialization to prevent app crash if API key is missing
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
    if (!ai) {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            throw new Error("Gemini API key not configured");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

/**
 * Analyzes the check-out media to provide a quality assurance report.
 */
export const analyzeQuality = async (
  checkInMedia: JobMedia, 
  checkOutMedia: JobMedia,
  jobDescription: string
): Promise<string> => {
  try {
    const cleanBase64 = (data: string) => data.split(',')[1] || data;

    const prompt = `
      You are a Quality Control Manager for 'Garage Scholars'.
      
      Job Description: ${jobDescription}
      
      I have two sets of media:
      1. Check-In (Before): Front of House photo.
      2. Check-Out (After): Front of House photo.
      
      Please generate a short, professional "Quality Control" report (max 3 sentences).
      Confirm if the job site looks presentable and organized in the 'After' photo compared to the 'Before'.
      Mention the timestamp difference.
      
      Start with "Quality Analysis:".
    `;

    // Use gemini-3-flash-preview for multimodal analysis tasks.
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(checkInMedia.photoFrontOfHouse)
            }
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(checkOutMedia.photoFrontOfHouse)
            }
          }
        ]
      }
    });

    // Access .text property directly as it is a getter, not a method.
    return response.text || "Analysis completed. Pending final review.";

  } catch (error) {
    console.error("Quality Analysis Error:", error);
    return "Quality analysis requires manual review.";
  }
};

/**
 * Generates an SMS alert message for a team milestone.
 */
export const generateSmsAlert = async (userName: string, milestone: number, earnings: number): Promise<string> => {
    try {
        const prompt = `Write a short, exciting SMS notification (max 140 characters) for a team of workers. 
        Scholar ${userName} just hit ${milestone}% of their monthly goal by earning $${earnings}. 
        Make it sound encouraging and professional. Use emojis.`;
        
        // Use gemini-3-flash-preview for basic text generation.
        const response = await getAI().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text?.trim() || `🎉 ${userName} just hit ${milestone}% of their goal! $${earnings} earned! 🚀`;
    } catch (e) {
        return `🎉 ${userName} hit ${milestone}% of their goal! $${earnings} earned! 🚀`;
    }
}

export const generateJobSummary = async (jobDescription: string, address: string): Promise<string> => {
   try {
    // Use gemini-3-flash-preview for basic text summarization.
    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a very short, motivating 1-sentence summary for a worker going to this job: ${jobDescription} at ${address}.`,
    });
    return response.text ?? "Ready to work!";
   } catch (e) {
       return "Ready to work!";
   }
}
