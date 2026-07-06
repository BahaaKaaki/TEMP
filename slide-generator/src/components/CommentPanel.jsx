import { useState } from 'react';
import { useSlides } from '../context/SlideContext';

export default function CommentPanel({ slideId, compact = false }) {
  const { state, actions } = useSlides();
  const [newComment, setNewComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const slide = state.slides.find(s => s.id === slideId);
  const comments = slide?.comments || [];
  const pendingCount = comments.filter(c => !c.addressed).length;

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    actions.addComment(slideId, newComment.trim());
    setNewComment('');
  };

  const handleDeleteComment = (commentId) => {
    actions.deleteComment(slideId, commentId);
  };

  const handleAddressComment = (commentId) => {
    actions.addressComment(slideId, commentId, 'Manual');
  };

  const handleUnaddressComment = (commentId) => {
    actions.unaddressComment(slideId, commentId);
  };

  const handleAddressAll = () => {
    actions.addressAllSlideComments(slideId, 'Manual');
  };

  if (compact) {
    // Compact mode - just show count badge
    return pendingCount > 0 ? (
      <div className="comment-badge" title={`${pendingCount} pending comment${pendingCount > 1 ? 's' : ''}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{pendingCount}</span>
      </div>
    ) : null;
  }

  return (
    <div className="comment-panel">
      <div
        className="comment-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Comments</span>
          {comments.length > 0 && (
            <span className="comment-count">
              {pendingCount > 0 && <span className="pending-badge">{pendingCount} pending</span>}
              {pendingCount > 0 && comments.length > pendingCount && ' / '}
              {comments.length > pendingCount && <span className="addressed-count">{comments.length - pendingCount} addressed</span>}
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            className="address-all-btn"
            onClick={(e) => { e.stopPropagation(); handleAddressAll(); }}
            title="Mark all comments as addressed"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Address All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="comment-panel-content">
          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add instructions for this slide... (e.g., 'Add market share data', 'Include 2023 figures')"
              rows={4}
            />
            <button type="submit" disabled={!newComment.trim()} className="btn btn-sm btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
          </form>

          {/* Comments list */}
          {comments.length > 0 && (
            <div className="comment-list">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`comment-item ${comment.addressed ? 'addressed' : 'pending'}`}
                >
                  <div className="comment-content">
                    <p>{comment.text}</p>
                    <div className="comment-meta">
                      <span className="comment-date">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                      {comment.addressed && (
                        <span className="comment-status">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Addressed by {comment.addressedBy}
                          {comment.addressedAt && ` at ${new Date(comment.addressedAt).toLocaleTimeString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="comment-actions">
                    {comment.addressed ? (
                      <button
                        className="comment-unaddress-btn"
                        onClick={() => handleUnaddressComment(comment.id)}
                        title="Mark as not addressed"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        className="comment-address-btn"
                        onClick={() => handleAddressComment(comment.id)}
                        title="Mark as addressed"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="comment-delete-btn"
                      onClick={() => handleDeleteComment(comment.id)}
                      title="Delete comment"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comments.length === 0 && (
            <div className="comment-empty">
              <p>No comments yet. Add comments to guide AI edits.</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .comment-panel {
          background: var(--bg-secondary, #f8f9fa);
          border-radius: 8px;
          border: 1px solid var(--border-color, #e0e0e0);
          margin-top: 12px;
        }

        .comment-panel-header {
          padding: 10px 14px;
          font-weight: 500;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }

        .comment-count {
          font-weight: normal;
          font-size: 11px;
          color: var(--text-muted, #666);
        }

        .pending-badge {
          background: #fef3c7;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
        }

        .addressed-count {
          color: #059669;
        }

        .comment-panel-content {
          padding: 0 14px 14px;
        }

        .comment-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .comment-form textarea {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
          line-height: 1.5;
          resize: vertical;
          min-height: 80px;
          background: white;
          font-family: inherit;
        }

        .comment-form textarea:focus {
          outline: none;
          border-color: var(--primary-color, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .comment-form button {
          align-self: flex-end;
        }

        .comment-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .comment-item {
          background: white;
          border-radius: 6px;
          padding: 10px 12px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border-left: 3px solid;
        }

        .comment-item.pending {
          border-left-color: #f59e0b;
        }

        .comment-item.addressed {
          border-left-color: #10b981;
          opacity: 0.7;
        }

        .comment-content {
          flex: 1;
        }

        .comment-content p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary, #333);
        }

        .comment-meta {
          margin-top: 6px;
          font-size: 10px;
          color: var(--text-muted, #666);
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .comment-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #059669;
        }

        .comment-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .comment-address-btn,
        .comment-delete-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          color: var(--text-muted, #666);
        }

        .comment-address-btn:hover {
          opacity: 1;
          color: #10b981;
        }

        .comment-unaddress-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          color: var(--text-muted, #666);
        }

        .comment-unaddress-btn:hover {
          opacity: 1;
          color: #f59e0b;
        }

        .comment-delete-btn:hover {
          opacity: 1;
          color: #dc2626;
        }

        .address-all-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .address-all-btn:hover {
          background: #d1fae5;
          border-color: #6ee7b7;
        }

        .comment-empty {
          text-align: center;
          padding: 16px;
          color: var(--text-muted, #666);
          font-size: 12px;
        }

        .comment-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fef3c7;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
