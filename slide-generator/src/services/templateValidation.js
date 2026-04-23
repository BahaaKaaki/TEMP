// Template Validation Service
// Three-step validation:
// 1. PROMPT CONFORMANCE - Check if HTML and PPTX JS code match the original prompt
// 2. PPTX EXECUTION - Test if PPTX JS code executes without errors
// 3. VISUAL INSPECTION - Analyze HTML screenshot to verify layout (note: uses HTML, not actual PPTX rendering)

import PptxGenJS from 'pptxgenjs';
import { generatePptxRendererCode } from './aiService';
import { createRendererFromCode, addFooter, COLORS, LAYOUT } from './pptxRenderers';
import { authFetch } from './authFetch.js';

export const VALIDATION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  WARNING: 'warning',
};

export const VALIDATION_STEPS = {
  PROMPT_CONFORMANCE: 'prompt_conformance',  // Step 1: Does code match the request?
  PPTX_EXECUTION: 'pptx_execution',          // Step 2: Does PPTX JS code run without errors?
  VISUAL_INSPECTION: 'visual_inspection',    // Step 3: Does HTML screenshot look correct?
};

// Pattern-based model detection -- covers current and future versions
function isGeminiModel(model) { return /\bgemini-/i.test(model || ''); }
function isGPT5Model(model) { return /\bgpt-5/i.test(model || ''); }

// Extract the actual response text from Gemini parts, skipping thinking/thought parts
function extractGeminiResponseText(parts) {
  if (!parts || parts.length === 0) return '';
  const responseParts = parts.filter(p => !p.thought);
  const targetParts = responseParts.length > 0 ? responseParts : parts;
  return targetParts.map(p => p.text).filter(Boolean).join('');
}

/**
 * Capture slide HTML as a base64 PNG image using html2canvas
 */
