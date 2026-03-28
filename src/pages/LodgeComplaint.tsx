import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// LodgeComplaint maps to the complaint details entry (step 2) in RaiseComplaint.
// The full flow (photo → details → review) is handled by RaiseComplaint.tsx.
const LodgeComplaint: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/raise-complaint', { replace: true });
  }, [navigate]);

  return null;
};

export default LodgeComplaint;
