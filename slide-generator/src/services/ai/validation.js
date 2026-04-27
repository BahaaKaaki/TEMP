import { debugLog, LogLevel } from '../../utils/debugLog';
import { getCredentials, isGeminiModel, isGemini3Model, isGemini25Model, extractGeminiResponseText, buildProviderHeaders, buildGeminiEndpoint, buildGeminiHeaders } from './models.js';
import { callWithModelFallback } from './apiClient.js';
import { authFetch } from '../authFetch.js';
import { applyPromptOverride, recordPromptPayload } from './promptOverrides.js';

// AI-based HTML quality validation - checks layout similarity to prompt
export async function validateHtmlWithAI(html, originalPrompt, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required for AI validation.');
  }

  const systemPrompt = applyPromptOverride(settings, 'validation.system', `You are a strict quality assurance expert for Strategy& consulting slide design.
Your job is to critically evaluate HTML slide quality on TWO key aspects:

1. LAYOUT MATCH TO PROMPT - Does the slide design match what was requested?
2. CONTENT QUALITY - Is it clean, professional, executive-ready?

Be HARSH and CRITICAL. Good slides are rare. Most slides have issues.

LAYOUT ISSUES (check if design matches the original request):
- Wrong layout type (e.g., requested cards but got bullets)
- Missing requested elements (icons, KPIs, timeline, etc.)
- Layout doesn't fit the content type requested
- Design doesn't convey the requested message/structure

CONTENT OVERFLOW ISSUES (CRITICAL):
- Text that would extend beyond slide boundaries
- Too many elements crammed into the space
- Paragraphs that are too long to fit properly
- Cards/cells with text that would overflow their containers

QUALITY ISSUES:
- Missing .slide container
- Walls of text (>50 words in a paragraph)
- More than 5 bullet points or 4 cards
- Generic headlines (not insight-driven)
- Poor visual hierarchy`);

  const userPrompt = `EVALUATE THIS SLIDE HTML:
${html}

${originalPrompt ? `ORIGINAL PROMPT/REQUEST: "${originalPrompt}"

CRITICAL: Check if the layout/design MATCHES what was requested in the prompt above.
- Does it use the right layout type for the request?
- Does it include all the elements that were requested?
- Does the design structure fit the content being asked for?` : ''}

CHECK FOR CONTENT OVERFLOW:
- Would any text extend beyond its container?
- Are there elements that would overlap or collide?
- Is there too much content for the available space?

Respond in this EXACT JSON format:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "verdict": "<PASS/FAIL/WARNING>",
  "summary": "<one sentence summary>",
  "layoutMatch": {
    "matches": <true/false>,
    "matchScore": <0-100>,
    "issues": ["<what doesn't match the request>"]
  },
  "overflowCheck": {
    "hasOverflow": <true/false>,
    "overflowAreas": ["<where content might overflow>"]
  },
  "issues": [
    {"severity": "critical|major|minor", "issue": "<description>"}
  ],
  "suggestions": ["<improvement suggestion>"]
}

Be CRITICAL. Most slides should score 40-70. Only truly excellent slides score 80+.`;

  try {
    let content;
    recordPromptPayload('validation.system', {
      model: settings.model,
      systemPrompt,
      userPrompt,
    });

    content = await callWithModelFallback(settings, systemPrompt, userPrompt);

    // Parse JSON response
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('AI HTML validation error:', error);
    return {
      score: 50,
      grade: 'C',
      verdict: 'WARNING',
      summary: 'Could not complete AI validation',
      layoutMatch: { matches: true, matchScore: 50, issues: [] },
      overflowCheck: { hasOverflow: false, overflowAreas: [] },
      issues: [{ severity: 'minor', issue: error.message }],
      suggestions: [],
    };
  }
}

