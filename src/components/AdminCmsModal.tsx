import React, { useEffect, type ComponentProps } from 'react';
import { AdminAuthGate } from './AdminAuthGate';
import { LegacyAdminCmsModal } from './LegacyAdminCmsModal';
import { useApplicationSession } from '../utils/authClient';
import type { UserAccount } from '../types';

type AdminCmsModalProps = ComponentProps<typeof LegacyAdminCmsModal>;

/**
 * Better Auth is the only browser authentication entry point. The existing CMS
 * implementation is rendered only after the server-owned application session
 * is present, preserving all existing CMS functionality without retaining the
 * legacy login form as an alternative authentication path.
 */
export const AdminCmsModal: React.FC<AdminCmsModalProps> = (props) => {
  const { user: sessionUser, isPending } = useApplicationSession();
  const effectiveUser = props.currentUser ?? (sessionUser as UserAccount | null);

  useEffect(() => {
    if (props.isOpen && !props.currentUser && sessionUser) {
      props.setCurrentUser(sessionUser as UserAccount);
    }
  }, [props.isOpen, props.currentUser, props.setCurrentUser, sessionUser]);

  if (!props.isOpen) return null;

  if (!effectiveUser) {
    if (isPending) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" role="status" aria-live="polite">
          <div className="rounded-2xl border border-white/10 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-2xl">در حال بررسی نشست حساب…</div>
        </div>
      );
    }
    return <AdminAuthGate isOpen onClose={props.onClose} setCurrentUser={props.setCurrentUser} />;
  }

  return <LegacyAdminCmsModal {...props} currentUser={effectiveUser} />;
};

export default AdminCmsModal;
