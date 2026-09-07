import React, { type ComponentProps } from 'react';
import { AdminAuthGate } from './AdminAuthGate';
import LegacyAdminCmsModal from './LegacyAdminCmsModal';

type AdminCmsModalProps = ComponentProps<typeof LegacyAdminCmsModal>;

/**
 * Better Auth is the only browser authentication entry point. The existing CMS
 * implementation is rendered only after the server-owned application session
 * is present, preserving all existing CMS functionality without retaining the
 * legacy login form as an alternative authentication path.
 */
export const AdminCmsModal: React.FC<AdminCmsModalProps> = (props) => {
  if (!props.isOpen) return null;
  if (!props.currentUser) {
    return <AdminAuthGate isOpen onClose={props.onClose} setCurrentUser={props.setCurrentUser} />;
  }
  return <LegacyAdminCmsModal {...props} />;
};

export default AdminCmsModal;
