declare module '@google/genai' {
  interface Content {
    role: string;
    parts: { text: string }[];
  }

  interface GenerateContentResponse {
    text?: string;
    candidates?: {
      content?: Content;
      finishReason?: string;
    }[];
  }

  class Models {
    generateContent(params: {
      model: string;
      contents: Content[];
      config?: Record<string, unknown>;
    }): Promise<GenerateContentResponse>;
  }

  export class GoogleGenAI {
    constructor(params: { apiKey: string; location?: string; project?: string });
    models: Models;
  }
}
