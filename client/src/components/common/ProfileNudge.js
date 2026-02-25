import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps an action that requires profile completion.
 * If profile is incomplete, shows a nudge instead of executing the action.
 * Usage: <ProfileNudge requiredFields={['skills', 'bio']}><button onClick={doSomething}>Apply</button></ProfileNudge>
 * Or use the hook: const { canAct, nudge } = useProfileNudge(['skills']);
 */
export const useProfileNudge = (requiredFields = []) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const missingFields = requiredFields.filter(field => {
    if (!user) return true;
    const val = user[field];
    if (Array.isArray(val)) return val.length === 0;
    return !val;
  });

  const canAct = missingFields.length === 0;

  const nudge = () => {
    if (canAct) return true;
    const fieldNames = missingFields.map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ');
    if (window.confirm(`Complete your profile to continue. You're missing: ${fieldNames}.\n\nGo to profile settings?`)) {
      navigate('/profile');
    }
    return false;
  };

  return { canAct, nudge, missingFields };
};

export default useProfileNudge;