// AI-based PPTX code validation
export async function validatePptxCodeWithAI(pptxCode, html, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required for AI validation.');
  }

  const systemPrompt = `You are a PptxGenJS code quality expert.
Evaluate if the given PPTX rendering code will correctly reproduce the HTML slide.

Check for:
1. Does it create a slide? (pptx.addSlide())
2. Does it extract content from the HTML?
3. Does it position elements correctly?
4. Will it handle the main visual elements (titles, cards, text)?
5. Does it call addFooter?
6. Any syntax errors or issues?`;

  const userPrompt = `EVALUATE THIS PPTX RENDERING CODE:

HTML TO RENDER:
${html.substring(0, 1500)}

PPTX CODE:
${pptxCode.substring(0, 2500)}

Respond in this EXACT JSON format:
{
  "score": <number 0-100>,
  "willRender": <true/false>,
  "verdict": "<PASS/FAIL/WARNING>",
  "issues": [
    {"severity": "critical|major|minor", "issue": "<description>"}
  ],
  "missingElements": ["<elements from HTML not handled>"],
  "suggestions": ["<improvement>"]
}`;

  try {
    let content;

    content = await callWithModelFallback(settings, systemPrompt, userPrompt);

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('AI PPTX validation error:', error);
    return {
      score: 50,
      willRender: true,
      verdict: 'WARNING',
      issues: [{ severity: 'minor', issue: error.message }],
      missingElements: [],
      suggestions: [],
    };
  }
}

// Call Gemini Vision API with image
export async function callGeminiVisionAPI(settings, systemPrompt, userPromptText, imageBase64) {
  const creds = getCredentials(settings);
  // Use the current model if it's Gemini, otherwise default to gemini-1.5-flash for vision
  const visionModel = isGeminiModel(creds.rawModel || creds.model) ? (creds.rawModel || creds.model) : 'gemini-1.5-flash';

  const endpoint = buildGeminiEndpoint({ ...creds, rawModel: visionModel });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPromptText },
          {
            inline_data: {
              mime_type: 'image/png',
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.3,
      topP: 0.95,
    }
  };

  // Add thinkingConfig for Gemini thinking models in vision calls (keep budget low for validation)
  if (isGemini3Model(visionModel)) {
    body.generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  } else if (isGemini25Model(visionModel)) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildGeminiHeaders(creds),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini Vision API error: ${response.status}`);
  }

  const data = await response.json();
  return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
}

// Vision-based validation using GPT or Gemini with image analysis
export async function validateWithVision(imageBase64, originalPrompt, settings, validationType = 'layout') {
  const creds = getCredentials(settings);
  const visionModel = settings.visionModel || 'gpt-4o';

  if (!creds.apiKey) {
    throw new Error('API key is required for vision validation.');
  }

  let systemPrompt, userPromptText;

  if (validationType === 'layout') {
    systemPrompt = `You are a visual design quality expert for consulting slides.
Analyze the slide image and evaluate:
1. Does the layout match what was requested in the prompt?
2. Is content overflowing or overlapping?
3. Is text readable and well-positioned?
4. Is the visual hierarchy clear?
5. Is this executive/boardroom quality?`;

    userPromptText = `ANALYZE THIS SLIDE IMAGE.

${originalPrompt ? `ORIGINAL REQUEST: "${originalPrompt}"

Does this slide visually match what was requested? Check:
- Layout type matches request
- All requested elements are present
- Visual structure fits the content` : 'Evaluate the overall visual quality.'}

CHECK FOR VISUAL ISSUES:
- Text overflow or cutoff
- Overlapping elements
- Poor spacing/alignment
- Cluttered appearance

Respond in JSON:
{
  "score": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "layoutMatches": <true/false>,
  "hasOverflow": <true/false>,
  "overflowAreas": ["<areas with overflow>"],
  "visualIssues": ["<issue>"],
  "suggestions": ["<improvement>"]
}`;
  } else if (validationType === 'comparison') {
    systemPrompt = `You are a visual fidelity expert comparing HTML rendering to PowerPoint export.
Your job is to determine if the PowerPoint version accurately reproduces the HTML version.`;

    userPromptText = `Compare these two slide renderings:
IMAGE 1 (Left/First): HTML rendering
IMAGE 2 (Right/Second): PowerPoint export

