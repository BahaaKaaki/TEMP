import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSlides } from '../context/SlideContext';
import { useKnowledgeBase } from '../context/KnowledgeBaseContext';
import { generateSlides, improveSlide, improveSlideWithTemplate, improveMultipleSlides, generatePptxRendererCode, fillTemplateWithAI, fillTemplatesBulkWithAI, selectTemplateWithAI, planSlidesWithTemplates, chatWithContext, generateStoryline, generateSkeletonSlides, fillSkeletonSlide, populateSlides, createAgentExecutionPlan, buildContextString, buildMinimalEditContext, updateSlideSummary, generateSlideSummary, routeRequest, aiRouteRequest, detectContextRequest, buildRequestedContext, extractTitleFromHTML, analyzeContentForSlides, triageRequest, generateImageSlide, extractImageDataUri, buildDeckContextForSwitch, callWithModelFallback, webSearch } from '../services/aiService';
import { useAgenticExecution } from '../hooks/useAgenticExecution';
// Agent components removed - using simplified content agent
import { validateSlideLayout, formatValidationForAgent } from '../services/layoutValidation';
import { generateGPTContext, inspectSlide, agenticFixLoop, formatInspection } from '../services/layoutCorrectionService';
import { parseMultipleDocuments, getAcceptString, isFileSupported } from '../services/documentParser';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { VIBES, getVibePromptContext } from '../utils/vibes';
import { debugLog, LogLevel } from '../utils/debugLog';
import TemplatePicker from './TemplatePicker';
import ExecutionPlan from './ExecutionPlan';
import StorylinePanel from './StorylinePanel';
import StorylineWorkspace from './StorylineWorkspace';
import AgentApprovalDialog from './AgentApprovalDialog';
import SmartActionCard from './SmartActionCard';
import FlowStudio from './FlowStudio';
import KnowledgeBaseManager from './KnowledgeBaseManager';

// Detect vibe from user prompt for image-based mode
// Returns a vibe ID or 'default' if no strong signal
function detectVibeFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (/\b(bold|impactful|strong|punch|dramatic)\b/.test(lower)) return 'bold';
  if (/\b(corporate|formal|board|annual report|regulatory)\b/.test(lower)) return 'corporate';
  if (/\b(creative|playful|startup|fun|colorful|dynamic)\b/.test(lower)) return 'creative';
  if (/\b(minimal|clean|simple|keynote|zen|whitespace)\b/.test(lower)) return 'minimal';
  return 'default'; // professional strategy consulting
}

// Helper to parse slide references from prompt
// Returns { referencedSlides: [...], cleanedPrompt: string }
function parseSlideReferences(prompt, slides, currentSlideIndex) {
  const references = [];
  let cleanedPrompt = prompt;

  // Match patterns like "slide 5", "slide #5", "the 5th slide", "page 5", "page #5"
  const slideNumberPattern = /(?:(?:slide|page)\s*#?\s*(\d+)|the\s+(\d+)(?:st|nd|rd|th)\s+(?:slide|page)|in\s+(?:slide|page)\s*(\d+))/gi;
  let match;
  while ((match = slideNumberPattern.exec(prompt)) !== null) {
    const num = parseInt(match[1] || match[2] || match[3]);
    if (num > 0 && num <= slides.length) {
      references.push({ type: 'number', index: num - 1, slide: slides[num - 1] });
    }
  }

  // Match "this slide", "current slide", "this page"
  if (/\b(this|current)\s+(slide|page)\b/i.test(prompt) && currentSlideIndex >= 0) {
    references.push({ type: 'current', index: currentSlideIndex, slide: slides[currentSlideIndex] });
  }

  // Match "previous slide/page", "the slide/page before"
  if (/\b(previous|preceding|prior)\s+(slide|page)\b/i.test(prompt) && currentSlideIndex > 0) {
    references.push({ type: 'previous', index: currentSlideIndex - 1, slide: slides[currentSlideIndex - 1] });
  }

  // Match "next slide/page", "the slide/page after"
  if (/\bnext\s+(slide|page)\b/i.test(prompt) && currentSlideIndex < slides.length - 1) {
    references.push({ type: 'next', index: currentSlideIndex + 1, slide: slides[currentSlideIndex + 1] });
  }

  // Match "first slide/page"
  if (/\bfirst\s+(slide|page)\b/i.test(prompt) && slides.length > 0) {
    references.push({ type: 'first', index: 0, slide: slides[0] });
  }

  // Match "last slide/page" (but not "last" used for "previous")
  if (/\blast\s+(slide|page)\b/i.test(prompt) && slides.length > 0) {
    references.push({ type: 'last', index: slides.length - 1, slide: slides[slides.length - 1] });
  }

  // Deduplicate by index
  const uniqueRefs = [];
  const seenIndices = new Set();
  for (const ref of references) {
    if (!seenIndices.has(ref.index)) {
      seenIndices.add(ref.index);
      uniqueRefs.push(ref);
    }
  }

  return { referencedSlides: uniqueRefs, cleanedPrompt };
}

// Parse slide targets from prompt for Edit All mode
// Returns: { targetIndices: number[] | null, editAll: boolean, cleanedPrompt: string }
function parseSlideTargets(prompt, totalSlides) {
  let targetIndices = null;
  let editAll = true; // Default to all slides in Edit All mode
  let cleanedPrompt = prompt;

  // Check for "last slide" (not "last N slides")
  if (/\b(the\s+)?last\s+slide\b/i.test(prompt) && !/\blast\s+\d+\s+slides?\b/i.test(prompt)) {
    targetIndices = [totalSlides - 1];
    cleanedPrompt = prompt.replace(/\b(the\s+)?last\s+slide\b/gi, '').trim();
    editAll = false;
    return { targetIndices, editAll, cleanedPrompt };
  }

  // Check for "first slide" (not "first N slides")
  if (/\b(the\s+)?first\s+slide\b/i.test(prompt) && !/\bfirst\s+\d+\s+slides?\b/i.test(prompt)) {
    targetIndices = [0];
    cleanedPrompt = prompt.replace(/\b(the\s+)?first\s+slide\b/gi, '').trim();
    editAll = false;
    return { targetIndices, editAll, cleanedPrompt };
  }

  // Check for "last N slides"
  const lastNMatch = prompt.match(/\blast\s+(\d+)\s+slides?\b/i);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1], 10);
    const startIdx = Math.max(0, totalSlides - n);
    targetIndices = [];
    for (let i = startIdx; i < totalSlides; i++) {
      targetIndices.push(i);
    }
    cleanedPrompt = prompt.replace(/\blast\s+\d+\s+slides?\b/gi, '').trim();
    editAll = false;
    return { targetIndices, editAll, cleanedPrompt };
  }

  // Check for "first N slides"
  const firstNMatch = prompt.match(/\bfirst\s+(\d+)\s+slides?\b/i);
  if (firstNMatch) {
    const n = parseInt(firstNMatch[1], 10);
    targetIndices = [];
    for (let i = 0; i < Math.min(n, totalSlides); i++) {
      targetIndices.push(i);
    }
    cleanedPrompt = prompt.replace(/\bfirst\s+\d+\s+slides?\b/gi, '').trim();
    editAll = false;
    return { targetIndices, editAll, cleanedPrompt };
  }

  // Check for range patterns like "slides 3-5" or "slide 3 to 5"
  const rangeMatch = prompt.match(/\bslides?\s+(\d+)\s*[-–—to]+\s*(\d+)\b/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10) - 1;
    const end = parseInt(rangeMatch[2], 10) - 1;
    targetIndices = [];
    for (let i = start; i <= end && i < totalSlides; i++) {
      if (i >= 0) targetIndices.push(i);
    }
    cleanedPrompt = prompt.replace(/\bslides?\s+\d+\s*[-–—to]+\s*\d+\b/gi, '').trim();
    editAll = false;
    return { targetIndices, editAll, cleanedPrompt };
  }

  // Check for comma/and separated slide numbers like "slides 3, 4, and 5"
  const multiMatch = prompt.match(/\bslides?\s+([\d\s,and]+)/i);
  if (multiMatch) {
    const numStr = multiMatch[1];
    const numbers = numStr.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      targetIndices = numbers.map(n => parseInt(n, 10) - 1).filter(i => i >= 0 && i < totalSlides);
      if (targetIndices.length > 0) {
        cleanedPrompt = prompt.replace(/\bslides?\s+[\d\s,and]+/gi, '').trim();
        editAll = false;
        return { targetIndices, editAll, cleanedPrompt };
      }
    }
  }

  // Check for "only slide N" or "just slide N"
  const onlyMatch = prompt.match(/\b(only|just)\s+slide\s+(\d+)\b/i);
  if (onlyMatch) {
    const idx = parseInt(onlyMatch[2], 10) - 1;
    if (idx >= 0 && idx < totalSlides) {
      targetIndices = [idx];
      cleanedPrompt = prompt.replace(/\b(only|just)\s+slide\s+\d+\b/gi, '').trim();
      editAll = false;
      return { targetIndices, editAll, cleanedPrompt };
    }
  }

  // No specific slides mentioned - edit all
  return { targetIndices: null, editAll: true, cleanedPrompt: prompt };
}

/**
 * Parse vibe selection from prompt
 * Detects patterns like "in executive vibe", "use modern style", "with bold vibe"
 * @returns { selectedVibe: string | null, cleanedPrompt: string }
 */
function parseVibeFromPrompt(prompt) {
  const vibeIds = Object.keys(VIBES); // ['executive', 'bold', 'modern']

  // Create regex patterns for each vibe
  for (const vibeId of vibeIds) {
    const vibe = VIBES[vibeId];
    const vibeName = vibe.name.toLowerCase();

    // Match patterns like:
    // "in executive vibe/style", "use executive", "with executive look"
    // "make it executive", "executive style", "executive vibe"
    const patterns = [
      new RegExp(`\\b(in|use|with|using|apply)\\s+(the\\s+)?${vibeName}\\s*(vibe|style|look|theme)?\\b`, 'i'),
      new RegExp(`\\b(make\\s+(it|this)|set)\\s+(to\\s+)?${vibeName}\\b`, 'i'),
      new RegExp(`\\b${vibeName}\\s+(vibe|style|look)\\b`, 'i'),
      new RegExp(`\\bvibe[:\\s]+${vibeName}\\b`, 'i'),
      new RegExp(`\\b${vibeName}\\s+vibe\\b`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        // Remove the vibe instruction from prompt for cleaner AI input
        const cleanedPrompt = prompt.replace(pattern, '').replace(/\s+/g, ' ').trim();
        return { selectedVibe: vibeId, cleanedPrompt };
      }
    }
  }

  return { selectedVibe: null, cleanedPrompt: prompt };
}

/**
 * Validates slide layout and returns issues with fix suggestions
 * @param {string} html - The slide HTML to validate
 * @param {number} slideIndex - Index of the slide (1-based for display)
 * @returns {Object|null} - Validation result or null if no issues
 */
