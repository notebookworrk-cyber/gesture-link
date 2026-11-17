import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useAppearanceSync } from '@/settings/useAppearanceSync'
import { useVisionSettingsSync } from '@/vision/useVision'
import { CalibrationPage } from '@/pages/Calibration/CalibrationPage'
import { DictionaryPage } from '@/pages/Dictionary/DictionaryPage'
import { GalleryPage } from '@/pages/Gallery/GalleryPage'
import { GestureCameraPage } from '@/pages/GestureCamera/GestureCameraPage'
import { HomePage } from '@/pages/Home/HomePage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'
import { SignReaderPage } from '@/pages/SignReader/SignReaderPage'
import { TrainingPage } from '@/pages/Training/TrainingPage'
import { WhiteboardPage } from '@/pages/Whiteboard/WhiteboardPage'

export function App() {
  useAppearanceSync()
  useVisionSettingsSync()

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sign-reader" element={<SignReaderPage />} />
          <Route path="/whiteboard" element={<WhiteboardPage />} />
          <Route path="/camera" element={<GestureCameraPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/calibration" element={<CalibrationPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
