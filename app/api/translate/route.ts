import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { content, footnotes, bookTitle, chapterTitle } = await req.json();

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required for translation' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'GEMINI_API_KEY가 .env.local 파일에 설정되어 있지 않습니다. 프로젝트 루트 폴더의 .env.local 파일에 GEMINI_API_KEY=your_key_here 형태로 API 키를 입력해 주세요.',
        },
        { status: 401 }
      );
    }

    // Build the prompt for Gemini
    const systemInstruction = `You are an expert translator and scholar of ancient Eastern philosophies and languages (specifically Buddhism, Jainism, Hinduism, Pali, Sanskrit, Classical Chinese, and English).

Your task is to:
1. Translate the provided text into natural, accurate, and respectful Korean (한국어). If the original text contains English translations or annotations, translate them into clear, scholarly Korean.
2. Extract key philosophical terms (especially Pali, Sanskrit, or Prakrit terms like "Karma", "Jiva", "Ajiva", "Dharma", "Anatta", "Dukkha", "Ahiṃsā") found in the text. Provide their original language, their Korean equivalent, and a clear explanation.
3. Provide a deep, philosophical commentary and context explaining the meaning of this chapter/lecture, how it fits into the broader spiritual system, and its practical/philosophical significance for modern readers.

All textual answers (koreanTranslation, explanation, philosophicalCommentary) must be written in Korean.`;

    const prompt = `Here is the scripture content to analyze:

[Book/Source Title]: ${bookTitle || 'Unknown Text'}
[Chapter/Lecture Title]: ${chapterTitle || 'Unknown Section'}

[Footnotes & Annotation Context]:
${footnotes || 'No footnotes provided.'}

[Scripture Text]:
"""
${content}
"""

Analyze and translate this text according to the system instructions.`;

    // Make the request to Gemini API (1.5 Pro) using standard fetch
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    // Define the response schema to force JSON formatting
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        bookTitle: { type: 'STRING' },
        chapterTitle: { type: 'STRING' },
        koreanTranslation: { type: 'STRING' },
        glossary: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              term: { type: 'STRING' },
              originalLanguage: { type: 'STRING' },
              koreanTerm: { type: 'STRING' },
              explanation: { type: 'STRING' },
            },
            required: ['term', 'originalLanguage', 'koreanTerm', 'explanation'],
          },
        },
        philosophicalCommentary: { type: 'STRING' },
      },
      required: [
        'bookTitle',
        'chapterTitle',
        'koreanTranslation',
        'glossary',
        'philosophicalCommentary',
      ],
    };

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemInstruction }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for high translation consistency
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error details:', errorText);
      return NextResponse.json(
        { success: false, error: `Gemini API 호출 중 오류가 발생했습니다: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return NextResponse.json(
        { success: false, error: 'Gemini로부터 응답을 받지 못했습니다.' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    try {
      const parsedData = JSON.parse(responseText);
      return NextResponse.json({
        success: true,
        data: parsedData,
      });
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', responseText);
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini 응답을 JSON으로 파싱하는 데 실패했습니다. 응답 형식에 결함이 있습니다.',
          raw: responseText,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Translate API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal translation error' },
      { status: 500 }
    );
  }
}
