import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSlides } from '../context/SlideContext';
import { chatWithContext, generateStoryline, generateSlides, selectTemplateWithAI, populateSlides, generateSkeletonSlides, syncStorylineFromSlidesAI, syncSlidesFromStorylineAI } from '../services/aiService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { getVibePromptContext } from '../utils/vibes';

// Point type configuration - colors and labels for visual indicators
const POINT_TYPE_CONFIG = {
  'cover': { label: 'Cover', color: '#6366f1', bgColor: '#eef2ff', icon: '📄' },
  'executive-summary': { label: 'Summary', color: '#8b5cf6', bgColor: '#f5f3ff', icon: '⭐' },
  'context': { label: 'Context', color: '#06b6d4', bgColor: '#ecfeff', icon: '📊' },
  'approach': { label: 'Approach', color: '#f59e0b', bgColor: '#fffbeb', icon: '🎯' },
  'approach-step': { label: 'Step', color: '#f97316', bgColor: '#fff7ed', icon: '→' },
  'insight': { label: 'Insight', color: '#10b981', bgColor: '#ecfdf5', icon: '💡' },
  'recommendation': { label: 'Rec', color: '#ef4444', bgColor: '#fef2f2', icon: '✓' },
  'case-study': { label: 'Case', color: '#ec4899', bgColor: '#fdf2f8', icon: '📋' },
  'comparison': { label: 'Compare', color: '#14b8a6', bgColor: '#f0fdfa', icon: '⚖️' },
  'timeline': { label: 'Timeline', color: '#3b82f6', bgColor: '#eff6ff', icon: '📅' },
  'conclusion': { label: 'Conclusion', color: '#84cc16', bgColor: '#f7fee7', icon: '🏁' },
  'appendix': { label: 'Appendix', color: '#6b7280', bgColor: '#f9fafb', icon: '📎' },
};

