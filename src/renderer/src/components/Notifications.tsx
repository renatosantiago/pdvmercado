import React from 'react';

interface NotificationsProps {
  loading: boolean;
  error: string;
  success: string;
}

const Notifications: React.FC<NotificationsProps> = ({ loading, error, success }) => {
  // Se não há notificações, não renderizar nada
  if (!loading && !error && !success) {
    return null;
  }

  return (
    <div className="p-4 border-b">
      {loading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
          Processando...
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ {success}
        </div>
      )}
    </div>
  );
};

export default Notifications;