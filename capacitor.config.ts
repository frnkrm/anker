import type { CapacitorConfig } from '@capacitor/cli'
import { APP_ID, APP_NAME } from './app.config'

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: 'dist',
  android: { backgroundColor: '#0f1115' },
  plugins: {
    // Die ganze WebView bleibt außerhalb von Systemleisten und Kameraausschnitt,
    // auch bei aktiver Testbegleitung und nach einer Drehung.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'contain',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_anker',
      iconColor: '#7dd3c0',
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    // Nur Google-Login, keine Facebook-SDK (kein Tracking)
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
  },
}

export default config
