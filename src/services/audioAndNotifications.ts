import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { AlarmSoundType } from '../types';

const ALARM_CHANNEL_ID = 'bitacora_fit_alarm_v5';
const COUNTDOWN_NOTIF_ID = 90421;

let sharedAudioCtx: AudioContext | null = null;
let wakeLockSentinel: WakeLockSentinel | null = null;
let channelInitialized = false;
let alarmOperation: Promise<void> = Promise.resolve();
let alarmGeneration = 0;
const ScreenAwake = registerPlugin<{ set(options: { enabled: boolean }): Promise<void> }>('ScreenAwake');

export function unlockAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export async function triggerHapticTap(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch {
    // Ignore
  }
}

export async function playAlarmSound(type: AlarmSoundType): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    }
    if (navigator.vibrate) {
      navigator.vibrate([280, 110, 280, 110, 420]);
    }

    const ctx = unlockAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'bell') {
      // Campana metálica de gimnasio (fundamental + armónicos)
      [587.33, 1174.66, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.38 / (idx + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.25);
      });
    } else if (type === 'digital') {
      // Triple beep digital clásico de cronómetro deportivo
      [0, 0.16, 0.34, 0.56].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1046.5, now + offset);
        gain.gain.setValueAtTime(0.2, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } else if (type === 'zen') {
      // Acorde suave ascendente (C5 - E5 - G5 - C6)
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    } else if (type === 'siren') {
      // Sirena intensa para gimnasio ruidoso / HIIT
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(1250, now + 0.35);
      osc.frequency.linearRampToValueAtTime(600, now + 0.7);
      osc.frequency.linearRampToValueAtTime(1250, now + 1.05);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.15);
    } else if (type === 'pulse') {
      // Pulso grave + sub-bajo
      [0, 0.34, 0.68].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now + offset);
        gain.gain.setValueAtTime(0.45, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    }
  } catch {
    // Ignore audio error
  }
}

// ============================================================================
// Best-effort native notifications. Android battery policies can delay delivery.
// ============================================================================
export async function ensureNotificationSetup(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return false;
      }
      if (!channelInitialized) {
        await LocalNotifications.createChannel({
          id: ALARM_CHANNEL_ID,
          name: 'Alarmas de Descanso y Series',
          description: 'Avisos de descanso sujetos a permisos y restricciones de batería de Android',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#D94E28',
        });
        channelInitialized = true;
      }
      return true;
    } else if ('Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function scheduleBackgroundTimerAlarm(
  targetEndEpochMs: number,
  title: string,
  body: string
): Promise<void> {
  const generation = ++alarmGeneration;
  if (!Capacitor.isNativePlatform()) return;
  alarmOperation = alarmOperation.catch(() => {}).then(async () => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: COUNTDOWN_NOTIF_ID }] });
      if (generation !== alarmGeneration || targetEndEpochMs - Date.now() <= 600) return;
      const ok = await ensureNotificationSetup();
      if (!ok || generation !== alarmGeneration) return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: COUNTDOWN_NOTIF_ID,
            title,
            body,
            channelId: ALARM_CHANNEL_ID,
            schedule: {
              at: new Date(targetEndEpochMs),
              allowWhileIdle: true,
            },
            extra: { source: 'chrono' },
          },
        ],
      });
    } catch {
      // The persisted clock remains authoritative even without notifications.
    }
  });
  return alarmOperation;
}

export async function cancelBackgroundTimerAlarm(): Promise<void> {
  ++alarmGeneration;
  if (!Capacitor.isNativePlatform()) return;
  alarmOperation = alarmOperation.catch(() => {}).then(async () => {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: COUNTDOWN_NOTIF_ID }],
      });
    } catch {
      // A denied notification permission must not interrupt a workout.
    }
  });
  return alarmOperation;
}

export function fireWebNotificationIfHidden(title: string, body: string): void {
  try {
    if (!Capacitor.isNativePlatform() && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: './app-icon.svg' });
    }
  } catch {
    // Ignore
  }
}

// ============================================================================
// Screen Wake Lock; released by the browser while the application is hidden.
// ============================================================================
export async function setScreenWakeLock(enable: boolean): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await ScreenAwake.set({ enabled: enable });
      return enable;
    }
    if (!('wakeLock' in navigator)) return false;
    if (enable) {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
      return true;
    } else {
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
      return false;
    }
  } catch {
    return false;
  }
}