export async function captureSlideAsImage(html, width = 960, height = 540) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  try {
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -10000px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      background: white;
      overflow: hidden;
    `;
    container.innerHTML = html;
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      width,
      height,
      scale: 1,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    document.body.removeChild(container);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } catch (error) {
    console.error('Failed to capture slide as image:', error);
    return null;
  }
}

/**
 * STEP 1: Check if HTML and PPTX JS code conform to the original prompt
 */
export async function validatePromptConformance(html, pptxCode, originalPrompt, settings) {
  const { apiKey, apiEndpoint, model } = settings;

  if (!apiKey || !originalPrompt) {
    return {
      status: 'skipped',
      htmlConforms: null,
      pptxConforms: null,
      summary: 'No API key or prompt provided',
    };
  }

  const systemPrompt = `You are a strict validator checking if generated code matches the user's request EXACTLY.

Your job is to verify:
1. Does the HTML layout MATCH what was requested?
2. Does the PPTX JavaScript code produce the SAME layout as requested?

Be STRICT. If user asked for "3x3 matrix" and got "bullet points", that's a FAIL.
If user asked for "4 cards" and got "3 cards", that's a FAIL.`;

  const userPrompt = `ORIGINAL USER REQUEST:
"${originalPrompt}"

HTML CODE TO VALIDATE:
${html}

${pptxCode ? `PPTX JAVASCRIPT CODE TO VALIDATE:
${pptxCode}` : 'No PPTX code provided yet.'}

VALIDATION CHECKLIST:
1. Does the HTML create the EXACT layout requested? (e.g., if "3x3 matrix" was requested, are there 9 cells in 3 rows?)
2. Does the HTML structure match the request? (grid vs cards vs bullets vs timeline)
3. ${pptxCode ? 'Does the PPTX code reproduce the same layout?' : 'N/A - no PPTX code'}

Respond in JSON:
{
  "htmlConforms": <true/false>,
  "htmlIssues": ["<what doesn't match the request>"],
  "htmlScore": <0-100>,
  "pptxConforms": <true/false/null if no code>,
  "pptxIssues": ["<what doesn't match>"],
  "pptxScore": <0-100 or null>,
  "verdict": "<PASS/FAIL/WARNING>",
  "summary": "<one line summary of conformance>"
}`;

  try {
    let content;

    if (isGeminiModel(model)) {
      // Gemini API
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
      const data = await response.json();
      content = extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
    } else {
      // OpenAI API
      const response = await authFetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ...(isGPT5Model(model)
            ? { max_completion_tokens: 1500 }
            : { max_tokens: 1500 }),
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Prompt conformance validation error:', error);
    return {
      status: 'error',
      htmlConforms: null,
      pptxConforms: null,
      summary: `Validation failed: ${error.message}`,
    };
  }
}

/**
 * STEP 3: Visual inspection of the slide
 * Note: This uses HTML screenshot as a proxy for visual validation.
 * True PPTX rendering would require server-side PowerPoint conversion tools.
 */
export async function validateVisualInspection(html, pptxCode, originalPrompt, settings) {
  const { apiKey, apiEndpoint, model } = settings;

  if (!apiKey) {
    return {
      status: 'skipped',
      summary: 'No API key provided for visual inspection',
    };
  }

  // Capture HTML as screenshot for visual validation
  // Note: This uses HTML screenshot as a proxy since true PPTX rendering
  // would require server-side PowerPoint conversion tools
  const screenshotBase64 = await captureSlideAsImage(html);

  if (!screenshotBase64) {
    return {
      status: 'warning',
      summary: 'Could not capture slide screenshot for visual validation',
    };
  }

  // Visual validation with AI
  const systemPrompt = `You are a visual quality inspector for PowerPoint slides.
Analyze the slide image and check:
1. Does the layout match the original request?
2. Is all content visible (no overflow/cutoff)?
3. Is the visual quality professional?`;

  const userPromptText = `ORIGINAL REQUEST: "${originalPrompt}"

Analyze this slide image. Does it match the request?

Check:
- Layout type matches (grid/matrix/cards/bullets/etc)
- Correct number of elements (if 3x3 was requested, are there 9 cells?)
- All text is readable and not cut off
- Professional appearance

Respond in JSON:
{
  "matchesRequest": <true/false>,
  "layoutCorrect": <true/false>,
  "elementsCorrect": <true/false>,
  "noOverflow": <true/false>,
  "issues": ["<visible problems>"],
  "score": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "summary": "<visual assessment>"
}`;

  try {
    let content;

    if (isGeminiModel(model)) {
      // Gemini Vision API
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n---\n\n${userPromptText}` },
            { inline_data: { mime_type: 'image/png', data: screenshotBase64 } }
          ]
        }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Gemini Vision API error: ${response.status}`);
      const data = await response.json();
      content = extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
    } else {
      // OpenAI Vision API
      const visionModel = settings.visionModel || 'gpt-4o';
      const response = await authFetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPromptText },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
              ]
            }
          ],
          ...(isGPT5Model(visionModel)
            ? { max_completion_tokens: 1000 }
            : { max_tokens: 1000 }),
        }),
      });

      if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Visual validation error:', error);
    return {
      status: 'error',
      summary: `Visual validation failed: ${error.message}`,
    };
  }
}

/**
 * Test if PPTX code can execute and generate a valid PPTX file
 * This actually generates a PPTX blob to verify the code works end-to-end
 */
export async function testPptxExecution(pptxCode, testHtml) {
  try {
    const renderer = createRendererFromCode(pptxCode);
    if (!renderer) {
      return { status: 'failed', error: 'Could not create renderer function', pptxSize: 0 };
    }

    const testPptx = new PptxGenJS();
    testPptx.defineLayout({ name: 'TEST', width: 13.333, height: 7.5 });
    testPptx.layout = 'TEST';

    const testSlideData = {
      html: testHtml || '<div class="slide"><h1 class="title">Test</h1></div>',
      title: 'Test',
      type: 'test',
    };

    // Call the renderer to add a slide
    renderer(testPptx, testSlideData, 1, 1);

    // Actually generate the PPTX blob to verify it works
    const pptxBlob = await testPptx.write({ outputType: 'blob' });

    // Check if the generated file is valid (should be > 10KB for a basic PPTX)
    const fileSize = pptxBlob.size;
    if (fileSize < 1000) {
      return {
        status: 'failed',
        error: `Generated PPTX file too small (${fileSize} bytes)`,
        pptxSize: fileSize,
      };
    }

    return {
      status: 'passed',
      error: null,
      pptxSize: fileSize,
      message: `PPTX generated successfully (${Math.round(fileSize / 1024)}KB)`,
    };
  } catch (err) {
    return { status: 'failed', error: err.message, pptxSize: 0 };
  }
}

