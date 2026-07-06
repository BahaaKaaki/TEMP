import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { organizationsApi, authApi } from '../services/apiClient';

export default function OrganizationManager({ onClose }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [orgInvitations, setOrgInvitations] = useState([]);
  const [activeTab, setActiveTab] = useState('organizations'); // 'organizations' | 'invitations'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New org form
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [orgs, invites] = await Promise.all([
        organizationsApi.list(),
        authApi.getMyInvitations().catch(() => []),
      ]);
      setOrganizations(orgs || []);
      setInvitations(invites || []);

      // If organizations exist, select the first one
      if (orgs?.length > 0 && !selectedOrg) {
        selectOrganization(orgs[0]);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }

  async function selectOrganization(org) {
    setSelectedOrg(org);
    try {
      const [membersList, invitesList] = await Promise.all([
        organizationsApi.getMembers(org.id),
        organizationsApi.getInvitations(org.id).catch(() => []),
      ]);
      setMembers(membersList || []);
      setOrgInvitations(invitesList || []);
    } catch (err) {
      console.error('Failed to load org details:', err);
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreatingOrg(true);
    try {
      const newOrg = await organizationsApi.create({ name: newOrgName.trim() });
      setOrganizations([...organizations, newOrg]);
      setNewOrgName('');
      setShowNewOrgForm(false);
      selectOrganization(newOrg);
    } catch (err) {
      console.error('Failed to create organization:', err);
      alert(err.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedOrg) return;

    setInviting(true);
    try {
      const invitation = await organizationsApi.sendInvitation(selectedOrg.id, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setOrgInvitations([...orgInvitations, invitation]);
      setInviteEmail('');
      setShowInviteForm(false);
    } catch (err) {
      console.error('Failed to send invitation:', err);
      alert(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleAcceptInvitation(invitation) {
    try {
      await authApi.acceptInvitation(invitation.id);
      // Refresh data
      loadData();
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      alert(err.message || 'Failed to accept invitation');
    }
  }

  async function handleRevokeInvitation(invitationId) {
    if (!selectedOrg) return;
    try {
      await organizationsApi.revokeInvitation(selectedOrg.id, invitationId);
      setOrgInvitations(orgInvitations.filter(i => i.id !== invitationId));
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
      alert(err.message || 'Failed to revoke invitation');
    }
  }

  const canManageOrg = (org) => {
    return org?.role === 'owner' || org?.role === 'admin';
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner': return '#8E1E1E';
      case 'admin': return '#c2410c';
      case 'editor': return '#0369a1';
      case 'viewer': return '#4b5563';
      default: return '#6b7280';
    }
  };

  return (
    <div className="org-manager-overlay" onClick={onClose}>
      <div className="org-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="org-manager-header">
          <h2>Organizations</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="org-manager-tabs">
          <button
            className={`org-tab ${activeTab === 'organizations' ? 'active' : ''}`}
            onClick={() => setActiveTab('organizations')}
          >
            My Organizations
            {organizations.length > 0 && <span className="tab-count">{organizations.length}</span>}
          </button>
          <button
            className={`org-tab ${activeTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitations')}
          >
            Pending Invitations
            {invitations.length > 0 && <span className="tab-count tab-count-alert">{invitations.length}</span>}
          </button>
        </div>

        {loading ? (
          <div className="org-manager-loading">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        ) : error ? (
          <div className="org-manager-error">
            <p>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={loadData}>Retry</button>
          </div>
        ) : activeTab === 'invitations' ? (
          <div className="org-manager-content">
            {invitations.length === 0 ? (
              <div className="org-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
                </svg>
                <h3>No pending invitations</h3>
                <p>You'll see invitations from organizations here</p>
              </div>
            ) : (
              <div className="invitations-list">
                {invitations.map(inv => (
                  <div key={inv.id} className="invitation-card">
                    <div className="invitation-info">
                      <h4>{inv.organizationName || 'Organization'}</h4>
                      <p>Invited as <strong>{inv.role}</strong></p>
                      <span className="invitation-date">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAcceptInvitation(inv)}
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="org-manager-content org-split-view">
            {/* Organizations List */}
            <div className="org-list-panel">
              <div className="org-list-header">
                <h3>Organizations</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowNewOrgForm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New
                </button>
              </div>

              {showNewOrgForm && (
                <form onSubmit={handleCreateOrg} className="new-org-form">
                  <input
                    type="text"
                    placeholder="Organization name"
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    autoFocus
                  />
                  <div className="new-org-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowNewOrgForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={creatingOrg || !newOrgName.trim()}
                    >
                      {creatingOrg ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {organizations.length === 0 ? (
                <div className="org-empty-state small">
                  <p>No organizations yet</p>
                  <p className="hint">Create one to share themes with your team</p>
                </div>
              ) : (
                <div className="org-list">
                  {organizations.map(org => (
                    <div
                      key={org.id}
                      className={`org-list-item ${selectedOrg?.id === org.id ? 'selected' : ''}`}
                      onClick={() => selectOrganization(org)}
                    >
                      <div className="org-avatar">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.name} />
                        ) : (
                          <span>{org.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="org-info">
                        <div className="org-name">{org.name}</div>
                        <div className="org-role" style={{ color: getRoleBadgeColor(org.role) }}>
                          {org.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Organization Details */}
            <div className="org-details-panel">
              {selectedOrg ? (
                <>
                  <div className="org-details-header">
                    <div className="org-details-title">
                      <h3>{selectedOrg.name}</h3>
                      <span className="tier-badge">{selectedOrg.tier}</span>
                    </div>
                    {canManageOrg(selectedOrg) && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowInviteForm(true)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                        Invite Member
                      </button>
                    )}
                  </div>

                  {showInviteForm && canManageOrg(selectedOrg) && (
                    <form onSubmit={handleInviteMember} className="invite-form">
                      <div className="invite-form-row">
                        <input
                          type="email"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          autoFocus
                        />
                        <select
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value)}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="invite-form-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowInviteForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={inviting || !inviteEmail.trim()}
                        >
                          {inviting ? 'Sending...' : 'Send Invitation'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="org-section">
                    <h4>Members ({members.length})</h4>
                    <div className="members-list">
                      {members.map(member => (
                        <div key={member.user_id} className="member-item">
                          <div className="member-avatar">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" />
                            ) : (
                              <span>
                                {(member.first_name?.[0] || member.email[0]).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="member-info">
                            <div className="member-name">
                              {member.first_name || member.last_name
                                ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                                : member.email
                              }
                            </div>
                            <div className="member-email">{member.email}</div>
                          </div>
                          <div
                            className="member-role"
                            style={{ color: getRoleBadgeColor(member.role) }}
                          >
                            {member.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {canManageOrg(selectedOrg) && orgInvitations.length > 0 && (
                    <div className="org-section">
                      <h4>Pending Invitations ({orgInvitations.length})</h4>
                      <div className="invitations-list compact">
                        {orgInvitations.filter(i => i.status === 'pending').map(inv => (
                          <div key={inv.id} className="invitation-item">
                            <div className="invitation-email">{inv.email}</div>
                            <div
                              className="invitation-role"
                              style={{ color: getRoleBadgeColor(inv.role) }}
                            >
                              {inv.role}
                            </div>
                            <button
                              className="btn btn-ghost btn-icon btn-xs"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              title="Revoke invitation"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="org-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <h3>Select an organization</h3>
                  <p>Choose an organization to see members and manage settings</p>
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          .org-manager-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .org-manager-modal {
            background: white;
            border-radius: 12px;
            width: 900px;
            max-width: 95vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          }

          .org-manager-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .org-manager-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .org-manager-tabs {
            display: flex;
            gap: 4px;
            padding: 12px 20px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .org-tab {
            padding: 8px 16px;
            background: none;
            border: none;
            font-size: 14px;
            color: #6b7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .org-tab:hover {
            color: #374151;
          }

          .org-tab.active {
            color: #8E1E1E;
            border-bottom-color: #8E1E1E;
          }

          .tab-count {
            background: #e5e7eb;
            color: #374151;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          }

          .tab-count-alert {
            background: #fee2e2;
            color: #b91c1c;
          }

          .org-manager-loading,
          .org-manager-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px;
            gap: 16px;
            color: #6b7280;
          }

          .org-manager-content {
            flex: 1;
            overflow: auto;
            min-height: 400px;
          }

          .org-split-view {
            display: flex;
          }

          .org-list-panel {
            width: 280px;
            border-right: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
          }

          .org-list-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            border-bottom: 1px solid #e5e7eb;
          }

          .org-list-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
          }

          .new-org-form {
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .new-org-form input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .new-org-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }

          .org-list {
            flex: 1;
            overflow: auto;
          }

          .org-list-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f3f4f6;
          }

          .org-list-item:hover {
            background: #f9fafb;
          }

          .org-list-item.selected {
            background: #fef2f2;
          }

          .org-avatar {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: linear-gradient(135deg, #8E1E1E, #b33939);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 16px;
            overflow: hidden;
          }

          .org-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .org-info {
            flex: 1;
            min-width: 0;
          }

          .org-name {
            font-weight: 500;
            color: #111;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .org-role {
            font-size: 12px;
            font-weight: 500;
            text-transform: capitalize;
          }

          .org-details-panel {
            flex: 1;
            padding: 20px;
            overflow: auto;
          }

          .org-details-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }

          .org-details-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .org-details-title h3 {
            margin: 0;
            font-size: 20px;
          }

          .tier-badge {
            padding: 4px 10px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
            text-transform: capitalize;
          }

          .invite-form {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }

          .invite-form-row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
          }

          .invite-form-row input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
          }

          .invite-form-row select {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            background: white;
          }

          .invite-form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }

          .org-section {
            margin-bottom: 24px;
          }

          .org-section h4 {
            margin: 0 0 12px;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
          }

          .members-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .member-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: #f9fafb;
            border-radius: 8px;
          }

          .member-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #e5e7eb;
            color: #4b5563;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            overflow: hidden;
          }

          .member-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .member-info {
            flex: 1;
            min-width: 0;
          }

          .member-name {
            font-weight: 500;
            color: #111;
            font-size: 14px;
          }

          .member-email {
            font-size: 12px;
            color: #6b7280;
          }

          .member-role {
            font-size: 12px;
            font-weight: 500;
            text-transform: capitalize;
          }

          .invitations-list.compact {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .invitation-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            background: #fef3c7;
            border-radius: 6px;
          }

          .invitation-email {
            flex: 1;
            font-size: 14px;
            color: #92400e;
          }

          .invitation-role {
            font-size: 12px;
            font-weight: 500;
            text-transform: capitalize;
          }

          .invitation-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin: 12px 20px;
          }

          .invitation-info h4 {
            margin: 0 0 4px;
            font-size: 16px;
          }

          .invitation-info p {
            margin: 0 0 4px;
            font-size: 14px;
            color: #4b5563;
          }

          .invitation-date {
            font-size: 12px;
            color: #9ca3af;
          }

          .org-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
            text-align: center;
            color: #6b7280;
          }

          .org-empty-state.small {
            padding: 24px 16px;
          }

          .org-empty-state h3 {
            margin: 16px 0 8px;
            font-size: 16px;
            color: #374151;
          }

          .org-empty-state p {
            margin: 0;
            font-size: 14px;
          }

          .org-empty-state .hint {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 4px;
          }

          .btn-xs {
            padding: 4px 6px;
          }

          .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid #e5e7eb;
            border-top-color: #8E1E1E;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
