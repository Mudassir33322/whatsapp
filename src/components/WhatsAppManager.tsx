import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { API_URL } from '../config';

interface AutomationRule {
  id: string;
  title: string;
  trigger: string;
  action: string;
  status: 'active' | 'paused';
}

export function WhatsAppManager() {
  const { user } = useAuth();
  const { onMessage } = useSocket(user?.uid);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/automations`)
      .then(res => res.json())
      .then(data => setAutomations(data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !onMessage) return;
    const cleanup = onMessage((data: any) => {
      const { sender, text } = data;
      console.log(`[UI Notification] Message from ${sender}: ${text}`);
    });
    return () => { if (cleanup) cleanup(); };
  }, [user, onMessage]);

  return null;
}