Evaluate FIDELITY - does the PPTX match the HTML?
- Text content: Same text present?
- Layout: Same positioning?
- Visual style: Similar colors/fonts?
- Elements: All elements reproduced?

Respond in JSON:
{
  "score": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "isFaithful": <true/false>,
  "missingElements": ["<elements in HTML but not PPTX>"],
  "positionIssues": ["<positioning differences>"],
  "styleIssues": ["<style differences>"],
  "summary": "<one sentence summary>"
}`;
  }

  try {
    let content;

    if (creds.isGeminiProvider) {
      // Gemini native vision API
      content = await callGeminiVisionAPI(settings, systemPrompt, userPromptText, imageBase64);
    } else {
      // OpenAI-compatible vision API (GPT-4o, Claude via proxy, etc.)
      const headers = buildProviderHeaders(creds);
      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPromptText },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ];
      const requestBody = {
        model: creds.model,
        messages,
        max_tokens: 1000,
        temperature: 0.3,
      };
      const response = await authFetch(creds.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Vision API error: ${response.status}`);
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Vision validation error:', error);
    return {
      score: 50,
      verdict: 'WARNING',
      layoutMatches: true,
      hasOverflow: false,
      overflowAreas: [],
      visualIssues: [`Vision analysis failed: ${error.message}`],
      suggestions: [],
    };
  }
}

// Compare HTML and PPTX images for fidelity
export async function compareHtmlToPptxVisually(htmlImageBase64, pptxImageBase64, settings) {
  const creds = getCredentials(settings);
  const visionModel = settings.visionModel || 'gpt-4o';

  if (!creds.apiKey) {
    throw new Error('API key is required for visual comparison.');
  }

  const systemPrompt = `You are a visual fidelity expert comparing HTML slide rendering to PowerPoint export.
Evaluate how faithfully the PowerPoint reproduces the HTML version.`;

  const userPrompt = `Compare these two slide images:
- FIRST IMAGE: HTML rendering (the source)
- SECOND IMAGE: PowerPoint export (should match the source)

Evaluate FULL FIDELITY:
1. Is all text content present in PPTX?
2. Are elements positioned similarly?
3. Are colors and styles similar?
4. Are any elements missing or extra?

Respond in JSON:
{
  "fidelityScore": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "textMatch": {"score": <0-100>, "issues": ["<text differences>"]},
  "layoutMatch": {"score": <0-100>, "issues": ["<position differences>"]},
  "styleMatch": {"score": <0-100>, "issues": ["<style differences>"]},
  "missingInPptx": ["<elements missing from PPTX>"],
  "extraInPptx": ["<unexpected elements in PPTX>"],
  "summary": "<overall assessment>"
}`;

  try {
    let content;

    const geminiVisionModel = creds.rawModel || creds.model;
    const endpoint = buildGeminiEndpoint({ ...creds, rawModel: geminiVisionModel });

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [
          { text: userPrompt },
          { inline_data: { mime_type: 'image/png', data: htmlImageBase64 } },
          { inline_data: { mime_type: 'image/png', data: pptxImageBase64 } },
        ]
      }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.3, topP: 0.95 }
    };

    // Add thinkingConfig for Gemini thinking models in vision comparison (keep budget low for validation)
    if (isGemini3Model(geminiVisionModel)) {
      body.generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
    } else if (isGemini25Model(geminiVisionModel)) {
      body.generationConfig.thinkingConfig = { thinkingBudget: 1024 };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildGeminiHeaders(creds),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Vision API error: ${response.status}`);
    }

    const data = await response.json();
    content = extractGeminiResponseText(data.candidates?.[0]?.content?.parts);

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Visual comparison error:', error);
    return {
      fidelityScore: 50,
      verdict: 'WARNING',
      textMatch: { score: 50, issues: [] },
      layoutMatch: { score: 50, issues: [] },
      styleMatch: { score: 50, issues: [] },
      missingInPptx: [],
      extraInPptx: [],
      summary: `Visual comparison failed: ${error.message}`,
    };
  }
}