/**
 * Main validation function - Two steps:
 * 1. Prompt conformance (HTML + PPTX JS match prompt?)
 * 2. Visual inspection (screenshot looks correct?)
 */
export async function validateTemplate(template, settings, options = {}) {
  const {
    maxIterations = 3,
    onProgress = null,
    generatePptx = true,
    originalPrompt = null,
  } = options;

  const results = {
    status: VALIDATION_STATUS.PENDING,
    promptConformance: null,
    visualInspection: null,
    finalPptxCode: template.pptxRendererCode || null,
    iterations: 0,
    score: 0,
    grade: null,
    stepResults: [],
  };

  // Generate PPTX code if needed
  if (generatePptx && settings?.apiKey && !results.finalPptxCode) {
    if (onProgress) {
      onProgress({ step: 'generating', message: 'Generating PPTX code...' });
    }

    let pptxCode = null;
    let iteration = 0;

    while (iteration < maxIterations && !pptxCode) {
      iteration++;
      results.iterations = iteration;

      try {
        pptxCode = await generatePptxRendererCode(template.html, template.title || 'Template', settings);
        const execTest = await testPptxExecution(pptxCode, template.html);
        if (execTest.status === 'failed') {
          pptxCode = null;
        }
      } catch (err) {
        console.warn(`PPTX generation attempt ${iteration} failed:`, err);
      }
    }

    results.finalPptxCode = pptxCode;
  }

  // STEP 1: Prompt Conformance
  if (settings?.apiKey && originalPrompt) {
    if (onProgress) {
      onProgress({
        step: VALIDATION_STEPS.PROMPT_CONFORMANCE,
        message: 'Step 1: Checking if HTML & JS match your request...',
      });
    }

    results.promptConformance = await validatePromptConformance(
      template.html,
      results.finalPptxCode,
      originalPrompt,
      settings
    );

    const conformanceScore = results.promptConformance.htmlScore || 0;
    const conformanceStatus = results.promptConformance.verdict === 'PASS' ? 'passed' :
                              results.promptConformance.verdict === 'FAIL' ? 'failed' : 'warning';

    results.stepResults.push({
      step: VALIDATION_STEPS.PROMPT_CONFORMANCE,
      name: 'Prompt Match',
      icon: '📝',
      status: conformanceStatus,
      score: conformanceScore,
      htmlConforms: results.promptConformance.htmlConforms,
      pptxConforms: results.promptConformance.pptxConforms,
      issues: [
        ...(results.promptConformance.htmlIssues || []).map(i => ({ severity: 'major', issue: `HTML: ${i}` })),
        ...(results.promptConformance.pptxIssues || []).map(i => ({ severity: 'major', issue: `PPTX: ${i}` })),
      ],
      summary: results.promptConformance.summary,
    });
  }

  // STEP 2: PPTX Execution Test
  if (results.finalPptxCode) {
    if (onProgress) {
      onProgress({
        step: VALIDATION_STEPS.PPTX_EXECUTION,
        message: 'Step 2: Testing if PPTX code executes correctly...',
      });
    }

    const executionTest = await testPptxExecution(results.finalPptxCode, template.html);
    const execStatus = executionTest.status === 'passed' ? 'passed' : 'failed';

    results.pptxExecution = executionTest;
    results.stepResults.push({
      step: VALIDATION_STEPS.PPTX_EXECUTION,
      name: 'PPTX Generation',
      icon: '⚙️',
      status: execStatus,
      score: execStatus === 'passed' ? 100 : 0,
      error: executionTest.error,
      pptxSize: executionTest.pptxSize,
      issues: executionTest.error ? [{ severity: 'major', issue: executionTest.error }] : [],
      summary: execStatus === 'passed'
        ? executionTest.message || `PPTX generated successfully (${Math.round((executionTest.pptxSize || 0) / 1024)}KB)`
        : `Generation failed: ${executionTest.error}`,
    });
  }

  // STEP 3: Visual Inspection (uses HTML screenshot as proxy)
  if (settings?.apiKey && originalPrompt) {
    if (onProgress) {
      onProgress({
        step: VALIDATION_STEPS.VISUAL_INSPECTION,
        message: 'Step 3: Analyzing screenshot for visual quality...',
      });
    }

    results.visualInspection = await validateVisualInspection(
      template.html,
      results.finalPptxCode,
      originalPrompt,
      settings
    );

    const visualScore = results.visualInspection.score || 0;
    const visualStatus = results.visualInspection.verdict === 'PASS' ? 'passed' :
                         results.visualInspection.verdict === 'FAIL' ? 'failed' : 'warning';

    results.stepResults.push({
      step: VALIDATION_STEPS.VISUAL_INSPECTION,
      name: 'Visual Check',
      icon: '👁️',
      status: visualStatus,
      score: visualScore,
      matchesRequest: results.visualInspection.matchesRequest,
      layoutCorrect: results.visualInspection.layoutCorrect,
      noOverflow: results.visualInspection.noOverflow,
      issues: (results.visualInspection.issues || []).map(i => ({ severity: 'major', issue: i })),
      summary: results.visualInspection.summary,
      note: 'Uses HTML screenshot (not actual PPTX rendering)',
    });
  }

  // Calculate final score
  const scores = results.stepResults.filter(s => typeof s.score === 'number').map(s => s.score);
  results.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
  results.grade = getGrade(results.score);

  // Determine final status
  const hasFailure = results.stepResults.some(s => s.status === 'failed');
  const hasWarning = results.stepResults.some(s => s.status === 'warning');
  results.status = hasFailure ? VALIDATION_STATUS.FAILED :
                   hasWarning ? VALIDATION_STATUS.WARNING :
                   results.stepResults.length > 0 ? VALIDATION_STATUS.PASSED :
                   VALIDATION_STATUS.PENDING;

  if (onProgress) {
    onProgress({
      step: 'complete',
      status: results.status,
      message: `Validation: ${results.grade.grade} (${results.score}%)`,
      results: results.stepResults,
    });
  }

  return results;
}