// Full-screen Storyline Workspace - Dedicated modal rendered via Portal (outside chatbot)
export default function StorylineWorkspace({ isOpen, onClose }) {
  const { state, actions } = useSlides();
  const [editingId, setEditingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [viewMode, setViewMode] = useState('detailed'); // 'compact' | 'detailed'
  const [selectedIds, setSelectedIds] = useState(new Set()); // Multi-select
  const [meceResult, setMeceResult] = useState(null); // { status: 'good'|'warning'|'error', issues: [], suggestions: [] }
  const [pendingSuggestions, setPendingSuggestions] = useState([]); // Suggestions to accept/reject
  const [slideGenMode, setSlideGenMode] = useState('auto'); // 'auto' (AI selects best), 'freestyle', or specific templateId
  const [showCreateDialog, setShowCreateDialog] = useState(false); // Show create storyline dialog
  const [deleteExistingSlides, setDeleteExistingSlides] = useState(false); // Delete slides when creating new storyline
  const [populatingSlides, setPopulatingSlides] = useState(false); // Loading state for populate slides
  const [generatingSkeletons, setGeneratingSkeletons] = useState(false); // Loading state for skeleton generation
  const [showSyncMenu, setShowSyncMenu] = useState(false); // Sync menu dropdown
  const [syncing, setSyncing] = useState(false); // Sync loading state
  const [syncResult, setSyncResult] = useState(null); // Sync result for preview
  const draggedRef = useRef(null);

  // AI-powered sync between storyline and slides
  const handleSync = async (direction) => {
    setShowSyncMenu(false);
    setSyncing(true);
    setSyncResult(null);

    try {
      if (direction === 'from-slides') {
        // Full AI analysis of slides to generate storyline
        if (state.slides.length === 0) {
          alert('No slides to sync from.');
          return;
        }
        const newStoryline = await syncStorylineFromSlidesAI(state.slides, state.settings);
        if (newStoryline && newStoryline.length > 0) {
          // Show preview and confirm
          const confirm = window.confirm(
            `AI generated a storyline with ${newStoryline.length} points. Apply this storyline?\n\n` +
            newStoryline.map((p, i) => `${i + 1}. ${p.title}`).join('\n')
          );
          if (confirm) {
            actions.setStoryline(newStoryline);
          }
        } else {
          alert('Could not generate storyline from slides.');
        }
      } else if (direction === 'from-storyline') {
        // AI analyzes storyline vs slides and returns sync actions
        if (storyline.length === 0) {
          alert('No storyline to sync from.');
          return;
        }
        const syncPlan = await syncSlidesFromStorylineAI(storyline, state.slides, state.settings);
        setSyncResult(syncPlan);
        // Don't auto-apply - show preview first
      }
    } catch (error) {
      alert('Sync failed: ' + error.message);
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Apply sync actions from storyline -> slides
  const applySyncActions = async (syncPlan) => {
    try {
      // 1. Apply reorder actions
      if (syncPlan.reorder && syncPlan.reorder.length > 0) {
        // Sort by new index to apply in correct order
        const sortedReorders = [...syncPlan.reorder].sort((a, b) => a.newIndex - b.newIndex);
        for (const reorder of sortedReorders) {
          const currentIndex = state.slides.findIndex(s => s.id === reorder.slideId);
          if (currentIndex !== -1 && currentIndex !== reorder.newIndex) {
            actions.reorderSlides(currentIndex, reorder.newIndex);
          }
        }
      }

      // 2. Create skeleton slides for missing storyline points
      if (syncPlan.skeletons && syncPlan.skeletons.length > 0) {
        for (const skeleton of syncPlan.skeletons) {
          const storyPoint = storyline.find(p => p.id === skeleton.storyPointId);
          if (storyPoint) {
            // Find template
            const template = availableTemplates.find(t => t.id === skeleton.suggestedLayout) || availableTemplates[0];

            // Find insert position
            let insertPosition = 0;
            if (skeleton.insertAfterSlideId) {
              const afterIdx = state.slides.findIndex(s => s.id === skeleton.insertAfterSlideId);
              if (afterIdx !== -1) insertPosition = afterIdx + 1;
            }

            // Create skeleton slide
            actions.insertSlideAt(insertPosition, {
              title: skeleton.title || storyPoint.title,
              type: template?.id || 'content-list',
              templateId: template?.id,
              html: template?.html || '<div class="slide"><div class="frame"><p>Skeleton slide</p></div></div>',
              isSkeleton: true,
              storyPointId: skeleton.storyPointId,
            });
          }
        }
      }

      // 3. Apply hierarchy fixes
      if (syncPlan.hierarchyFixes && syncPlan.hierarchyFixes.length > 0) {
        for (const fix of syncPlan.hierarchyFixes) {
          actions.setSlideParent(fix.slideId, fix.newParentId);
        }
      }

      // 4. Add comments to slides
      if (syncPlan.comments && syncPlan.comments.length > 0) {
        for (const comment of syncPlan.comments) {
          actions.addComment(comment.slideId, `[Sync] ${comment.comment}`);
        }
      }

      setSyncResult(null);
      alert('Sync applied successfully!');
    } catch (error) {
      alert('Failed to apply sync: ' + error.message);
      console.error('Apply sync error:', error);
    }
  };

  // Get available templates (built-in + custom)
  const availableTemplates = [
    ...Object.values(SLIDE_TEMPLATES).filter(t => !state.deletedSystemTemplates?.includes(t.id)),
    ...(state.customTemplates || []),
  ];

  const storyline = state.storyline || [];

  // Build hierarchical structure from flat storyline
  const buildTree = (points) => {
    const rootPoints = points.filter(p => !p.parentId);
    const getChildren = (parentId) => points.filter(p => p.parentId === parentId);

    const buildNode = (point) => ({
      ...point,
      children: getChildren(point.id).map(buildNode),
    });

    return rootPoints.map(buildNode);
  };

  const tree = buildTree(storyline);

  // Calculate depths for visual hierarchy
  const getDepth = (pointId, points = storyline) => {
    const point = points.find(p => p.id === pointId);
    if (!point || !point.parentId) return 0;
    return 1 + getDepth(point.parentId, points);
  };

  if (!isOpen) return null;

  // Toggle expand/collapse
  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Expand all / Collapse all
  const expandAll = () => {
    const allIds = new Set(storyline.map(p => p.id));
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Multi-select handlers
  const toggleSelect = (id, e) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(storyline.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Drag and drop handlers
  const handleDragStart = (e, point) => {
    setDraggedId(point.id);
    draggedRef.current = point;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', point.id);
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e, targetId, position = 'after') => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newStoryline = [...storyline];
    const draggedIndex = newStoryline.findIndex(p => p.id === draggedId);
    const targetIndex = newStoryline.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item
    const [draggedItem] = newStoryline.splice(draggedIndex, 1);

    // Calculate new position
    let insertIndex = targetIndex;
    if (position === 'after') {
      insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
    } else if (position === 'child') {
      // Make it a child of the target
      draggedItem.parentId = targetId;
      insertIndex = targetIndex + 1;
    }

    newStoryline.splice(insertIndex, 0, draggedItem);

    // Update order values
    actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Point operations
  const handleAddPoint = (parentId = null, afterId = null) => {
    // If adding after a point, inherit its parentId to stay at same level
    let effectiveParentId = parentId;
    if (afterId && parentId === null) {
      const afterPoint = storyline.find(p => p.id === afterId);
      if (afterPoint) {
        effectiveParentId = afterPoint.parentId || null;
      }
    }

    const newPoint = {
      id: `sp-${Date.now()}`,
      title: '',
      description: '',
      keyMessage: '',
      templateId: null,
      parentId: effectiveParentId,
      order: storyline.length,
    };

    let newStoryline;
    if (afterId) {
      // Insert right after the specified point
      const afterIndex = storyline.findIndex(p => p.id === afterId);
      newStoryline = [
        ...storyline.slice(0, afterIndex + 1),
        newPoint,
        ...storyline.slice(afterIndex + 1),
      ];
    } else if (parentId) {
      // Adding a child - insert right after the parent (and any existing children)
      const parentIndex = storyline.findIndex(p => p.id === parentId);
      if (parentIndex !== -1) {
        // Find all descendants of this parent to insert after them
        const findDescendantCount = (pid) => {
          let count = 0;
          for (const p of storyline) {
            if (p.parentId === pid) {
              count += 1 + findDescendantCount(p.id);
            }
          }
          return count;
        };
        const insertAt = parentIndex + 1 + findDescendantCount(parentId);
        newStoryline = [
          ...storyline.slice(0, insertAt),
          newPoint,
          ...storyline.slice(insertAt),
        ];
      } else {
        newStoryline = [...storyline, newPoint];
      }
    } else {
      // Adding to root - add at end
      newStoryline = [...storyline, newPoint];
    }

    actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
    setEditingId(newPoint.id);

    if (parentId) {
      setExpandedIds(prev => new Set([...prev, parentId]));
    }
  };

  // Use the dedicated action for single point updates (preserves all fields)
  const handleUpdatePoint = (id, updates) => {
    actions.updateStorylinePoint(id, updates);
  };

  const handleDeletePoint = (id) => {
    // Also delete all children
    const idsToDelete = new Set([id]);
    const findChildren = (parentId) => {
      storyline.forEach(p => {
        if (p.parentId === parentId) {
          idsToDelete.add(p.id);
          findChildren(p.id);
        }
      });
    };
    findChildren(id);

    const newStoryline = storyline.filter(p => !idsToDelete.has(p.id));
    actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      idsToDelete.forEach(delId => newSet.delete(delId));
      return newSet;
    });
  };

  const handleIndent = (id) => {
    // Make this point a child of the previous sibling
    const point = storyline.find(p => p.id === id);
    if (!point) return;

    // Get siblings at same level, sorted by order
    const siblings = storyline
      .filter(p => (p.parentId || null) === (point.parentId || null))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const myIndex = siblings.findIndex(p => p.id === id);

    if (myIndex > 0) {
      const newParentId = siblings[myIndex - 1].id;
      console.log('Indenting', id, 'under', newParentId);
      handleUpdatePoint(id, { parentId: newParentId });
      setExpandedIds(prev => new Set([...prev, newParentId]));
    } else {
      console.log('Cannot indent - no previous sibling');
    }
  };

  const handleOutdent = (id) => {
    // Move this point up one level
    const point = storyline.find(p => p.id === id);
    if (!point || !point.parentId) {
      console.log('Cannot outdent - already at root level');
      return;
    }

    const parent = storyline.find(p => p.id === point.parentId);
    console.log('Outdenting', id, 'from', point.parentId, 'to', parent?.parentId || null);
    handleUpdatePoint(id, { parentId: parent?.parentId || null });
  };

  // ========== NEW: Merge selected points ==========
  const handleMergeSelected = async () => {
    if (selectedIds.size < 2) return;

    const selectedPoints = storyline.filter(p => selectedIds.has(p.id));
    const mergedTitle = selectedPoints.map(p => p.title).join(' + ');
    const mergedDescription = selectedPoints.map(p => p.description).filter(Boolean).join('\n\n');
    const mergedKeyMessage = selectedPoints.map(p => p.keyMessage).filter(Boolean).join('; ');

    // Use AI to create a better merged version
    setAiLoading(true);
    try {
      const response = await chatWithContext(
        `Merge these storyline points into one cohesive point:\n${selectedPoints.map((p, i) => `${i + 1}. "${p.title}": ${p.description || 'No description'}`).join('\n')}\n\nProvide JSON: { "title": "merged title", "description": "merged description", "keyMessage": "merged key message" }`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      let mergedPoint = {
        id: `sp-${Date.now()}`,
        title: mergedTitle,
        description: mergedDescription,
        keyMessage: mergedKeyMessage,
        templateId: selectedPoints[0].templateId,
        parentId: selectedPoints[0].parentId,
        order: selectedPoints[0].order,
      };

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        mergedPoint.title = parsed.title || mergedPoint.title;
        mergedPoint.description = parsed.description || mergedPoint.description;
        mergedPoint.keyMessage = parsed.keyMessage || mergedPoint.keyMessage;
      }

      // Remove selected points and add merged one
      const firstIndex = storyline.findIndex(p => selectedIds.has(p.id));
      const newStoryline = storyline.filter(p => !selectedIds.has(p.id));
      newStoryline.splice(firstIndex, 0, mergedPoint);

      actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
      setSelectedIds(new Set([mergedPoint.id]));
    } catch (err) {
      console.error('Merge error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ========== NEW: Split point into sub-items ==========
  const handleSplit = async (id, count = 2) => {
    const point = storyline.find(p => p.id === id);
    if (!point) return;

    setAiLoading(true);
    try {
      const response = await chatWithContext(
        `Split this storyline point into ${count} distinct sub-points:\nTitle: "${point.title}"\nDescription: ${point.description || 'No description'}\n\nProvide JSON array: [{ "title": "...", "description": "...", "keyMessage": "..." }, ...]`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const newPoints = parsed.slice(0, count).map((item, i) => ({
          id: `sp-${Date.now()}-${i}`,
          title: item.title || `${point.title} (Part ${i + 1})`,
          description: item.description || '',
          keyMessage: item.keyMessage || '',
          templateId: null,
          parentId: point.id, // Make them children of the original
          order: point.order + i + 1,
        }));

        // Add new points after the original
        const pointIndex = storyline.findIndex(p => p.id === id);
        const newStoryline = [
          ...storyline.slice(0, pointIndex + 1),
          ...newPoints,
          ...storyline.slice(pointIndex + 1),
        ];

        actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
        setExpandedIds(prev => new Set([...prev, id]));
      }
    } catch (err) {
      console.error('Split error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ========== NEW: Add depth (sub-items) to selected ==========
  const handleAddDepth = async () => {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : storyline.filter(p => !p.parentId).map(p => p.id);
    if (targetIds.length === 0) return;

    setAiLoading(true);
    try {
      for (const id of targetIds) {
        const point = storyline.find(p => p.id === id);
        if (!point) continue;

        const response = await chatWithContext(
          `Add 2-3 detailed sub-points for this storyline item:\nTitle: "${point.title}"\nDescription: ${point.description || 'No description'}\n\nProvide JSON array: [{ "title": "...", "description": "...", "keyMessage": "..." }, ...]`,
          { allSlides: state.slides, totalSlides: state.slides.length },
          state.settings
        );

        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const newSubPoints = parsed.slice(0, 3).map((item, i) => ({
            id: `sp-${Date.now()}-${id}-${i}`,
            title: item.title || '',
            description: item.description || '',
            keyMessage: item.keyMessage || '',
            templateId: null,
            parentId: id,
            order: 0, // Will be recalculated
          }));

          // Insert sub-points right after their parent
          const currentStoryline = state.storyline || [];
          const parentIndex = currentStoryline.findIndex(p => p.id === id);
          const newStoryline = [
            ...currentStoryline.slice(0, parentIndex + 1),
            ...newSubPoints,
            ...currentStoryline.slice(parentIndex + 1),
          ];
          actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
          setExpandedIds(prev => new Set([...prev, id]));
        }
      }
    } catch (err) {
      console.error('Add depth error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ========== NEW: Expand/Shrink content guidance ==========
  const handleExpandContent = async () => {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : storyline.map(p => p.id);
    if (targetIds.length === 0) return;

    setAiLoading(true);
    try {
      const response = await chatWithContext(
        `Expand the description and key message for these storyline items. Make them more detailed with specific examples, data points, or elaboration:\n${targetIds.map(id => {
          const p = storyline.find(pt => pt.id === id);
          return p ? `- "${p.title}": ${p.description || 'No description'}` : '';
        }).filter(Boolean).join('\n')}\n\nProvide JSON array with same structure: [{ "id": "original-id", "description": "expanded description", "keyMessage": "expanded key message" }]`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const updatesMap = new Map(parsed.map((item, i) => [targetIds[i], item]));

        const newStoryline = storyline.map(p => {
          if (updatesMap.has(p.id)) {
            const update = updatesMap.get(p.id);
            return {
              ...p,
              description: update.description || p.description,
              keyMessage: update.keyMessage || p.keyMessage,
            };
          }
          return p;
        });
        actions.setStoryline(newStoryline);
      }
    } catch (err) {
      console.error('Expand content error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleShrinkContent = async () => {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : storyline.map(p => p.id);
    if (targetIds.length === 0) return;

    setAiLoading(true);
    try {
      const response = await chatWithContext(
        `Make these storyline items more concise. Shorten descriptions to key points only:\n${targetIds.map(id => {
          const p = storyline.find(pt => pt.id === id);
          return p ? `- "${p.title}": ${p.description || 'No description'}` : '';
        }).filter(Boolean).join('\n')}\n\nProvide JSON array: [{ "id": "original-id", "description": "concise description", "keyMessage": "short key message" }]`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const updatesMap = new Map(parsed.map((item, i) => [targetIds[i], item]));

        const newStoryline = storyline.map(p => {
          if (updatesMap.has(p.id)) {
            const update = updatesMap.get(p.id);
            return {
              ...p,
              description: update.description || p.description,
              keyMessage: update.keyMessage || p.keyMessage,
            };
          }
          return p;
        });
        actions.setStoryline(newStoryline);
      }
    } catch (err) {
      console.error('Shrink content error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ========== NEW: MECE Check with visual feedback ==========
  const handleMeceCheck = async () => {
    if (storyline.length === 0) return;

    setAiLoading(true);
    setMeceResult(null);
    setPendingSuggestions([]);

    try {
      const storylineText = storyline.map((p, i) => {
        const depth = getDepth(p.id);
        const indent = '  '.repeat(depth);
        return `${indent}${i + 1}. ${p.title}${p.description ? ` - ${p.description}` : ''}`;
      }).join('\n');

      const response = await chatWithContext(
        `Analyze this storyline for MECE (Mutually Exclusive, Collectively Exhaustive) principles.

Storyline:
${storylineText}

Provide JSON response:
{
  "status": "good" | "warning" | "error",
  "overallScore": 1-10,
  "meAnalysis": {
    "score": 1-10,
    "overlaps": ["list of overlapping items if any"],
    "explanation": "brief explanation"
  },
  "ceAnalysis": {
    "score": 1-10,
    "gaps": ["list of missing topics if any"],
    "explanation": "brief explanation"
  },
  "suggestions": [
    { "type": "merge" | "split" | "add" | "remove" | "reorder", "targetIds": ["sp-xxx"], "description": "what to do", "newContent": { "title": "...", "description": "..." } }
  ]
}`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setMeceResult({
          status: parsed.status || 'warning',
          overallScore: parsed.overallScore || 5,
          meAnalysis: parsed.meAnalysis || { score: 5, overlaps: [], explanation: '' },
          ceAnalysis: parsed.ceAnalysis || { score: 5, gaps: [], explanation: '' },
        });
        setPendingSuggestions(parsed.suggestions || []);
      }
    } catch (err) {
      console.error('MECE check error:', err);
      setMeceResult({ status: 'error', overallScore: 0, meAnalysis: { score: 0, overlaps: [], explanation: 'Error analyzing' }, ceAnalysis: { score: 0, gaps: [], explanation: '' } });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion, index) => {
    setAiLoading(true);
    try {
      if (suggestion.type === 'add' && suggestion.newContent) {
        const newPoint = {
          id: `sp-${Date.now()}`,
          title: suggestion.newContent.title || 'New Point',
          description: suggestion.newContent.description || '',
          keyMessage: suggestion.newContent.keyMessage || '',
          templateId: null,
          parentId: null,
          order: storyline.length,
        };
        actions.setStoryline([...storyline, newPoint].map((p, i) => ({ ...p, order: i })));
      } else if (suggestion.type === 'remove' && suggestion.targetIds?.length > 0) {
        const newStoryline = storyline.filter(p => !suggestion.targetIds.includes(p.id));
        actions.setStoryline(newStoryline.map((p, i) => ({ ...p, order: i })));
      } else if (suggestion.type === 'merge' && suggestion.targetIds?.length > 1) {
        setSelectedIds(new Set(suggestion.targetIds));
        await handleMergeSelected();
      } else if (suggestion.type === 'split' && suggestion.targetIds?.length === 1) {
        await handleSplit(suggestion.targetIds[0], 2);
      }

      // Remove accepted suggestion
      setPendingSuggestions(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Accept suggestion error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRejectSuggestion = (index) => {
    setPendingSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  // ========== NEW: Generate slides from story point ==========
  const handleGenerateSlides = async (pointId) => {
    const point = storyline.find(p => p.id === pointId);
    if (!point) return;

    setAiLoading(true);
    try {
      const prompt = `${point.title}${point.description ? `. ${point.description}` : ''}${point.keyMessage ? `. Key message: ${point.keyMessage}` : ''}`;

      // Determine which template to use based on slideGenMode
      let templateId = point.templateId; // Point-specific template takes precedence
      let selectedTemplate = null;

      if (!templateId) {
        if (slideGenMode === 'auto') {
          // AI selects best template
          const selected = await selectTemplateWithAI(prompt, availableTemplates, state.settings);
          if (selected) {
            templateId = selected.id;
            selectedTemplate = selected;
          }
        } else if (slideGenMode !== 'freestyle') {
          // Use specific template selected by user
          templateId = slideGenMode;
          selectedTemplate = availableTemplates.find(t => t.id === slideGenMode);
        }
        // If 'freestyle', templateId remains null and AI creates without template
      }

      // Get vibe context for AI
      const vibeHint = getVibePromptContext(state.vibe);
      const promptWithVibe = vibeHint ? `${prompt}\n\n[Design Style: ${vibeHint}]` : prompt;

      // Generate slide with template if available
      const slides = await generateSlides(promptWithVibe, state.settings, 1, state.slides, templateId, selectedTemplate);

      if (slides.length > 0) {
        actions.addSlide({
          title: slides[0].title || point.title,
          html: slides[0].html,
          type: templateId || slides[0].type,
          templateId: templateId,
          summary: point.description,
          storyPointId: pointId,
        });
      }
    } catch (err) {
      console.error('Generate slides error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateSlidesForSelected = async () => {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : [];
    if (targetIds.length === 0) return;

    setAiLoading(true);
    try {
      for (const id of targetIds) {
        await handleGenerateSlides(id);
      }
    } catch (err) {
      console.error('Generate slides error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI operations
  const handleAiRefine = async () => {
    if (!aiPrompt.trim() || aiLoading) return;

    setAiLoading(true);
    try {
      const storylineContext = storyline.map((p, i) =>
        `${i + 1}. ${p.title}${p.description ? ` - ${p.description}` : ''}`
      ).join('\n');

      const response = await chatWithContext(
        `Current storyline:\n${storylineContext}\n\nUser request: ${aiPrompt}\n\nProvide the updated storyline as a JSON array with objects containing: title, description, keyMessage. Only output valid JSON.`,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      // Try to parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const newStoryline = parsed.map((item, i) => ({
          id: `sp-${Date.now()}-${i}`,
          title: item.title || '',
          description: item.description || '',
          keyMessage: item.keyMessage || '',
          templateId: null,
          parentId: null,
          order: i,
        }));
        actions.setStoryline(newStoryline);
      }
      setAiPrompt('');
    } catch (err) {
      console.error('AI refine error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Show confirmation dialog if slides exist
  const handleCreateStorylineClick = () => {
    if (!aiPrompt.trim() || aiLoading) return;
    if (state.slides.length > 0) {
      setShowCreateDialog(true);
    } else {
      handleGenerateFromScratch(false);
    }
  };

  const handleGenerateFromScratch = async (shouldDeleteSlides = false) => {
    if (!aiPrompt.trim() || aiLoading) return;
    setShowCreateDialog(false);

    setAiLoading(true);
    try {
      // Delete existing slides if requested
      if (shouldDeleteSlides && state.slides.length > 0) {
        state.slides.forEach(slide => actions.deleteSlide(slide.id));
      }

      const newStoryline = await generateStoryline(aiPrompt, state.settings, { slideCount: 5 });
      actions.setStoryline(newStoryline);
      setAiPrompt('');
      // Expand all to show hierarchy
      setExpandedIds(new Set(newStoryline.map(p => p.id)));
    } catch (err) {
      console.error('Generate storyline error:', err);
    } finally {
      setAiLoading(false);
      setDeleteExistingSlides(false);
    }
  };

  // Generate skeleton slides from storyline - creates structure placeholders
  const handleGenerateSkeletons = async () => {
    if (storyline.length === 0 || generatingSkeletons) return;

    setGeneratingSkeletons(true);
    try {
      const skeletonSlides = await generateSkeletonSlides(
        storyline,
        availableTemplates,
        state.settings
      );

      // Add skeleton slides
      for (const skeleton of skeletonSlides) {
        actions.addSlide({
          title: skeleton.title,
          html: skeleton.html,
          type: skeleton.templateId || 'custom',
          templateId: skeleton.templateId,
          storyPointId: skeleton.storyPointId,
          isSkeleton: true,
        });
      }
    } catch (err) {
      console.error('Generate skeletons error:', err);
    } finally {
      setGeneratingSkeletons(false);
    }
  };

  // Populate slides from storyline - fills with actual content
  const handlePopulateSlides = async () => {
    if (storyline.length === 0 || populatingSlides) return;

    setPopulatingSlides(true);
    try {
      const batchSize = state.settings.agentBatchSize || 3;

      const results = await populateSlides(
        storyline,
        state.slides,
        availableTemplates,
        state.settings,
        { batchSize }
      );

      // Update existing slides or add new ones
      for (const result of results) {
        if (result.existingSlideId) {
          // Update existing slide with filled content
          actions.updateSlide(result.existingSlideId, {
            html: result.html,
            isSkeleton: false,
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
          });
        }
      }
    } catch (err) {
      console.error('Populate slides error:', err);
    } finally {
      setPopulatingSlides(false);
    }
  };

  // Render a story point (recursive for tree)
  const renderPoint = (point, depth = 0, isLast = false, parentLines = []) => {
    const isEditing = editingId === point.id;
    const isExpanded = expandedIds.has(point.id);
    const hasChildren = point.children && point.children.length > 0;
    const slide = state.slides.find(s => s.storyPointId === point.id);
    const isDragOver = dragOverId === point.id;
    const isDragging = draggedId === point.id;
    const isSelected = selectedIds.has(point.id);

    return (
      <div key={point.id} className="story-point-wrapper">
        <div
          className={`story-point ${isDragOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''} ${slide ? 'has-slide' : ''} ${isSelected ? 'selected' : ''} ${viewMode}`}
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, point)}
          onDragOver={(e) => handleDragOver(e, point.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, point.id)}
          onDragEnd={handleDragEnd}
        >
          {/* Visual hierarchy lines */}
          <div className="hierarchy-lines" style={{ width: depth * 24 }}>
            {parentLines.map((showLine, i) => (
              <span key={i} className={`hierarchy-line ${showLine ? 'active' : ''}`} />
            ))}
            {depth > 0 && (
              <span className={`hierarchy-connector ${isLast ? 'last' : ''}`} />
            )}
          </div>

          {/* Selection checkbox */}
          <label className="story-point-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelect(point.id, e)}
            />
          </label>

          {/* Expand/collapse toggle */}
          <button
            className={`story-point-toggle ${hasChildren ? 'has-children' : ''}`}
            onClick={() => hasChildren && toggleExpand(point.id)}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </button>

          {/* Point type badge with color */}
          {(() => {
            const typeConfig = POINT_TYPE_CONFIG[point.pointType] || POINT_TYPE_CONFIG['insight'];
            return (
              <div
                className="story-point-type-badge"
                style={{
                  backgroundColor: typeConfig.bgColor,
                  color: typeConfig.color,
                  borderColor: typeConfig.color,
                }}
                title={typeConfig.label}
              >
                <span className="type-icon">{typeConfig.icon}</span>
                <span className="type-label">{typeConfig.label}</span>
              </div>
            );
          })()}

          {/* Point number */}
          <div className="story-point-number">{point.order + 1}</div>

          {/* Content area */}
          <div className="story-point-content">
            {isEditing ? (
              <div className="story-point-form">
                <input
                  type="text"
                  className="story-point-title-input"
                  value={point.title}
                  onChange={(e) => handleUpdatePoint(point.id, { title: e.target.value })}
                  placeholder="Slide title..."
                  autoFocus
                />
                <textarea
                  className="story-point-desc-input"
                  value={point.description || ''}
                  onChange={(e) => handleUpdatePoint(point.id, { description: e.target.value })}
                  placeholder="Description - what should this slide cover in detail..."
                  rows={3}
                />
                <input
                  type="text"
                  className="story-point-key-input"
                  value={point.keyMessage || ''}
                  onChange={(e) => handleUpdatePoint(point.id, { keyMessage: e.target.value })}
                  placeholder="Key message / takeaway..."
                />
                <div className="story-point-template">
                  <label>Template override:</label>
                  <select
                    className="story-point-template-select"
                    value={point.templateId || ''}
                    onChange={(e) => handleUpdatePoint(point.id, { templateId: e.target.value || null })}
                  >
                    <option value="">📋 Use default ({slideGenMode === 'auto' ? 'Auto' : 'Freestyle'})</option>
                    <optgroup label="Specific Templates">
                      {availableTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="story-point-form-actions">
                  <button className="btn-primary" onClick={() => setEditingId(null)}>Done</button>
                </div>
              </div>
            ) : (
              <div className="story-point-view" onClick={() => setEditingId(point.id)}>
                <div className="story-point-header">
                  <span className="story-point-title">{point.title || 'Untitled'}</span>
                  {point.templateId && (
                    <span className="story-point-template-badge">{point.templateId}</span>
                  )}
                  {slide && (
                    <span className={`story-point-status ${slide.isSkeleton ? 'skeleton' : 'complete'}`}>
                      {slide.isSkeleton ? '🦴' : '✓'}
                    </span>
                  )}
                </div>
                {viewMode === 'detailed' && (
                  <>
                    {point.description && (
                      <p className="story-point-description">{point.description}</p>
                    )}
                    {point.keyMessage && (
                      <p className="story-point-key">💡 {point.keyMessage}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="story-point-actions">
              <button onClick={() => handleGenerateSlides(point.id)} title="Generate slide from this point">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </button>
              <button onClick={() => handleIndent(point.id)} title="Make child of previous (indent right)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
              <button onClick={() => handleOutdent(point.id)} title="Move up one level (outdent left)" disabled={!point.parentId}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
              <button onClick={() => handleAddPoint(null, point.id)} title="Add sibling point after this">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button onClick={() => handleAddPoint(point.id)} title="Add child point under this">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                  <path d="M9 18l3 3 3-3" />
                </svg>
              </button>
              <div className="story-point-split-menu">
                <button title="Split this point into multiple">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <path d="M4.93 4.93l2.83 2.83" />
                    <path d="M16.24 16.24l2.83 2.83" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <path d="M4.93 19.07l2.83-2.83" />
                    <path d="M16.24 7.76l2.83-2.83" />
                  </svg>
                </button>
                <div className="split-dropdown">
                  <button onClick={() => handleSplit(point.id, 2)}>Split into 2</button>
                  <button onClick={() => handleSplit(point.id, 3)}>Split into 3</button>
                  <button onClick={() => handleSplit(point.id, 4)}>Split into 4</button>
                </div>
              </div>
              <button className="danger" onClick={() => handleDeletePoint(point.id)} title="Delete this point">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="story-point-children">
            {point.children.map((child, idx) =>
              renderPoint(child, depth + 1, idx === point.children.length - 1, [...parentLines, !isLast])
            )}
          </div>
        )}
      </div>
    );
  };

  // Render MECE visual feedback
  const renderMeceStatus = () => {
    if (!meceResult) return null;

    const statusColors = { good: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
    const statusIcons = { good: '✓', warning: '⚠', error: '✗' };

    return (
      <div className="mece-result">
        <div className="mece-header">
          <div className="mece-status" style={{ background: statusColors[meceResult.status] }}>
            <span className="mece-icon">{statusIcons[meceResult.status]}</span>
            <span className="mece-score">{meceResult.overallScore}/10</span>
          </div>
          <h4>MECE Analysis</h4>
        </div>

        <div className="mece-details">
          <div className="mece-section">
            <div className="mece-section-header">
              <strong>ME (Mutually Exclusive)</strong>
              <span className="mece-section-score">{meceResult.meAnalysis.score}/10</span>
            </div>
            <p>{meceResult.meAnalysis.explanation}</p>
            {meceResult.meAnalysis.overlaps.length > 0 && (
              <ul className="mece-issues">
                {meceResult.meAnalysis.overlaps.map((overlap, i) => (
                  <li key={i} className="mece-issue overlap">{overlap}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mece-section">
            <div className="mece-section-header">
              <strong>CE (Collectively Exhaustive)</strong>
              <span className="mece-section-score">{meceResult.ceAnalysis.score}/10</span>
            </div>
            <p>{meceResult.ceAnalysis.explanation}</p>
            {meceResult.ceAnalysis.gaps.length > 0 && (
              <ul className="mece-issues">
                {meceResult.ceAnalysis.gaps.map((gap, i) => (
                  <li key={i} className="mece-issue gap">{gap}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Suggestions with accept/reject */}
        {pendingSuggestions.length > 0 && (
          <div className="mece-suggestions">
            <h5>Suggestions</h5>
            {pendingSuggestions.map((suggestion, i) => (
              <div key={i} className="mece-suggestion">
                <div className="suggestion-type">{suggestion.type}</div>
                <p>{suggestion.description}</p>
                <div className="suggestion-actions">
                  <button className="btn-accept" onClick={() => handleAcceptSuggestion(suggestion, i)}>Accept</button>
                  <button className="btn-reject" onClick={() => handleRejectSuggestion(i)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render via Portal to document.body (completely outside chatbot)
  const modalContent = (
    <div className="storyline-workspace-overlay" onClick={onClose}>
      <div className="storyline-workspace-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sw-modal-header">
          <div className="sw-modal-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <h2>Storyline Workspace</h2>
            <span className="sw-modal-count">{storyline.length} points</span>
          </div>

          {/* View mode toggle */}
          <div className="sw-view-toggle">
            <button
              className={viewMode === 'compact' ? 'active' : ''}
              onClick={() => setViewMode('compact')}
              title="Compact view - titles only"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              className={viewMode === 'detailed' ? 'active' : ''}
              onClick={() => setViewMode('detailed')}
              title="Detailed view - full content"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </button>
          </div>

          <button className="sw-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <div className="sw-modal-body">
          {/* Left: AI Input Panel */}
          <div className="sw-ai-panel">
            <h3>AI Assistant</h3>
            <div className="sw-ai-input-group">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your presentation topic or how you'd like to modify the storyline..."
                rows={4}
              />
              <div className="sw-ai-buttons">
                {storyline.length === 0 ? (
                  <button
                    className="btn-primary"
                    onClick={handleCreateStorylineClick}
                    disabled={aiLoading || !aiPrompt.trim()}
                  >
                    {aiLoading ? 'Generating...' : 'Create Storyline'}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-secondary"
                      onClick={handleAiRefine}
                      disabled={aiLoading || !aiPrompt.trim()}
                    >
                      {aiLoading ? 'Updating...' : 'Refine'}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={handleCreateStorylineClick}
                      disabled={aiLoading || !aiPrompt.trim()}
                    >
                      Replace All
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Structure Actions */}
            <div className="sw-action-group">
              <h4>Structure</h4>
              <div className="sw-action-buttons">
                <button onClick={handleAddDepth} disabled={aiLoading} title="Add sub-items to selected">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  Add Depth
                </button>
                <button onClick={handleMeceCheck} disabled={aiLoading || storyline.length === 0} title="Check MECE structure">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  MECE Check
                </button>
              </div>
            </div>

            {/* Content Actions */}
            <div className="sw-action-group">
              <h4>Content Guidance</h4>
              <div className="sw-action-buttons">
                <button onClick={handleExpandContent} disabled={aiLoading} title="Expand descriptions with more detail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                  Expand
                </button>
                <button onClick={handleShrinkContent} disabled={aiLoading} title="Make content more concise">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                  </svg>
                  Shrink
                </button>
              </div>
            </div>

            {/* Slide Generation Mode - Global Default */}
            <div className="sw-action-group">
              <h4>Default Template Mode</h4>
              <div className="sw-gen-mode-selector">
                <select
                  value={slideGenMode}
                  onChange={(e) => setSlideGenMode(e.target.value)}
                  className="sw-gen-mode-select"
                >
                  <option value="auto">🎯 Auto (AI selects best)</option>
                  <option value="freestyle">✨ Freestyle (no template)</option>
                  <option value="image-full">🖼️ Image Full (AI visual)</option>
                  <option value="image-content">🖼️ Image + Text (illustrated)</option>
                </select>
                <p className="sw-gen-mode-hint">
                  {slideGenMode === 'auto' && 'AI picks the best template for each slide'}
                  {slideGenMode === 'freestyle' && 'AI creates slides without template constraints'}
                  {slideGenMode === 'image-full' && 'AI generates a full-bleed image for each slide'}
                  {slideGenMode === 'image-content' && 'AI generates an illustration with textual title & subtitle'}
                </p>
                <p className="sw-gen-mode-hint" style={{ marginTop: 4, fontStyle: 'normal', color: '#64748b' }}>
                  Override per-element by setting a template in edit mode
                </p>
              </div>
            </div>

            {/* Selection Actions */}
            {selectedIds.size > 0 && (
              <div className="sw-action-group selected-actions">
                <h4>Selection ({selectedIds.size})</h4>
                <div className="sw-action-buttons">
                  {selectedIds.size >= 2 && (
                    <button onClick={handleMergeSelected} disabled={aiLoading} title="Merge selected items">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 6l4 4 4-4M8 18l4-4 4 4" />
                      </svg>
                      Merge
                    </button>
                  )}
                  <button onClick={handleGenerateSlidesForSelected} disabled={aiLoading} title="Generate slides for selected">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Generate Slides
                  </button>
                  <button onClick={clearSelection} className="btn-ghost" title="Clear selection">
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* MECE Result */}
            {renderMeceStatus()}

            {/* Legend */}
            <div className="sw-legend">
              <h4>Tips</h4>
              <p>• Select items with checkboxes</p>
              <p>• Drag to reorder</p>
              <p>• Click ⋮ to split</p>
              <p>• Use → ← to change depth</p>
            </div>
          </div>

          {/* Right: Storyline content */}
          <div className="sw-content-panel">
            {/* Toolbar */}
            <div className="sw-toolbar">
              <div className="sw-toolbar-left">
                <button onClick={selectAll} title="Select all">Select All</button>
                <button onClick={expandAll} title="Expand all">Expand All</button>
                <button onClick={collapseAll} title="Collapse all">Collapse All</button>
              </div>
              <div className="sw-toolbar-right">
                {/* Sync Button */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowSyncMenu(!showSyncMenu)}
                    title="Sync slides & storyline"
                    className="sw-sync-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6" />
                      <path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Sync
                  </button>
                  {showSyncMenu && (
                    <>
                      <div
                        className="sw-sync-backdrop"
                        onClick={() => setShowSyncMenu(false)}
                      />
                      <div className="sw-sync-menu">
                        <div className="sw-sync-menu-title">Choose Source of Truth</div>
                        <button
                          className="sw-sync-option"
                          onClick={() => handleSync('from-slides')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <path d="M8 21h8" />
                            <path d="M12 17v4" />
                          </svg>
                          <div className="sw-sync-option-text">
                            <span className="sw-sync-option-label">Slides → Storyline</span>
                            <span className="sw-sync-option-desc">Update storyline from current slides</span>
                          </div>
                        </button>
                        <button
                          className="sw-sync-option"
                          onClick={() => handleSync('from-storyline')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                          <div className="sw-sync-option-text">
                            <span className="sw-sync-option-label">Storyline → Slides</span>
                            <span className="sw-sync-option-desc">Reorder slides to match storyline</span>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {storyline.length === 0 ? (
              <div className="sw-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <h3>No storyline yet</h3>
                <p>Describe your presentation topic in the AI panel to generate a storyline, or add points manually.</p>
                <button className="btn-primary" onClick={() => handleAddPoint()}>
                  Add First Point
                </button>
              </div>
            ) : (
              <div className={`sw-story-list ${viewMode}`}>
                {tree.map((point, idx) => renderPoint(point, 0, idx === tree.length - 1, []))}
                <button className="sw-add-point-btn" onClick={() => handleAddPoint()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Point
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sw-modal-footer">
          <div className="sw-footer-info">
            {storyline.length > 0 && (
              <span>{storyline.filter(p => !p.parentId).length} main points, {storyline.filter(p => p.parentId).length} sub-points</span>
            )}
          </div>
          <div className="sw-footer-actions">
            <button className="btn-ghost" onClick={() => { actions.setStoryline([]); setSelectedIds(new Set()); setMeceResult(null); }}>
              Clear All
            </button>
            {storyline.length > 0 && (
              <>
                <button
                  className="btn-secondary"
                  onClick={handleGenerateSkeletons}
                  disabled={generatingSkeletons || storyline.length === 0}
                  title="Create skeleton slides with structure placeholders"
                >
                  {generatingSkeletons ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      Generate Skeletons
                    </>
                  )}
                </button>
                <button
                  className="btn-primary"
                  onClick={handlePopulateSlides}
                  disabled={populatingSlides || storyline.length === 0}
                  title="Fill skeleton slides with actual content"
                >
                  {populatingSlides ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                      Populating...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                      Populate Slides
                    </>
                  )}
                </button>
              </>
            )}
            <button className="btn-ghost" onClick={onClose}>
              Done
            </button>
          </div>
        </div>

        {/* Create Storyline Confirmation Dialog */}
        {showCreateDialog && (
          <div className="sw-dialog-overlay" onClick={() => setShowCreateDialog(false)}>
            <div className="sw-dialog" onClick={e => e.stopPropagation()}>
              <h3>Create New Storyline</h3>
              <p>You have {state.slides.length} existing slide{state.slides.length !== 1 ? 's' : ''}. What would you like to do?</p>

              <label className="sw-dialog-checkbox">
                <input
                  type="checkbox"
                  checked={deleteExistingSlides}
                  onChange={(e) => setDeleteExistingSlides(e.target.checked)}
                />
                Delete existing slides and start fresh
              </label>

              <div className="sw-dialog-actions">
                <button className="btn-ghost" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={() => handleGenerateFromScratch(deleteExistingSlides)}>
                  {deleteExistingSlides ? 'Delete Slides & Create' : 'Keep Slides & Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Result Preview Dialog */}
        {syncResult && (
          <div className="sw-dialog-overlay" onClick={() => setSyncResult(null)}>
            <div className="sw-sync-dialog" onClick={e => e.stopPropagation()}>
              <div className="sw-sync-dialog-header">
                <h3>Sync Preview</h3>
                <span className="sw-sync-subtitle">Review changes before applying</span>
              </div>

              <div className="sw-sync-dialog-body">
                {/* Reorder Actions */}
                {syncResult.reorder && syncResult.reorder.length > 0 && (
                  <div className="sw-sync-section">
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                      Reorder ({syncResult.reorder.length})
                    </h4>
                    <ul className="sw-sync-list">
                      {syncResult.reorder.map((item, i) => (
                        <li key={i} className="sw-sync-item reorder">
                          <span className="sw-sync-item-title">
                            {state.slides.find(s => s.id === item.slideId)?.title || 'Slide'}
                          </span>
                          <span className="sw-sync-item-action">
                            Move to position {item.newIndex + 1}
                          </span>
                          {item.reason && <span className="sw-sync-item-reason">{item.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skeleton Slides to Create */}
                {syncResult.skeletons && syncResult.skeletons.length > 0 && (
                  <div className="sw-sync-section">
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      New Slides ({syncResult.skeletons.length})
                    </h4>
                    <ul className="sw-sync-list">
                      {syncResult.skeletons.map((item, i) => (
                        <li key={i} className="sw-sync-item skeleton">
                          <span className="sw-sync-item-title">{item.title}</span>
                          {item.suggestedLayout && (
                            <span className="sw-sync-item-template">Template: {item.suggestedLayout}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hierarchy Fixes */}
                {syncResult.hierarchyFixes && syncResult.hierarchyFixes.length > 0 && (
                  <div className="sw-sync-section">
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      Hierarchy ({syncResult.hierarchyFixes.length})
                    </h4>
                    <ul className="sw-sync-list">
                      {syncResult.hierarchyFixes.map((item, i) => (
                        <li key={i} className="sw-sync-item hierarchy">
                          <span className="sw-sync-item-title">
                            {state.slides.find(s => s.id === item.slideId)?.title || 'Slide'}
                          </span>
                          <span className="sw-sync-item-action">
                            {item.newParentId
                              ? `Move under "${state.slides.find(s => s.id === item.newParentId)?.title || 'parent'}"`
                              : 'Move to root level'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Comments to Add */}
                {syncResult.comments && syncResult.comments.length > 0 && (
                  <div className="sw-sync-section">
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Comments ({syncResult.comments.length})
                    </h4>
                    <ul className="sw-sync-list">
                      {syncResult.comments.map((item, i) => (
                        <li key={i} className="sw-sync-item comment">
                          <span className="sw-sync-item-title">
                            {state.slides.find(s => s.id === item.slideId)?.title || 'Slide'}
                          </span>
                          <span className="sw-sync-item-comment">"{item.comment}"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Empty state */}
                {(!syncResult.reorder || syncResult.reorder.length === 0) &&
                 (!syncResult.skeletons || syncResult.skeletons.length === 0) &&
                 (!syncResult.hierarchyFixes || syncResult.hierarchyFixes.length === 0) &&
                 (!syncResult.comments || syncResult.comments.length === 0) && (
                  <div className="sw-sync-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p>Slides and storyline are already in sync!</p>
                  </div>
                )}
              </div>

              <div className="sw-sync-dialog-footer">
                <button className="btn-ghost" onClick={() => setSyncResult(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => applySyncActions(syncResult)}
                  disabled={
                    (!syncResult.reorder || syncResult.reorder.length === 0) &&
                    (!syncResult.skeletons || syncResult.skeletons.length === 0) &&
                    (!syncResult.hierarchyFixes || syncResult.hierarchyFixes.length === 0) &&
                    (!syncResult.comments || syncResult.comments.length === 0)
                  }
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Syncing Loading Overlay */}
        {syncing && (
          <div className="sw-syncing-overlay">
            <div className="sw-syncing-content">
              <div className="spinner" style={{ width: 32, height: 32 }} />
              <p>Analyzing with AI...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Use createPortal to render completely outside of React component tree (at document.body)
  return createPortal(modalContent, document.body);
}
