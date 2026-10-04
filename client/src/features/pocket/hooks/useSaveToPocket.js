import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveToPocketApi, deletePocketItem } from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';

export const useSaveToPocket = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null); // { message, itemId, onUndo, onOpen }

  const save = useCallback(
    async ({ from, refId, url, text, folderId, tags, prompt, model }) => {
      setIsSaving(true);
      try {
        const res = await saveToPocketApi({
          from,
          refId,
          url,
          text,
          folderId,
          tags,
          prompt,
          model
        });

        const createdItem = res.item;

        // Trigger notification dot in AppLayout / Nav
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pocket_item_saved', { detail: { itemId: createdItem._id } }));
        }

        // Show toast with Undo and Open actions
        setToast({
          message: 'Saved to Pocket',
          itemId: createdItem._id,
          onUndo: async () => {
            try {
              await deletePocketItem(createdItem._id);
              setToast(null);
            } catch (e) {
              console.error('Failed to undo save to pocket', e);
            }
          },
          onOpen: () => {
            setToast(null);
            navigate(`/pocket/item/${createdItem._id}`);
          }
        });

        // Auto dismiss toast after 6s
        setTimeout(() => {
          setToast((curr) => (curr?.itemId === createdItem._id ? null : curr));
        }, 6000);

        return { success: true, item: createdItem };
      } catch (err) {
        const errMsg = err.message || 'Failed to save to Pocket';
        if (errMsg.includes('storage limit') || errMsg.includes('quota')) {
          setToast({
            message: 'Pocket storage is full. Tap to manage.',
            isError: true,
            onOpen: () => navigate('/pocket/settings')
          });
        } else {
          setToast({
            message: errMsg,
            isError: true
          });
        }
        return { success: false, error: errMsg };
      } finally {
        setIsSaving(false);
      }
    },
    [navigate]
  );

  const saveAiAnswerToPocket = useCallback(
    async ({ text, prompt = '', model = 'gemini-1.5-flash', folderId = null, tags = ['ai'] }) => {
      return save({
        from: 'ai_answer',
        text,
        prompt,
        model,
        folderId,
        tags
      });
    },
    [save]
  );

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    saveToPocket: save,
    saveAiAnswerToPocket,
    isSaving,
    toast,
    closeToast
  };
};

export const saveAiAnswerToPocket = async ({
  text,
  prompt = '',
  model = 'gemini-1.5-flash',
  folderId = null,
  tags = ['ai']
}) => {
  const res = await saveToPocketApi({
    from: 'ai_answer',
    text,
    prompt,
    model,
    folderId,
    tags
  });
  if (typeof window !== 'undefined' && res?.item?._id) {
    window.dispatchEvent(new CustomEvent('pocket_item_saved', { detail: { itemId: res.item._id } }));
  }
  return res?.item;
};

export default useSaveToPocket;
