import { useState, useCallback } from 'react';

let notificationIdCounter = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((type, message, duration = 4000) => {
    const id = ++notificationIdCounter;
    setNotifications((prev) => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [removeNotification]);

  return { notifications, addNotification, removeNotification };
}
