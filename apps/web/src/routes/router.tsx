import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppPage } from '@/pages/app-page'
import { LoginPage } from '@/pages/login-page'
import { RegisterPage } from '@/pages/register-page'
import { SettingsPage } from '@/pages/settings-page'
import { SettingsAccountPage } from '@/pages/settings/account-page'
import {
  SettingsBlockedPage,
  SettingsPrivacyFieldPage,
  SettingsPrivacyPage,
} from '@/pages/settings/privacy-page'
import {
  SettingsAdvancedPage,
  SettingsChatPage,
  SettingsDataPage,
  SettingsDevicesPage,
  SettingsFoldersPage,
  SettingsLanguagePage,
  SettingsNotificationsPage,
  SettingsStickersPage,
} from '@/pages/settings/prefs-pages'
import { ProtectedRoute, PublicRoute } from '@/routes/protected-route'

function PrivacyFieldRoute() {
  const { field } = useParams()
  return <SettingsPrivacyFieldPage slug={field ?? ''} />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppPage />} />
        <Route path="/app/settings" element={<SettingsPage />}>
          <Route path="account" element={<SettingsAccountPage />} />
          <Route path="notifications" element={<SettingsNotificationsPage />} />
          <Route path="privacy" element={<SettingsPrivacyPage />} />
          <Route path="privacy/blocked" element={<SettingsBlockedPage />} />
          <Route path="privacy/:field" element={<PrivacyFieldRoute />} />
          <Route path="data" element={<SettingsDataPage />} />
          <Route path="chat" element={<SettingsChatPage />} />
          <Route path="folders" element={<SettingsFoldersPage />} />
          <Route path="devices" element={<SettingsDevicesPage />} />
          <Route path="language" element={<SettingsLanguagePage />} />
          <Route path="stickers" element={<SettingsStickersPage />} />
          <Route path="advanced" element={<SettingsAdvancedPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