/**
 * Quick sync check if PPTX code can be parsed (doesn't generate actual PPTX)
 */
export function quickTestPptxCode(pptxCode) {
  try {
    const renderer = createRendererFromCode(pptxCode);
    return !!renderer;
  } catch {
    return false;
  }
}

/**
 * Quick validation (no API calls, sync)
 */
export function quickValidate(template) {
  const hasHtml = !!template.html?.includes('class="slide"');
  const hasPptxCode = !!template.pptxRendererCode;
  let pptxWorks = false;

  if (hasPptxCode) {
    pptxWorks = quickTestPptxCode(template.pptxRendererCode);
  }

  const score = hasHtml ? (hasPptxCode && pptxWorks ? 100 : 70) : 0;

  return {
    status: hasHtml ? 'passed' : 'failed',
    score,
    hasHtml,
    hasPptxCode,
    pptxWorks,
    grade: getGrade(score),
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score) {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: '#28a745' };
  if (score >= 75) return { grade: 'B', label: 'Good', color: '#5cb85c' };
  if (score >= 60) return { grade: 'C', label: 'Acceptable', color: '#ffc107' };
  if (score >= 40) return { grade: 'D', label: 'Needs Work', color: '#fd7e14' };
  return { grade: 'F', label: 'Failed', color: '#dc3545' };
}

export { getGrade as getQualityGrade };

/**
 * Validate a single slide from a deck
 */
export async function validateSlide(slide, slideIndex, settings, options = {}) {
  return validateTemplate({
    html: slide.html,
    title: slide.title || `Slide ${slideIndex + 1}`,
    type: slide.type,
    pptxRendererCode: slide.pptxRendererCode,
  }, settings, options);
}