function validateSlideAndGetIssues(html, slideIndex) {
  try {
    const result = validateSlideLayout(html);
    if (!result.valid && result.issues.length > 0) {
      // Filter to only show significant issues (warnings and errors, not info)
      const significantIssues = result.issues.filter(
        issue => issue.severity === 'error' || issue.severity === 'warning'
      );

      if (significantIssues.length > 0) {
        return {
          slideIndex,
          issues: significantIssues,
          summary: result.summary,
          suggestions: result.suggestions,
          forAgent: formatValidationForAgent(result),
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Layout validation error:', err);
    return null;
  }
}

/**
 * Formats validation issues for display to user
 */
function formatIssuesForUser(validationResult) {
  const { slideIndex, issues, suggestions } = validationResult;
  const lines = [`⚠️ **Layout issues detected on Slide ${slideIndex}:**`];

  issues.slice(0, 3).forEach((issue) => {
    const icon = issue.severity === 'error' ? '🔴' : '🟡';
    lines.push(`${icon} ${issue.message}`);
  });

  if (issues.length > 3) {
    lines.push(`_...and ${issues.length - 3} more issue(s)_`);
  }

  if (suggestions.length > 0) {
    lines.push('\n**Suggested fixes:**');
    suggestions.slice(0, 2).forEach(s => {
      lines.push(`• ${s.suggestion}`);
    });
  }

  lines.push('\n_Reply "fix layout" to auto-fix these issues._');

  return lines.join('\n');
}

export default function AIChatbot() {
  const { state, actions, activeSlide } = useSlides();
  const knowledgeBase = useKnowledgeBase();

  // Keep a ref to current state that's updated synchronously on every render
  // This prevents stale closure issues in async handlers
  const stateRef = useRef(state);
  stateRef.current = state; // Updated synchronously during render

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Agent-only mode - simplified chatbot
  const mode = 'agent';
  const [editAllAutoMatch] = useState(false); // Auto-match templates in Edit All mode
  const [progress, setProgress] = useState(null); // { phase, current, total, plan, planStepsRef }
  // Agent mode state
  const [agentPlan, setAgentPlan] = useState(null); // Current execution plan
  const [agentStep, setAgentStep] = useState(-1); // Current step in execution (-1 = not started)
  const [showStorylineWorkspace, setShowStorylineWorkspace] = useState(false); // Storyline workspace modal
  const [showApprovalDialog, setShowApprovalDialog] = useState(false); // Agent approval dialog
  const [pendingAgentExecution, setPendingAgentExecution] = useState(null); // { plan, prompt, context }
  const [showRouterPreview, setShowRouterPreview] = useState(false); // Pre-router context preview
  const [pendingRouterCall, setPendingRouterCall] = useState(null); // { userPrompt, context, getFreshState, ... }
  const [showFlowStudio, setShowFlowStudio] = useState(false); // Flow Studio modal
  const [activeFlow, setActiveFlow] = useState(null); // Currently selected flow for execution
  // Smart Action Card state - inline chat execution
  const [pendingSmartAction, setPendingSmartAction] = useState(null); // { routeResult, userPrompt, context, ... }
  const [executionStatus, setExecutionStatus] = useState(null); // { type: 'fetching'|'generating'|'success'|'error', message }
  const abortControllerRef = useRef(null);

  // NEW: Agentic execution mode state
  const [useAgenticMode, setUseAgenticMode] = useState(false); // Toggle for new agentic system
  const [useReportMode, setUseReportMode] = useState(false); // Toggle for interactive report output (instead of slides)
  const [useImageMode, setUseImageMode] = useState(false); // Image-based slide generation mode
  // imageVibe is persisted in SlideContext (state.imageVibe) — read from context, write via actions.setImageVibe
  const imageVibe = state.imageVibe || 'default';
  const setImageVibe = actions.setImageVibe;
  // Unified agent-mode execution tracker — covers research + slide creation phases
  const [agentModeProgress, setAgentModeProgress] = useState(null); // { phase, steps: [{name, status}] }
  const [editableStoryline, setEditableStoryline] = useState(null); // Editable copy during approval

  // Knowledge Base and File Upload state
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // Files uploaded in current chat session
  const [useDeepThink, setUseDeepThink] = useState(false); // Use big model for router (more thorough planning)
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [useKnowledgeContext, setUseKnowledgeContext] = useState(false); // Include knowledge base in AI context
  const fileInputRef = useRef(null);

  // Chat messages state - must be defined before functions that use setMessages
  const [messages, setMessages] = useState([
    {
      type: 'assistant',
      content: 'Hi! I can help you create and improve slides. Choose a mode below and describe what you need.',
    },
  ]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // AI I/O tracking state - for viewing what was sent/received during each step
  const [expandedAiIO, setExpandedAiIO] = useState(new Set()); // Set of message indices with expanded AI I/O
  const [expandedSteps, setExpandedSteps] = useState(new Set()); // Set of step indices expanded to show thinking
  const currentStepAiIO = useRef([]); // Collect AI I/O during current execution

  // Agent output display - shows refined prompt sent to router
  const [lastAgentOutput, setLastAgentOutput] = useState(null);
  const [agentOutputExpanded, setAgentOutputExpanded] = useState(false);

  // Interactive report HTML (generated alongside slides)
  const [reportHTML, setReportHTML] = useState(null);

  // Storyline approval — stores context needed to resume after user approves
  const approvalResumeRef = useRef(null);

  // Ref for programmatic submit (used by clarification option buttons)
  const pendingClarificationRef = useRef(null);

  // Ref for router clarification re-submission (stores original prompt + context)
  const routerClarificationRef = useRef(null);

  // Only show last 2 user messages (and all messages after the first of those 2)
  const visibleMessages = useMemo(() => {
    // Find indices of all user messages
    const userMsgIndices = messages
      .map((msg, idx) => msg.type === 'user' ? idx : -1)
      .filter(idx => idx >= 0);

    // If 2 or fewer user messages, show all
    if (userMsgIndices.length <= 2) {
      return messages;
    }

    // Get the index of the second-to-last user message
    const cutoffIdx = userMsgIndices[userMsgIndices.length - 2];

    // Return messages from that point onward
    return messages.slice(cutoffIdx);
  }, [messages]);

  // Add message to chat - defined early so other functions can use it
  const addMessage = (type, content, options = {}) => {
    const { aiIO = null, isHTML = false } = options;
    setMessages((prev) => [...prev, { type, content, timestamp: new Date(), aiIO, isHTML }]);
  };

  // Wrapper for addMessage that matches the agentic system's expected format
  const addMessageForAgent = useCallback((msg) => {
    if (msg.type && msg.content) {
      const options = { ...(msg.options || {}), isHTML: msg.isHTML || false };
      addMessage(msg.type, msg.content, options);
    }
  }, []);

  // NEW: Use the agentic execution hook
  const agenticExecution = useAgenticExecution({
    state,
    actions,
    addMessage: addMessageForAgent,
    activeFlow,
    knowledgeBaseEntries: knowledgeBase?.entries || null,
  });

  // Helper to record AI I/O for current execution
  const recordAiIO = (stepName, input, output) => {
    currentStepAiIO.current.push({
      step: stepName,
      input: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
      output: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
      timestamp: new Date().toISOString(),
    });
  };

  // Stop ongoing operation
  const handleStop = () => {
    // Stop agentic execution if running
    if (agenticExecution.isRunning) {
      agenticExecution.stop();
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setProgress(null);
    setAgentPlan(null);
    setAgentStep(-1);
    setAgentModeProgress(null);
    setPendingSmartAction(null);
    addMessage('assistant', '⏹️ Operation stopped by user.');
  };

  // ─── Storyline Approval Handlers ───
  // These are exposed on window so the inline HTML buttons can call them
  useEffect(() => {
    window.__approveStoryline = async () => {
      const resumeCtx = approvalResumeRef.current;
      if (!resumeCtx) return;
      approvalResumeRef.current = null;

      addMessage('user', 'Approved — building presentation.', { isHTML: false });
      setIsLoading(true);

      // Clear approval card — agent's real-time steps will show progress
      // Do NOT set static steps here — the agent emits its own steps via onProgress
      setAgentModeProgress(prev => prev ? { ...prev, approvalData: null } : null);

      try {
        // Resume agent — Manager drafts → Partner reviews → Slide routing
        const agentResult = await agenticExecution.approveStoryline(editableStoryline);
        setEditableStoryline(null);

        // Capture agent's final steps into agentModeProgress BEFORE the hook clears them
        // (the hook sets isRunning=false and currentProgress=null when it returns)
        const agentFinalSteps = agentResult.steps || agenticExecution.currentProgress?.steps || [];
        if (agentFinalSteps.length > 0) {
          setAgentModeProgress({
            phase: 'Routing slides...',
            steps: agentFinalSteps.map(s => ({ ...s })),
          });
        }

        // Feed agent's AI I/O into the step log so it shows in the message
        const agentIO = agenticExecution.aiIOLog || agentResult.aiIOLog || [];
        if (agentIO.length > 0) {
          for (const io of agentIO) {
            currentStepAiIO.current.push(io);
          }
        }

        if (!agentResult.success) {
          addMessage('assistant', `Error resuming: ${agentResult.error}`);
          setIsLoading(false);
          setProgress(null);
          return;
        }

        // ─── Report mode — agent produced an interactive HTML report ───
        if (agentResult.reportHTML) {
          setReportHTML(agentResult.reportHTML);
          setLastAgentOutput({
            summary: agentResult.summary,
            budgetUsed: agentResult.budgetUsed,
            budgetTotal: agentResult.budgetTotal,
          });
          setAgentOutputExpanded(false);
          addMessage('assistant', agentResult.summary || 'Interactive report generated.');
          setIsLoading(false);
          setProgress(null);
          setAgentModeProgress(null);
          return;
        }

        // ─── Direct creation mode — agent already created slides via tools ───
        if (agentResult.directCreation) {
          const agentIO2 = agenticExecution.aiIOLog || agentResult.aiIOLog || [];
          if (agentIO2.length > 0) {
            for (const io of agentIO2) {
              currentStepAiIO.current.push(io);
            }
          }
          setLastAgentOutput({
            summary: agentResult.summary,
            structure: agentResult.structure,
            budgetUsed: agentResult.budgetUsed,
            budgetTotal: agentResult.budgetTotal,
          });
          setAgentOutputExpanded(false);
          addMessage('assistant', agentResult.summary || 'Slides created successfully.');
          setIsLoading(false);
          setProgress(null);
          setAgentModeProgress(null);
          return;
        }

        // ── Route using EXACTLY the same pipeline as handleSubmit ──
        // This ensures identical context building, router model selection, and fallback logic
        const selectedVibe = resumeCtx.selectedVibe;
        // Fallback: if agent didn't produce a refinedPrompt, use the original user request
        const effectivePrompt = agentResult.refinedPrompt || resumeCtx.userRequest || 'Create a presentation';

        // Save agent output
        setLastAgentOutput({
          refinedPrompt: agentResult.refinedPrompt,
          structure: agentResult.structure,
          iterations: agentResult.iterations,
        });

        // ── Build FULL context (same as handleSubmit lines 1295-1362) ──
        const getFreshState = () => stateRef.current;
        const freshState = getFreshState();
        const _rawIdx = freshState.activeSlideId
          ? freshState.slides.findIndex(s => s.id === freshState.activeSlideId)
          : -1;
        // Default to first slide when none explicitly selected — never pass -1
        const currentSlideIdx = _rawIdx >= 0 ? _rawIdx : (freshState.slides.length > 0 ? 0 : -1);
        const currentSlide = currentSlideIdx >= 0 ? freshState.slides[currentSlideIdx] : null;
        const storylineSummary = (freshState.storyline || []).map(s => s.title).join(' → ');
        const slideSummaries = freshState.slides.map((s, idx) => {
          const pendingComments = (s.comments || []).filter(c => !c.addressed);
          return {
            index: idx,
            title: s.title || 'Untitled',
            template: s.templateId || s.layoutType || s.type || 'custom',
            pendingComments: pendingComments.length > 0 ? pendingComments.map(c => c.text) : undefined,
          };
        });

        // Full document content (same as handleSubmit)
        const fullKnowledgeContext = buildKnowledgeContextForPrompt(effectivePrompt, { fullContent: true });
        let documentContent = null;
        let hasDocumentsAttached = false;
        if (fullKnowledgeContext) {
          hasDocumentsAttached = true;
          documentContent = fullKnowledgeContext.combined || '';
        } else if (uploadedFiles.length > 0) {
          // Fallback: RAG returned null but files exist in session
          const filesWithContent = uploadedFiles.filter(f => f.content);
          if (filesWithContent.length > 0) {
            hasDocumentsAttached = true;
            documentContent = filesWithContent
              .map(f => `=== FILE: ${f.fileName} ===\n${f.content}\n=== END FILE ===`)
              .join('\n\n');
          }
        }

        const context = {
          slideCount: freshState.slides.length,
          currentSlideIndex: currentSlideIdx,
          storylineSummary,
          slideSummaries,
          activeFlow: activeFlow || undefined,
          parallelBatchSize: freshState.settings?.parallelSlideGeneration || 3,
          hasDocumentsAttached,
          documentContent,
          pendingImages: null,
          useBigModel: false,
          referencedSlides: null,
          preferImageSlides: useImageMode && !!freshState.settings.imageModel,
        };

        // ── Route using SAME logic as handleSubmit ──
        const routerModel = freshState.settings?.routerModel || 'gemini:gemini-3-flash-preview';
        const routerParts = routerModel.includes(':') ? routerModel.split(':') : ['', routerModel];
        const routerProviderId = routerParts[0];
        const routerProviderArr = Array.isArray(freshState.settings?.providers) ? freshState.settings.providers : [];
        const routerProviderObj = routerProviderArr.find(p => p.id === routerProviderId);
        const routerProviderKey = routerProviderObj?.apiKey;
        const useAIRouter = routerModel !== 'rule-based' && !!routerProviderKey;

        // Preserve prior agent steps (scoping, storyline, etc.) and add slide routing
        setAgentModeProgress(prev => {
          const priorSteps = (prev?.steps || [])
            .filter(s => s.status === 'complete')
            .map(s => ({ ...s }));
          return {
            phase: 'Routing slides...',
            steps: [
              ...priorSteps,
              { name: 'Routing slides', status: 'active', role: 'associate' },
            ],
          };
        });

        let routeResult;
        if (useAIRouter) {
          setProgress({ phase: 'Creating slides...', current: 0, total: 1 });
          try {
            routeResult = await aiRouteRequest(effectivePrompt, context, freshState.settings);
          } catch (routerErr) {
            console.warn('[StorylineApproval] AI router failed, falling back to rule-based:', routerErr.message);
            routeResult = routeRequest(effectivePrompt, context);
          }
        } else {
          routeResult = routeRequest(effectivePrompt, context);
        }

        console.log('[StorylineApproval] Route result:', routeResult?.plan?.length, 'steps');

        // ── Build smart action payload (same as handleSubmit) ──
        const showSteps = freshState.settings?.showAgentSteps !== false;
        const batchSize = freshState.settings?.agentBatchSize || 3;

        // Detect context slides
        let contextIndices = routeResult.contextNeeded?.slideIndices || [];
        const planContextIndices = routeResult.plan?.flatMap(step => step.contextSlides || []) || [];
        const detectedContextIndices = [...new Set([...contextIndices, ...planContextIndices])];

        const enhancedRouteResult = {
          ...routeResult,
          detectedContextIndices,
          contextNeeded: {
            ...routeResult.contextNeeded,
            slideIndices: detectedContextIndices.length > 0 ? detectedContextIndices : (routeResult.contextNeeded?.slideIndices || []),
          },
        };

        const smartActionPayload = {
          routeResult: enhancedRouteResult,
          userPrompt: effectivePrompt,
          context,
          getFreshState,
          showSteps,
          batchSize,
          settings: freshState.settings,
          capturedSlideId: freshState.activeSlideId,
          capturedSlideIdx: currentSlideIdx,
          capturedSlide: currentSlide ? { id: currentSlide.id, title: currentSlide.title, type: currentSlide.type } : null,
          vibeHint: getVibePromptContext(selectedVibe || freshState.vibe),
          fullKnowledgeContext,
          fromAgent: true, // Agent mode — content is fully baked, safe to parallelize
        };

        // Update widget: carry forward all prior steps, add slide execution steps
        const routerPlan = enhancedRouteResult.plan || [];
        setAgentModeProgress(prev => {
          const priorSteps = (prev?.steps || [])
            .filter(s => s.status === 'complete' && s.name !== 'Routing slides')
            .map(s => ({ ...s }));
          const execSteps = routerPlan.map((s, idx) => ({
            name: s.action === 'analyze_content'
              ? 'Analyzing content'
              : `Slide ${idx + 1}: ${s.templateId || (s.instruction || 'Slide').slice(0, 30)}`,
            status: 'pending',
            role: 'associate',
          }));
          return {
            phase: `Creating ${execSteps.length} slides...`,
            steps: [
              ...priorSteps,
              { name: 'Routing slides', status: 'complete', role: 'associate', summary: `Routed ${execSteps.length} slides to templates` },
              ...execSteps,
            ],
          };
        });

        // Auto-execute
        setPendingSmartAction({ ...smartActionPayload, autoExecute: true });

      } catch (err) {
        console.error('[StorylineApproval] Error:', err);
        addMessage('assistant', `Error: ${err.message}`);
        setIsLoading(false);
        setProgress(null);
        setAgentModeProgress(null);
      }
    };

    window.__rejectStoryline = () => {
      approvalResumeRef.current = null;
      agenticExecution.rejectStoryline();
      setAgentModeProgress(null);
      addMessage('assistant', 'Storyline rejected. You can describe what you\'d like changed and I\'ll re-plan.');
    };

    // Multi-select: clicking an option toggles it independently
    window.__toggleClarificationChip = (btn) => {
      btn.classList.toggle('selected');
    };

    // Collect all selected option cards + free text per question and submit
    window.__submitClarificationAnswers = () => {
      const card = document.querySelector('.clarification-card');
      if (!card) return;
      const blocks = card.querySelectorAll('.clarification-question-block');
      const parts = [];
      blocks.forEach(block => {
        const qText = block.querySelector('.clarification-question')?.textContent || '';
        // Collect selected option cards
        const selected = Array.from(block.querySelectorAll('.clarification-option-card.selected, .clarification-chip.selected')).map(b => b.textContent);
        // Collect free text if provided
        const freetext = (block.querySelector('.clarification-freetext')?.value || '').trim();
        const answerParts = [];
        if (selected.length > 0) answerParts.push(selected.join('; '));
        if (freetext) answerParts.push(freetext);
        const answer = answerParts.join(' — ');
        if (answer) parts.push(`Q: ${qText}\nA: ${answer}`);
      });
      const combined = parts.join('\n\n') || '(no specific preferences)';
      setPrompt(combined);
      pendingClarificationRef.current = combined;
    };

    return () => {
      delete window.__approveStoryline;
      delete window.__rejectStoryline;
      delete window.__toggleClarificationChip;
      delete window.__submitClarificationAnswers;
    };
  }, [agenticExecution, state, activeFlow]);

  // Auto-submit when a clarification option is selected
  useEffect(() => {
    if (pendingClarificationRef.current && prompt === pendingClarificationRef.current) {
      pendingClarificationRef.current = null;
      // Programmatically trigger the form submit
      const form = document.querySelector('.chatbot-input-form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  }, [prompt]);

  // Handle flow selection from Flow Studio
  const handleFlowSelect = (flow) => {
    setActiveFlow(flow);
    addMessage('assistant', `📋 Flow loaded: **${flow.name}** (${flow.sections.length} sections)\n\n_${flow.description || 'No description'}_\n\nDescribe the topic/client to populate this flow.`);
  };

  const clearActiveFlow = () => {
    setActiveFlow(null);
  };

  // Handle file upload for chat context
  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const validFiles = files.filter(isFileSupported);
    if (validFiles.length === 0) {
      addMessage('assistant', '❌ No supported files selected. Supported formats: PDF, Word, Excel, PowerPoint, Images, Text');
      return;
    }

    if (validFiles.length > 10) {
      addMessage('assistant', '❌ Maximum 10 files can be uploaded at once. Please select fewer files.');
      return;
    }

    setIsUploadingFiles(true);
    addMessage('assistant', `📎 Parsing ${validFiles.length} file${validFiles.length > 1 ? 's' : ''}...`);

    try {
      const results = await parseMultipleDocuments(validFiles, {
        settings: state.settings,
      });

      const successDocs = [];
      const failures = [];

      results.forEach((result) => {
        if (result.success) {
          successDocs.push({
            fileName: result.file.name,
            content: result.result.content,
            type: result.result.type,
            metadata: result.result.metadata,
            imageData: result.result.imageData || null, // Preserve base64 for images
          });
        } else {
          failures.push({ file: result.file.name, error: result.error?.message || 'Unknown error' });
        }
      });

      // Add successful documents to knowledge base
      if (successDocs.length > 0) {
        knowledgeBase.actions.bulkAddDocuments(successDocs.map(doc => ({
          content: doc.content,
          type: doc.type,
          metadata: doc.metadata,
        })));

        // Also track in local session
        setUploadedFiles(prev => [...prev, ...successDocs]);

        const fileNames = successDocs.map(d => d.fileName).join(', ');
        addMessage('assistant', `✓ Uploaded and parsed ${successDocs.length} file${successDocs.length > 1 ? 's' : ''}: ${fileNames}\n\nThis content is now available for slide creation. You can ask me to use it!`);
      }

      if (failures.length > 0) {
        const failedNames = failures.map(f => f.file).join(', ');
        addMessage('assistant', `⚠️ ${failures.length} file${failures.length > 1 ? 's' : ''} failed to parse: ${failedNames}`);
      }
    } catch (error) {
      console.error('[AIChatbot] File upload error:', error);
      addMessage('assistant', `❌ Error uploading files: ${error.message}`);
    } finally {
      setIsUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [state.settings, knowledgeBase.actions]);

  // Handle paste event for images - store raw image, analyze later with query context
  const handlePaste = useCallback(async (event) => {
    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;

    const imageItems = [];
    for (const item of clipboardItems) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageItems.push({ file, type: item.type });
        }
      }
    }

    if (imageItems.length === 0) return;

    // Prevent default paste behavior for images
    event.preventDefault();

    console.log('[AIChatbot] Pasted', imageItems.length, 'image(s)');

    setIsUploadingFiles(true);

    try {
      // Convert images to base64 WITHOUT analyzing - analyze later with user query
      const processedImages = await Promise.all(imageItems.map(async ({ file, type }) => {
        const ext = type.split('/')[1] || 'png';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `pasted-image-${timestamp}.${ext}`;

        // Read as base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          fileName,
          type: 'image',
          imageData: base64, // Store raw base64 - will analyze with query
          content: null, // No pre-analysis - will be filled when user sends query
          needsAnalysis: true, // Flag to indicate this needs vision analysis
        };
      }));

      // Track in session (not in knowledge base yet - will add after analysis)
      setUploadedFiles(prev => [...prev, ...processedImages]);

      addMessage('assistant', `📎 Image${processedImages.length > 1 ? 's' : ''} ready. What would you like me to do with ${processedImages.length > 1 ? 'them' : 'it'}?`);
    } catch (error) {
      console.error('[AIChatbot] Paste error:', error);
      addMessage('assistant', `❌ Error processing pasted image: ${error.message}`);
    } finally {
      setIsUploadingFiles(false);
    }
  }, []);

  // Build knowledge context for AI prompts (RAG-style)
  // ALWAYS includes uploaded files, optionally includes KB if toggle is on
  const buildKnowledgeContextForPrompt = useCallback((userPrompt, options = {}) => {
    const { fullContent = false } = options; // fullContent=true for analyze_content step

    // Get relevant knowledge base entries (only if KB toggle is ON)
    let kbContext = null;
    if (useKnowledgeContext) {
      // Use higher token limit for full content mode
      kbContext = knowledgeBase.buildKnowledgeContext(userPrompt, {
        maxTokens: fullContent ? 50000 : 3000, // Much higher limit for full analysis
        fullContent, // Pass through to allow full content extraction
      });
    }

    // ALWAYS include uploaded files from this session (regardless of KB toggle)
    let sessionContext = '';
    if (uploadedFiles.length > 0) {
      // For analyze_content, include ALL files with FULL content
      const filesToInclude = fullContent ? uploadedFiles : uploadedFiles.slice(-5);
      sessionContext = filesToInclude
        .filter(f => f.content) // Skip files without content (e.g., images pending analysis)
        .map(f => {
          if (fullContent) {
            // Full content for analysis - no truncation
            return `=== FILE: ${f.fileName} ===\n${f.content}\n=== END FILE ===`;
          } else {
            // Brief preview for router/other steps
            const preview = f.content.slice(0, 1000);
            return `[Recently uploaded: ${f.fileName}]\n${preview}${f.content.length > 1000 ? '...' : ''}`;
          }
        }).join('\n\n');
    }

    if (!kbContext && !sessionContext) {
      // Log WHY we're returning null — helps diagnose "documents not reaching router"
      if (uploadedFiles.length > 0) {
        console.warn('[buildKnowledgeContext] Returning null despite uploadedFiles:', {
          count: uploadedFiles.length,
          files: uploadedFiles.map(f => ({ name: f.fileName, hasContent: !!f.content, contentLen: f.content?.length || 0 })),
          kbToggle: useKnowledgeContext,
        });
      }
      return null;
    }

    // Log the content sizes for debugging
    console.log('[buildKnowledgeContext]', {
      fullContent,
      kbContextLength: kbContext?.context?.length || 0,
      sessionContextLength: sessionContext?.length || 0,
      filesIncluded: uploadedFiles.length,
    });

    return {
      knowledgeBase: kbContext?.context || '',
      sessionFiles: sessionContext,
      combined: [
        kbContext?.context ? `## Knowledge Base Context\n${kbContext.context}` : '',
        sessionContext ? `## Recently Uploaded Files\n${sessionContext}` : '',
      ].filter(Boolean).join('\n\n'),
    };
  }, [useKnowledgeContext, knowledgeBase, uploadedFiles]);

  // Helper to check if operation was aborted
  const isAborted = () => abortControllerRef.current?.signal.aborted;

  // Get all available templates including custom and modified system templates
  const allTemplates = useMemo(() => {
    const deletedIds = state.deletedSystemTemplates || [];
    const modifications = state.modifiedSystemTemplates || {};
    const builtIn = Object.values(SLIDE_TEMPLATES)
      .filter((t) => !deletedIds.includes(t.id))
      .map((t) => {
        const mod = modifications[t.id];
        return { ...t, ...(mod || {}), isBuiltIn: true };
      });
    const custom = (state.customTemplates || []).map((t) => ({ ...t, isBuiltIn: false }));
    return [...builtIn, ...custom];
  }, [state.customTemplates, state.deletedSystemTemplates, state.modifiedSystemTemplates]);

  // Templates for AI selection - exclude "blank" which is for manual empty canvas only
  const templatesForAI = useMemo(() => {
    return allTemplates.filter(t => t.id !== 'blank');
  }, [allTemplates]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-switch to edit mode when a slide is selected
  useEffect(() => {
    if (activeSlide && mode === 'create') {
      // Keep create mode but show the option
    }
  }, [activeSlide]);

  // Clear chat when a new deck is created (deckName changes and slides are empty)
  const prevDeckNameRef = useRef(state.deckName);
  useEffect(() => {
    if (state.deckName !== prevDeckNameRef.current && state.slides.length === 0) {
      // Full reset of chat state for new deck
      setMessages([{
        type: 'assistant',
        content: 'Hi! I can help you create and improve slides. Choose a mode below and describe what you need.',
      }]);
      setUploadedFiles([]);
      setPendingSmartAction(null);
      setProgress(null);
      setExecutionStatus(null);
      setAgentModeProgress(null);
      setLastAgentOutput(null);
      setAgentOutputExpanded(false);
      agenticExecution.clear();
      currentStepAiIO.current = [];
      console.log('[AIChatbot] New deck detected - all chat state reset');
    }
    prevDeckNameRef.current = state.deckName;
  }, [state.deckName, state.slides.length]);

  // Toggle AI I/O expansion for a message
  const toggleAiIO = (msgIndex) => {
    setExpandedAiIO(prev => {
      const next = new Set(prev);
      if (next.has(msgIndex)) {
        next.delete(msgIndex);
      } else {
        next.add(msgIndex);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // ─── Live input: if agent is running, push message to its input queue ───
    // This enables chatting with the agent while it works (like Claude Code).
    // Messages are queued and integrated at checkpoints between workers.
    if (agenticExecution.isRunning) {
      const liveMsg = prompt.trim();
      setPrompt('');

      // Check if it's a budget add command
      const budgetMatch = liveMsg.match(/(?:add|give|extend|increase|more)\s*(?:me\s+)?(?:more\s+)?(\d+)?\s*(?:budget|credits?|units?)/i);
      const addBudget = budgetMatch ? (parseInt(budgetMatch[1], 10) || 10) : 0;

      const pushed = agenticExecution.pushLiveInput(liveMsg, { addBudget });
      if (pushed) {
        if (addBudget > 0) {
          addMessage('assistant', `Got it — added ${addBudget} credits. Your message will be integrated at the next checkpoint.`);
        }
        // Message was pushed to queue — don't block, don't set loading
        return;
      }
    }

    if (isLoading) return;

    let userPrompt = prompt.trim();
    setPrompt('');
    addMessage('user', userPrompt);

    // ─── Pending plan: handle text responses to a visible SmartActionCard ───
    // When a plan is showing and the user types instead of clicking Execute,
    // inject the pending plan context so the router can interpret the follow-up.
    if (pendingSmartAction && !pendingSmartAction.autoExecute) {
      const pendingPlan = pendingSmartAction.routeResult?.plan || [];
      const planSummary = pendingPlan.map((s, i) =>
        `${i + 1}. ${s.action} — ${s.templateId || 'freestyle'}${s.instruction ? ': ' + s.instruction.slice(0, 80) : ''}`
      ).join('\n');

      console.log('[SmartAction] User sent follow-up to pending plan, re-routing with plan context');
      const originalPrompt = pendingSmartAction.userPrompt;
      setPendingSmartAction(null);
      setExecutionStatus(null);
      actions.setHighlightedSlides([]);

      userPrompt = `Original request: ${originalPrompt}\n\nPENDING PLAN (already shown to user, awaiting approval):\n${planSummary}\n\nUser reply: ${userPrompt}`;
    }

    // Auto-detect vibe from prompt when in image mode
    if (useImageMode) {
      const detected = detectVibeFromPrompt(userPrompt);
      setImageVibe(detected);
    }

    // CRITICAL: Get current state from ref to avoid stale closure issues
    // The state variable from the closure may be outdated
    const currentState = stateRef.current;

    // Check if any provider has an API key configured
    const hasAnyKey = currentState.settings.apiKey ||
      (Array.isArray(currentState.settings.providers) && currentState.settings.providers.some(p => !!p.apiKey));
    if (!hasAnyKey) {
      addMessage('assistant', '⚠️ Please configure your API key in Settings first (gear icon in header).');
      return;
    }

    // ─── Budget top-up command ───
    // Detect "add budget", "add 5 credits", "add more budget", "give me more credits", etc.
    const budgetMatch = userPrompt.match(/(?:add|give|extend|increase|more)\s*(?:me\s+)?(?:more\s+)?(\d+)?\s*(?:budget|credits?|units?)/i)
      || userPrompt.match(/(?:add|give|extend|increase)\s*(?:more\s+)?(?:budget|credits?|units?)\s*(?:by\s+)?(\d+)?/i);
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1], 10) || 10;
      agenticExecution.extendBudget(amount);
      addMessage('assistant', `Added ${amount} credits to the agent budget.`);
      setIsLoading(false);
      return;
    }

    // ─── Continue / resume command ───
    // Detect "continue", "keep going", "go on", "carry on", "resume", "proceed" when agent exists
    const continueMatch = userPrompt.match(/^(?:continue|keep\s*going|go\s*on|carry\s*on|resume|proceed|more|finish\s*(?:it|this|the\s*work))[\s!.]*$/i);
    if (continueMatch && agenticExecution.phase !== 'idle' && !agenticExecution.isRunning) {
      // Extract optional credit amount: "continue with 20 credits"
      const creditAmountMatch = userPrompt.match(/(\d+)\s*(?:credits?|budget|units?)/i);
      const extraCredits = creditAmountMatch ? parseInt(creditAmountMatch[1], 10) : 15;

      addMessage('assistant', `Adding ${extraCredits} credits and continuing from where we left off.`);
      setIsLoading(true);
      setProgress({ phase: 'Continuing...', current: 0, total: 1 });

      try {
        const continueResult = await agenticExecution.continueExecution(extraCredits);

        if (continueResult.needsClarification || continueResult.needsApproval) {
          // Agent paused again — UI handles this
          setIsLoading(false);
          setProgress(null);
          return;
        }

        if (!continueResult.success) {
          addMessage('assistant', `Error: ${continueResult.error}`);
        }
      } catch (err) {
        addMessage('assistant', `Error continuing: ${err.message}`);
      }

      setIsLoading(false);
      setProgress(null);
      return;
    }

    // Auto-name deck from first user prompt (fire-and-forget)
    if (currentState.deckName === 'Untitled Deck' || !currentState.deckName) {
      const namingText = userPrompt.trim();
      (async () => {
        try {
          const fastSettings = {
            ...currentState.settings,
            model: currentState.settings.fastModel || currentState.settings.model,
            maxTokens: 50,
            temperature: 0.3,
          };
          const title = await callWithModelFallback(
            fastSettings,
            'Generate a concise deck title (3-6 words, no quotes, no punctuation at end) for a presentation. Return ONLY the title text.',
            namingText
          );
          const clean = (title || '').trim().replace(/^["']|["']$/g, '').replace(/[.!?]$/, '').trim();
          if (clean && clean.length > 2 && clean.length < 80 && stateRef.current.deckName === 'Untitled Deck') {
            actions.setDeckName(clean);
          }
        } catch (e) {
          console.warn('[AutoName] Failed to generate deck title:', e.message);
        }
      })();
    }

    // Parse vibe from prompt - user can say "in executive vibe" or "use modern style"
    const { selectedVibe, cleanedPrompt: promptWithoutVibe } = parseVibeFromPrompt(userPrompt);
    if (selectedVibe) {
      actions.setVibe(selectedVibe);
      const vibeName = VIBES[selectedVibe].name;
      addMessage('assistant', `🎨 Switching to **${vibeName}** vibe`);
    }

    // Build knowledge context - but DON'T inject into main prompt
    // The router will see a brief exhibit, and analyze_content step gets the full content
    // This prevents passing large documents through every step
    const earlyKnowledgeContext = buildKnowledgeContextForPrompt(userPrompt);
    if (earlyKnowledgeContext) {
      console.log('[AIChatbot] Knowledge context available for analyze_content step:', {
        hasKnowledgeBase: !!earlyKnowledgeContext.knowledgeBase,
        hasSessionFiles: !!earlyKnowledgeContext.sessionFiles,
        totalLength: earlyKnowledgeContext.combined?.length || 0,
      });
    }

    // Use cleaned prompt WITHOUT injected documents (router decides if analyze_content is needed)
    // Note: This will be updated if agent mode refines the prompt
    let effectivePrompt = selectedVibe ? promptWithoutVibe : userPrompt;

    // ─── Router clarification re-submission — combine original prompt + answers ───
    if (routerClarificationRef.current) {
      const { originalPrompt } = routerClarificationRef.current;
      effectivePrompt = `${originalPrompt}\n\nUser clarification:\n${effectivePrompt}`;
      routerClarificationRef.current = null;
    }

    // Parse slide references from prompt
    const rawSlideIdx = currentState.activeSlideId
      ? currentState.slides.findIndex(s => s.id === currentState.activeSlideId)
      : -1;
    // Default to first slide (0) when no slide is selected — never pass -1 to the router
    const currentSlideIndex = rawSlideIdx >= 0 ? rawSlideIdx : (currentState.slides.length > 0 ? 0 : -1);
    const { referencedSlides } = parseSlideReferences(userPrompt, currentState.slides, currentSlideIndex);

    // Create abort controller for this operation
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setAgentModeProgress(null); // Clear previous execution history

    // Show initial progress — agent mode will override with its own phases
    setProgress({ phase: 'Working...', current: 0, total: 1 });

    try {
      // REVISION MODE — user typed feedback during storyline approval
      if (agenticExecution.awaitingApproval && agentModeProgress?.approvalData) {
        setIsLoading(true);
        setProgress({ phase: 'Revising plan...', current: 0, total: 1 });

        const revResult = await agenticExecution.reviseStoryline(userPrompt, editableStoryline);

        if (revResult.needsApproval) {
          // Updated storyline — show approval card again
          const revisedStoryline = revResult.storyline;
          setEditableStoryline(JSON.parse(JSON.stringify(revisedStoryline)));
          setAgentModeProgress(prev => ({
            ...prev,
            phase: 'Awaiting approval',
            approvalData: {
              storyline: revisedStoryline,
              logs: revResult.logs || [],
            },
          }));
          approvalResumeRef.current = {
            storyline: revisedStoryline,
            currentState,
            selectedVibe,
            useDeepThink,
            userRequest: approvalResumeRef.current?.userRequest || userPrompt,
          };
          setIsLoading(false);
          setProgress(null);
          return;
        }

        if (!revResult.success) {
          addMessage('assistant', `Revision failed: ${revResult.error}`);
        }
        setIsLoading(false);
        setProgress(null);
        return;
      }

      // AGENT MODE - Content preparation layer before router
      // AI triage decides whether request needs agent (research/planning) or goes direct to router
      const isAgentAwaiting = agenticExecution.awaitingClarification;

      let shouldRunAgent = isAgentAwaiting;
      if (!isAgentAwaiting && (useAgenticMode || useReportMode)) {
        if (useReportMode) {
          // Report mode always uses agent — skip triage
          shouldRunAgent = true;
          console.log('[AIChatbot] Report mode — forcing agent');
        } else {
          // Let AI decide based on the request + current deck context
          const triageContext = {
            slideCount: currentState.slides?.length || 0,
            slideSummaries: (currentState.slides || []).map((s, idx) => ({
              index: idx,
              title: s.title || 'Untitled',
              type: s.type || 'custom',
            })),
            storylineSummary: (currentState.storyline || []).map(s => s.title).join(' → '),
          };
          const triage = await triageRequest(userPrompt, triageContext, currentState.settings);
          shouldRunAgent = triage.useAgent;
          console.log('[AIChatbot] AI triage:', triage.useAgent ? 'AGENT' : 'ROUTER', '-', triage.reason);
        }
      }

      if (shouldRunAgent) {
        console.log('[AIChatbot] Using agent mode - isAwaiting:', isAgentAwaiting, 'reportMode:', useReportMode);

        // Run content agent (agent has its own progress phases: Analyzing → Searching → Building)
        const agentResult = await agenticExecution.prepareContent(userPrompt, { reportMode: useReportMode });

        if (agentResult.needsClarification) {
          setIsLoading(false);
          setProgress(null);
          return;
        }

        // ─── Storyline Approval Checkpoint ───
        if (agentResult.needsApproval) {
          const storyline = agentResult.storyline || {};

          // Store resume context for when user approves
          approvalResumeRef.current = {
            storyline,
            currentState,
            selectedVibe,
            useDeepThink,
            userRequest: userPrompt,
          };

          // Initialize editable copy of the storyline for the approval card
          setEditableStoryline(JSON.parse(JSON.stringify(storyline)));

          // Update agent widget to show approval pending (card renders inline in the widget)
          setAgentModeProgress({
            phase: 'Awaiting approval',
            steps: agentResult.steps || [
              { name: 'Scoping & storyline', status: 'complete', role: 'manager' },
              { name: 'Awaiting approval', status: 'active', role: 'manager' },
            ],
            // Approval card data — rendered as React in the agent widget, not as HTML message
            approvalData: {
              storyline,
              logs: agentResult.logs || [],
            },
          });

          setIsLoading(false);
          setProgress(null);
          return;
        }

        if (!agentResult.success) {
          const canResume = agentResult.canResume;
          const resumeHint = canResume ? '\n\nYour progress is saved. Say **"continue"** to add more credits and pick up where we left off.' : '';
          addMessage('assistant', `${agentResult.error}${resumeHint}`);
          setIsLoading(false);
          setProgress(null);
          return;
        }

        // ─── Report mode — agent produced an interactive HTML report ───
        if (agentResult.reportHTML) {
          const agentIO = agenticExecution.aiIOLog || agentResult.aiIOLog || [];
          if (agentIO.length > 0) {
            for (const io of agentIO) {
              currentStepAiIO.current.push(io);
            }
          }
          setReportHTML(agentResult.reportHTML);
          setLastAgentOutput({
            summary: agentResult.summary,
            budgetUsed: agentResult.budgetUsed,
            budgetTotal: agentResult.budgetTotal,
          });
          setAgentOutputExpanded(false);
          addMessage('assistant', agentResult.summary || 'Interactive report generated.');
          setIsLoading(false);
          setProgress(null);
          setAgentModeProgress(null);
          return;
        }

        // ─── Direct creation mode — agent already created slides via tools ───
        if (agentResult.directCreation) {
          const agentIO = agenticExecution.aiIOLog || agentResult.aiIOLog || [];
          if (agentIO.length > 0) {
            for (const io of agentIO) {
              currentStepAiIO.current.push(io);
            }
          }
          setLastAgentOutput({
            summary: agentResult.summary,
            structure: agentResult.structure,
            budgetUsed: agentResult.budgetUsed,
            budgetTotal: agentResult.budgetTotal,
          });
          setAgentOutputExpanded(false);
          addMessage('assistant', agentResult.summary || 'Slides created successfully.');
          setIsLoading(false);
          setProgress(null);
          setAgentModeProgress(null);
          return;
        }

        // Transition agent widget from research → slide design
        // Use agentResult.steps (not currentProgress which is already cleared by the hook)
        const agentSteps = agentResult.steps || agenticExecution.currentProgress?.steps || [];
        const completedAgentSteps = agentSteps
          .filter(s => s.status === 'complete')
          .map(s => ({ ...s }));
        setAgentModeProgress({
          phase: 'Routing slides...',
          steps: [
            ...completedAgentSteps,
            { name: 'Routing slides', status: 'active', role: 'associate' },
          ],
        });

        // Use the refined prompt instead of original
        userPrompt = agentResult.refinedPrompt;
        effectivePrompt = userPrompt;
        console.log('[AIChatbot] Agent refined prompt:', userPrompt.slice(0, 200) + '...');

        // Feed agent's AI I/O into the step log
        const agentIO = agenticExecution.aiIOLog || agentResult.aiIOLog || [];
        if (agentIO.length > 0) {
          for (const io of agentIO) {
            currentStepAiIO.current.push(io);
          }
        }

        // Save agent output for display
        setLastAgentOutput({
          refinedPrompt: agentResult.refinedPrompt,
          structure: agentResult.structure,
          iterations: agentResult.budgetUsed || agentResult.iterations,
          budgetUsed: agentResult.budgetUsed,
          budgetTotal: agentResult.budgetTotal,
        });
        setAgentOutputExpanded(false);
      }

      // REGULAR FLOW - Route through existing router (agent mode feeds into this too)
      {
        const showSteps = currentState.settings?.showAgentSteps !== false;
        const batchSize = currentState.settings?.agentBatchSize || 3;

        // Special command: "fix layout" - Agentic CSS fixes with visible reasoning
        if (/^(fix\s+)?layout(\s+issues?)?$/i.test(userPrompt) || /^fix\s+(the\s+)?(overflow|overlap)/i.test(userPrompt)) {
          addMessage('assistant', '🤖 **Layout Agent Starting**\n\n_I will inspect each slide, analyze issues, and apply fixes step by step._');

          // Create hidden container for DOM-based inspection
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;width:960px;height:540px;';
          document.body.appendChild(container);

          // Add CSS variables for accurate layout detection
          const cssStyle = document.createElement('style');
          const baseVars = `
            :root {
              --slide-w: 960px; --slide-min-h: 540px;
              --left-x: 35px; --title-w: 890px; --subtitle-w: 890px;
              --title-y: 30px; --subtitle-y: 101px; --frame-y: 137px; --frame-w: 890px;
              --bg: #fff; --main: #111; --secondary: #222; --meta: #4A4F57;
              --red: #A32020; --zone1: #F7F9FB; --maroon: #8E1E1E; --rose: #F8E3E3;
              --radius: 4px; --border: #E6E9EE;
            }
            .slide { position:relative; width:960px; height:540px; background:#fff; box-sizing:border-box; overflow:hidden; }
          `;
          cssStyle.textContent = baseVars + '\n' + (currentState.sharedCSS || '');
          container.appendChild(cssStyle);

          const slideResults = [];
          const slidesNeedingGPT = [];

          for (let i = 0; i < currentState.slides.length; i++) {
            const slide = currentState.slides[i];
            setProgress(prev => ({ ...prev, phase: `Slide ${i + 1}/${currentState.slides.length}`, current: i }));

            // Render slide
            const slideDiv = document.createElement('div');
            slideDiv.innerHTML = slide.html;
            container.appendChild(slideDiv);

            const slideEl = slideDiv.querySelector('.slide');
            if (!slideEl) {
              container.removeChild(slideDiv);
              continue;
            }

            // Force layout calculation
            slideEl.getBoundingClientRect();

            // Step 1: INSPECT - Show detailed measurements
            addMessage('assistant', `\n---\n### 🔍 Inspecting Slide ${i + 1}: "${slide.title || 'Untitled'}"`);

            const inspection = inspectSlide(slideEl);
            const inspectionText = formatInspection(inspection);
            addMessage('assistant', inspectionText);

            if (!inspection.hasIssues) {
              addMessage('assistant', `✅ **No issues** - layout is correct`);
              slideResults.push({ index: i, status: 'ok' });
              container.removeChild(slideDiv);
              continue;
            }

            // Step 2: REASON - Explain what needs fixing
            let reasoning = `\n**🧠 Analysis:**\n`;
            const issueTypes = inspection.issues.map(iss => iss.type);
            if (issueTypes.includes('frame-overflow') || issueTypes.includes('frame-footer-overlap')) {
              const overflow = inspection.issues.find(i => i.overflow)?.overflow || 0;
              reasoning += `• Content overflows by ~${overflow}px - need to compress\n`;
            }
            if (issueTypes.includes('element-overflow')) {
              reasoning += `• Elements extend beyond slide bounds\n`;
            }
            if (issueTypes.includes('text-truncation')) {
              reasoning += `• Some text is truncated\n`;
            }
            reasoning += `\n**Strategy:** Apply progressive CSS fixes (gaps → padding → margins → fonts)`;
            addMessage('assistant', reasoning);

            // Step 3: ACT - Apply fixes with live updates
            addMessage('assistant', `\n**🔧 Applying fixes...**`);

            const fixLog = [];
            const result = agenticFixLoop(slideEl, {
              maxIterations: 25,
              slideIndex: i,
              slideTitle: slide.title || 'Untitled',
              onStep: (step) => {
                fixLog.push(step);
              }
            });

            // Show the fix steps with full reasoning
            const relevantSteps = result.log.filter(l =>
              ['applied', 'verify', 'decide', 'skip'].includes(l.type)
            );

            let fixSummary = '';
            relevantSteps.forEach(step => {
              if (step.type === 'applied') {
                fixSummary += `✓ ${step.message}\n`;
              } else if (step.type === 'verify') {
                if (step.data?.hasIssues) {
                  const overflow = step.data.issues.find(i => i.overflow)?.overflow;
                  fixSummary += `📏 ${overflow ? `Still ${overflow}px overflow` : 'Issues remain'}\n`;
                } else {
                  fixSummary += `📏 All issues resolved!\n`;
                }
              } else if (step.type === 'decide') {
                fixSummary += `${step.message}\n`;
              }
            });

            if (fixSummary) {
              addMessage('assistant', `\`\`\`\n${fixSummary}\`\`\``);
            }

            // Step 4: VERIFY - Final check
            if (result.success) {
              addMessage('assistant', `\n**✅ Slide ${i + 1} fixed** in ${result.iterations} steps`);

              // Save the fixed HTML
              const fixedSlideEl = slideDiv.querySelector('.slide');
              if (fixedSlideEl) {
                actions.updateSlide(slide.id, { html: fixedSlideEl.outerHTML });
              }
              slideResults.push({ index: i, status: 'fixed', iterations: result.iterations });
            } else {
              const remaining = result.remainingIssues?.map(i => i.message).join('; ') || 'unknown';
              addMessage('assistant', `\n**⚠️ Slide ${i + 1}**: CSS fixes exhausted\nRemaining: ${remaining}\n\n_Will need AI to regenerate with less content._`);

              slidesNeedingGPT.push({
                slide,
                index: i,
                gptContext: generateGPTContext(result),
                appliedFixes: result.log.filter(l => l.type === 'applied'),
              });
              slideResults.push({ index: i, status: 'needs-gpt', remaining });
            }

            container.removeChild(slideDiv);
          }

          // Cleanup
          document.body.removeChild(container);

          // Final Summary
          const fixed = slideResults.filter(r => r.status === 'fixed').length;
          const needsGPT = slideResults.filter(r => r.status === 'needs-gpt').length;
          const ok = slideResults.filter(r => r.status === 'ok').length;

          addMessage('assistant', `\n---\n### 📊 Final Summary\n• ${ok} slide(s) OK\n• ${fixed} slide(s) fixed with CSS\n${needsGPT > 0 ? `• ${needsGPT} slide(s) need AI regeneration` : ''}`);

          // If any slides need GPT, offer to regenerate
          if (slidesNeedingGPT.length > 0) {
            const fixPlan = {
              understanding: `${slidesNeedingGPT.length} slide(s) need AI regeneration after CSS fixes were insufficient.`,
              steps: slidesNeedingGPT.map(({ index, gptContext }) => ({
                action: 'edit_slide',
                description: `Regenerate slide ${index + 1} with less content`,
                params: {
                  slideIndex: index,
                  instruction: `${gptContext}\n\nRegenerate this slide with LESS content to fit properly. Keep the key message but use shorter text, fewer bullet points, or simpler layout.`,
                },
              })),
              estimatedSlides: slidesNeedingGPT.length,
              requiresApproval: true,
            };

            setPendingAgentExecution({
              plan: fixPlan,
              userPrompt: 'Fix remaining layout issues with AI',
              context: { slides: currentState.slides },
              getFreshState: () => stateRef.current,
              showSteps,
              batchSize,
            });
            setShowApprovalDialog(true);
          }

          setIsLoading(false);
          setProgress(null);
          return;
        }

        // Build context for router BEFORE making API call
        // IMPORTANT: Always read fresh state from stateRef to avoid stale data after edits
        const getFreshState = () => stateRef.current;

        // Find current slide info - use fresh state
        const freshState = getFreshState();
        const _rawIdx = freshState.activeSlideId
          ? freshState.slides.findIndex(s => s.id === freshState.activeSlideId)
          : -1;
        // Default to first slide when none explicitly selected — never pass -1
        const currentSlideIdx = _rawIdx >= 0 ? _rawIdx : (freshState.slides.length > 0 ? 0 : -1);
        const currentSlide = currentSlideIdx >= 0 ? freshState.slides[currentSlideIdx] : null;

        // Build storyline summary (titles only, for context)
        const storylineSummary = (freshState.storyline || [])
          .map(s => s.title)
          .join(' → ');

        // Build slide summaries for AI router — lightweight: index, title, template, pending comments
        const slideSummaries = freshState.slides.map((s, idx) => {
          const pendingComments = (s.comments || []).filter(c => !c.addressed);
          return {
            index: idx,
            title: s.title || 'Untitled',
            template: s.templateId || s.layoutType || s.type || 'custom',
            pendingComments: pendingComments.length > 0 ? pendingComments.map(c => c.text) : undefined,
          };
        });

        // Build FULL document content for router (router makes all decisions now)
        const fullKnowledgeContext = buildKnowledgeContextForPrompt(userPrompt, { fullContent: true });
        let documentContent = null;
        let hasDocumentsAttached = false;

        if (fullKnowledgeContext) {
          hasDocumentsAttached = true;
          documentContent = fullKnowledgeContext.combined || '';
          console.log('[AIChatbot] Full document content for router:', {
            contentLength: documentContent.length,
            filesCount: uploadedFiles.length,
          });
        } else if (uploadedFiles.length > 0) {
          // Fallback: buildKnowledgeContextForPrompt returned null but files exist
          // This can happen when RAG scoring filters out all entries
          const filesWithContent = uploadedFiles.filter(f => f.content);
          if (filesWithContent.length > 0) {
            hasDocumentsAttached = true;
            documentContent = filesWithContent
              .map(f => `=== FILE: ${f.fileName} ===\n${f.content}\n=== END FILE ===`)
              .join('\n\n');
            console.warn('[AIChatbot] buildKnowledgeContextForPrompt returned null but uploadedFiles has content — using fallback.', {
              contentLength: documentContent.length,
              filesCount: filesWithContent.length,
            });
          }
        }

        // Get pending images that need analysis (pasted but not yet analyzed)
        const pendingImages = uploadedFiles.filter(f => f.needsAnalysis && f.imageData);

        // Context for router — includes FULL document content and pending images
        const context = {
          slideCount: freshState.slides.length,
          currentSlideIndex: currentSlideIdx,
          storylineSummary, // e.g., "Intro → Problem → Solution → Results"
          slideSummaries, // Array of {index, title, pendingComments}
          activeFlow: activeFlow || undefined,
          parallelBatchSize: freshState.settings?.parallelSlideGeneration || 3,
          // FULL document content for router to analyze and plan
          hasDocumentsAttached,
          documentContent, // Full content, not summary
          // Pending images to analyze with this query
          pendingImages: pendingImages.length > 0 ? pendingImages : null,
          // Use big model for more thorough planning
          useBigModel: useDeepThink,
          // Slides explicitly referenced in the prompt (e.g., "slide 3", "page 5")
          // Only pass index and title - router tells execution which slides to read
          referencedSlides: referencedSlides.length > 0 ? referencedSlides.map(r => ({
            index: r.index,
            type: r.type,
            title: r.slide?.title,
          })) : null,
          // Agent mode flag — affects router settings and audit log
          agentMode: shouldRunAgent,
          // Image-based mode — tell router to prefer image-content templates
          preferImageSlides: useImageMode && !!freshState.settings.imageModel,
        };

        // ROUTING: Use AI router if enabled, otherwise rule-based
        // Default to gemini-3-flash-preview if routerModel not set
        const routerModel = freshState.settings?.routerModel || 'gemini:gemini-3-flash-preview';
        // Check that the router model's provider has an API key (providers is an array)
        const routerParts = routerModel.includes(':') ? routerModel.split(':') : ['', routerModel];
        const routerProviderId = routerParts[0];
        const routerProviderArr = Array.isArray(freshState.settings?.providers) ? freshState.settings.providers : [];
        const routerProviderObj = routerProviderArr.find(p => p.id === routerProviderId);
        const routerProviderKey = routerProviderObj?.apiKey;
        const useAIRouter = routerModel !== 'rule-based' && !!routerProviderKey;

        console.log('[Router] Settings:', {
          routerModel,
          routerProviderId,
          hasRouterKey: !!routerProviderKey,
          useAIRouter,
        });

        let routeResult;
        // Reset AI I/O tracking for this request
        currentStepAiIO.current = [];

        if (useAIRouter) {
          // If coming from agent mode, say "Creating slides" not "Drafting a plan" (agent already planned)
          const routerPhaseMessage = shouldRunAgent ? 'Creating slides...' : 'Drafting a plan...';
          setProgress({ phase: routerPhaseMessage, current: 0, total: 1 });
          try {
            routeResult = await aiRouteRequest(effectivePrompt, context, freshState.settings);
          } catch (routerErr) {
            console.warn('[Router] AI router failed, falling back to rule-based:', routerErr.message);
            routeResult = routeRequest(effectivePrompt, context);
          }

          // Record router AI I/O
          recordAiIO('router',
            `Prompt: ${effectivePrompt}\n\nContext: ${JSON.stringify(context, null, 2)}`,
            JSON.stringify(routeResult, null, 2)
          );
        } else {
          console.log('[Router] Using rule-based (no Gemini key or disabled)');
          // INSTANT RULE-BASED ROUTING (use effectivePrompt without vibe instruction)
          routeResult = routeRequest(effectivePrompt, context);
        }

        // ─── Router clarification questions — show same UI as agent questions ───
        if (routeResult?.needsClarification && routeResult.questions?.length > 0) {
          const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          const questionBlocks = routeResult.questions;

          const questionBlocksHtml = questionBlocks.map((qb, qi) => {
            const optionCards = (qb.options || []).map(opt => {
              const escaped = escHtml(opt);
              return `<button class="clarification-option-card" data-qi="${qi}" onclick="window.__toggleClarificationChip && window.__toggleClarificationChip(this)">${escaped}</button>`;
            }).join('');

            return `<div class="clarification-question-block" data-qi="${qi}">
  <p class="clarification-question">${escHtml(qb.question)}</p>
  ${optionCards ? `<div class="clarification-options-grid">${optionCards}</div>` : ''}
  <textarea class="clarification-freetext" data-qi="${qi}" rows="1" placeholder="Or type your own answer..."></textarea>
</div>`;
          }).join('\n');

          const formattedQuestion = `
<div class="clarification-card">
  <div class="clarification-header">
    <span class="clarification-icon">&#x1f4ac;</span>
    <span class="clarification-title">${questionBlocks.length > 1 ? 'A few quick questions' : 'Quick Question'}</span>
  </div>
  <div class="clarification-body">
    ${questionBlocksHtml}
    <div class="clarification-submit-row">
      <button class="clarification-submit-btn" onclick="window.__submitClarificationAnswers && window.__submitClarificationAnswers()">Submit Answers</button>
    </div>
  </div>
</div>`;

          addMessage('assistant', formattedQuestion, { isHTML: true });
          // Store original prompt so we can re-submit with answers
          routerClarificationRef.current = { originalPrompt: effectivePrompt, context };
          setIsLoading(false);
          setProgress(null);
          return;
        }

        // IMPORTANT: Capture current slide ID at submission time (not execution time)
        const capturedSlideId = freshState.activeSlideId;
        const capturedSlideIdx = currentSlideIdx;
        const capturedSlide = currentSlide ? {
          id: currentSlide.id,
          title: currentSlide.title,
          type: currentSlide.type,
        } : null;

        // Detect context slides BEFORE setting pendingSmartAction
        let contextIndices = routeResult.contextNeeded?.slideIndices || [];
        const planContextIndices = routeResult.plan?.flatMap(step => step.contextSlides || []) || [];

        // Include explicitly referenced slides from the prompt (e.g., "slide 3", "page 5")
        const referencedSlideIndices = referencedSlides.map(r => r.index);

        // Combine all detected context indices
        let detectedContextIndices = [...new Set([...contextIndices, ...planContextIndices, ...referencedSlideIndices])];

        // Log when slides are detected from references
        if (referencedSlideIndices.length > 0) {
          console.log('[SmartAction] Slides referenced in prompt:', referencedSlides.map(r => `Page ${r.index + 1} (${r.type})`).join(', '));
        }

        // Fallback: if no context specified but prompt references current slide patterns, include current
        if (detectedContextIndices.length === 0 && currentSlideIdx >= 0) {
          const promptLower = effectivePrompt.toLowerCase();
          const referencesCurrent =
            promptLower.includes('this slide') || promptLower.includes('current slide') ||
            promptLower.includes('this page') || promptLower.includes('current page') ||
            promptLower.match(/first\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/second\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/third\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/point\s*[1-9]/i) ||
            promptLower.match(/pillar\s*[1-9]/i);

          if (referencesCurrent) {
            detectedContextIndices = [currentSlideIdx];
            console.log('[SmartAction] Auto-detected current slide as context: Page', currentSlideIdx + 1);
          }
        }

        // Enhance routeResult with detected context (for execution)
        const enhancedRouteResult = {
          ...routeResult,
          detectedContextIndices,
          contextNeeded: {
            ...routeResult.contextNeeded,
            slideIndices: detectedContextIndices.length > 0 ? detectedContextIndices : (routeResult.contextNeeded?.slideIndices || []),
          },
        };

        // Build the SmartAction payload (shared for manual and auto-execute)
        const smartActionPayload = {
          routeResult: enhancedRouteResult,
          userPrompt: effectivePrompt,
          context,
          getFreshState,
          showSteps,
          batchSize,
          settings: freshState.settings,
          capturedSlideId,
          capturedSlideIdx,
          capturedSlide,
          vibeHint: getVibePromptContext(selectedVibe || freshState.vibe),
          // Full knowledge context for analyze_content step (only passed to that step)
          fullKnowledgeContext,
          fromAgent: shouldRunAgent, // Agent mode — content is fully baked, safe to parallelize
        };

        // When agent mode ran, auto-execute — the agent already planned, no need for user review
        if (shouldRunAgent) {
          // Update agent widget: carry forward ALL prior steps, add slide execution steps
          // IMPORTANT: include ALL steps (including analyze_content) so indices match execution loop
          const routerPlan = enhancedRouteResult.plan || [];
          setAgentModeProgress(prev => {
            const execSteps = routerPlan.map((s, idx) => ({
              name: s.action === 'analyze_content'
                ? 'Analyzing content'
                : `Slide ${idx + 1}: ${s.templateId || (s.instruction || 'Slide').slice(0, 30)}`,
              status: 'pending',
              role: 'associate',
            }));
            // Carry forward ALL completed agent steps from previous phase
            const priorSteps = (prev?.steps || [])
              .filter(s => s.status === 'complete')
              .map(s => ({ ...s }));
            return {
              phase: `Creating ${execSteps.length} slides...`,
              steps: [
                ...priorSteps,
                { name: 'Routing slides', status: 'complete', role: 'associate', summary: `Routed ${execSteps.length} slides to templates` },
                ...execSteps,
              ],
            };
          });

          // Set pendingSmartAction with autoExecute flag — effect will trigger execution
          setPendingSmartAction({ ...smartActionPayload, autoExecute: true });

          if (detectedContextIndices.length > 0) {
            actions.setHighlightedSlides(detectedContextIndices);
          }
          // Don't setIsLoading(false) — execution will handle that
          return;
        }

        // Normal flow (no agent): show plan for user review
        const planSteps = enhancedRouteResult.plan || [];

        // If the plan only has answer_question steps, auto-execute without approval
        const isAnswerOnly = planSteps.length > 0 && planSteps.every(s => s.action === 'answer_question');
        if (isAnswerOnly) {
          for (const step of planSteps) {
            addMessage('assistant', step.instruction || 'How can I help with your presentation?');
          }
          setIsLoading(false);
          return;
        }

        // Text-based plan message (disabled -- SmartActionCard shows the plan visually)
        // if (planSteps.length > 0) {
        //   let planMessage = `**📋 Execution Plan** (${planSteps.length} step${planSteps.length > 1 ? 's' : ''}):\n\n`;
        //   planSteps.forEach((step, i) => {
        //     const actionLabel = {
        //       'analyze_content': '🧠 Analyze content',
        //       'create_slide': '✨ Create slide',
        //       'create_from_template': '✨ Create slide',
        //       'edit_slide': '✏️ Edit slide',
        //       'delete_slide': '🗑️ Delete slide',
        //       'switch_template': '🔄 Switch template',
        //     }[step.action] || step.action;
        //     let stepDesc = `${i + 1}. ${actionLabel}`;
        //     if (step.templateId) stepDesc += ` — ${step.templateId}`;
        //     if (step.slideIndex !== null && step.slideIndex !== undefined) stepDesc += ` (Page ${step.slideIndex + 1})`;
        //     if (step.instruction) {
        //       const shortInstr = step.instruction.length > 60 ? step.instruction.slice(0, 60) + '...' : step.instruction;
        //       stepDesc += `\n   _"${shortInstr}"_`;
        //     }
        //     planMessage += stepDesc + '\n';
        //   });
        //   planMessage += '\n_Review the plan below and click **Execute** to proceed, or **Cancel** to abort._';
        //   addMessage('assistant', planMessage);
        // }

        // Show SmartActionCard in chat for user review/modification
        setPendingSmartAction(smartActionPayload);

        // Highlight context slides in the slide panel
        if (detectedContextIndices.length > 0) {
          actions.setHighlightedSlides(detectedContextIndices);
          console.log('[SmartAction] Highlighted context slides:', detectedContextIndices.map(i => `Page ${i + 1}`).join(', '));
        }

        setExecutionStatus(null);
        setIsLoading(false);
        setProgress(null);
        return; // Wait for user to execute from SmartActionCard
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        addMessage('assistant', `❌ Error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Execute action from SmartActionCard with real-time status updates
  // Now supports multi-step plans (up to 5 slides per call)
  const executeFromSmartAction = async (modifiedRouteResult) => {
    if (!pendingSmartAction) return;

    const { userPrompt, getFreshState, settings, capturedSlideId, capturedSlideIdx, vibeHint, fullKnowledgeContext, fromAgent } = pendingSmartAction;

    const routeResult = modifiedRouteResult;

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      // Get plan steps (multi-step) or create single-step array from legacy format
      // IMPORTANT: Merge detected context indices into each step's contextSlides
      const detectedContext = routeResult.detectedContextIndices || routeResult.contextNeeded?.slideIndices || [];

      const planSteps = routeResult.plan && routeResult.plan.length > 0
        ? routeResult.plan.map(step => ({
            ...step,
            // Merge step's own contextSlides with detected indices (deduplicated)
            contextSlides: [...new Set([...(step.contextSlides || []), ...detectedContext])],
          }))
        : [{
            action: routeResult.action || 'create_slide',
            templateId: routeResult.templateMatch?.templateId || null,
            slideIndex: routeResult.params?.slideIndex ?? null,
            contextSlides: detectedContext,
            instruction: userPrompt,
          }];

      console.log('[SmartAction] Context indices for execution:', detectedContext);

      const totalSteps = planSteps.length;
      const createdSlides = [];
      const editedSlides = [];
      const deletedSlides = [];
      const parallelBatchSize = settings.parallelSlideGeneration || 3;

      // Track outputs per step index: stepOutputs[stepIndex] = { html, slideIndex, title }
      const stepOutputs = {};
      // Track last inserted slide index for "after_previous" positioning
      let lastInsertedIndex = -1;
      // Track total slide count manually (React state updates are async, so getFreshState may be stale)
      let currentSlideCount = getFreshState().slides.length;
      // Capture deck identity at submission time — agent only modifies THIS deck
      // IMPORTANT: Get fresh state before using it
      const freshState = getFreshState();
      const capturedDeckName = freshState.deckName;

      console.log('[SmartAction] Executing plan with', totalSteps, 'steps, parallel batch size:', parallelBatchSize, planSteps);
      console.log('[SmartAction] Captured deck:', capturedDeckName);

      // Build groups: use router-provided groups or default to all steps in one group
      // In agent mode, flatten ALL groups into ONE — content is fully baked by the agent,
      // no cross-group dependencies. Steps still insert in order via flushInsertsInOrder.
      const routerGroups = routeResult.groups && routeResult.groups.length > 0
        ? routeResult.groups
        : [planSteps.map((_, i) => i)];
      const groups = fromAgent && routerGroups.length > 1
        ? [routerGroups.flat()]
        : routerGroups;

      console.log(`[SmartAction] Execution groups (fromAgent=${!!fromAgent}):`, groups);

      // Helper: check if we're still on the same deck
      const isDeckStillActive = () => {
        const current = getFreshState();
        return current.deckName === capturedDeckName;
      };

      // Helper: resolve position to an insertion index, or null for append
      // Uses a snapshotted base index to avoid race conditions in parallel batches
      const resolvePosition = (step, baseInsertIndex) => {
        const pos = step.position;
        if (!pos || pos === 'end') return null; // null = append
        if (pos === 'start') return 0;
        if (pos === 'after_previous') return baseInsertIndex >= 0 ? baseInsertIndex + 1 : null;
        if (typeof pos === 'object' && pos.after_slide !== undefined) return pos.after_slide + 1;
        return null;
      };

      // Helper: insert slides in deterministic order after a parallel batch completes
      // pendingInserts is an array of { stepIndex, slideDataArray, step } sorted by stepIndex
      const flushInsertsInOrder = (pendingInserts) => {
        if (!isDeckStillActive()) {
          console.warn('[SmartAction] Deck changed, skipping inserts for original deck:', capturedDeckName);
          return;
        }
        // Sort by step index to guarantee router-decided order
        pendingInserts.sort((a, b) => a.stepIndex - b.stepIndex);

        for (const { stepIndex, slideDataArray, step } of pendingInserts) {
          for (const slideData of slideDataArray) {
            const insertAt = resolvePosition(step, lastInsertedIndex);
            // skipActiveChange: don't hijack the user's selected thumbnail during agent work
            const dataWithFlag = { ...slideData, skipActiveChange: true };
            if (insertAt !== null && insertAt !== undefined) {
              actions.insertSlideAt(insertAt, dataWithFlag);
              lastInsertedIndex = insertAt;
              currentSlideCount++; // Track manually since React state is async
            } else {
              // Append — use tracked count since getFreshState may be stale
              const appendIdx = currentSlideCount;
              actions.insertSlideAt(appendIdx, dataWithFlag);
              lastInsertedIndex = appendIdx;
              currentSlideCount++; // Track manually since React state is async
            }
            stepOutputs[stepIndex] = {
              html: slideData.html,
              slideIndex: lastInsertedIndex,
              title: slideData.title,
            };
            createdSlides.push(slideData.title);
          }
        }
      };

      // Helper: build context string for a step, including contextSlides, contextFromStep, and content
      const buildContextForStep = (step, stepPromptWithVibe, baseState) => {
        let contextIndices = step.contextSlides?.length > 0
          ? step.contextSlides
          : (routeResult.contextNeeded?.slideIndices?.length > 0
              ? routeResult.contextNeeded.slideIndices
              : []);

        // Cap contextSlides at 10
        if (contextIndices.length > 10) {
          contextIndices = contextIndices.slice(0, 10);
        }

        // If no context specified but user prompt references current slide, include it
        if (contextIndices.length === 0 && capturedSlideIdx >= 0) {
          const promptLower = userPrompt.toLowerCase();
          const referencesCurrent =
            promptLower.includes('this slide') || promptLower.includes('current slide') ||
            promptLower.includes('this page') || promptLower.includes('current page') ||
            promptLower.match(/first\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/second\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/third\s+(point|bullet|item|pillar)/i) ||
            promptLower.match(/point\s*[1-9]/i) || promptLower.match(/pillar\s*[1-9]/i) ||
            promptLower.match(/item\s*[1-9]/i) || promptLower.match(/bullet\s*[1-9]/i);

          if (referencesCurrent) {
            contextIndices = [capturedSlideIdx];
          }
        }

        let contextForAI = stepPromptWithVibe;

        // Add context from existing slides (for reference, not primary content)
        if (contextIndices.length > 0) {
          const contextSlides = contextIndices.map(idx => baseState.slides[idx]).filter(Boolean);
          if (contextSlides.length > 0) {
            const contextSlidesHtml = contextSlides
              .map((s, i) => `[Page ${contextIndices[i] + 1}] "${s.title}" (${s.type || 'custom'}):\n${s.html}`)
              .join('\n\n---\n\n');
            contextForAI = `${contextForAI}\n\n[CONTEXT FROM EXISTING SLIDES - use for style/reference:]\n${contextSlidesHtml}`;
          }
        }

        // Add context from a previous step's output
        if (step.contextFromStep !== null && step.contextFromStep !== undefined && stepOutputs[step.contextFromStep]) {
          const prevOutput = stepOutputs[step.contextFromStep];
          const prevStep = planSteps[step.contextFromStep];

          // Check if the previous step was an analyze_content step
          if (prevStep?.action === 'analyze_content') {
            // Use analysis as content guide (not slide HTML)
            contextForAI = `${contextForAI}\n\n=== CONTENT ANALYSIS (Use this to guide slide creation) ===\n${prevOutput.analysis || prevOutput.html}\n=== END ANALYSIS ===`;
          } else {
            // Regular slide context
            contextForAI = `${contextForAI}\n\n[CONTEXT FROM PREVIOUSLY CREATED SLIDE (Step ${step.contextFromStep}) - "${prevOutput.title}":\n${prevOutput.html}]`;
          }
        }

        // Log context stats for debugging
        const contextWords = contextForAI.split(/\s+/).length;
        const contextChars = contextForAI.length;
        const estimatedTokens = Math.ceil(contextChars / 4);
        console.log(`[Step Context] Step ${step.action}:`, {
          words: contextWords,
          chars: contextChars,
          estimatedTokens,
          hasContextSlides: contextIndices.length > 0,
          hasContextFromStep: step.contextFromStep !== null && step.contextFromStep !== undefined,
        });

        return contextForAI;
      };

      // Execute a single step (any action type)
      // For create_slide: returns { pendingSlides: [...slideData], step, stepIndex } for deferred insertion
      // For other actions: executes immediately and returns null
      const executeStep = async (step, stepIndex) => {
        if (abortControllerRef.current?.signal.aborted) return null;

        // Check deck is still the same before executing
        if (!isDeckStillActive()) {
          console.warn(`[SmartAction] Deck changed during execution, aborting step ${stepIndex}`);
          return null;
        }

        const freshState = getFreshState();
        const stepPrompt = step.instruction || userPrompt;
        const stepPromptWithVibe = vibeHint ? `${stepPrompt}\n\n[Design Style: ${vibeHint}]` : stepPrompt;

        // Map action names to user-friendly labels
        const actionLabels = {
          'analyze_content': 'Analyzing',
          'create_slide': 'Create',
          'edit_slide': 'Edit',
          'delete_slide': 'Delete',
          'switch_template': 'Switch',
        };
        setProgress({
          phase: `Step ${stepIndex + 1}/${totalSteps}`,
          current: stepIndex,
          total: totalSteps,
          plan: planSteps.map((s, idx) => ({
            text: `${actionLabels[s.action] || s.action}${s.templateId ? ` (${s.templateId})` : ''}${s.searchQuery ? ' 🔍' : ''}`,
            action: s.action,
            templateId: s.templateId || null,
            layoutGuidance: s.layoutGuidance || null,
            stepIndex: idx,
          })),
          planStepsRef: planSteps,
        });

        // Update agent-mode widget if active (pink/green step tracker)
        setAgentModeProgress(prev => {
          if (!prev) return null;
          // Find where execution steps start — skip prior agent steps AND the
          // "Routing slides" marker. We identify execution steps as consultant steps
          // whose name starts with "Slide" or "Analyzing".
          const firstExecIdx = prev.steps.findIndex(s =>
            (s.role === 'consultant' || s.role === 'associate' || s.role === 'designer') && (s.name?.startsWith('Slide ') || s.name?.startsWith('Analyzing'))
          );
          const offset = firstExecIdx >= 0 ? firstExecIdx : prev.steps.length;
          const steps = prev.steps.map((s, i) => {
            if (i < offset) return s; // keep prior steps (agent + routing complete) as-is
            const slideIdx = i - offset;
            if (slideIdx < stepIndex) return { ...s, status: 'complete' };
            if (slideIdx === stepIndex) return { ...s, status: 'active' };
            return { ...s, status: 'pending' };
          });
          return { phase: `Slide ${stepIndex + 1} of ${totalSteps}`, steps };
        });

        switch (step.action) {
          case 'analyze_content': {
            // Deep thinking step - analyze documents and create content plan
            setExecutionStatus({
              type: 'generating',
              message: `Step ${stepIndex + 1}/${totalSteps}: Deep Analysis - reading documents...`,
            });

            // Get full document content from knowledge context
            const documentContent = fullKnowledgeContext?.combined || '';

            if (!documentContent) {
              console.warn('[SmartAction] No document content available for analyze_content step');
              stepOutputs[stepIndex] = {
                analysis: 'No documents attached. Please upload documents to analyze.',
                title: 'Analysis',
              };
              return null;
            }

            // Call the deep analysis function with full document content
            const analysisInstruction = step.instruction || userPrompt;
            const analysisResult = await analyzeContentForSlides(
              analysisInstruction,
              documentContent,
              settings,
              {
                storyline: freshState.storyline?.summary || '',
                slideCount: planSteps.filter(s => s.action === 'create_slide').length,
              }
            );

            // Record AI I/O for debugging/viewing
            recordAiIO('analyze_content',
              `REQUEST: ${analysisInstruction}\n\nSOURCE MATERIAL:\n${documentContent.slice(0, 3000)}${documentContent.length > 3000 ? '...' : ''}`,
              analysisResult.analysis || JSON.stringify(analysisResult.slides || [], null, 2)
            );

            // Store the analysis output for replanning and contextFromStep
            stepOutputs[stepIndex] = {
              analysis: analysisResult.analysis,
              title: 'Content Analysis',
              html: analysisResult.analysis, // For contextFromStep compatibility
              // Structured output for Phase 2 replanning
              slides: analysisResult.slides || [],
              summary: analysisResult.summary || '',
              totalSlides: analysisResult.totalSlides || 0,
              parsed: analysisResult.parsed,
            };

            // Show full analysis plan output in chat
            const slidesPlanned = analysisResult.slides?.length || 0;
            let analysisMessage = `**Analysis Complete** — ${slidesPlanned} slides planned:\n\n`;

            if (slidesPlanned > 0) {
              analysisResult.slides.forEach((s, i) => {
                const content = s.content || {};
                analysisMessage += `---\n**Slide ${i + 1}: ${s.title}**\n`;
                if (content.headline) analysisMessage += `> ${content.headline}\n\n`;
                if (content.points?.length > 0) {
                  content.points.forEach(p => {
                    analysisMessage += `• ${p}\n`;
                  });
                }
                if (content.data?.length > 0) {
                  analysisMessage += `\n_Data: ${content.data.join(' | ')}_\n`;
                }
                analysisMessage += '\n';
              });
            } else if (analysisResult.analysis) {
              // Show raw analysis if no structured slides
              analysisMessage += '```\n' + analysisResult.analysis.slice(0, 2000) + '\n```';
            } else {
              analysisMessage += 'Analysis complete. Planning slides...';
            }
            addMessage('assistant', analysisMessage);

            // Clear uploaded files after analysis - they've been processed
            // This prevents them from being re-used in subsequent requests
            setUploadedFiles([]);
            console.log('[SmartAction] Cleared uploaded files after analysis');

            console.log('[SmartAction] Content analysis complete:', {
              analysisLength: analysisResult.analysis?.length || 0,
              slidesPlanned: analysisResult.slides?.length || 0,
            });
            return null;
          }

          case 'create_slide':
          case 'create_from_template': {
            const templateId = step.templateId;
            // "freestyle" is not a real template — treat it as null so we hit the freestyle path
            const isFreestyleStep = !templateId || templateId === 'freestyle';
            const template = isFreestyleStep ? null : SLIDE_TEMPLATES[templateId];

            setExecutionStatus({
              type: 'generating',
              message: `Step ${stepIndex + 1}/${totalSteps}: Creating slide${template ? ` (${templateId})` : ` (freestyle${step.layoutGuidance ? `: ${step.layoutGuidance}` : ''})`}${step.searchQuery && settings.searchEnabled ? ' + searching...' : '...'}`,
            });

            const pendingSlides = [];

            let stepSettings = settings;
            let enrichedStepPrompt = stepPromptWithVibe;
            if (step.searchQuery && settings.searchEnabled) {
              console.log(`[SmartAction] Step ${stepIndex}: pre-searching for "${step.searchQuery.substring(0, 80)}"`);
              try {
                const searchResult = await webSearch(step.searchQuery, settings);
                if (searchResult) {
                  enrichedStepPrompt = `${stepPromptWithVibe}\n\n=== WEB SEARCH RESULTS ===\nQuery: "${step.searchQuery}"\n${searchResult}\n=== END SEARCH RESULTS ===\n\nUse the search results above for real, current data and facts. Cite specific numbers and sources.`;
                  console.log(`[SmartAction] Step ${stepIndex}: search returned ${searchResult.length} chars`);
                } else {
                  enrichedStepPrompt = `${stepPromptWithVibe}\n\n[Note: web search was attempted for "${step.searchQuery}" but returned no results. Use your best knowledge.]`;
                  console.log(`[SmartAction] Step ${stepIndex}: search returned no results`);
                }
              } catch (searchErr) {
                console.warn(`[SmartAction] Step ${stepIndex}: search failed:`, searchErr.message);
                enrichedStepPrompt = `${stepPromptWithVibe}\n\n[Note: web search failed. Use your best knowledge.]`;
              }
            }

            // Image slide handling — check before template/freestyle branch
            const isImageSlide = templateId === 'image-full' || templateId === 'image-content';
            if (isImageSlide && settings.imageModel) {
              try {
                const imageMode = templateId === 'image-full' ? 'full' : 'content';
                const imageResult = await generateImageSlide(enrichedStepPrompt, stepSettings, imageMode, {
                  layoutGuidance: step.layoutGuidance,
                  vibe: useImageMode ? imageVibe : state.vibe,
                  footerBranding: settings.footerBranding || 'Strategy&',
                  slideNumber: freshState.slides.length + 1,
                  totalSlides: freshState.slides.length + totalSteps,
                });
                if (imageResult?.html) {
                  pendingSlides.push({
                    ...imageResult,
                    summary: generateSlideSummary(imageResult.html, imageResult.type, imageResult.title),
                    ...(step.sectionTracker ? { sectionLabel: step.sectionTracker } : {}),
                    ...(step.subSectionTracker ? { subSectionLabel: step.subSectionTracker } : {}),
                  });
                  recordAiIO(`create_slide (${templateId})`, enrichedStepPrompt, imageResult.html.slice(0, 500));
                }
              } catch (imgErr) {
                console.warn(`[SmartAction] Image generation failed, falling back to freestyle:`, imgErr.message);
                addMessage('assistant', `⚠️ Image generation failed: ${imgErr.message}. Using text layout instead.`);
              }
            }

            // Section divider shortcut: direct placeholder replacement, no AI call needed
            if (pendingSlides.length === 0 && templateId === 'sectionDivider') {
              const dividerTitle = step.instruction || step.title || step.sectionTracker || 'Section Break';
              const dividerSubtitle = step.subtitle || step.layoutGuidance || '';
              const dividerNum = step.sectionNumber || String(freshState.slides.length + 1).padStart(2, '0');
              const dividerHtml = SLIDE_TEMPLATES.sectionDivider.html
                .replace('[01]', dividerNum)
                .replace('[Section Title]', dividerTitle)
                .replace('[What this section covers]', dividerSubtitle)
                .replace('[Company]', settings.footerBranding || 'Strategy&')
                .replace('1 / 1', '');

              pendingSlides.push({
                title: dividerTitle,
                html: dividerHtml,
                type: 'divider',
                templateId: 'sectionDivider',
                summary: `Section: ${dividerTitle}`,
                ...(step.sectionTracker ? { sectionLabel: step.sectionTracker } : {}),
                ...(step.subSectionTracker ? { subSectionLabel: step.subSectionTracker } : {}),
              });
            }

            // Template-based or freestyle (also serves as fallback if image generation failed)
            if (pendingSlides.length === 0 && templateId && template) {
              const contextForAI = buildContextForStep(step, enrichedStepPrompt, freshState);
              const filledHtml = await fillTemplateWithAI(template, contextForAI, stepSettings, [], { agentMode: !!fromAgent });
              if (!filledHtml) {
                console.warn(`[SmartAction] Step ${stepIndex}: fillTemplateWithAI returned null`);
                return null;
              }

              // Record AI I/O
              recordAiIO(`create_slide (${templateId})`, contextForAI, filledHtml.slice(0, 2000));

              const extractedTitle = extractTitleFromHTML(filledHtml);
              const slideTitle = extractedTitle || template.title || 'Untitled Slide';
              const slideSummary = generateSlideSummary(filledHtml, templateId, slideTitle);

              pendingSlides.push({
                title: slideTitle,
                html: filledHtml,
                type: templateId,
                templateId,
                summary: slideSummary,
                ...(step.sectionTracker ? { sectionLabel: step.sectionTracker } : {}),
                ...(step.subSectionTracker ? { subSectionLabel: step.subSectionTracker } : {}),
              });
            } else if (pendingSlides.length === 0) {
              // Freestyle - build full context (contextFromStep, contextSlides) same as template path
              const freestyleContext = buildContextForStep(step, enrichedStepPrompt, freshState);
              const freestyleContextInfo = {
                ...(step.layoutGuidance ? { layoutGuidance: step.layoutGuidance } : {}),
              };
              const newSlides = await generateSlides(freestyleContext, stepSettings, 1, freshState.slides, null, null, freestyleContextInfo);
              for (const slide of newSlides) {
                const title = extractTitleFromHTML(slide.html) || slide.title || 'Untitled Slide';
                pendingSlides.push({
                  title,
                  html: slide.html,
                  type: slide.type,
                  summary: generateSlideSummary(slide.html, slide.type, title),
                  ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                  ...(step.sectionTracker ? { sectionLabel: step.sectionTracker } : {}),
                  ...(step.subSectionTracker ? { subSectionLabel: step.subSectionTracker } : {}),
                });
              }

              // Record AI I/O for freestyle
              if (newSlides.length > 0) {
                recordAiIO(`create_slide (freestyle${step.layoutGuidance ? `:${step.layoutGuidance}` : ''})`, stepPromptWithVibe, newSlides.map(s => s.html.slice(0, 500)).join('\n---\n'));
              }
            }

            // Return pending slides for deferred, ordered insertion
            return { pendingSlides, step, stepIndex };
          }

          case 'edit_slide': {
            // Prefer ID-based lookup to avoid stale index issues when slides are added/deleted
            // during multi-step execution. step.slideIndex comes from the router plan and may
            // be stale if slides were inserted before this step ran.
            let slideIdx = step.slideIndex ?? (capturedSlideId
              ? freshState.slides.findIndex(s => s.id === capturedSlideId)
              : capturedSlideIdx);
            let slideToEdit = freshState.slides[slideIdx];

            // Validate: if the router targeted the "current slide" (index matches captured),
            // but slides shifted, re-resolve by ID to find the actual slide.
            if (slideToEdit && capturedSlideId && step.slideIndex === capturedSlideIdx && slideToEdit.id !== capturedSlideId) {
              const correctedIdx = freshState.slides.findIndex(s => s.id === capturedSlideId);
              if (correctedIdx >= 0) {
                console.warn(`[SmartAction] edit_slide: index ${slideIdx} shifted (expected "${capturedSlideId}", got "${slideToEdit.id}"). Corrected to index ${correctedIdx}.`);
                slideIdx = correctedIdx;
                slideToEdit = freshState.slides[slideIdx];
              }
            }

            if (!slideToEdit) {
              console.warn(`[SmartAction] No slide found at index ${slideIdx}`);
              return null;
            }

            // Detect if this is an image slide — use image regeneration instead of text editing
            const isImageSlide = slideToEdit.templateId === 'image-full' || slideToEdit.templateId === 'image-content';

            setExecutionStatus({
              type: 'generating',
              message: `Step ${stepIndex + 1}/${totalSteps}: ${isImageSlide ? 'Regenerating image for' : 'Editing'} slide ${slideIdx + 1}: "${slideToEdit.title}"...`,
            });

            // Build context including contextFromStep if present
            let editContext = stepPromptWithVibe;
            if (step.contextFromStep !== null && step.contextFromStep !== undefined && stepOutputs[step.contextFromStep]) {
              const prevOutput = stepOutputs[step.contextFromStep];
              const prevStep = planSteps[step.contextFromStep];

              if (prevStep?.action === 'analyze_content') {
                editContext = `${stepPromptWithVibe}\n\n=== CONTENT ANALYSIS (Use this to guide the edit) ===\n${prevOutput.analysis || prevOutput.html}\n=== END ANALYSIS ===`;
              } else {
                editContext = `${stepPromptWithVibe}\n\n[CONTEXT FROM PREVIOUSLY CREATED SLIDE (Step ${step.contextFromStep}) - "${prevOutput.title}":\n${prevOutput.html}]`;
              }
            }

            let newHtml, newTitle, newCustomCSS;
            if (isImageSlide && settings.imageModel) {
              // Image slide: edit the image — pass existing image as reference
              const imageMode = slideToEdit.templateId === 'image-full' ? 'full' : 'content';
              const existingImage = extractImageDataUri(slideToEdit.html);
              try {
                const imageResult = await generateImageSlide(editContext, settings, imageMode, {
                  layoutGuidance: step.layoutGuidance || step.instruction,
                  vibe: useImageMode ? imageVibe : state.vibe,
                  footerBranding: settings.footerBranding || 'Strategy&',
                  slideNumber: slideIdx + 1,
                  totalSlides: freshState.slides.length,
                  existingImageDataUri: existingImage,
                });
                newHtml = imageResult.html;
                newTitle = imageResult.title || slideToEdit.title;
              } catch (imgErr) {
                console.warn('[edit_slide] Image regeneration failed, falling back to text edit:', imgErr.message);
                const result = await improveSlide(slideToEdit, editContext, settings, { slides: freshState.slides, storyline: freshState.storyline });
                newHtml = result.html || result;
                newCustomCSS = result?.customCSS;
                newTitle = extractTitleFromHTML(newHtml) || slideToEdit.title;
              }
            } else {
              // Regular slide: use text-based editing
              const result = await improveSlide(
                slideToEdit,
                editContext,
                settings,
                { slides: freshState.slides, storyline: freshState.storyline }
              );
              newHtml = result.html || result;
              newCustomCSS = result?.customCSS;
              newTitle = extractTitleFromHTML(newHtml) || slideToEdit.title;
            }

            // Record AI I/O for edit
            recordAiIO(`edit_slide (${slideToEdit.title})`,
              `Original: ${slideToEdit.html.slice(0, 500)}...\n\nInstruction: ${editContext}`,
              (newHtml || '').slice(0, 2000)
            );

            actions.updateSlide(slideToEdit.id, {
              html: newHtml,
              customCSS: newCustomCSS,
              title: newTitle,
              ...(isImageSlide ? { templateId: slideToEdit.templateId, type: slideToEdit.type } : {}),
            });

            actions.syncStorylineFromSlides();
            stepOutputs[stepIndex] = { html: newHtml, slideIndex: slideIdx, title: newTitle };
            editedSlides.push(newTitle);
            return null;
          }

          case 'delete_slide': {
            let slideIdx = step.slideIndex ?? freshState.slides.findIndex(s => s.id === freshState.activeSlideId);
            let slideToDelete = freshState.slides[slideIdx];

            // Validate index hasn't shifted
            if (slideToDelete && capturedSlideId && step.slideIndex === capturedSlideIdx && slideToDelete.id !== capturedSlideId) {
              const correctedIdx = freshState.slides.findIndex(s => s.id === capturedSlideId);
              if (correctedIdx >= 0) {
                console.warn(`[SmartAction] delete_slide: index ${slideIdx} shifted. Corrected to index ${correctedIdx}.`);
                slideIdx = correctedIdx;
                slideToDelete = freshState.slides[slideIdx];
              }
            }

            if (slideToDelete) {
              setExecutionStatus({
                type: 'generating',
                message: `Step ${stepIndex + 1}/${totalSteps}: Deleting slide ${slideIdx + 1}: "${slideToDelete.title}"...`,
              });
              actions.deleteSlide(slideToDelete.id);
              deletedSlides.push(slideToDelete.title);
            }
            return null;
          }

          case 'switch_template': {
            let slideIdx = step.slideIndex ?? (capturedSlideId
              ? freshState.slides.findIndex(s => s.id === capturedSlideId)
              : capturedSlideIdx);
            let slideToSwitch = freshState.slides[slideIdx];
            const targetTemplateId = step.templateId;

            // Validate index hasn't shifted
            if (slideToSwitch && capturedSlideId && step.slideIndex === capturedSlideIdx && slideToSwitch.id !== capturedSlideId) {
              const correctedIdx = freshState.slides.findIndex(s => s.id === capturedSlideId);
              if (correctedIdx >= 0) {
                console.warn(`[SmartAction] switch_template: index ${slideIdx} shifted. Corrected to index ${correctedIdx}.`);
                slideIdx = correctedIdx;
                slideToSwitch = freshState.slides[slideIdx];
              }
            }

            if (!slideToSwitch) {
              console.warn(`[SmartAction] No slide found at index ${slideIdx} for switch_template`);
              return null;
            }

            const targetTemplate = allTemplates.find(t => t.id === targetTemplateId);
            if (!targetTemplate) {
              addMessage('assistant', `⚠️ Template "${targetTemplateId}" not found.`);
              return null;
            }

            setExecutionStatus({
              type: 'generating',
              message: `Step ${stepIndex + 1}/${totalSteps}: Switching slide ${slideIdx + 1} to "${targetTemplate.title}"...`,
            });

            const switchInstruction = step.instruction || 'Keep the same content but use the new template layout';
            const deckCtx = buildDeckContextForSwitch(freshState.slides, slideIdx);
            const transformedHtml = await improveSlideWithTemplate(
              slideToSwitch.html,
              switchInstruction,
              targetTemplate,
              settings,
              { slideNumber: slideIdx + 1, totalSlides: freshState.slides.length },
              deckCtx,
            );

            const isValid = transformedHtml &&
              transformedHtml.length > 100 &&
              transformedHtml.includes('<div') &&
              transformedHtml.includes('class=');

            if (isValid) {
              actions.updateSlide(slideToSwitch.id, {
                html: transformedHtml,
                type: targetTemplateId,
                templateId: targetTemplateId,
                pptxRendererCode: null, // Clear stale export code so next PPTX export regenerates from new HTML
              });
              const newTitle = extractTitleFromHTML(transformedHtml) || slideToSwitch.title;
              editedSlides.push(newTitle);
              stepOutputs[stepIndex] = { html: transformedHtml, slideIndex: slideIdx, title: newTitle };
            } else {
              addMessage('assistant', `⚠️ Template switch returned invalid result for slide ${slideIdx + 1} — keeping original.`);
            }
            return null;
          }

          case 'answer_question': {
            addMessage('assistant', `💬 ${step.instruction || 'Request processed'}`);
            return null;
          }

          default:
            console.warn(`[SmartAction] Unknown action: ${step.action}`);
            return null;
        }
      };

      // Execute groups sequentially, batching consecutive create_slide steps.
      // Batch size is from settings.slideCreationBatchSize (default 3).
      // Templated slides in a batch use fillTemplatesBulkWithAI (single API call).
      // Non-create steps and freestyle slides process individually.
      const creationBatchSize = settings.slideCreationBatchSize || 3;

      const executeGroupParallel = async (group, planStepsRef, stepIndexOffset = 0) => {
        // Helper: flush a batch of create_slide steps using bulk API
        const flushCreateBatch = async (batch) => {
          if (batch.length === 0) return;

          // Separate image vs fixed-layout (cover, divider) vs templated vs freestyle
          const imageSlides = batch.filter(b => (b.step.templateId === 'image-full' || b.step.templateId === 'image-content') && settings.imageModel);
          const fixedLayoutIds = new Set(['sectionDivider', 'cover']);
          const fixedSlides = batch.filter(b => fixedLayoutIds.has(b.step.templateId) && !imageSlides.includes(b));
          const templated = batch.filter(b => b.template && !imageSlides.includes(b) && !fixedSlides.includes(b));
          const freestyle = batch.filter(b => !b.template && !imageSlides.includes(b) && !fixedSlides.includes(b));

          // Bulk-generate templated slides (ONE API call for the whole batch)
          // Search results are already injected into each step's enrichedPrompt
          const bulkSettings = settings;
          let templatedResults = []; // Array of { b, html }
          if (templated.length > 0) {
            const bulkSpecs = templated.map(b => ({
              template: b.template,
              instruction: b.enrichedPrompt,
            }));
            console.log(`[SmartAction] Bulk generating ${templated.length} slides in one API call`);
            try {
              const bulkHtmls = await fillTemplatesBulkWithAI(bulkSpecs, bulkSettings, { agentMode: !!fromAgent });
              templatedResults = templated.map((b, i) => ({ b, html: bulkHtmls[i] || null }));
            } catch (bulkErr) {
              // Bulk failed (timeout, overload) — retry individually, sequentially to reduce load
              console.warn(`[SmartAction] Bulk generation failed, retrying individually (sequential):`, bulkErr.message);
              for (const b of templated) {
                try {
                  const html = await fillTemplateWithAI(b.template, b.enrichedPrompt, b.settings || settings, [], { agentMode: !!fromAgent });
                  templatedResults.push({ b, html });
                } catch (e) {
                  console.warn(`[SmartAction] Individual fill failed for step ${b.actualIndex}:`, e.message);
                  templatedResults.push({ b, html: null });
                }
              }
            }
          }

          // Generate freestyle slides in parallel, retry failures sequentially
          const freestyleResults = [];
          if (freestyle.length > 0) {
            const parallelResults = await Promise.all(freestyle.map(async (b) => {
              try {
                const freestyleBatchCtx = b.step.layoutGuidance
                  ? { layoutGuidance: b.step.layoutGuidance }
                  : null;
                const newSlides = await generateSlides(b.enrichedPrompt, b.settings || settings, 1, getFreshState().slides, null, null, freestyleBatchCtx);
                return { b, newSlides, ok: true };
              } catch (e) {
                console.warn(`[SmartAction] Freestyle gen failed for step ${b.actualIndex}:`, e.message);
                return { b, newSlides: [], ok: false };
              }
            }));
            // Collect successes, retry failures sequentially
            const failed = [];
            for (const r of parallelResults) {
              if (r.ok) {
                freestyleResults.push(r);
              } else {
                failed.push(r.b);
              }
            }
            if (failed.length > 0) {
              console.log(`[SmartAction] Retrying ${failed.length} failed freestyle slides sequentially...`);
              for (const b of failed) {
                try {
                  const freestyleBatchCtx = b.step.layoutGuidance
                    ? { layoutGuidance: b.step.layoutGuidance }
                    : null;
                  const newSlides = await generateSlides(b.enrichedPrompt, b.settings || settings, 1, getFreshState().slides, null, null, freestyleBatchCtx);
                  freestyleResults.push({ b, newSlides });
                } catch (e) {
                  console.warn(`[SmartAction] Freestyle retry also failed for step ${b.actualIndex}:`, e.message);
                  freestyleResults.push({ b, newSlides: [] });
                }
              }
            }
          }

          // Generate image slides sequentially (one at a time — image APIs are heavy)
          const imageResults = [];
          if (imageSlides.length > 0) {
            for (const b of imageSlides) {
              try {
                const imageMode = b.step.templateId === 'image-full' ? 'full' : 'content';
                const result = await generateImageSlide(b.enrichedPrompt, b.settings || settings, imageMode, {
                  layoutGuidance: b.step.layoutGuidance,
                  vibe: useImageMode ? imageVibe : state.vibe,
                  footerBranding: settings.footerBranding || 'Strategy&',
                  slideNumber: getFreshState().slides.length + 1,
                });
                if (result?.html) {
                  imageResults.push({ b, result });
                } else {
                  // Fall back: move to freestyle
                  freestyle.push(b);
                }
              } catch (e) {
                console.warn(`[SmartAction] Image gen failed for step ${b.actualIndex}, will fall back to freestyle:`, e.message);
                freestyle.push(b);
              }
            }
          }

          // Collect ALL results into a single array, then insert in plan-step order.
          // Previously, results were inserted by type (images → templates → freestyle),
          // which broke ordering when a batch mixed slide types.
          const allBatchInserts = [];

          for (const { b, result } of imageResults) {
            recordAiIO(`create_slide (${b.step.templateId})`, b.enrichedPrompt, result.html.slice(0, 500));
            allBatchInserts.push({
              stepIndex: b.actualIndex,
              slideDataArray: [{
                ...result,
                summary: generateSlideSummary(result.html, result.type, result.title),
                ...(b.step.sectionTracker ? { sectionLabel: b.step.sectionTracker } : {}),
                ...(b.step.subSectionTracker ? { subSectionLabel: b.step.subSectionTracker } : {}),
              }],
              step: b.step,
            });
          }

          // Fixed-layout slides (cover, section divider): direct placeholder fill, no AI call
          for (const b of fixedSlides) {
            const instr = b.step.instruction || '';
            const titleMatch = instr.match(/TITLE:\s*(.+)/i);
            const subMatch = instr.match(/SUBTITLE:\s*(.+)/i);
            let parsedTitle = titleMatch?.[1]?.split('\n')[0]?.trim() || '';
            let parsedSubtitle = subMatch?.[1]?.trim() || '';
            // Fallback: use the full instruction as title when no TITLE: marker
            if (!parsedTitle && instr) {
              const cleaned = instr.replace(/SUBTITLE:\s*.*/i, '').trim();
              parsedTitle = cleaned.split('\n')[0].trim().substring(0, 80);
            }

            let slideData;
            if (b.step.templateId === 'cover') {
              const coverTitle = parsedTitle || 'Untitled Presentation';
              const coverSubtitle = parsedSubtitle || '';
              const coverHtml = SLIDE_TEMPLATES.cover.html
                .replace('[CATEGORY]', coverSubtitle.toUpperCase() || 'STRATEGY')
                .replace('[Presentation Title]', coverTitle)
                .replace('[Company]', settings.footerBranding || 'Strategy&')
                .replace('[Date]', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }));
              slideData = {
                title: coverTitle,
                html: coverHtml,
                type: 'cover',
                templateId: 'cover',
                summary: coverTitle,
              };
            } else {
              const divTitle = parsedTitle || b.step.sectionTracker || 'Section Break';
              const divSubtitle = parsedSubtitle || '';
              const divNum = b.step.sectionNumber || String(getFreshState().slides.length + 1).padStart(2, '0');
              const divHtml = SLIDE_TEMPLATES.sectionDivider.html
                .replace('[01]', divNum)
                .replace('[Section Title]', divTitle)
                .replace('[What this section covers]', divSubtitle)
                .replace('[Company]', settings.footerBranding || 'Strategy&')
                .replace('1 / 1', '');
              slideData = {
                title: divTitle,
                html: divHtml,
                type: 'divider',
                templateId: 'sectionDivider',
                summary: `Section: ${divTitle}`,
              };
            }
            allBatchInserts.push({
              stepIndex: b.actualIndex,
              slideDataArray: [{
                ...slideData,
                ...(b.step.sectionTracker ? { sectionLabel: b.step.sectionTracker } : {}),
                ...(b.step.subSectionTracker ? { subSectionLabel: b.step.subSectionTracker } : {}),
              }],
              step: b.step,
            });
          }

          for (const { b, html } of templatedResults) {
            if (!html) continue;
            recordAiIO(`create_slide (${b.step.templateId})`, b.enrichedPrompt, html.slice(0, 2000));
            const extractedTitle = extractTitleFromHTML(html);
            const slideTitle = extractedTitle || b.template.title || 'Untitled Slide';
            allBatchInserts.push({
              stepIndex: b.actualIndex,
              slideDataArray: [{
                title: slideTitle,
                html,
                type: b.step.templateId,
                templateId: b.step.templateId,
                summary: generateSlideSummary(html, b.step.templateId, slideTitle),
                ...(b.step.sectionTracker ? { sectionLabel: b.step.sectionTracker } : {}),
                ...(b.step.subSectionTracker ? { subSectionLabel: b.step.subSectionTracker } : {}),
              }],
              step: b.step,
            });
          }

          for (const { b, newSlides } of freestyleResults) {
            if (newSlides.length === 0) continue;
            recordAiIO(`create_slide (freestyle${b.step.layoutGuidance ? `:${b.step.layoutGuidance}` : ''})`, b.enrichedPrompt, newSlides.map(s => s.html.slice(0, 500)).join('\n---\n'));
            const pendingSlides = newSlides.map(slide => {
              const title = extractTitleFromHTML(slide.html) || slide.title || 'Untitled Slide';
              return {
                title,
                html: slide.html,
                type: slide.type,
                summary: generateSlideSummary(slide.html, slide.type, title),
                ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                ...(b.step.sectionTracker ? { sectionLabel: b.step.sectionTracker } : {}),
                ...(b.step.subSectionTracker ? { subSectionLabel: b.step.subSectionTracker } : {}),
              };
            });
            allBatchInserts.push({ stepIndex: b.actualIndex, slideDataArray: pendingSlides, step: b.step });
          }

          // Single sorted insertion — guarantees plan-step order regardless of slide type
          if (allBatchInserts.length > 0) {
            flushInsertsInOrder(allBatchInserts);
          }

          if (batch.length > 0) actions.syncStorylineFromSlides();
        };

        let createBatch = []; // Accumulates create_slide steps

        for (let si = 0; si < group.length; si++) {
          if (abortControllerRef.current?.signal.aborted) break;

          const stepIndex = group[si];
          const actualIndex = stepIndex + stepIndexOffset;
          const step = planStepsRef[stepIndex];
          if (!step) {
            console.warn(`[SmartAction] No step found at index ${stepIndex}`);
            continue;
          }

          const isCreateStep = step.action === 'create_slide' || step.action === 'create_from_template';

          if (isCreateStep) {
            // Prepare this step for batching
            const freshState = getFreshState();
            const stepPromptLocal = step.instruction || userPrompt;
            const stepPromptWithVibeLocal = vibeHint ? `${stepPromptLocal}\n\n[Design Style: ${vibeHint}]` : stepPromptLocal;

            // Update UI progress
            setProgress({
              phase: `Step ${actualIndex + 1}/${totalSteps}`,
              current: actualIndex,
              total: totalSteps,
              plan: planSteps.map((s, idx) => ({
                text: `${s.action}${s.templateId ? ` (${s.templateId})` : ''}`,
                action: s.action,
                templateId: s.templateId || null,
                layoutGuidance: s.layoutGuidance || null,
                stepIndex: idx,
              })),
              planStepsRef: planSteps,
            });
            setExecutionStatus({
              type: 'generating',
              message: `Step ${actualIndex + 1}/${totalSteps}: Creating slide${step.templateId ? ` (${step.templateId})` : ' (freestyle)'}...`,
            });

            let batchStepSettings = settings;
            let enrichedPrompt = stepPromptWithVibeLocal;
            if (step.searchQuery && settings.searchEnabled) {
              console.log(`[SmartAction] Step ${actualIndex}: pre-searching for "${step.searchQuery.substring(0, 80)}"`);
              try {
                const searchResult = await webSearch(step.searchQuery, settings);
                if (searchResult) {
                  enrichedPrompt = `${stepPromptWithVibeLocal}\n\n=== WEB SEARCH RESULTS ===\nQuery: "${step.searchQuery}"\n${searchResult}\n=== END SEARCH RESULTS ===\n\nUse the search results above for real, current data and facts. Cite specific numbers and sources.`;
                  console.log(`[SmartAction] Step ${actualIndex}: search returned ${searchResult.length} chars`);
                } else {
                  enrichedPrompt = `${stepPromptWithVibeLocal}\n\n[Note: web search was attempted for "${step.searchQuery}" but returned no results. Use your best knowledge.]`;
                }
              } catch (searchErr) {
                console.warn(`[SmartAction] Step ${actualIndex}: search failed:`, searchErr.message);
                enrichedPrompt = `${stepPromptWithVibeLocal}\n\n[Note: web search failed. Use your best knowledge.]`;
              }
            }

            const templateId = step.templateId;
            // "freestyle" is not a real template — treat it as null
            const isFreestyleBatch = !templateId || templateId === 'freestyle';
            const template = isFreestyleBatch ? null : SLIDE_TEMPLATES[templateId];
            if (!isFreestyleBatch && !template) {
              console.warn(`[SmartAction] Router picked templateId "${templateId}" but it was not found in SLIDE_TEMPLATES — falling through to freestyle`);
            }
            // Always build full context (contextFromStep, contextSlides) for both template and freestyle
            const contextForAI = buildContextForStep(step, enrichedPrompt, freshState);

            createBatch.push({
              stepIndex, actualIndex, step, template,
              enrichedPrompt: contextForAI,
              settings: batchStepSettings,
            });

            // Flush batch when full
            if (createBatch.length >= creationBatchSize) {
              console.log(`[SmartAction] Flushing batch of ${createBatch.length} create steps`);
              await flushCreateBatch(createBatch);
              createBatch = [];
            }
          } else {
            // Non-create step — flush any pending create batch first
            if (createBatch.length > 0) {
              console.log(`[SmartAction] Flushing batch of ${createBatch.length} create steps before non-create step`);
              await flushCreateBatch(createBatch);
              createBatch = [];
            }

            // Execute non-create step individually
            console.log(`[SmartAction] Executing step ${si + 1}/${group.length} (index ${stepIndex})`);
            const result = await executeStep(step, actualIndex);
            if (result && result.pendingSlides) {
              flushInsertsInOrder([{
                stepIndex: result.stepIndex,
                slideDataArray: result.pendingSlides,
                step: result.step,
              }]);
              actions.syncStorylineFromSlides();
            }
          }
        }

        // Flush any remaining create batch
        if (createBatch.length > 0) {
          console.log(`[SmartAction] Flushing final batch of ${createBatch.length} create steps`);
          await flushCreateBatch(createBatch);
        }
      };

      for (let gi = 0; gi < groups.length; gi++) {
        if (abortControllerRef.current?.signal.aborted) break;

        const group = groups[gi];
        console.log(`[SmartAction] Executing group ${gi + 1}/${groups.length} (${group.length} steps, parallel batch: ${parallelBatchSize}):`, group);

        await executeGroupParallel(group, planSteps);

        // After first group completes, check if replanning is needed
        // This is critical for analyze_content flow: analysis done → now plan the actual slides
        if (gi === 0 && routeResult.needsReplanning) {
          console.log('[SmartAction] Replanning after first group (Phase 2)...');
          setExecutionStatus({ type: 'generating', message: 'Planning slides based on analysis...' });

          try {
            const freshState = getFreshState();
            const slideSummaries = freshState.slides.map((s, idx) => {
              const pendingComments = (s.comments || []).filter(c => !c.addressed);
              return {
                index: idx,
                title: s.title || 'Untitled',
                template: s.templateId || s.layoutType || s.type || 'custom',
                pendingComments: pendingComments.length > 0 ? pendingComments.map(c => c.text) : undefined,
              };
            });

            // Check if first step was analyze_content - if so, use its output
            const firstStep = planSteps[0];
            const wasAnalyzeStep = firstStep?.action === 'analyze_content';
            const analysisOutput = wasAnalyzeStep ? stepOutputs[0] : null;

            let replanPrompt;
            let replanContext;

            if (wasAnalyzeStep && analysisOutput?.slides?.length > 0) {
              // Phase 2: Create slides from analysis - pass SPECIFIC content for each slide
              console.log('[SmartAction] Phase 2: Creating slides from analysis output');
              console.log('[SmartAction] Analysis produced', analysisOutput.slides.length, 'slide specs');

              // Build a prompt with the analyzed slide specifications
              const slideSpecs = analysisOutput.slides.map((s, i) => {
                const content = s.content || {};
                return `SLIDE ${i + 1}: "${s.title}"
  Template: ${s.templateSuggestion || 'auto'}
  Headline: ${content.headline || s.purpose || ''}
  Points: ${(content.points || []).join(' | ')}
  Data: ${(content.supportingData || []).join(', ')}`;
              }).join('\n\n');

              replanPrompt = `Create the following slides based on document analysis. Each slide has SPECIFIC content - use it exactly:

${slideSpecs}

Original request: ${userPrompt}`;

              replanContext = {
                slideCount: freshState.slides.length,
                currentSlideIndex: freshState.slides.length - 1,
                slideSummaries,
                storylineSummary: freshState.storyline?.summary || '',
                // Pass analysis output for router to use
                analysisOutput: {
                  slides: analysisOutput.slides,
                  summary: analysisOutput.summary,
                },
                hasDocumentsAttached: false, // Don't trigger another analyze!
              };
            } else {
              // Regular replanning (not from analyze_content)
              const executedStepsSummary = group.map(si => {
                const out = stepOutputs[si];
                return out ? `Step ${si}: ${planSteps[si].action} → "${out.title}"` : `Step ${si}: ${planSteps[si].action}`;
              }).join(', ');

              replanPrompt = `Continue plan. Already executed: [${executedStepsSummary}]. Original request: ${userPrompt}`;
              replanContext = {
                slideCount: freshState.slides.length,
                currentSlideIndex: freshState.slides.length - 1,
                slideSummaries,
                storylineSummary: freshState.storyline?.summary || '',
              };
            }

            let newRouteResult;
            try {
              newRouteResult = await aiRouteRequest(replanPrompt, replanContext, settings);
            } catch (replanErr) {
              console.warn('[SmartAction] Replan AI router failed, falling back to rule-based:', replanErr.message);
              newRouteResult = routeRequest(replanPrompt, replanContext);
            }

            // Execute the new plan recursively (it will have its own groups)
            console.log('[SmartAction] Executing replanned route:', newRouteResult);
            const newPlanSteps = newRouteResult.plan || [];
            const newGroups = newRouteResult.groups && newRouteResult.groups.length > 0
              ? newRouteResult.groups
              : [newPlanSteps.map((_, i) => i)];

            for (const newGroup of newGroups) {
              if (abortControllerRef.current?.signal.aborted) break;
              await executeGroupParallel(newGroup, newPlanSteps, totalSteps);
            }

            // Skip remaining original groups since we replanned
            break;
          } catch (replanErr) {
            console.error('[SmartAction] Replanning failed, continuing with original plan:', replanErr);
            // Fall through to continue executing original groups
          }
        }
      }

      // Build summary message
      const summaryParts = [];
      if (createdSlides.length > 0) {
        summaryParts.push(`Created ${createdSlides.length} slide${createdSlides.length > 1 ? 's' : ''}`);
      }
      if (editedSlides.length > 0) {
        summaryParts.push(`Edited ${editedSlides.length} slide${editedSlides.length > 1 ? 's' : ''}`);
      }
      if (deletedSlides.length > 0) {
        summaryParts.push(`Deleted ${deletedSlides.length} slide${deletedSlides.length > 1 ? 's' : ''}`);
      }

      const summaryMessage = summaryParts.length > 0
        ? summaryParts.join(', ')
        : 'Plan executed';

      // Check if there are remaining slides to create (batch mode)
      const remainingCount = routeResult.remainingCount || 0;

      if (remainingCount > 0) {
        // More slides need to be created - make another router call
        setExecutionStatus({ type: 'generating', message: `✅ ${summaryMessage}. Creating ${remainingCount} more...` });

        const freshState = getFreshState();
        const slideSummaries = freshState.slides.map((s, idx) => {
          const pendingComments = (s.comments || []).filter(c => !c.addressed);
          return {
            index: idx,
            title: s.title || 'Untitled',
            template: s.templateId || s.layoutType || s.type || 'custom',
            pendingComments: pendingComments.length > 0 ? pendingComments.map(c => c.text) : undefined,
          };
        });

        const layoutCounts = {};
        slideSummaries.forEach(s => {
          layoutCounts[s.template] = (layoutCounts[s.template] || 0) + 1;
        });
        const layoutSummary = Object.entries(layoutCounts).map(([t, c]) => `${t}:${c}`).join(', ');

        const context = {
          slideCount: freshState.slides.length,
          currentSlideIndex: freshState.slides.length - 1,
          layoutSummary,
          slideSummaries,
        };

        // Continuation prompt that references how many more are needed
        const continuationPrompt = `Continue: create ${remainingCount} more slides. Original request: ${userPrompt}`;

        try {
          let nextRouteResult;
          try {
            nextRouteResult = await aiRouteRequest(continuationPrompt, context, freshState.settings);
          } catch (contErr) {
            console.warn('[SmartAction] Continuation AI router failed, falling back to rule-based:', contErr.message);
            nextRouteResult = routeRequest(continuationPrompt, context);
          }

          // Recursively execute the next batch
          // Strip autoExecute to prevent the useEffect from double-firing
          setPendingSmartAction({
            ...pendingSmartAction,
            autoExecute: false,
            userPrompt: continuationPrompt,
          });

          // Execute the next batch (this will recurse if more are needed)
          await executeFromSmartAction(nextRouteResult);
          return; // Exit early, the recursive call handles cleanup

        } catch (contErr) {
          console.error('[SmartAction] Continuation batch failed:', contErr);
          setExecutionStatus({ type: 'error', message: `Batch continuation failed: ${contErr.message}` });
        }
      } else {
        setExecutionStatus({ type: 'success', message: `✅ ${summaryMessage}` });

        // Add a permanent message to chat showing what was done
        const resultDetails = [];
        if (createdSlides.length > 0) {
          resultDetails.push(`**Created ${createdSlides.length} slide${createdSlides.length > 1 ? 's' : ''}:**`);
          createdSlides.forEach((title, i) => {
            resultDetails.push(`  ${i + 1}. ${title}`);
          });
        }
        if (editedSlides.length > 0) {
          resultDetails.push(`**Edited:** ${editedSlides.join(', ')}`);
        }
        if (deletedSlides.length > 0) {
          resultDetails.push(`**Deleted:** ${deletedSlides.join(', ')}`);
        }
        const resultMessage = resultDetails.length > 0
          ? `✅ ${summaryMessage}\n\n${resultDetails.join('\n')}`
          : `✅ ${summaryMessage}`;

        // Include AI I/O data in the message for debugging
        const aiIOData = currentStepAiIO.current.length > 0 ? [...currentStepAiIO.current] : null;
        addMessage('assistant', resultMessage, { aiIO: aiIOData });
      }

      // Mark all agent steps complete — keep visible as execution history
      setAgentModeProgress(prev => {
        if (!prev) return null;
        const completedSteps = prev.steps.map(s => ({ ...s, status: 'complete' }));
        const slideCount = completedSteps.filter(s => s.role === 'consultant' || s.role === 'associate' || s.role === 'designer').length;
        return {
          phase: slideCount > 0 ? `Done — ${slideCount} slides created` : 'Done!',
          steps: completedSteps,
        };
      });

      // Clear pending action and highlighting
      setTimeout(() => {
        setPendingSmartAction(null);
        setExecutionStatus(null);
        // NOTE: agentModeProgress is NOT cleared — stays as execution history
        actions.setHighlightedSlides([]);
      }, 1500);

    } catch (err) {
      // Mark failed step in agent progress
      setAgentModeProgress(prev => {
        if (!prev) return null;
        return { ...prev, phase: `Error: ${err.message}`, error: true };
      });
      // Clear autoExecute so SmartActionCard becomes visible for retry
      setPendingSmartAction(prev => prev ? { ...prev, autoExecute: false } : null);
      setExecutionStatus({ type: 'error', message: err.message });
      setTimeout(() => { setExecutionStatus(null); }, 4000);
      actions.setHighlightedSlides([]);
    } finally {
      setIsLoading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Cancel/Stop SmartActionCard execution
  const cancelSmartAction = () => {
    // Abort any in-progress execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log('[SmartAction] Execution stopped by user');
    }
    setPendingSmartAction(null);
    setExecutionStatus(null);
    setIsLoading(false);
    setProgress(null);
    setAgentModeProgress(null); // Clear agent widget on cancel
    actions.setHighlightedSlides([]); // Clear context highlighting
  };

  // Auto-execute when agent mode sets autoExecute flag
  // Agent already planned — skip user review and go straight to execution
  useEffect(() => {
    if (pendingSmartAction?.autoExecute) {
      console.log('[SmartAction] Auto-executing from agent mode');
      executeFromSmartAction(pendingSmartAction.routeResult);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSmartAction]);

  // Handle router preview confirmation
  const confirmRouterCall = async () => {
    if (!pendingRouterCall) return;

    const { userPrompt, context, getFreshState, showSteps, batchSize } = pendingRouterCall;
    setShowRouterPreview(false);
    setPendingRouterCall(null);

    // Get fresh settings for router model
    const freshState = getFreshState();
    const routerModel = freshState.settings?.routerModel;
    const useAIRouter = routerModel && routerModel !== 'rule-based';

    // ROUTING: Use AI router if enabled, otherwise rule-based
    let routeResult;
    if (useAIRouter) {
      setProgress({ phase: 'Drafting a plan...', current: 0, total: 1 });
      try {
        routeResult = await aiRouteRequest(userPrompt, context, freshState.settings);
      } catch (routerErr) {
        console.warn('[Router] AI router failed, falling back to rule-based:', routerErr.message);
        routeResult = routeRequest(userPrompt, context);
      }
      setProgress(null);
    } else {
      routeResult = routeRequest(userPrompt, context);
    }

    // Convert route result to plan format for compatibility
    const plan = {
      understanding: routeResult.understanding,
      steps: [{
        action: routeResult.action,
        params: {
          ...routeResult.params,
          templateId: routeResult.templateMatch?.templateId || null,
        },
      }],
      contextStrategy: routeResult.contextNeeded,
      templateMatch: routeResult.templateMatch,
    };

    // Build template selection if matched
    const templateSelection = routeResult.templateMatch ? {
      template: SLIDE_TEMPLATES[routeResult.templateMatch.templateId],
      confidence: 100,
      reasoning: `Matched keyword: "${routeResult.templateMatch.keyword}"`,
      isFreestyle: false,
    } : {
      template: null,
      confidence: 0,
      reasoning: 'No template keyword matched - using freestyle layout',
      isFreestyle: true,
    };

    // Show approval dialog immediately (no loading needed)
    setPendingAgentExecution({
      plan,
      userPrompt,
      context,
      getFreshState,
      showSteps,
      batchSize,
      templateSelection,
    });
    setShowApprovalDialog(true);
  };

  // Cancel router preview
  const cancelRouterPreview = () => {
    setShowRouterPreview(false);
    setPendingRouterCall(null);
  };

  // Execute approved agent plan
  const executeApprovedAgentPlan = async (contextStrategy) => {
    if (!pendingAgentExecution) return;

    const { plan, userPrompt, getFreshState, showSteps, batchSize } = pendingAgentExecution;
    setShowApprovalDialog(false);
    setPendingAgentExecution(null);

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Show what context strategy is being used
    const strategyLabel = contextStrategy?.type || 'full';
    const strategyReason = contextStrategy?.reason || '';
    if (showSteps) {
      addMessage('assistant', `📋 **Plan:** ${plan.understanding}\n\n_Context: ${strategyLabel}${strategyReason ? ` - ${strategyReason}` : ''}_`);
    }

    setAgentPlan(plan);

    try {
      // Execute plan steps
      for (let stepIdx = 0; stepIdx < plan.steps.length; stepIdx++) {
          if (abortControllerRef.current?.signal.aborted) {
            addMessage('assistant', '⏹️ Agent stopped.');
            break;
          }

          const step = plan.steps[stepIdx];
          setAgentStep(stepIdx);

          if (showSteps) {
            addMessage('assistant', `▶️ Step ${stepIdx + 1}: ${step.description}`);
          }

          setProgress(prev => ({
            ...prev,
            phase: step.description,
            current: stepIdx,
            total: plan.steps.length
          }));

          try {
            // Always get fresh state at the start of each action
            const actionState = getFreshState();

            switch (step.action) {
              case 'generate_storyline': {
                const slideCount = step.params?.slideCount || 5;
                const storyline = await generateStoryline(userPrompt, actionState.settings, { slideCount });
                if (isAborted()) break; // Check after AI call
                actions.setStoryline(storyline);
                addMessage('assistant', `📖 Generated storyline with ${storyline.length} points:\n${storyline.map((p, i) => `${i + 1}. **${p.title}**`).join('\n')}`);
                break;
              }

              case 'refine_storyline': {
                const existingStoryline = getFreshState().storyline || [];
                const refined = await generateStoryline(userPrompt, actionState.settings, {
                  slideCount: existingStoryline.length,
                  existingStoryline
                });
                if (isAborted()) break;
                actions.setStoryline(refined);
                addMessage('assistant', `📖 Refined storyline:\n${refined.map((p, i) => `${i + 1}. **${p.title}**`).join('\n')}`);
                break;
              }

              case 'generate_skeletons': {
                const storyline = getFreshState().storyline || [];
                if (storyline.length === 0) {
                  addMessage('assistant', '⚠️ No storyline to generate skeletons from.');
                  break;
                }
                const skeletons = await generateSkeletonSlides(storyline, templatesForAI, actionState.settings);
                if (isAborted()) break;
                actions.setSkeletonMode(true);

                // Add skeleton slides
                for (const skeleton of skeletons) {
                  actions.addSlide({
                    title: skeleton.title,
                    html: skeleton.html,
                    type: skeleton.templateId || 'custom',
                    templateId: skeleton.templateId,
                    storyPointId: skeleton.storyPointId,
                    isSkeleton: true,
                    skeletonApproved: false,
                  });
                }

                addMessage('assistant', `🦴 Created ${skeletons.length} skeleton slides. Review and approve them before filling.`);
                break;
              }

              case 'populate_slides':
              case 'fill_skeletons': {
                // Get storyline and existing slides
                const popState = getFreshState();
                const storyline = popState.storyline || [];

                if (storyline.length === 0) {
                  addMessage('assistant', '⚠️ No storyline to populate from. Create a storyline first.');
                  break;
                }

                addMessage('assistant', `📝 Populating ${storyline.length} slides with content...`);

                let populated = 0;
                try {
                  const results = await populateSlides(
                    storyline,
                    popState.slides,
                    templatesForAI,
                    popState.settings,
                    {
                      batchSize,
                      onProgress: (progress) => {
                        setProgress(prev => ({
                          ...prev,
                          phase: progress.phase,
                        }));
                      }
                    }
                  );

                  if (isAborted()) break;

                  // Update existing slides or add new ones
                  for (const result of results) {
                    if (result.existingSlideId) {
                      // Update existing slide with filled content
                      actions.updateSlide(result.existingSlideId, {
                        html: result.html,
                        isSkeleton: false,
                        layoutType: result.layoutType,
                      });
                    } else {
                      // Add new slide
                      actions.addSlide({
                        title: result.title,
                        html: result.html,
                        type: result.templateId || 'custom',
                        templateId: result.templateId,
                        storyPointId: result.storyPointId,
                        isSkeleton: false,
                        layoutType: result.layoutType,
                      });
                    }
                    populated++;
                  }

                  actions.setSkeletonMode(false);
                  addMessage('assistant', `✅ Populated ${populated} slides with content.`);

                  // Validate layouts after population
                  const postPopState = getFreshState();
                  const layoutIssues = [];
                  for (const result of results) {
                    const slideIdx = postPopState.slides.findIndex(s =>
                      s.id === result.existingSlideId || s.title === result.title
                    );
                    if (slideIdx >= 0 && result.html) {
                      const issues = validateSlideAndGetIssues(result.html, slideIdx + 1);
                      if (issues) layoutIssues.push(issues);
                    }
                  }

                  if (layoutIssues.length > 0) {
                    const issueMsg = layoutIssues.length === 1
                      ? formatIssuesForUser(layoutIssues[0])
                      : `⚠️ **Layout issues detected on ${layoutIssues.length} slides.**\n\n_Reply "fix layout" to auto-fix these issues._`;
                    addMessage('assistant', issueMsg);
                  }
                } catch (err) {
                  addMessage('assistant', `❌ Error populating slides: ${err.message}`);
                }
                break;
              }

              case 'edit_slides': {
                let slideIndices = step.params?.slideIndices || [];
                const instruction = step.params?.instruction || userPrompt;

                // Get fresh state for this action
                const editState = getFreshState();

                // Fallback 1: parse slide numbers from description or user prompt if indices are empty
                if (slideIndices.length === 0) {
                  const textToParse = `${step.description || ''} ${userPrompt}`;
                  // Look for "slide N" patterns and convert to 0-based indices
                  const slideNumMatches = textToParse.match(/slide\s*#?\s*(\d+)/gi) || [];
                  const parsedIndices = slideNumMatches.map(m => {
                    const num = parseInt(m.match(/\d+/)?.[0] || '0', 10);
                    return num - 1; // Convert to 0-based
                  }).filter(idx => idx >= 0 && idx < editState.slides.length);

                  // Deduplicate
                  slideIndices = [...new Set(parsedIndices)];
                }

                // Fallback 2: if still no slides found, use current slide from FRESH state (not stale closure)
                if (slideIndices.length === 0) {
                  const freshCurrentIdx = editState.activeSlideId
                    ? editState.slides.findIndex(s => s.id === editState.activeSlideId)
                    : -1;
                  if (freshCurrentIdx >= 0) {
                    slideIndices = [freshCurrentIdx];
                  }
                }

                // Capture slide IDs upfront — indices can shift during sequential edits
                // (e.g., if a previous edit triggers state changes), but IDs are stable.
                const slideIdsToEdit = slideIndices
                  .filter(idx => idx >= 0 && idx < editState.slides.length)
                  .map(idx => editState.slides[idx].id);

                let editedCount = 0;
                for (const slideId of slideIdsToEdit) {
                  if (isAborted()) break;
                  // Get absolutely fresh state for each slide edit
                  const latestState = getFreshState();
                  // Re-resolve by ID — immune to index drift from previous edits
                  const idx = latestState.slides.findIndex(s => s.id === slideId);
                  if (idx >= 0 && idx < latestState.slides.length) {
                    const slide = latestState.slides[idx];
                    // Find matching template for structure reference
                    const matchingTemplate = slide.templateId
                      ? allTemplates.find(t => t.id === slide.templateId)
                      : allTemplates.find(t => t.id === slide.type);

                    // Build minimal context (position + lightweight neighbor info)
                    const minimalContext = buildMinimalEditContext(latestState.slides, idx, {
                      includeNeighbors: true,
                      includeStoryline: latestState.storyline?.length > 0,
                      storyline: latestState.storyline,
                      neighborRange: 2,
                    });

                    const result = await improveSlide(
                      {
                        html: slide.html,
                        title: slide.title,
                        type: slide.type,
                        templateId: slide.templateId,
                        slideNumber: idx + 1,
                        totalSlides: latestState.slides.length,
                        comments: slide.comments,
                        templateHtml: matchingTemplate?.html || null,
                        templateName: matchingTemplate?.title || null,
                        // Minimal context - no sharedCSS, just position + neighbors
                        minimalContext,
                      },
                      instruction,
                      latestState.settings
                    );
                    if (isAborted()) break;

                    // Handle new return type { html, customCSS }
                    const improved = result?.html || result;
                    const newCustomCSS = result?.customCSS;

                    // VALIDATION: Only update if we got valid HTML back
                    const isValidHtml = improved &&
                      improved.length > 100 &&
                      improved.includes('<div') &&
                      improved.includes('class=');

                    if (isValidHtml) {
                      debugLog(LogLevel.INFO, 'edit_slides', `Updating slide ${idx + 1}`, {
                        originalLength: slide.html.length,
                        newLength: improved.length,
                        hasCustomCSS: !!newCustomCSS,
                      });
                      // Regenerate summary after edit to maintain deck structure
                      const newSummary = generateSlideSummary(improved, slide.type, slide.title);
                      const updateData = { html: improved, summary: newSummary };
                      if (newCustomCSS) updateData.customCSS = newCustomCSS;
                      actions.updateSlide(slide.id, updateData);
                      editedCount++;
                    } else {
                      debugLog(LogLevel.ERROR, 'edit_slides', `Skipped update - invalid HTML for slide ${idx + 1}`, {
                        improvedLength: improved?.length || 0,
                        hasDiv: improved?.includes('<div'),
                        preview: improved?.substring(0, 200),
                      });
                      addMessage('assistant', `⚠️ Slide ${idx + 1} edit returned invalid result - keeping original.`);
                    }
                  }
                }

                addMessage('assistant', `🔧 Edited ${editedCount} slide${editedCount !== 1 ? 's' : ''}.`);

                // Validate edited slides for layout issues
                if (editedCount > 0) {
                  const postEditState = getFreshState();
                  const layoutIssues = [];
                  for (const idx of slideIndices) {
                    if (idx >= 0 && idx < postEditState.slides.length) {
                      const slide = postEditState.slides[idx];
                      const issues = validateSlideAndGetIssues(slide.html, idx + 1);
                      if (issues) layoutIssues.push(issues);
                    }
                  }

                  if (layoutIssues.length > 0) {
                    const issueMsg = layoutIssues.length === 1
                      ? formatIssuesForUser(layoutIssues[0])
                      : `⚠️ **Layout issues detected on ${layoutIssues.length} slides.**\n\n_Reply "fix layout" to auto-fix these issues._`;
                    addMessage('assistant', issueMsg);
                  }
                }
                break;
              }

              case 'edit_all': {
                const instruction = step.params?.instruction || userPrompt;
                const editAllState = getFreshState();
                const slides = editAllState.slides;

                for (let i = 0; i < slides.length; i += batchSize) {
                  if (abortControllerRef.current?.signal.aborted) break;
                  const batch = slides.slice(i, i + batchSize);

                  for (const slide of batch) {
                    if (isAborted()) break;
                    // Get fresh slide data before each edit
                    const latestState = getFreshState();
                    const latestSlide = latestState.slides.find(s => s.id === slide.id);
                    if (!latestSlide) continue;

                    // Get slide index for position context
                    const slideIdx = latestState.slides.findIndex(s => s.id === slide.id);

                    // Find matching template for structure reference
                    const matchingTemplate = latestSlide.templateId
                      ? allTemplates.find(t => t.id === latestSlide.templateId)
                      : allTemplates.find(t => t.id === latestSlide.type);

                    // Build minimal context (position + lightweight neighbor info)
                    const minimalContext = buildMinimalEditContext(latestState.slides, slideIdx, {
                      includeNeighbors: true,
                      includeStoryline: latestState.storyline?.length > 0,
                      storyline: latestState.storyline,
                      neighborRange: 2,
                    });

                    const result = await improveSlide(
                      {
                        html: latestSlide.html,
                        title: latestSlide.title,
                        type: latestSlide.type,
                        templateId: latestSlide.templateId,
                        slideNumber: slideIdx + 1,
                        totalSlides: latestState.slides.length,
                        templateHtml: matchingTemplate?.html || null,
                        templateName: matchingTemplate?.title || null,
                        minimalContext,
                      },
                      instruction,
                      latestState.settings
                    );
                    if (isAborted()) break;

                    // Handle new return type { html, customCSS }
                    const improved = result?.html || result;
                    const newCustomCSS = result?.customCSS;

                    // Validate before updating
                    const isValidHtml = improved &&
                      improved.length > 100 &&
                      improved.includes('<div') &&
                      improved.includes('class=');

                    if (isValidHtml) {
                      // Regenerate summary after edit to maintain deck structure
                      const newSummary = generateSlideSummary(improved, latestSlide.type, latestSlide.title);
                      const updateData = { html: improved, summary: newSummary };
                      if (newCustomCSS) updateData.customCSS = newCustomCSS;
                      actions.updateSlide(slide.id, updateData);
                    } else {
                      debugLog(LogLevel.WARN, 'edit_all', `Skipped slide ${latestSlide.title} - invalid AI response`);
                    }
                  }

                  setProgress(prev => ({
                    ...prev,
                    phase: `Editing ${Math.min(i + batchSize, slides.length)}/${slides.length} slides`,
                  }));
                }

                addMessage('assistant', `🔧 Applied changes to all ${slides.length} slides.`);

                // Validate all edited slides for layout issues
                const postEditAllState = getFreshState();
                const editAllLayoutIssues = [];
                for (let i = 0; i < postEditAllState.slides.length; i++) {
                  const slide = postEditAllState.slides[i];
                  const issues = validateSlideAndGetIssues(slide.html, i + 1);
                  if (issues) editAllLayoutIssues.push(issues);
                }

                if (editAllLayoutIssues.length > 0) {
                  addMessage('assistant', `⚠️ **Layout issues detected on ${editAllLayoutIssues.length} slide${editAllLayoutIssues.length > 1 ? 's' : ''}.**\n\n_Reply "fix layout" to auto-fix these issues._`);
                }
                break;
              }

              case 'create_slides': {
                const count = step.params?.count || 1;
                const topic = step.params?.topic || userPrompt;
                const createState = getFreshState();
                const slides = await generateSlides(topic, createState.settings, count, createState.slides);
                if (isAborted()) break;

                for (const slide of slides) {
                  actions.addSlide({
                    title: slide.title,
                    html: slide.html,
                    type: slide.type,
                    summary: slide.summary,
                    ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                  });
                }

                addMessage('assistant', `➕ Created ${slides.length} new slides.`);

                // Validate new slides for layout issues
                const createLayoutIssues = [];
                slides.forEach((slide, i) => {
                  const issues = validateSlideAndGetIssues(slide.html, createState.slides.length + i + 1);
                  if (issues) createLayoutIssues.push(issues);
                });

                if (createLayoutIssues.length > 0) {
                  const issueMsg = createLayoutIssues.length === 1
                    ? formatIssuesForUser(createLayoutIssues[0])
                    : `⚠️ **Layout issues detected on ${createLayoutIssues.length} new slides.**\n\n_Reply "fix layout" to auto-fix these issues._`;
                  addMessage('assistant', issueMsg);
                }
                break;
              }

              case 'create_slide': {
                // Create a single new slide (alias for create_slides with count=1)
                // Combine topic and instruction for full context - instruction has layout details
                const topic = step.params?.topic || '';
                const instruction = step.params?.instruction || '';
                // Build full prompt: if both exist, combine them; otherwise use whichever is available or fall back to userPrompt
                const fullPrompt = topic && instruction
                  ? `${topic}\n\nLayout/Design Instructions: ${instruction}`
                  : (instruction || topic || userPrompt);
                // Use user's template choice from approval dialog, or fall back to step params
                const templateId = contextStrategy?.templateChoice !== undefined
                  ? contextStrategy.templateChoice
                  : step.params?.templateId;
                const createSlideState = getFreshState();

                let newSlides;
                // Image slide handling
                const isImageTemplate = templateId === 'image-full' || templateId === 'image-content';
                if (isImageTemplate && createSlideState.settings.imageModel) {
                  const imageMode = templateId === 'image-full' ? 'full' : 'content';
                  addMessage('assistant', `🖼️ Generating ${imageMode === 'full' ? 'full image' : 'illustrated'} slide...`);
                  try {
                    const imageResult = await generateImageSlide(fullPrompt, createSlideState.settings, imageMode, {
                      layoutGuidance: step.params?.layoutGuidance,
                      vibe: useImageMode ? imageVibe : state.vibe,
                      footerBranding: createSlideState.settings.footerBranding || 'Strategy&',
                      slideNumber: createSlideState.slides.length + 1,
                    });
                    if (isAborted()) break;
                    newSlides = [imageResult];
                  } catch (imgErr) {
                    console.warn('[create_slide] Image generation failed, falling back to freestyle:', imgErr.message);
                    addMessage('assistant', `⚠️ Image generation failed, using freestyle layout instead.`);
                    const freestyleCtx = step.params?.layoutGuidance ? { layoutGuidance: step.params.layoutGuidance } : null;
                    newSlides = await generateSlides(fullPrompt, createSlideState.settings, 1, createSlideState.slides, null, null, freestyleCtx);
                    if (isAborted()) break;
                  }
                } else if (templateId === 'sectionDivider') {
                  // Section divider shortcut: direct placeholder fill, no AI call
                  const divTitle = topic || instruction || 'Section Break';
                  const divSubtitle = step.params?.subtitle || '';
                  const divNum = step.params?.sectionNumber || String(createSlideState.slides.length + 1).padStart(2, '0');
                  const divHtml = SLIDE_TEMPLATES.sectionDivider.html
                    .replace('[01]', divNum)
                    .replace('[Section Title]', divTitle)
                    .replace('[What this section covers]', divSubtitle)
                    .replace('[Company]', createSlideState.settings.footerBranding || 'Strategy&')
                    .replace('1 / 1', '');
                  newSlides = [{
                    title: divTitle,
                    html: divHtml,
                    type: 'divider',
                    templateId: 'sectionDivider',
                    summary: `Section: ${divTitle}`,
                  }];
                } else if (templateId && !isImageTemplate) {
                  // Use specific template
                  const template = allTemplates.find(t => t.id === templateId);
                  if (template) {
                    addMessage('assistant', `Using template: **${template.title}**`);
                    const filledHtml = await fillTemplateWithAI(template, fullPrompt, createSlideState.settings, [], { agentMode: false });
                    if (isAborted()) break;
                    newSlides = [{
                      title: template.title,
                      html: filledHtml,
                      type: templateId,
                      templateId: templateId,
                      summary: topic || fullPrompt,
                    }];
                  } else {
                    newSlides = await generateSlides(fullPrompt, createSlideState.settings, 1, createSlideState.slides);
                    if (isAborted()) break;
                  }
                } else {
                  // Freestyle mode - pass layoutGuidance from step params if available
                  const layoutGuidance = step.params?.layoutGuidance || null;
                  if (contextStrategy?.isFreestyleChoice || layoutGuidance) {
                    addMessage('assistant', `🎨 Using freestyle mode${layoutGuidance ? ` (${layoutGuidance} layout)` : ' (custom layout)'}`);
                  }
                  const freestyleCtx = layoutGuidance ? { layoutGuidance } : null;
                  newSlides = await generateSlides(fullPrompt, createSlideState.settings, 1, createSlideState.slides, null, null, freestyleCtx);
                  if (isAborted()) break;
                }

                for (const slide of newSlides) {
                  actions.addSlide({
                    title: slide.title,
                    html: slide.html,
                    type: slide.type,
                    templateId: slide.templateId,
                    summary: slide.summary,
                    ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                  });
                }

                addMessage('assistant', `➕ Created new slide: "${newSlides[0]?.title || 'Untitled'}"`);

                // Validate the new slide for layout issues
                if (newSlides[0]) {
                  const newSlideIssues = validateSlideAndGetIssues(newSlides[0].html, createSlideState.slides.length + 1);
                  if (newSlideIssues) {
                    addMessage('assistant', formatIssuesForUser(newSlideIssues));
                  }
                }
                break;
              }

              case 'create_from_template': {
                // Create slide using a specific template
                const templateId = step.params?.templateId;
                const content = step.params?.content || {};
                const instruction = step.params?.instruction || userPrompt;
                const templateState = getFreshState();

                const template = allTemplates.find(t => t.id === templateId);
                if (!template) {
                  // Template not found - fall back to freestyle mode with component guide
                  addMessage('assistant', `ℹ️ Template "${templateId}" not found. Creating slide using freestyle mode...`);
                  const freestyleSlides = await generateSlides(instruction, templateState.settings, 1, templateState.slides);
                  if (isAborted()) break;
                  for (const slide of freestyleSlides) {
                    actions.addSlide({
                      title: slide.title,
                      html: slide.html,
                      type: slide.type || 'freestyle',
                      templateId: 'freestyle',
                      summary: slide.summary || instruction,
                      ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                    });
                  }
                  addMessage('assistant', `➕ Created slide: "${freestyleSlides[0]?.title || 'Untitled'}"`);
                  break;
                }

                const filledHtml = await fillTemplateWithAI(template, instruction, templateState.settings, [], { agentMode: false });
                if (isAborted()) break;
                actions.addSlide({
                  title: content.title || template.title,
                  html: filledHtml,
                  type: templateId,
                  templateId: templateId,
                  summary: instruction,
                });

                addMessage('assistant', `➕ Created slide using "${template.title}" template.`);

                // Validate the new template slide for layout issues
                const templateSlideIssues = validateSlideAndGetIssues(filledHtml, templateState.slides.length + 1);
                if (templateSlideIssues) {
                  addMessage('assistant', formatIssuesForUser(templateSlideIssues));
                }
                break;
              }

              case 'switch_template': {
                // Switch existing slide to a different template
                const switchState = getFreshState();
                // Get fresh current slide index - not stale closure
                const freshSwitchIdx = switchState.activeSlideId
                  ? switchState.slides.findIndex(s => s.id === switchState.activeSlideId)
                  : -1;
                const slideIndex = step.params?.slideIndex ?? freshSwitchIdx;
                const templateId = step.params?.templateId;
                const instruction = step.params?.instruction || 'Keep the same content but use the new template layout';

                const slide = switchState.slides[slideIndex];

                if (!slide) {
                  addMessage('assistant', `⚠️ Slide ${slideIndex + 1} not found.`);
                  break;
                }

                const template = allTemplates.find(t => t.id === templateId);
                if (!template) {
                  addMessage('assistant', `⚠️ Template "${templateId}" not found.`);
                  break;
                }

                const legacyDeckCtx = buildDeckContextForSwitch(switchState.slides, slideIndex);
                const transformedHtml = await improveSlideWithTemplate(
                  slide.html,
                  instruction,
                  template,
                  switchState.settings,
                  { slideNumber: slideIndex + 1, totalSlides: switchState.slides.length },
                  legacyDeckCtx,
                );
                if (isAborted()) break;

                // Validate before updating
                const isValid = transformedHtml &&
                  transformedHtml.length > 100 &&
                  transformedHtml.includes('<div') &&
                  transformedHtml.includes('class=');

                if (isValid) {
                  actions.updateSlide(slide.id, {
                    html: transformedHtml,
                    type: templateId,
                    templateId: templateId,
                    pptxRendererCode: null, // Clear stale export code so next PPTX export regenerates from new HTML
                  });
                  addMessage('assistant', `🔄 Switched slide ${slideIndex + 1} to "${template.title}" template.`);
                } else {
                  debugLog(LogLevel.ERROR, 'switch_template', `Invalid template conversion for slide ${slideIndex + 1}`);
                  addMessage('assistant', `⚠️ Template switch returned invalid result - keeping original slide.`);
                }
                break;
              }

              case 'find_template': {
                // Search for best matching template
                const query = step.params?.query || userPrompt;
                const findTemplateState = getFreshState();

                const bestTemplate = await selectTemplateWithAI(query, templatesForAI, findTemplateState.settings);
                if (isAborted()) break;
                if (bestTemplate) {
                  addMessage('assistant', `🔍 Best matching template: **${bestTemplate.title}** (${bestTemplate.id})\n${bestTemplate.description || 'No description'}`);
                } else {
                  addMessage('assistant', '🔍 No matching template found. Consider using freestyle or creating a new slide.');
                }
                break;
              }

              case 'list_templates': {
                // Show available templates to user
                const templatesByCategory = {};
                for (const t of allTemplates) {
                  const cat = t.category || 'General';
                  if (!templatesByCategory[cat]) templatesByCategory[cat] = [];
                  templatesByCategory[cat].push(t);
                }

                let templateList = '📋 **Available Templates:**\n';
                for (const [category, templates] of Object.entries(templatesByCategory)) {
                  templateList += `\n**${category}:**\n`;
                  for (const t of templates) {
                    templateList += `- ${t.title} (\`${t.id}\`)\n`;
                  }
                }

                addMessage('assistant', templateList);
                break;
              }

              case 'answer_question': {
                // Just use chat mode to answer
                const answerState = getFreshState();
                const response = await chatWithContext(userPrompt, {
                  allSlides: answerState.slides,
                  totalSlides: answerState.slides.length,
                }, answerState.settings);
                if (isAborted()) break;
                addMessage('assistant', response);
                break;
              }

              case 'insert_slide_at': {
                // Insert slide at specific position (0 = first, -1 = last)
                const position = step.params?.position ?? -1;
                // Combine topic and instruction for full context - instruction has layout details
                const topic = step.params?.topic || '';
                const instruction = step.params?.instruction || '';
                const fullPrompt = topic && instruction
                  ? `${topic}\n\nLayout/Design Instructions: ${instruction}`
                  : (instruction || topic || userPrompt);
                const templateId = step.params?.templateId;
                const insertState = getFreshState();

                let slideHtml;
                let slideTitle = topic || fullPrompt;
                let slideType = templateId || 'custom';
                let slideTemplateId = templateId || null;

                // Image slide handling for insert
                const isInsertImage = (templateId === 'image-full' || templateId === 'image-content') && insertState.settings.imageModel;
                if (isInsertImage) {
                  try {
                    const imageMode = templateId === 'image-full' ? 'full' : 'content';
                    const imageResult = await generateImageSlide(fullPrompt, insertState.settings, imageMode, {
                      layoutGuidance: step.params?.layoutGuidance,
                      vibe: useImageMode ? imageVibe : state.vibe,
                      footerBranding: insertState.settings.footerBranding || 'Strategy&',
                      slideNumber: (typeof position === 'number' && position >= 0) ? position + 1 : insertState.slides.length + 1,
                    });
                    if (isAborted()) break;
                    slideHtml = imageResult.html;
                    slideTitle = imageResult.title;
                    slideType = imageResult.type;
                    slideTemplateId = imageResult.templateId;
                  } catch (imgErr) {
                    console.warn('[insert_slide_at] Image generation failed, falling back:', imgErr.message);
                  }
                }

                if (!slideHtml && templateId && !isInsertImage) {
                  // Use specific template
                  const template = allTemplates.find(t => t.id === templateId);
                  if (template) {
                    slideHtml = await fillTemplateWithAI(template, fullPrompt, insertState.settings, [], { agentMode: false });
                    if (isAborted()) break;
                    slideTitle = template.title;
                  }
                }

                if (!slideHtml) {
                  // Generate freestyle slide - pass layoutGuidance if available
                  const insertLayoutGuidance = step.params?.layoutGuidance || null;
                  const insertCtx = insertLayoutGuidance ? { layoutGuidance: insertLayoutGuidance } : null;
                  const slides = await generateSlides(fullPrompt, insertState.settings, 1, insertState.slides, null, null, insertCtx);
                  if (isAborted()) break;
                  if (slides.length > 0) {
                    slideHtml = slides[0].html;
                    slideTitle = slides[0].title || topic || fullPrompt;
                  }
                }

                if (slideHtml) {
                  actions.insertSlideAt(position, {
                    title: slideTitle,
                    html: slideHtml,
                    type: templateId || 'custom',
                    templateId: templateId,
                    summary: topic,
                  });

                  const posLabel = position === 0 ? 'first' : position === -1 ? 'last' : `position ${position + 1}`;
                  addMessage('assistant', `📍 Inserted "${slideTitle}" as ${posLabel} slide.`);
                }
                break;
              }

              case 'add_separator': {
                // Add a section separator/divider slide using the proper sectionDivider template
                const position = step.params?.position ?? -1;
                const title = step.params?.title || 'Section Break';
                const subtitle = step.params?.subtitle || '';
                const sectionNum = step.params?.sectionNumber || '';

                const dividerTemplate = SLIDE_TEMPLATES.sectionDivider;
                const separatorHtml = dividerTemplate.html
                  .replace('[01]', sectionNum || '01')
                  .replace('[Section Title]', title)
                  .replace('[What this section covers]', subtitle || '')
                  .replace('[Company]', '')
                  .replace('1 / 1', '');

                actions.insertSlideAt(position, {
                  title: title,
                  html: separatorHtml,
                  type: 'divider',
                  templateId: 'sectionDivider',
                  summary: `Section: ${title}`,
                });

                const posLabel = position === 0 ? 'first' : position === -1 ? 'last' : `position ${position + 1}`;
                addMessage('assistant', `📌 Added separator "${title}" at ${posLabel} position.`);
                break;
              }

              case 'move_slide': {
                // Move a slide to a different position
                const fromIndex = step.params?.fromIndex;
                const toIndex = step.params?.toIndex;
                const moveState = getFreshState();

                if (fromIndex === undefined || toIndex === undefined) {
                  addMessage('assistant', '⚠️ Move requires fromIndex and toIndex.');
                  break;
                }

                if (fromIndex < 0 || fromIndex >= moveState.slides.length) {
                  addMessage('assistant', `⚠️ Invalid source position: ${fromIndex + 1}`);
                  break;
                }

                const slideToMove = moveState.slides[fromIndex];
                actions.reorderSlides(fromIndex, toIndex);

                addMessage('assistant', `🔄 Moved "${slideToMove.title}" from position ${fromIndex + 1} to ${toIndex + 1}.`);
                break;
              }

              case 'edit_slide': {
                // Edit a single slide (alias for edit_slides with single index)
                const editSingleState = getFreshState();
                // Get fresh current slide index - not stale closure
                const freshEditIdx = editSingleState.activeSlideId
                  ? editSingleState.slides.findIndex(s => s.id === editSingleState.activeSlideId)
                  : -1;
                let slideIndex = step.params?.slideIndex ?? freshEditIdx;
                const instruction = step.params?.instruction || userPrompt;

                if (slideIndex < 0 || slideIndex >= editSingleState.slides.length) {
                  addMessage('assistant', `⚠️ Invalid slide index: ${slideIndex + 1}`);
                  break;
                }

                const slide = editSingleState.slides[slideIndex];

                // Build minimal context (position + lightweight neighbor info)
                const minimalContext = buildMinimalEditContext(editSingleState.slides, slideIndex, {
                  includeNeighbors: true,
                  includeStoryline: editSingleState.storyline?.length > 0,
                  storyline: editSingleState.storyline,
                  neighborRange: 2,
                });

                const result = await improveSlide(
                  {
                    html: slide.html,
                    title: slide.title,
                    type: slide.type,
                    slideNumber: slideIndex + 1,
                    totalSlides: editSingleState.slides.length,
                    comments: slide.comments,
                    minimalContext,
                  },
                  instruction,
                  editSingleState.settings
                );
                if (isAborted()) break;

                // Handle new return type { html, customCSS }
                const improved = result?.html || result;
                const newCustomCSS = result?.customCSS;

                // Validate before updating
                const isValidEdit = improved &&
                  improved.length > 100 &&
                  improved.includes('<div') &&
                  improved.includes('class=');

                if (isValidEdit) {
                  // Regenerate summary after edit to maintain deck structure
                  const newSummary = generateSlideSummary(improved, slide.type, slide.title);
                  const updateData = { html: improved, summary: newSummary };
                  if (newCustomCSS) updateData.customCSS = newCustomCSS;
                  actions.updateSlide(slide.id, updateData);
                  addMessage('assistant', `🔧 Edited slide ${slideIndex + 1}: "${slide.title}"`);
                } else {
                  debugLog(LogLevel.ERROR, 'edit_slide', `Invalid AI response for slide ${slideIndex + 1}`);
                  addMessage('assistant', `⚠️ Edit returned invalid result - keeping original slide ${slideIndex + 1}.`);
                }
                break;
              }

              case 'create_slides_batch': {
                // Create multiple slides at once
                const count = step.params?.count || 3;
                const topic = step.params?.topic || userPrompt;
                const slideDescriptions = step.params?.slideDescriptions || [];
                const batchState = getFreshState();

                if (slideDescriptions.length > 0) {
                  // Create each slide with its specific description
                  for (let i = 0; i < slideDescriptions.length; i++) {
                    if (isAborted()) break;
                    const desc = slideDescriptions[i];
                    const slides = await generateSlides(`${topic}: ${desc}`, batchState.settings, 1, batchState.slides);
                    if (slides.length > 0) {
                      actions.addSlide({
                        title: slides[0].title,
                        html: slides[0].html,
                        type: slides[0].type,
                        summary: desc,
                        ...(slides[0].customCSS ? { customCSS: slides[0].customCSS } : {}),
                      });
                    }
                    setProgress(prev => ({
                      ...prev,
                      phase: `Creating slide ${i + 1}/${slideDescriptions.length}`,
                    }));
                  }
                  addMessage('assistant', `➕ Created ${slideDescriptions.length} slides about "${topic}".`);
                } else {
                  // Create slides without specific descriptions
                  const slides = await generateSlides(topic, batchState.settings, count, batchState.slides);
                  if (isAborted()) break;
                  for (const slide of slides) {
                    actions.addSlide({
                      title: slide.title,
                      html: slide.html,
                      type: slide.type,
                      summary: slide.summary,
                      ...(slide.customCSS ? { customCSS: slide.customCSS } : {}),
                    });
                  }
                  addMessage('assistant', `➕ Created ${slides.length} new slides about "${topic}".`);
                }
                break;
              }

              default:
                addMessage('assistant', `⚠️ Unknown action: ${step.action}`);
            }
          } catch (stepError) {
            addMessage('assistant', `❌ Error in step ${stepIdx + 1}: ${stepError.message}`);
            console.error('Agent step error:', stepError);
          }
        }

        setAgentStep(-1);
        setAgentPlan(null);
        addMessage('assistant', '✅ Agent workflow complete.');
    } catch (err) {
      if (err.name !== 'AbortError') {
        addMessage('assistant', `❌ Error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      setAgentPlan(null);
      setAgentStep(-1);
      abortControllerRef.current = null;
    }
  };

  // Cancel pending approval
  const cancelApproval = () => {
    setShowApprovalDialog(false);
    setPendingAgentExecution(null);
    addMessage('assistant', '❌ Agent execution cancelled.');
  };

  // Remaining of handleSubmit continues here (called after agent mode check returns)
  // This handles edit-all, edit, chat, and create modes
  // eslint-disable-next-line no-unused-vars
  const continueHandleSubmit = async (userPrompt, currentState, _settings) => {
    try {
      if (mode === 'edit-all') {
        // Edit all slides in the deck (or specific slides if specified in prompt)
        if (currentState.slides.length === 0) {
          addMessage('assistant', '⚠️ No slides in the deck to edit.');
          setIsLoading(false);
          return;
        }

        // Parse slide targets from prompt (e.g., "change slide 4", "slides 2-5")
        const { targetIndices, editAll, cleanedPrompt } = parseSlideTargets(userPrompt, currentState.slides.length);
        const editInstruction = cleanedPrompt || userPrompt;

        // Filter slides based on targeting
        let slidesToProcess;
        if (editAll || !targetIndices || targetIndices.length === 0) {
          // Edit all slides
          slidesToProcess = currentState.slides.map((s, idx) => {
            const pendingComments = (s.comments || []).filter(c => !c.addressed);
            return {
              id: s.id,
              html: s.html,
              title: s.title,
              type: s.type,
              summary: s.summary,
              originalIndex: idx,
              comments: pendingComments.map(c => c.text),
              pendingCommentCount: pendingComments.length,
            };
          });
        } else {
          // Edit only targeted slides
          slidesToProcess = targetIndices.map(idx => {
            const s = currentState.slides[idx];
            const pendingComments = (s.comments || []).filter(c => !c.addressed);
            return {
              id: s.id,
              html: s.html,
              title: s.title,
              type: s.type,
              summary: s.summary,
              originalIndex: idx,
              comments: pendingComments.map(c => c.text),
              pendingCommentCount: pendingComments.length,
            };
          });
          const targetNames = targetIndices.map(i => `Slide ${i + 1}`).join(', ');
          addMessage('assistant', `📍 Targeting: ${targetNames} (${targetIndices.length} of ${currentState.slides.length} slides)`);
        }

        // Count total pending comments
        const totalPendingComments = slidesToProcess.reduce((sum, s) => sum + s.pendingCommentCount, 0);
        if (totalPendingComments > 0) {
          addMessage('assistant', `📝 ${totalPendingComments} pending comment${totalPendingComments > 1 ? 's' : ''} will be considered and addressed`);
        }

        const batchSize = currentState.settings?.editAllBatchSize || 3;
        const totalSlides = slidesToProcess.length;
        const deckTotalSlides = currentState.slides.length;

        if (editAllAutoMatch) {
          // Template matching mode - process each slide with optimal template
          addMessage('assistant', `Analyzing ${totalSlides} slide${totalSlides > 1 ? 's' : ''} for optimal templates...`);

          // Update progress
          setProgress(prev => ({
            ...prev,
            phase: 'Analyzing templates',
            current: 0,
            total: totalSlides
          }));

          let updatedCount = 0;
          const modifications = currentState.modifiedSystemTemplates || {};

          // Process slides in batches
          for (let batchStart = 0; batchStart < totalSlides; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, totalSlides);
            const batchNum = Math.floor(batchStart / batchSize) + 1;
            const totalBatches = Math.ceil(totalSlides / batchSize);

            if (totalSlides > batchSize) {
              addMessage('assistant', `Processing batch ${batchNum}/${totalBatches}...`);
            }

            // Process each slide in the batch
            for (let i = batchStart; i < batchEnd; i++) {
              const slide = slidesToProcess[i];
              const slideNum = slide.originalIndex + 1; // 1-indexed for display
              setProgress(prev => ({
                ...prev,
                phase: `Processing slide ${slideNum}/${deckTotalSlides}`,
                current: i + 1,
                total: totalSlides
              }));

              try {
                // Include slide position in template selection prompt
                const slidePositionInfo = `[Slide ${slideNum} of ${deckTotalSlides}]`;
                const templateSelectionPrompt = `${slidePositionInfo} Current slide content: ${slide.title || 'Untitled'}. ${slide.summary || ''}\n\nImprove this slide: ${editInstruction}`;

                // Select best template for this slide
                const selectedTemplate = await selectTemplateWithAI(
                  templateSelectionPrompt,
                  templatesForAI,
                  currentState.settings
                );

                let improvedHtml;
                if (selectedTemplate) {
                  // Apply template modifications if any
                  let templateToUse = selectedTemplate;
                  if (modifications[selectedTemplate.id]) {
                    templateToUse = { ...selectedTemplate, ...modifications[selectedTemplate.id] };
                  }

                  // Convert slide to new template while applying improvements
                  // Pass slide position for correct page numbers in footer
                  improvedHtml = await improveSlideWithTemplate(
                    slide.html,
                    editInstruction,
                    templateToUse,
                    currentState.settings,
                    { slideNumber: slideNum, totalSlides: deckTotalSlides }
                  );

                  // Validate before updating
                  const isValid = improvedHtml &&
                    improvedHtml.length > 100 &&
                    improvedHtml.includes('<div') &&
                    improvedHtml.includes('class=');

                  if (isValid) {
                    // Regenerate summary after edit to maintain deck structure
                    const newSummary = generateSlideSummary(improvedHtml, templateToUse.id, slide.title);
                    actions.updateSlide(slide.id, {
                      html: improvedHtml,
                      type: templateToUse.id,
                      templateId: templateToUse.id,
                      summary: newSummary
                    });
                  } else {
                    debugLog(LogLevel.ERROR, 'edit_all_slides', `Invalid template conversion for slide ${slideNum}`);
                    improvedHtml = null; // Mark as failed
                  }
                } else {
                  // No template match - just improve without template conversion
                  // Build minimal context (position + lightweight neighbor info)
                  const minimalContext = buildMinimalEditContext(currentState.slides, slide.originalIndex, {
                    includeNeighbors: true,
                    includeStoryline: currentState.storyline?.length > 0,
                    storyline: currentState.storyline,
                    neighborRange: 2,
                  });

                  const slideInfo = {
                    html: slide.html,
                    title: slide.title,
                    type: slide.type,
                    slideNumber: slideNum,
                    totalSlides: deckTotalSlides,
                    comments: slide.comments || [],
                    minimalContext,
                  };
                  // Build instruction with comments
                  const commentContext = slide.comments?.length > 0 ? `\n\nUser comments to address:\n${slide.comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : '';
                  const result = await improveSlide(slideInfo, editInstruction + commentContext, currentState.settings, null);

                  // Handle new return type { html, customCSS }
                  improvedHtml = result?.html || result;
                  const newCustomCSS = result?.customCSS;

                  // Validate before updating
                  const isValid = improvedHtml &&
                    improvedHtml.length > 100 &&
                    improvedHtml.includes('<div') &&
                    improvedHtml.includes('class=');

                  if (isValid) {
                    // Regenerate summary after edit to maintain deck structure
                    const newSummary = generateSlideSummary(improvedHtml, slide.type, slide.title);
                    const updateData = { html: improvedHtml, summary: newSummary };
                    if (newCustomCSS) updateData.customCSS = newCustomCSS;
                    actions.updateSlide(slide.id, updateData);
                  } else {
                    debugLog(LogLevel.ERROR, 'edit_all_slides', `Invalid AI response for slide ${slideNum}`);
                    improvedHtml = null; // Mark as failed
                  }
                }

                if (improvedHtml && improvedHtml !== slide.html) {
                  updatedCount++;
                  // Mark comments as addressed for this slide
                  if (slide.pendingCommentCount > 0) {
                    actions.addressAllComments(slide.id, 'Edit All Mode');
                  }
                }
              } catch (err) {
                console.warn(`Failed to process slide ${slideNum}:`, err);
              }
            }
          }

          const commentsSummary = totalPendingComments > 0 ? ` (${totalPendingComments} comment${totalPendingComments > 1 ? 's' : ''} addressed)` : '';
          addMessage('assistant', `✓ Updated ${updatedCount} of ${totalSlides} slide${totalSlides > 1 ? 's' : ''} with optimal templates${commentsSummary}. Check the preview!`);
        } else {
          // Standard edit-all mode without template matching
          const modeDesc = editAll ? 'all' : 'targeted';
          addMessage('assistant', `Working on ${modeDesc} ${totalSlides} slide${totalSlides > 1 ? 's' : ''} (batch size: ${batchSize})...`);

          // Process in batches
          let updatedCount = 0;
          let addressedCommentCount = 0;
          for (let batchStart = 0; batchStart < totalSlides; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, totalSlides);
            const batchSlides = slidesToProcess.slice(batchStart, batchEnd);
            const batchNum = Math.floor(batchStart / batchSize) + 1;
            const totalBatches = Math.ceil(totalSlides / batchSize);

            setProgress(prev => ({
              ...prev,
              phase: `Batch ${batchNum}/${totalBatches}`,
              current: batchEnd,
              total: totalSlides
            }));

            // Build slides with comments included in instruction
            const batchSlidesWithComments = batchSlides.map(slide => ({
              ...slide,
              // Include comments in the slide data that gets sent to AI
              instruction: slide.comments?.length > 0
                ? `${editInstruction}\n\nUser comments to address for this slide:\n${slide.comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
                : editInstruction,
            }));

            const batchResults = await improveMultipleSlides(batchSlidesWithComments, editInstruction, currentState.settings);

            // Update each slide in the batch
            batchResults.forEach((htmlResult, i) => {
              const originalSlide = batchSlides[i];
              if (originalSlide && htmlResult && htmlResult !== originalSlide.html) {
                // Regenerate summary after edit to maintain deck structure
                const newSummary = generateSlideSummary(htmlResult, originalSlide.type, originalSlide.title);
                actions.updateSlide(originalSlide.id, { html: htmlResult, summary: newSummary });
                updatedCount++;
                // Mark comments as addressed
                if (originalSlide.pendingCommentCount > 0) {
                  actions.addressAllComments(originalSlide.id, 'Edit All Mode');
                  addressedCommentCount += originalSlide.pendingCommentCount;
                }
              }
            });
          }

          const commentsSummary = addressedCommentCount > 0 ? ` (${addressedCommentCount} comment${addressedCommentCount > 1 ? 's' : ''} addressed)` : '';
          addMessage('assistant', `✓ Updated ${updatedCount} of ${totalSlides} slide${totalSlides > 1 ? 's' : ''}${commentsSummary}. Check the preview!`);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User stopped the operation - message already shown by handleStop
      } else {
        addMessage('assistant', `❌ Error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) {
    return (
      <button className="chatbot-fab" onClick={() => setIsOpen(true)} title="AI Assistant">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="chatbot-fab-badge">AI</span>
      </button>
    );
  }

  return (
    <div className={`chatbot-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="chatbot-header">
        <div className="chatbot-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <span>AI Assistant</span>
        </div>
        <div className="chatbot-actions">
          <button
            className="chatbot-action-btn"
            onClick={() => {
              // Full reset — clear ALL chat state for a fresh start
              setMessages([{ type: 'assistant', content: 'Hi! I can help you create and improve slides. Choose a mode below and describe what you need.' }]);
              setUploadedFiles([]);
              setPendingSmartAction(null);
              setProgress(null);
              setExecutionStatus(null);
              setAgentModeProgress(null);
              setLastAgentOutput(null);
              setAgentOutputExpanded(false);
              setReportHTML(null);
              setUseReportMode(false);
              setEditableStoryline(null);
              setExpandedSteps(new Set());
              setExpandedAiIO(new Set());
              setIsLoading(false);
              agenticExecution.clear(); // also aborts any running agent
              currentStepAiIO.current = [];
              approvalResumeRef.current = null;
              pendingClarificationRef.current = null;
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
              console.log('[AIChatbot] Chat fully cleared — all state reset');
            }}
            title="Clear chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button
            className="chatbot-action-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Shrink' : 'Expand'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isExpanded ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
          </button>
          <button className="chatbot-action-btn" onClick={() => setIsOpen(false)} title="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chatbot-messages">
        {visibleMessages.map((msg, idx) => (
          <div key={idx} className={`chatbot-message ${msg.type}`}>
            {msg.type === 'assistant' && (
              <div className="chatbot-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
            )}
            <div className="chatbot-message-content">
              {msg.isHTML ? (
                <div dangerouslySetInnerHTML={{ __html: msg.content }} />
              ) : (
                msg.content
              )}
              {/* AI I/O toggle for messages with AI call data */}
              {msg.aiIO && msg.aiIO.length > 0 && (
                <>
                  <button
                    className={`ai-io-toggle ${expandedAiIO.has(idx) ? 'expanded' : ''}`}
                    onClick={() => toggleAiIO(idx)}
                  >
                    <span>{expandedAiIO.has(idx) ? '▼' : '▶'}</span>
                    <span>🔍 View AI I/O ({msg.aiIO.length} call{msg.aiIO.length > 1 ? 's' : ''})</span>
                  </button>
                  {expandedAiIO.has(idx) && (
                    <div className="ai-io-panel">
                      {msg.aiIO.map((io, ioIdx) => (
                        <div key={ioIdx} className="ai-io-section">
                          <div className="ai-io-step-header">
                            <span className="ai-io-step-num">{ioIdx + 1}</span>
                            <span className="ai-io-step-action">{io.step}</span>
                            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>
                              {io.timestamp?.split('T')[1]?.split('.')[0] || ''}
                            </span>
                          </div>
                          <div className="ai-io-meta">
                            {io.model && <span className="ai-io-meta-tag">Model: {io.model}</span>}
                            {io.maxTokens && <span className="ai-io-meta-tag">Max tokens: {io.maxTokens.toLocaleString()}</span>}
                            {io.duration && <span className="ai-io-meta-tag">{(io.duration / 1000).toFixed(1)}s</span>}
                            {io.temperature != null && <span className="ai-io-meta-tag">Temp: {io.temperature}</span>}
                            {io.attempt > 1 && <span className="ai-io-meta-tag ai-io-meta-warn">Attempt #{io.attempt}</span>}
                            {io.reasoningEffort && <span className="ai-io-meta-tag">Reasoning: {io.reasoningEffort}</span>}
                            {io.skillsInjected > 0 && <span className="ai-io-meta-tag ai-io-meta-skill">{io.skillsInjected} skills</span>}
                          </div>
                          <div className="ai-io-section-header input">📤 Input</div>
                          <div className="ai-io-content">
                            {io.input?.length > 5000 ? io.input.slice(0, 5000) + '\n\n... (truncated)' : io.input}
                          </div>
                          <div className="ai-io-section-header output">📥 Output</div>
                          <div className="ai-io-content">
                            {io.output?.length > 5000 ? io.output.slice(0, 5000) + '\n\n... (truncated)' : io.output}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Smart Action Card - inline execution with real-time status */}
        {pendingSmartAction && !pendingSmartAction.autoExecute && (
          <div className="smart-action-wrapper" style={{
            position: 'relative',
            zIndex: 100,
            overflow: 'visible',
            width: '100%',
            pointerEvents: 'auto'
          }}>
            <SmartActionCard
              routeResult={pendingSmartAction.routeResult}
              userPrompt={pendingSmartAction.userPrompt}
              slides={state.slides}
              onExecute={executeFromSmartAction}
              onCancel={cancelSmartAction}
              isExecuting={isLoading}
              executionStatus={executionStatus}
              currentSlide={pendingSmartAction.capturedSlide}
              currentSlideIdx={pendingSmartAction.capturedSlideIdx}
              imageVibe={imageVibe}
              onImageVibeChange={useImageMode ? setImageVibe : null}
            />
          </div>
        )}

        {/* Consulting Team Agent — research/reasoning phase */}
        {(agenticExecution.isRunning || agentModeProgress) && (() => {
          const isDone = agentModeProgress?.phase?.startsWith('Done');
          const isError = agentModeProgress?.error;
          // Agent is running = show real-time progress (whether pre- or post-approval)
          const isAgentActive = agenticExecution.isRunning;
          const isResearchPhase = isAgentActive && !agentModeProgress;
          const isSlidePhase = agentModeProgress && !isDone && !isError;
          const isActive = isResearchPhase || isSlidePhase;
          const steps = (() => {
            // When agent is actively running, ALWAYS prefer its real-time steps
            if (isAgentActive && agenticExecution.currentProgress?.steps?.length > 0) {
              return agenticExecution.currentProgress.steps;
            }
            // Show hook's initial progress message (set in prepareContent before async call)
            if (isAgentActive && agenticExecution.currentProgress?.message) {
              return [{ name: agenticExecution.currentProgress.message, status: 'active', role: 'agent' }];
            }
            if (isResearchPhase) {
              return [{ name: 'Starting agent...', status: 'active', role: 'agent' }];
            }
            if (agentModeProgress) return agentModeProgress.steps;
            return [{ name: 'Starting...', status: 'active' }];
          })();

          const roleIcon = (role) => {
            if (!role) return '?';
            const r = role.toLowerCase();
            switch (r) {
              case 'manager': return 'M';
              case 'consultant': return 'C';
              // Legacy roles (backward compat)
              case 'senior-associate': return 'C';
              case 'associate': return 'C';
              case 'designer': return 'C';
              case 'analyst': return 'C';
              case 'agent': return 'C';
              default: return 'C';
            }
          };
          const roleLabel = (role) => {
            if (!role) return 'unknown';
            const r = role.toLowerCase();
            switch (r) {
              case 'manager': return 'Manager';
              case 'consultant': return 'Consultant';
              // Legacy roles (backward compat)
              case 'senior-associate': return 'Consultant';
              case 'associate': return 'Consultant';
              case 'designer': return 'Consultant';
              case 'analyst': return 'Consultant';
              case 'agent': return 'Consultant';
              default: return 'Consultant';
            }
          };
          const roleColor = (role) => {
            if (!role) return '#6b7280';
            const r = role.toLowerCase();
            switch (r) {
              case 'manager': return '#1e40af';           // Navy blue
              case 'consultant': return '#047857';         // Emerald
              // Legacy roles (backward compat)
              case 'senior-associate': return '#047857';
              case 'associate': return '#047857';
              case 'designer': return '#047857';
              case 'analyst': return '#047857';
              case 'agent': return '#047857';
              default: return '#047857';
            }
          };

          // Budget info from progress
          const budget = agenticExecution.currentProgress?.budget;

          // Thinking log — last 4 entries
          const recentThinking = (agenticExecution.thinkingLog || []).slice(-4);

          return (
            <div className={`agent-working ${isDone ? 'agent-working-done' : ''} ${isError ? 'agent-working-error' : ''}`}>
              {/* ── Unified progress — all steps in one coherent section ── */}
              {(isActive || isDone || isError || (agenticExecution.thinkingLog || []).length > 0) && (
                <div className="agent-team-section agent-team-research">
                  <div className="agent-working-header">
                    <div className="agent-working-left">
                      {isActive && !isDone && !isError && <div className={`agent-working-pulse`} />}
                      <span className="agent-working-title">
                        {isDone ? 'All slides created'
                          : isError ? 'Error'
                          : isAgentActive ? (agenticExecution.currentProgress?.message || 'Working...')
                          : 'Working...'}
                      </span>
                      {agenticExecution.currentProgress?.skillCount > 0 && (
                        <span className="agent-skills-badge" title={`${agenticExecution.currentProgress.skillCount} skills active`}>⚡{agenticExecution.currentProgress.skillCount}</span>
                      )}
                    </div>
                    <div className="agent-working-right">
                      {budget && budget.total > 0 && (
                        <>
                          <span
                            key={`budget-${budget.remaining}`}
                            className={`agent-budget-badge${budget.remaining <= 0 ? ' agent-budget-exhausted' : budget.remaining <= 5 ? ' agent-budget-low' : ''}`}
                            title={`${budget.remaining} of ${budget.total} credits remaining${budget.remaining <= 0 ? ' — say "continue" to add more' : ''}`}
                          >
                            {budget.remaining}/{budget.total}
                          </span>
                          {budget.remaining <= 5 && (
                            <button
                              className="agent-budget-add-btn"
                              title="Add 10 more credits"
                              onClick={() => agenticExecution.extendBudget(10)}
                            >+10</button>
                          )}
                        </>
                      )}
                      {isActive && !isDone && !isError && (
                        <button className="agent-working-stop" onClick={handleStop}>Stop</button>
                      )}
                    </div>
                  </div>

                  {/* ── Execution plan — structured timeline ── */}
                  <div className="ep-plan">
                    {(() => {
                      // Show agent steps when running OR when done (to keep history visible)
                      const displaySteps = (agenticExecution.currentProgress?.steps?.length > 0)
                        ? agenticExecution.currentProgress.steps
                        : steps;

                      if (displaySteps.length === 0 && isActive && !isDone) {
                        const initMsg = agenticExecution.currentProgress?.message
                          || 'Reading and understanding your request...';
                        return <div className="ep-thinking">{initMsg}</div>;
                      }

                      // Group steps: detect parallel runs (consecutive steps with parallel flag)
                      const hasActiveStep = displaySteps.some(s => s.status === 'active');
                      const groups = [];
                      let seqNum = 1;
                      displaySteps.forEach((step, i) => {
                        if (step.parallel) {
                          const lastGroup = groups[groups.length - 1];
                          if (lastGroup && lastGroup.type === 'parallel') {
                            lastGroup.steps.push({ ...step, _idx: i });
                          } else {
                            groups.push({ type: 'parallel', steps: [{ ...step, _idx: i }], seqStart: seqNum });
                            seqNum++;
                          }
                        } else {
                          groups.push({ type: 'sequential', steps: [{ ...step, _idx: i }], seqStart: seqNum });
                          seqNum++;
                        }
                      });

                      // Helper: highlight key words in step text — bold the first phrase or verb
                      const highlightText = (text) => {
                        if (!text) return text;
                        // Bold the assignee name if it appears at the start
                        const colonIdx = text.indexOf(':');
                        if (colonIdx > 0 && colonIdx < 30) {
                          const before = text.slice(0, colonIdx);
                          const after = text.slice(colonIdx + 1).trim();
                          return <><strong>{before}</strong><span className="ep-step-sep">:</span> {after}</>;
                        }
                        // Bold the action verb (first word)
                        const spaceIdx = text.indexOf(' ');
                        if (spaceIdx > 0 && spaceIdx < 20) {
                          return <><strong>{text.slice(0, spaceIdx)}</strong> {text.slice(spaceIdx + 1)}</>;
                        }
                        return text;
                      };

                      const renderStep = (step, i, num, isParallelChild) => {
                        const isComplete = step.status === 'complete';
                        const isActiveStep = step.status === 'active';
                        const isExpanded = expandedSteps.has(step._idx);
                        const assignee = step.assignee || '';

                        // Get logs scoped to THIS step
                        const allLogs = agenticExecution.thinkingLog || [];
                        let stepLogs;
                        if (step._stepId) {
                          stepLogs = allLogs.filter(t =>
                            t._stepId === step._stepId && (t.type !== 'info' || (t.message && t.message.length > 15))
                          );
                        } else {
                          const startIdx = step.logStartIdx ?? 0;
                          const endIdx = step.logEndIdx ?? (isActiveStep ? allLogs.length : startIdx);
                          stepLogs = allLogs.slice(startIdx, endIdx).filter(t =>
                            t.type !== 'info' || (t.message && t.message.length > 15)
                          );
                        }
                        const workerOutputs = step.workerOutputs || [];
                        const hasExpandable = isComplete && (workerOutputs.length > 0 || stepLogs.length > 0 || step.isBatchGroup);

                        // Step name: prefer summary when done
                        let stepText = isComplete && step.summary ? step.summary : step.name;
                        // Strip assignee name from step text to avoid duplication
                        if (assignee && stepText) {
                          const prefixes = [assignee + ':', assignee + ' — ', assignee + ' - ', assignee + ' → '];
                          for (const p of prefixes) {
                            if (stepText.startsWith(p)) { stepText = stepText.slice(p.length).trim(); break; }
                          }
                        }

                        // Build display: "Name — activity" with name bold, matching scoping/planning step format
                        const displayText = assignee
                          ? <><strong>{assignee}</strong> — {stepText}</>
                          : highlightText(stepText);

                        return (
                          <div
                            key={step._idx}
                            className={`ep-step ep-step--${step.status || 'pending'}${isParallelChild ? ' ep-step--parallel' : ''}${hasExpandable ? ' ep-step--expandable' : ''}`}
                            onClick={() => {
                              if (!hasExpandable) return;
                              setExpandedSteps(prev => {
                                const next = new Set(prev);
                                next.has(step._idx) ? next.delete(step._idx) : next.add(step._idx);
                                return next;
                              });
                            }}
                          >
                            {/* Row: number · status · text — same layout as scoping/planning steps */}
                            <div className="ep-step-row">
                              {!isParallelChild && <span className="ep-step-num">{num}</span>}
                              {isParallelChild && <span className="ep-step-num ep-step-num--sub">&nbsp;</span>}
                              <span className={`ep-step-dot ep-step-dot--${step.status || 'pending'}`}>
                                {isComplete ? '✓' : step.status === 'error' ? '✗' : ''}
                              </span>
                              <span className="ep-step-text">{displayText}</span>
                              {hasExpandable && <span className="ep-step-chevron">{isExpanded ? '▾' : '▸'}</span>}
                            </div>

                            {/* Active step: show sub-status or latest log inline */}
                            {isActiveStep && (step.subStatus || stepLogs.length > 0) && (
                              <div className="ep-step-live">
                                {step.subStatus ? (
                                  <span className="ep-step-live-msg ep-step-live-sub">
                                    {step.subStatus}
                                  </span>
                                ) : stepLogs.slice(-1).map((log, li) => {
                                  const msg = (log.message || '').slice(0, 100);
                                  return (
                                    <span key={li} className="ep-step-live-msg">
                                      <span className="ep-step-live-avatar" style={{ background: roleColor(log.role) }}>{roleIcon(log.role)}</span>
                                      {msg}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Batch slides */}
                            {step.isBatchGroup && step.batchSlides && (isActiveStep || isExpanded) && (
                              <div className="ep-batch">
                                {step.batchSlides.map((child, ci) => (
                                  <div key={ci} className={`ep-batch-item ep-batch-item--${child.status || 'pending'}`}>
                                    <span className={`ep-batch-dot ep-batch-dot--${child.status}`}>
                                      {child.status === 'complete' ? '✓' : child.status === 'active' ? '●' : child.status === 'error' ? '✗' : '·'}
                                    </span>
                                    <span className="ep-batch-label">{child.label}</span>
                                    {child.template && <span className="ep-batch-tpl">{child.template}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Expanded details */}
                            {isExpanded && (stepLogs.length > 0 || workerOutputs.length > 0) && (
                              <div className="ep-step-details">
                                {stepLogs.map((log, li) => (
                                  <div key={li} className={`ep-detail-log ep-detail-log--${log.type || 'info'}`} title={log.message}>
                                    <span className="ep-detail-avatar" style={{ background: roleColor(log.role) }}>{roleIcon(log.role)}</span>
                                    <span className="ep-detail-msg">{(log.message || '').slice(0, 140)}</span>
                                  </div>
                                ))}
                                {workerOutputs.map((wo, wi) => (
                                  <div key={wi} className="ep-detail-worker">
                                    <div className="ep-detail-worker-body">
                                      {wo.insights?.map((ins, ii) => <div key={ii} className="ep-detail-insight">• {ins}</div>)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      const elements = [];
                      groups.forEach((group) => {
                        if (group.type === 'parallel' && group.steps.length > 1) {
                          // Parallel group — visual bracket with inner structure
                          const groupStatus = group.steps.every(s => s.status === 'complete') ? 'complete'
                            : group.steps.some(s => s.status === 'active') ? 'active' : 'pending';
                          const activeSteps = group.steps.filter(s => s.status === 'active');
                          const completedSteps = group.steps.filter(s => s.status === 'complete');
                          const pendingSteps = group.steps.filter(s => s.status === 'pending');
                          const doneCount = completedSteps.length;
                          const totalCount = group.steps.length;
                          elements.push(
                            <div key={`pg-${group.seqStart}`} className={`ep-parallel-group ep-parallel-group--${groupStatus}`}>
                              <div className="ep-parallel-header">
                                <span className="ep-step-num">{group.seqStart}</span>
                                <span className={`ep-step-dot ep-step-dot--${groupStatus}`}>
                                  {groupStatus === 'complete' ? '✓' : ''}
                                </span>
                                <span className="ep-parallel-label">Team Activities</span>
                                <span className="ep-parallel-count">{doneCount}/{totalCount} done</span>
                              </div>
                              <div className="ep-parallel-lane">
                                {activeSteps.length > 0 && activeSteps.map((step, si) => renderStep(step, si, null, true))}
                                {pendingSteps.length > 0 && pendingSteps.map((step, si) => renderStep(step, si, null, true))}
                                {completedSteps.length > 0 && (
                                  <details className="ep-parallel-completed-group" open={groupStatus !== 'active'}>
                                    <summary className="ep-parallel-completed-toggle">
                                      <span className="ep-parallel-completed-icon">✓</span>
                                      {completedSteps.length} completed
                                    </summary>
                                    {completedSteps.map((step, si) => renderStep(step, si, null, true))}
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          // Sequential step
                          group.steps.forEach((step, si) => {
                            elements.push(renderStep(step, si, group.seqStart, false));
                          });
                        }
                      });

                      // Thinking indicator when no step is active
                      if (isActive && !isDone && !isError && !hasActiveStep && displaySteps.length > 0) {
                        const phaseMsg = agenticExecution.currentProgress?.message || 'Working...';
                        elements.push(
                          <div key="thinking-indicator" className="ep-thinking-inline">
                            <span className="ep-step-dot ep-step-dot--active" />
                            <span>{phaseMsg}</span>
                          </div>
                        );
                      }

                      return elements;
                    })()}
                  </div>
                </div>
              )}

              {/* ── Storyline Approval Card (React-rendered, editable, below plan) ── */}
              {agentModeProgress?.approvalData && editableStoryline && (
                <div className="agent-approval-section">
                  <div className="storyline-approval-card">
                    <div className="storyline-approval-header">
                      <span className="storyline-approval-title">{useReportMode ? 'Report Plan for Review' : 'Slide Plan for Review'}</span>
                      <span className="storyline-approval-badge">
                        {(() => {
                          const secs = editableStoryline.sections || [];
                          const unit = useReportMode ? 'sections' : 'slides';
                          const totalSlides = secs.reduce((sum, s) => sum + (s.slides?.length > 0 ? s.slides.length : 1), 0);
                          const hasGroups = secs.some(s => s.slides?.length > 0);
                          return hasGroups ? `${totalSlides} ${unit} in ${secs.length} sections` : `${secs.length} ${unit}`;
                        })()}
                      </span>
                    </div>
                    <div className="storyline-approval-body">
                      <input
                        className="storyline-main-message storyline-editable-input"
                        value={editableStoryline.mainMessage || ''}
                        onChange={(e) => setEditableStoryline(prev => ({ ...prev, mainMessage: e.target.value }))}
                        placeholder="Main message / governing thought"
                      />
                      <div className="storyline-type">
                        {editableStoryline.storylineType || ''}
                      </div>
                      <div className="storyline-sections-list">
                        {(editableStoryline.sections || []).map((s, i) => (
                          <div key={i} className={`storyline-section-item${s.slides?.length > 0 ? ' storyline-section-group' : ''}`}>
                            <span className="storyline-section-num">{i + 1}</span>
                            <div className="storyline-section-content">
                              <input
                                className="storyline-editable-title"
                                value={s.sectionTitle || ''}
                                onChange={(e) => {
                                  const updated = [...editableStoryline.sections];
                                  updated[i] = { ...updated[i], sectionTitle: e.target.value };
                                  setEditableStoryline(prev => ({ ...prev, sections: updated }));
                                }}
                                placeholder={s.slides?.length > 0 ? "Section theme" : "Slide title"}
                              />
                              <textarea
                                className="storyline-editable-msg"
                                value={s.keyMessage || ''}
                                rows={2}
                                onChange={(e) => {
                                  const updated = [...editableStoryline.sections];
                                  updated[i] = { ...updated[i], keyMessage: e.target.value };
                                  setEditableStoryline(prev => ({ ...prev, sections: updated }));
                                }}
                                placeholder="Key message"
                              />
                              {/* Render child slides under section groups */}
                              {s.slides?.length > 0 && (
                                <div className="storyline-child-slides">
                                  {s.slides.map((sl, j) => (
                                    <div key={j} className="storyline-child-slide">
                                      <span className="storyline-child-bullet">-</span>
                                      <input
                                        className="storyline-editable-title storyline-child-title"
                                        value={sl.title || ''}
                                        onChange={(e) => {
                                          const updated = [...editableStoryline.sections];
                                          const updatedSlides = [...(updated[i].slides || [])];
                                          updatedSlides[j] = { ...updatedSlides[j], title: e.target.value };
                                          updated[i] = { ...updated[i], slides: updatedSlides };
                                          setEditableStoryline(prev => ({ ...prev, sections: updated }));
                                        }}
                                        placeholder="Slide title"
                                      />
                                      {sl.contentType && <span className="storyline-section-type storyline-child-type">{sl.contentType}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {s.contentType && s.contentType !== 'section-group' && <span className="storyline-section-type">{s.contentType}</span>}
                            <button
                              className="storyline-section-remove"
                              title={s.slides?.length > 0 ? "Remove section" : "Remove slide"}
                              onClick={() => {
                                const updated = editableStoryline.sections.filter((_, idx) => idx !== i);
                                setEditableStoryline(prev => ({ ...prev, sections: updated }));
                              }}
                            >&times;</button>
                          </div>
                        ))}
                        <button
                          className="storyline-section-add"
                          onClick={() => {
                            const newSection = { sectionTitle: '', keyMessage: '', contentType: 'detail', slideRole: 'body' };
                            setEditableStoryline(prev => ({
                              ...prev,
                              sections: [...(prev.sections || []), newSection],
                            }));
                          }}
                        >+ Add slide</button>
                      </div>
                      {agentModeProgress.approvalData.logs?.length > 0 && (
                        <details className="storyline-logs-toggle">
                          <summary>Agent Log ({agentModeProgress.approvalData.logs.length} calls)</summary>
                          <div className="storyline-logs-list">
                            {agentModeProgress.approvalData.logs.map((l, i) => (
                              <div key={i} className="storyline-log-entry">
                                <strong>{(l.role || '').charAt(0).toUpperCase() + (l.role || '').slice(1)}</strong>: {l.action || l.message || ''}{' '}
                                <span className="storyline-log-detail">{l.detail || ''}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    <div className="storyline-approval-actions">
                      <button className="storyline-btn-reject" onClick={() => {
                        setEditableStoryline(null);
                        window.__rejectStoryline?.();
                      }}>Revise</button>
                      <button className="storyline-btn-approve" onClick={() => {
                        window.__approveStoryline?.();
                      }}>Approve &amp; Build</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Done / Error — keep plan visible for audit ── */}
              {(isDone || isError) && (
                <div className="ep-done-bar">
                  <span className={`ep-done-label ${isError ? 'ep-done-label--error' : ''}`}>
                    {isError ? 'Completed with errors' : 'Plan executed successfully'}
                  </span>
                  <button className="ep-done-dismiss" onClick={() => setAgentModeProgress(null)}>Dismiss</button>
                </div>
              )}
            </div>
          );
        })()}

        {isLoading && (!pendingSmartAction || pendingSmartAction.autoExecute) && !agenticExecution.isRunning && !agentModeProgress && (
          <div className="chatbot-message assistant chatbot-progress-message">
            <div className="chatbot-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <div className="chatbot-message-content">
              {progress ? (
                <div className="chatbot-progress">
                  <div className="chatbot-progress-header">
                    <span className="chatbot-progress-spinner"></span>
                    <span className="chatbot-progress-phase">{progress.phase}</span>
                    {progress.total > 1 && (
                      <span className="chatbot-progress-count">
                        {progress.current}/{progress.total}
                      </span>
                    )}
                  </div>
                  {progress.plan && progress.plan.length > 0 && (
                    <div className="chatbot-progress-plan">
                      {progress.plan.map((step, i) => {
                        const stepText = typeof step === 'string' ? step : step.text;
                        const isCreateStep = typeof step === 'object' && (step.action === 'create_slide' || step.action === 'create_from_template');
                        const isFreestyle = isCreateStep && (!step.templateId || step.templateId === 'freestyle');
                        const guidance = typeof step === 'object' ? step.layoutGuidance : null;
                        const stepIdx = typeof step === 'object' ? step.stepIndex : i;
                        const isPending = i >= progress.current;
                        return (
                          <div
                            key={i}
                            className={`chatbot-plan-step ${i < progress.current ? 'completed' : i === progress.current ? 'active' : ''}`}
                          >
                            <span className="step-indicator">
                              {i < progress.current ? '✓' : i === progress.current ? '●' : '○'}
                            </span>
                            <span className="step-text">{stepText}</span>
                            {isFreestyle && isPending && (
                              <input
                                className="layout-guidance-inline-input"
                                type="text"
                                value={guidance || ''}
                                placeholder="layout..."
                                title="Layout guidance for this freestyle slide"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value || null;
                                  if (progress.planStepsRef && progress.planStepsRef[stepIdx]) {
                                    progress.planStepsRef[stepIdx].layoutGuidance = val;
                                  }
                                  setProgress(prev => {
                                    if (!prev || !prev.plan) return prev;
                                    const newPlan = [...prev.plan];
                                    if (typeof newPlan[i] === 'object') {
                                      newPlan[i] = { ...newPlan[i], layoutGuidance: val };
                                    }
                                    return { ...prev, plan: newPlan };
                                  });
                                }}
                              />
                            )}
                            {isFreestyle && !isPending && guidance && (
                              <span className="layout-guidance-badge">{guidance}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {progress.total > 1 && (
                    <div className="chatbot-progress-bar">
                      <div
                        className="chatbot-progress-fill"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="chatbot-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              <button
                className="chatbot-stop-btn"
                onClick={handleStop}
                title="Stop operation"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-footer">
        {/* Agent mode section - clean minimal design */}
        {(
          <div className="chatbot-edit-section agent-section-clean">
            {/* Execution plan when running */}
            {agentPlan && (
              <ExecutionPlan
                plan={agentPlan}
                currentStep={agentStep}
                compact={!isExpanded}
                onCancel={handleStop}
              />
            )}

            {/* Active flow / uploads indicator — only when not running */}
            {!agentPlan && (
              <div className="agent-status-bar">
                {activeFlow ? (
                  <span className="agent-flow-tag">
                    {activeFlow.name}
                    <button className="agent-flow-clear" onClick={clearActiveFlow} title="Clear flow">&times;</button>
                  </span>
                ) : uploadedFiles.length > 0 ? (
                  <span className="agent-flow-tag">
                    {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded
                    <button className="agent-flow-clear" onClick={() => setUploadedFiles([])} title="Clear uploads">&times;</button>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Interactive report viewer — shown when a report was generated */}
        {reportHTML && (
          <div className="report-viewer-container">
            <div className="report-viewer-toolbar">
              <span className="report-viewer-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Interactive Report
              </span>
              <div className="report-viewer-actions">
                <button
                  className="report-action-btn report-open"
                  onClick={() => {
                    const blob = new Blob([reportHTML], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  }}
                  title="Open in new tab"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </button>
                <button
                  className="report-action-btn report-download"
                  onClick={() => {
                    const blob = new Blob([reportHTML], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'report.html';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  title="Download as HTML"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </button>
                <button
                  className="report-action-btn report-dismiss"
                  onClick={() => setReportHTML(null)}
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input form with file upload */}
        <form onSubmit={handleSubmit} className="chatbot-input-form">
          <div className="chatbot-input-actions">
            {/* ─── Context Group: Attach files + Library ─── */}
            <div className="chatbot-action-group">
              <button
                type="button"
                className="chatbot-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploadingFiles}
                title="Upload documents (PDF, Word, Excel, PPTX, Images)"
              >
                {isUploadingFiles ? (
                  <span className="upload-spinner"></span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                )}
                Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={getAcceptString()}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              {/* Library button hidden for now -- re-enable when knowledge base is ready */}
            </div>

            <div className="chatbot-action-separator" />

            {/* ─── Output Mode Group: Express / Image-based (+ Deep modes if enabled) ─── */}
            <div className="chatbot-action-group chatbot-mode-group">
              <span className="chatbot-mode-label">Slides:</span>
              <button
                type="button"
                className={`chatbot-mode-btn ${!useImageMode && !useAgenticMode && !useReportMode ? 'active' : ''}`}
                onClick={() => { setUseImageMode(false); setUseAgenticMode(false); setUseReportMode(false); }}
                disabled={isLoading}
                title="Regular - Template-based slides"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Regular
              </button>
              <button
                type="button"
                className={`chatbot-mode-btn ${useImageMode && !useAgenticMode && !useReportMode ? 'active' : ''}`}
                onClick={() => { setUseImageMode(true); setUseAgenticMode(false); setUseReportMode(false); }}
                disabled={isLoading || !state.settings.imageModel}
                title={state.settings.imageModel ? 'Image-based - AI-generated visual slides' : 'Configure an image model in Settings to enable'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Image
              </button>
              {/* Style preference */}
              <select
                className="chatbot-mode-select"
                value={state.settings.slideStylePreference || 'auto'}
                onChange={(e) => actions.updateSettings({ slideStylePreference: e.target.value })}
                title="Slide style preference"
                style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', marginLeft: 4 }}
              >
                <option value="auto">Auto</option>
                <option value="templates">Templates</option>
                <option value="freestyle">Freestyle</option>
              </select>
              {state.settings.enableAgenticMode && (
                <>
                  <button
                    type="button"
                    className={`chatbot-mode-btn ${useAgenticMode && !useReportMode ? 'active' : ''}`}
                    onClick={() => { setUseImageMode(false); setUseAgenticMode(true); setUseReportMode(false); }}
                    disabled={isLoading}
                    title="Deep Deck - Research-powered slide presentation"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Deep Deck
                  </button>
                  <button
                    type="button"
                    className={`chatbot-mode-btn chatbot-report-mode ${useReportMode ? 'active' : ''}`}
                    onClick={() => { setUseImageMode(false); setUseAgenticMode(true); setUseReportMode(true); }}
                    disabled={isLoading}
                    title="Deep Report - Research-powered interactive dashboard"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 9l-5 5-4-4-3 3" />
                    </svg>
                    Deep Report
                  </button>
                </>
              )}
            </div>

            {/* Storyline + Flows buttons hidden (functionality preserved in code) */}
          </div>
          <div className="chatbot-input-row">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={3}
              disabled={isLoading && !agenticExecution.isRunning}
              placeholder={agenticExecution.isRunning ? 'Chat with the team while they work...' : 'Describe your presentation goal or paste an image (Ctrl+V)...'}
            />
            <button type="submit" disabled={(isLoading && !agenticExecution.isRunning) || !prompt.trim()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Storyline Workspace Modal - renders as full-screen overlay */}
      <StorylineWorkspace
        isOpen={showStorylineWorkspace}
        onClose={() => setShowStorylineWorkspace(false)}
      />

      {/* Router Preview - Rule-based routing (instant, no API call) */}
      {showRouterPreview && pendingRouterCall && (() => {
        // Preview the routing decision (instant - no API call!)
        const routePreview = routeRequest(pendingRouterCall.userPrompt, pendingRouterCall.context);
        const matchedTemplate = routePreview.templateMatch
          ? SLIDE_TEMPLATES[routePreview.templateMatch.templateId]
          : null;

        return (
        <div className="router-preview-overlay" onClick={cancelRouterPreview}>
          <div className="router-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="router-preview-header">
              <h3>⚡ Route Decision</h3>
              <span className="router-preview-badge">Instant (No API)</span>
            </div>
            <div className="router-preview-body">
              <div className="router-preview-prompt">
                <strong>Your prompt:</strong>
                <p>"{pendingRouterCall.userPrompt}"</p>
              </div>

              {/* Routing Decision - the main info */}
              <div className="router-decision-box">
                <div className="decision-row">
                  <span className="decision-label">Action:</span>
                  <span className="decision-value action-badge">{routePreview.action}</span>
                </div>
                <div className="decision-row">
                  <span className="decision-label">Understanding:</span>
                  <span className="decision-value">{routePreview.understanding}</span>
                </div>
                {routePreview.templateMatch ? (
                  <div className="decision-row template-row">
                    <span className="decision-label">Template:</span>
                    <span className="decision-value template-match">
                      {matchedTemplate?.title || routePreview.templateMatch.templateId}
                      <span className="match-keyword">matched "{routePreview.templateMatch.keyword}"</span>
                    </span>
                  </div>
                ) : (
                  <div className="decision-row template-row">
                    <span className="decision-label">Template:</span>
                    <span className="decision-value freestyle-badge">Freestyle (auto-layout)</span>
                  </div>
                )}
                <div className="decision-row">
                  <span className="decision-label">Context:</span>
                  <span className="decision-value context-type">{routePreview.contextNeeded.type}</span>
                  {routePreview.contextNeeded.reason && (
                    <span className="context-reason">— {routePreview.contextNeeded.reason}</span>
                  )}
                </div>
              </div>

              {/* Deck state summary */}
              <div className="router-preview-context">
                <strong>Deck state:</strong>
                <div className="context-grid">
                  <div className="context-item">
                    <span className="label">Slides:</span>
                    <span className="value">{pendingRouterCall.context.slideCount}</span>
                  </div>
                  <div className="context-item">
                    <span className="label">Current:</span>
                    <span className="value">
                      {pendingRouterCall.context.currentSlideIndex >= 0
                        ? `#${pendingRouterCall.context.currentSlideIndex + 1}`
                        : 'none'}
                    </span>
                  </div>
                  <div className="context-item">
                    <span className="label">Skeletons:</span>
                    <span className="value">{pendingRouterCall.context.hasSkeletons ? 'pending' : 'none'}</span>
                  </div>
                </div>
                {pendingRouterCall.context.layoutSummary && (
                  <div className="context-section">
                    <span className="label">Layouts used:</span>
                    <div className="layout-chips">
                      {pendingRouterCall.context.layoutSummary.split(', ').map((item, i) => (
                        <span key={i} className="chip">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="router-preview-footer">
              <button className="btn-cancel" onClick={cancelRouterPreview}>Cancel</button>
              <button className="btn-proceed" onClick={confirmRouterCall}>Execute →</button>
            </div>
          </div>
          <style>{`
            .router-preview-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.6);
              backdrop-filter: blur(4px);
              z-index: 10002;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .router-preview-modal {
              background: white;
              border-radius: 12px;
              width: 100%;
              max-width: 600px;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              overflow: hidden;
            }
            .router-preview-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px 20px;
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-bottom: 2px solid #f59e0b;
            }
            .router-preview-header h3 {
              margin: 0;
              font-size: 16px;
              font-weight: 600;
              color: #92400e;
            }
            .router-preview-badge {
              font-size: 11px;
              font-weight: 600;
              color: white;
              background: #f59e0b;
              padding: 4px 10px;
              border-radius: 12px;
              text-transform: uppercase;
            }
            .router-preview-body {
              padding: 20px;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .router-preview-prompt {
              background: #f8fafc;
              padding: 12px;
              border-radius: 8px;
              border-left: 3px solid #6366f1;
            }
            .router-preview-prompt strong {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
            }
            .router-preview-prompt p {
              margin: 8px 0 0 0;
              font-size: 14px;
              color: #1e293b;
              font-style: italic;
            }
            .router-preview-context {
              background: #f0fdf4;
              padding: 16px;
              border-radius: 8px;
              border: 1px solid #86efac;
            }
            .router-preview-context strong {
              font-size: 12px;
              color: #166534;
              text-transform: uppercase;
              display: block;
              margin-bottom: 12px;
            }
            .context-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 12px;
            }
            .context-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .context-item .label {
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
            }
            .context-item .value {
              font-size: 13px;
              color: #1e293b;
              font-family: 'Monaco', 'Menlo', monospace;
            }
            .context-section {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px dashed #86efac;
            }
            .context-section .label {
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              display: block;
              margin-bottom: 8px;
            }
            .layout-chips {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
            }
            .layout-chips .chip {
              background: #dbeafe;
              color: #1e40af;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;
            }
            .storyline {
              font-size: 13px;
              color: #6366f1;
              font-style: italic;
            }
            .router-preview-footer {
              display: flex;
              justify-content: flex-end;
              gap: 12px;
              padding: 16px 20px;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
            }
            .btn-cancel {
              padding: 10px 20px;
              background: transparent;
              border: 1px solid #e2e8f0;
              color: #64748b;
              border-radius: 8px;
              font-size: 14px;
              cursor: pointer;
            }
            .btn-cancel:hover {
              background: #f1f5f9;
              color: #1e293b;
            }
            .btn-proceed {
              padding: 10px 24px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            }
            .btn-proceed:hover {
              background: linear-gradient(135deg, #059669 0%, #047857 100%);
            }
            /* Decision box styles */
            .router-decision-box {
              background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
              border: 2px solid #8b5cf6;
              border-radius: 10px;
              padding: 16px;
              margin-bottom: 16px;
            }
            .decision-row {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 10px;
            }
            .decision-row:last-child {
              margin-bottom: 0;
            }
            .decision-label {
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              min-width: 90px;
            }
            .decision-value {
              font-size: 14px;
              color: #1e293b;
            }
            .action-badge {
              background: #6366f1;
              color: white;
              padding: 4px 12px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 13px;
            }
            .template-match {
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 600;
              color: #059669;
            }
            .match-keyword {
              font-size: 11px;
              color: #6b7280;
              font-weight: 400;
              font-style: italic;
            }
            .freestyle-badge {
              background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
              color: white;
              padding: 4px 12px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 13px;
            }
            .context-type {
              background: #e0f2fe;
              color: #0369a1;
              padding: 2px 8px;
              border-radius: 4px;
              font-family: 'Monaco', 'Menlo', monospace;
              font-size: 12px;
            }
            .context-reason {
              font-size: 12px;
              color: #6b7280;
              font-style: italic;
            }
          `}</style>
        </div>
        );
      })()}

      {/* Agent Approval Dialog - shows context preview before execution */}
      <AgentApprovalDialog
        isOpen={showApprovalDialog}
        onApprove={executeApprovedAgentPlan}
        onCancel={cancelApproval}
        plan={pendingAgentExecution?.plan}
        slides={state.slides}
        storyline={state.storyline}
        templates={templatesForAI}
        userPrompt={pendingAgentExecution?.userPrompt || ''}
        defaultContextLevel={pendingAgentExecution?.plan?.suggestedContextLevel || 'full'}
        settings={state.settings}
        templateSelection={pendingAgentExecution?.templateSelection}
        routerContext={pendingAgentExecution?.context}
      />

      <FlowStudio
        isOpen={showFlowStudio}
        onClose={() => setShowFlowStudio(false)}
        onSelectFlow={handleFlowSelect}
      />

      {/* Knowledge Base Manager - renders as portal outside chatbot */}
      <KnowledgeBaseManager
        isOpen={showKnowledgeBase}
        onClose={() => setShowKnowledgeBase(false)}
      />
    </div>
  );
}
