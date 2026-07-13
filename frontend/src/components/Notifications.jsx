import './Notifications.css';

const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

export default function NotificationContainer({ notifications, removeNotification }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="notifications-container">
      {notifications.map((n) => (
        <div key={n.id} className={`notification-toast ${n.type}`}>
          <div className="notification-icon">{ICONS[n.type] || ICONS.info}</div>
          <div className="notification-message">{n.message}</div>
          <button className="notification-close" onClick={() => removeNotification(n.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
