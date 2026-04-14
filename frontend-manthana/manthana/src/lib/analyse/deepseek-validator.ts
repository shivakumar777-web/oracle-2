/* ═══ DEEPSEEK V3 PRE-VALIDATION LAYER ═══ */
import { DEEPSEEK_VALIDATION_PROMPT } from "./prompts/validation-prompt";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";

export interface PreValidationRequest {
  imageBase64: string;
  filename: string;
  selectedModality: string;
  patientContext: PatientContext;
}

export interface PatientContext {
  patientId: string;
  age?: string;
  gender?: string;
  location?: string;
  tobaccoUse?: string;
  symptoms?: string;
  clinicalHistory?: string;
  fastingStatus?: string;
  medications?: string;
  [key: string]: unknown;
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  whyItHelps: string;
  answered?: boolean;
}

export interface PreValidationResponse {
  fileType: string;
  detectedModality: string;
  selectedModality: string;
  modalityMatch: boolean;
  imageQuality: "good" | "acceptable" | "poor";
  provisionalOpinion: string;
  questions: DiagnosticQuestion[];
  patientDataCompleteness: {
    missingFields: string[];
    suggestions: string[];
  };
  readyForInference: boolean;
  concerns: string[];
}

export interface ChatMessage {
  role: "ai" | "user";
  content: string;
}

/**
 * Compress and convert image to base64 for DeepSeek API
 */
async function prepareImageForDeepSeek(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Max dimensions for vision models
      const MAX_SIZE = 1024;
      let width = img.width;
      let height = img.height;

      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = (height * MAX_SIZE) / width;
          width = MAX_SIZE;
        } else {
          width = (width * MAX_SIZE) / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      // Compress to JPEG with quality 0.8
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.split(",")[1]); // Return base64 without prefix
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Call DeepSeek v3 via OpenRouter for pre-validation
 */
export async function validateWithDeepSeek(
  request: PreValidationRequest,
  signal?: AbortSignal
): Promise<PreValidationResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  try {
    const prompt = DEEPSEEK_VALIDATION_PROMPT.replace(
      "{{selectedModality}}",
      request.selectedModality
    ).replace(
      "{{patientContext}}",
      JSON.stringify(request.patientContext, null, 2)
    );

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "Manthana Radiologist Copilot",
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${request.imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
        top_p: 0.9,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in DeepSeek response");
    }

    // Parse JSON response
    const validationResult = JSON.parse(content);

    // Ensure all required fields exist
    return {
      fileType: validationResult.file_type || "unknown",
      detectedModality: validationResult.detected_modality || "unknown",
      selectedModality: request.selectedModality,
      modalityMatch: validationResult.modality_match ?? true,
      imageQuality: validationResult.image_quality || "acceptable",
      provisionalOpinion: validationResult.provisional_opinion || "",
      questions: (validationResult.diagnostic_questions || []).map(
        (q: any, idx: number) => ({
          id: q.id || `q_${idx}`,
          question: q.question || "",
          whyItHelps: q.why_it_helps || "",
          answered: false,
        })
      ),
      patientDataCompleteness: {
        missingFields: validationResult.patient_data_completeness?.missing_fields || [],
        suggestions: validationResult.patient_data_completeness?.suggestions || [],
      },
      readyForInference: validationResult.ready_for_inference ?? true,
      concerns: validationResult.concerns || [],
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON response from DeepSeek");
    }
    throw error;
  }
}

/**
 * Chat with DeepSeek about the current validation context
 */
export async function chatWithDeepSeek(
  message: string,
  chatHistory: ChatMessage[],
  validationContext: PreValidationResponse,
  signal?: AbortSignal
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  const systemPrompt = `You are an expert radiology AI assistant helping a user analyze a medical image.

Current Context:
- File Type: ${validationContext.fileType}
- Detected Modality: ${validationContext.detectedModality}
- Selected Modality: ${validationContext.selectedModality}
- Image Quality: ${validationContext.imageQuality}
- Provisional Opinion: ${validationContext.provisionalOpinion}

Help the user with any questions they have about the image, the validation process, or their selected modality. Be concise and clinical.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    ...chatHistory.map((msg) => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content,
    })),
    { role: "user", content: message },
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "Manthana Radiologist Copilot",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v3",
      messages,
      max_tokens: 2000,
      temperature: 0.4,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Wrapper to prepare file and validate
 */
export async function validateFile(
  file: File,
  selectedModality: string,
  patientContext: PatientContext,
  signal?: AbortSignal
): Promise<PreValidationResponse> {
  const imageBase64 = await prepareImageForDeepSeek(file);
  return validateWithDeepSeek(
    {
      imageBase64,
      filename: file.name,
      selectedModality,
      patientContext,
    },
    signal
  );
}
