# GESTURELINK 2.0
## ULTIMATE MASTER BUILD PROMPT
### AI Gesture Intelligence, Sign Language, Air Canvas & Smart Camera

> **3.0 status note (2026-11-17).** Everything below is the original 2.0 build
> brief, kept as the product requirement record. GestureLink 3.0 has been built
> on top of it; the *shipped* state is in [`FEATURE_STATUS.md`](./FEATURE_STATUS.md),
> the stage-by-stage record in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md),
> and the recognition model's scope and limits in [`MODEL_CARD.md`](./MODEL_CARD.md).
>
> The 3.0 delta that supersedes parts of the brief below:
> - Recognition scores a 1.1 s time-normalised window (model v2), not one frame.
>   Static and moving signs share one sliding-window path; there is no
>   energy-based segmenter and no per-label threshold.
> - Two-handed support is the second hand's offset and presence, not its full
>   landmark shape.
> - The vocabulary is entirely the user's own recordings. No ISL dataset or
>   model is bundled and no ISL accuracy is claimed; a public silhouette dataset
>   was evaluated and rejected (see the model card).
> - Reading history can be exported as JSON; landmark-window replay is not
>   implemented.
> - Navigation is grouped as Workspace / Studio / System and a shared status
>   strip reports measured model, tracking and pose state.
> - Real-hand accuracy remains unverified: the automated browser camera has no
>   hand in front of it. Hardware verification is listed as pending, not passed.

---

# YOUR ROLE

Act as a principal software architect, senior computer vision engineer, machine learning engineer, interaction designer, and product engineer.

You are responsible for designing and building GestureLink 2.0 as a complete, polished, functional software product.

Do not create a generic AI dashboard.

Do not build a static frontend with buttons that have no functionality.

Do not use placeholder recognition results, fake statistics, simulated camera tracking, or decorative controls pretending to be real features.

Build the actual application, including the computer vision pipeline, gesture recognition, interaction system, storage, user settings, and interface.

Make independent engineering decisions. Inspect the project first. Reuse existing working code. Avoid unnecessary questions and do not repeatedly rebuild the same project.

The finished application must be usable, maintainable, responsive, and suitable for a professional live demonstration.

# 01. PRODUCT IDENTITY

Product name: GestureLink

Product category: AI-powered gesture interaction and computer vision workspace.

Core concept:

GestureLink turns an ordinary webcam into an intelligent human-computer interaction system.

Users should be able to communicate through supported hand signs, write in the air, control a digital workspace, and take photographs using natural hand gestures.

The application consists of five interconnected systems:

1. Sign Language Reader
2. AI Air Whiteboard
3. Gesture Camera
4. Gesture Training Studio
5. Global Gesture Intelligence Engine

All modules must share a centralized vision engine.

## Product design principles

- Reliability over unnecessary features.
- Real functionality over impressive-looking mockups.
- Privacy-first camera processing.
- Accessible interaction.
- Customizable language and appearance.
- Smooth and predictable gesture recognition.
- Professional visual design.
- Modular architecture.

---

# 02. TECHNOLOGY AND ARCHITECTURE

Use a modern, maintainable technology stack.

### Frontend

- React
- TypeScript
- Vite
- CSS Modules or a well-structured styling system
- Lucide icons
- Reusable UI components

### Computer vision

- MediaPipe Tasks Vision
- Hand Landmarker
- Gesture Recognizer
- Face Landmarker

### Rendering

- HTML Canvas API
- Canvas 2D
- SVG where appropriate
- WebRTC camera access
- CSS animations

### Data management

- IndexedDB for photos, drawings, gesture samples, and datasets.
- LocalStorage for lightweight preferences.
- A migration-friendly storage architecture.

### State management

Use a suitable typed state-management approach. Keep camera state, gesture state, feature state, and settings organized independently.

### Machine learning

- Landmark feature extraction.
- Static gesture classification.
- Temporal gesture classification architecture.
- Custom dataset collection.
- Model evaluation.
- Confidence and unknown-class handling.

Use compatible, verified package versions.

No paid APIs or mandatory API keys.

The core application must work locally. External services may only be optional enhancements.

---

# 03. THE VISUAL DESIGN SYSTEM

THIS SECTION IS A TOP PRIORITY.

Design GestureLink like a real premium creative software application.

The UI must feel designed by an experienced product design team.

It must NOT resemble an automatically generated AI dashboard.

## Art direction

Visual reference direction:
- High-end desktop creative software.
- Modern operating-system interfaces.
- Professional photography software.
- Advanced productivity workspaces.
- Minimal scientific instrumentation.

Do not copy any existing product.

## Default theme

Create a refined dark theme:

- Graphite primary background.
- Slightly lighter sidebar.
- Neutral surface hierarchy.
- White primary text.
- Muted grey secondary text.
- Restrained electric-mint accent.
- Thin low-contrast separators.
- Consistent typography.
- Minimal shadows.
- Subtle depth.

Avoid:
- Excessive glassmorphism.
- Random gradients.
- Purple-blue AI gradients.
- Huge glowing backgrounds.
- Excessive border radii.
- Decorative floating shapes.
- Overuse of cards.
- Giant empty sections.
- Emoji navigation.
- Unnecessary animations.

## Design tokens

Create global design tokens for:

- Backgrounds.
- Surfaces.
- Text colours.
- Accent colours.
- Borders.
- Focus indicators.
- Typography.
- Spacing.
- Radius.
- Shadows.
- Animation duration.
- Z-index layers.

Do not hardcode unrelated styling values throughout the application.

## Typography

Use a professional, readable font family with appropriate fallbacks for Hindi and Japanese scripts.

Create a deliberate typography scale.

Support:
- Large headings.
- Section headings.
- Body text.
- Secondary labels.
- Compact metadata.
- Monospaced technical values where useful.

## Layout

Use a consistent application shell:

LEFT SIDEBAR:
- Logo.
- Home.
- Sign Reader.
- Whiteboard.
- Gesture Camera.
- Training Studio.
- Gallery.
- Settings.
- Collapsible navigation.

TOP BAR:
- Current workspace.
- Breadcrumbs.
- Camera status.
- Tracking status.
- Quick actions.
- User preferences.

MAIN WORKSPACE:
- Feature-specific content.
- Camera preview where relevant.
- Workspace-specific toolbars.

RIGHT INSPECTOR:
- Context-sensitive properties.
- Gesture information.
- Tool settings.
- Recognition controls.

Do not force every page into the same card layout.

Each feature must have its own properly designed workspace.

## Responsive behaviour

Support:
- Desktop computers.
- Laptops.
- Tablets.
- Smaller browser windows.

The interface must adapt intelligently rather than simply shrinking every component.

## UI quality requirements

Every component must have:
- Hover states.
- Active states.
- Disabled states.
- Keyboard focus states.
- Loading states.
- Empty states.
- Error states.
- Tooltips where appropriate.

Use purposeful micro-interactions.

Animations should provide feedback, not distract from work.

---

# 04. GLOBAL SETTINGS AND PERSONALIZATION

Build a comprehensive Settings Center.

Settings must be functional and persistent.

Organize it into dedicated sections.

## A. Appearance

Options:

Theme:
- Dark.
- Light.
- System default.

Accent colours:
- Electric mint.
- Blue.
- Violet.
- Orange.
- Rose.
- Custom accent.

Interface density:
- Compact.
- Comfortable.
- Spacious.

Layout:
- Standard workspace.
- Focus workspace.
- Expanded workspace.

Additional options:
- Sidebar collapsed by default.
- Reduce animations.
- Enable subtle transitions.
- Enable interface sounds.
- Custom cursor appearance.
- Reset appearance.

Changing a setting must update the interface immediately.

## B. Language and Localization

Create a complete multilingual interface.

Initial languages:

- English.
- Hindi.
- Japanese.
- Spanish.
- French.
- German.

Architect the application to support additional languages later.

Requirements:

- All visible UI text must use translation keys.
- Never hardcode interface strings throughout components.
- Language selection must change the entire interface.
- Save the selection across reloads.
- Support Unicode correctly.
- Support Hindi Devanagari rendering.
- Support Japanese characters.
- Use proper font fallbacks.
- Format dates and numbers using locale settings.
- Prepare the layout for right-to-left languages.
- Never leave partially translated interfaces without indicating missing translations.

Separate these settings:

1. Interface language.
2. Recognized sign language.
3. Caption output language.
4. Optional translated caption language.
5. Text-to-speech voice language.

Important:

Changing the interface language must not pretend to change the recognition model.

The initial recognition target is Indian Sign Language (ISL). Recognition must accurately reflect the model's supported vocabulary.

Provide a clear language selector with searchable language names.

## C. Camera Settings

Include:
- Camera selection.
- Front/rear camera where supported.
- Video resolution.
- Preview mirroring.
- Frame-rate preference.
- Camera preview toggle.
- Camera restart.
- Automatic camera release when leaving a feature.
- Camera permission information.

## D. Hand Tracking Settings

Include adjustable controls for:

- Detection confidence.
- Tracking confidence.
- Maximum number of hands.
- Gesture sensitivity.
- Cursor smoothing.
- Pinch sensitivity.
- Gesture hold duration.
- Gesture cooldown.
- Tracking-loss tolerance.
- Dominant hand.
- Landmark visualization.

Provide sensible default presets:

- Stable.
- Balanced.
- Responsive.

Allow advanced users to customize values manually.

Show a short description of the effect of each setting.

## E. Performance Settings

Include:
- Processing quality.
- Adaptive frame-rate mode.
- CPU/GPU preference where supported.
- Debug rendering.
- Low-power mode.
- Model loading status.
- Performance diagnostics.

Never claim GPU acceleration when it is not actually active.

## F. Accessibility

Include:
- Larger text.
- Higher contrast.
- Reduced motion.
- Keyboard shortcuts.
- Mouse alternative controls.
- Screen-reader-friendly labels.
- Adjustable caption visibility.
- Adjustable caption size.

---

# 05. GLOBAL GESTURE INTELLIGENCE ENGINE

This is the central system.

Suggested modules:

vision/
  VisionEngine
  CameraManager
  HandTracker
  FaceTracker
  LandmarkProcessor
  FeatureExtractor
  TrackingSmoother
  GestureClassifier
  GestureStateMachine
  GestureRegistry
  CalibrationManager
  TrackingDiagnostics

## Hand tracking

Use MediaPipe Hand Landmarker.

Track up to two hands.

Use all 21 landmarks per detected hand.

Calculate:
- Finger joint positions.
- Finger-tip positions.
- Finger extension.
- Finger angles.
- Palm orientation.
- Wrist position.
- Pinch distance.
- Hand movement.
- Relative geometry.
- Handedness.

Normalize coordinates against hand or palm dimensions.

Do not depend exclusively on raw screen coordinates.

## Tracking stabilization

Implement:

- One Euro filtering or an appropriately benchmarked alternative.
- Adaptive temporal smoothing.
- Landmark interpolation.
- Tracking confidence.
- Gesture hysteresis.
- Gesture hold detection.
- Gesture release detection.
- Gesture cooldown.
- Tracking-loss detection.
- Reacquisition handling.

Prevent random cursor jumps.

Do not allow one-frame recognition errors to trigger actions.

## Gesture state machine

Each gesture must have a proper lifecycle:

IDLE → CANDIDATE → CONFIRMED → ACTIVE → RELEASED → COOLDOWN.

Use separate activation and deactivation thresholds.

Important actions must require stable recognition.

The gesture engine must emit events instead of letting every UI component independently interpret landmarks.

## Calibration

Implement an initial guided calibration process.

Guide the user to:
1. Place one hand inside the camera frame.
2. Open the hand.
3. Extend the index finger.
4. Perform a pinch.
5. Move the hand around the usable region.
6. Confirm the tracking range.

Save calibration settings locally.

Provide recalibration controls.

## Interaction reliability

Support:
- Left-hand users.
- Right-hand users.
- Mirrored previews.
- Different camera resolutions.
- Different window sizes.
- Temporary hand occlusion.
- Hand leaving the frame.
- Two-hand interaction where supported.

Always distinguish tracking loss from a genuine gesture release.

---

# 06. FEATURE ONE: SIGN LANGUAGE READER

Create a full sign recognition workspace.

## Workspace layout

LEFT:
- Camera preview.
- Hand landmark overlay.
- Tracking status.

CENTER:
- Large live recognition area.
- Current recognized sign.
- Sentence composition.

RIGHT:
- Recognition history.
- Recognition confidence.
- Language and model controls.

## Recognition workflow

1. Capture video frames.
2. Detect hands.
3. Extract landmarks.
4. Normalize geometry.
5. Extract static or temporal features.
6. Run the appropriate classifier.
7. Evaluate prediction confidence.
8. Apply temporal stabilization.
9. Display a recognized result only when sufficiently reliable.

## Recognition modes

Mode 1: Alphabet recognition.

Mode 2: Number recognition.

Mode 3: Supported vocabulary.

Mode 4: Custom-trained signs.

Mode 5: Future dynamic sign recognition.

Keep these categories separate.

## Custom sign training

Build a proper training system:

- Create sign labels.
- Describe the target sign.
- Capture examples.
- Store landmarks.
- Collect variation from different angles and distances.
- Review collected samples.
- Remove bad samples.
- Train a classifier.
- Evaluate the model using a separate test set.
- Display per-class precision, recall, and confusion information where appropriate.
- Export datasets.

Avoid data leakage: do not split adjacent frames from the same recording randomly across training and testing sets.

Use a collection target of approximately 30 or more varied samples per class as an initial starting point, not a guaranteed accuracy threshold.

## Recognition output

Allow users to:

- Build sentences.
- Insert spaces.
- Delete the previous result.
- Clear text.
- Copy results.
- Save transcripts.
- Read results aloud.
- Export text.

Show:
- Recognized result.
- Recognition confidence.
- Recognition status.
- Unknown-sign state.

If a sign is not recognized, say so.

Never fabricate a translation.

## Sign language integrity

Do not confuse ordinary control gestures with sign language.

A peace sign used to trigger a photograph is not automatically an ISL translation.

Do not claim full ISL translation without an appropriately trained and evaluated recognition model.

Clearly label supported signs and limitations.

---

# 07. ADVANCED CAPTION AND SUBTITLE SYSTEM

Build an independent caption engine.

This is a major feature, not just a text label underneath the camera.

## Caption modes

Mode 1: Live captions.

Display recognized words immediately.

Mode 2: Word-by-word captions.

Show each recognized sign or word individually.

Mode 3: Sentence captions.

Accumulate recognized words into readable sentences.

Mode 4: Subtitle captions.

Display text along the bottom of the workspace.

Mode 5: Large accessibility captions.

Use prominent, highly readable text.

Mode 6: Bilingual captions.

Display the recognized text and its translated equivalent on separate lines, but only when a valid translation is available.

Mode 7: Caption history.

Maintain timestamped recognition entries.

## Caption appearance

Create customizable caption presets:

- Minimal.
- Classic subtitles.
- Floating captions.
- High contrast.
- Large accessibility.
- Bilingual.
- Compact transcript.

Provide controls for:

- Font size.
- Font family.
- Font weight.
- Text colour.
- Background colour.
- Background opacity.
- Text outline or shadow.
- Caption position.
- Maximum line length.
- Maximum visible lines.
- Word spacing.
- Line spacing.
- Caption duration.
- Sentence punctuation.
- Capitalization.
- Automatic scrolling.

Provide a live caption preview inside settings.

## Caption language

Support:
- Original recognition language.
- Selected output language.
- Optional translated output.
- Side-by-side bilingual presentation.

Translation must be a separate, clearly identified operation.

Do not pretend that changing the text label translates a sign correctly.

Support optional speech synthesis using available browser voices.

---

# 08. FEATURE TWO: PROFESSIONAL AI AIR WHITEBOARD

Make the whiteboard a fully featured drawing workspace.

Do not build a basic drawing canvas with only one brush.

It should feel like professional digital whiteboard and annotation software.

## Main layout

TOP:
- Document title.
- Undo.
- Redo.
- Save.
- Export.
- Presentation mode.

LEFT TOOLBAR:
- Select.
- Pan.
- Pen.
- Pencil.
- Marker.
- Highlighter.
- Laser pointer.
- Eraser.
- Shape tools.
- Text.
- Sticky notes.
- Image.
- Ruler.
- Lasso.

CENTER:
- Main whiteboard canvas.

RIGHT INSPECTOR:
- Tool settings.
- Colour selection.
- Brush settings.
- Stroke properties.
- Selected object properties.

BOTTOM:
- Zoom controls.
- Page navigation.
- Canvas status.
- Gesture tracking status.

## A. Drawing tools

### Pen

- Smooth freehand drawing.
- Adjustable thickness.
- Adjustable opacity.
- Custom colours.
- Pressure-like variation based on speed where useful.

### Pencil

- Thin lines.
- Softer appearance.
- Adjustable texture or opacity.
- Natural drawing feel.

### Marker

- Thick stroke.
- Solid colour.
- Adjustable width.

### Highlighter

This is essential.

Create a translucent highlighter tool.

Features:
- Semi-transparent strokes.
- Multiple highlight colours.
- Adjustable opacity.
- Adjustable thickness.
- Smooth overlap handling.
- Highlight text or drawn regions.
- Avoid making the canvas unreadable through repeated overlapping strokes.

Default highlighter colours:
- Yellow.
- Green.
- Pink.
- Blue.
- Orange.

### Laser pointer

- Bright temporary pointer.
- Smooth cursor movement.
- Fading trail.
- Automatic disappearance.
- Adjustable trail duration.

Laser strokes must not become permanent drawings.

### Eraser

Support:
- Stroke eraser.
- Object eraser.
- Adjustable eraser size.
- Clear selection.

### Shape tools

Provide:
- Straight line.
- Arrow.
- Double arrow.
- Rectangle.
- Rounded rectangle.
- Circle.
- Ellipse.
- Triangle.
- Polygon.

Allow:
- Stroke colour.
- Fill colour.
- Stroke thickness.
- Fill opacity.
- Corner radius where appropriate.
- Shape resizing.

### Text tool

Support:
- Add text.
- Edit text.
- Font size.
- Font weight.
- Alignment.
- Colour.
- Text backgrounds.
- Multilingual Unicode input.

### Sticky notes

Create editable notes.

Options:
- Several note colours.
- Text inside notes.
- Resize and move.
- Duplicate.
- Delete.

### Ruler and grid

Provide:
- Ruler overlay.
- Straight-line assistance.
- Grid background.
- Dot grid.
- Graph paper.
- Blank canvas.
- Custom background colour.

## B. Object editing

Implement:
- Selection.
- Move.
- Resize.
- Rotate.
- Duplicate.
- Delete.
- Group.
- Ungroup.
- Lock.
- Unlock.
- Bring forward.
- Send backward.
- Align objects.
- Lasso selection.

## C. Hand gesture controls

Use the index fingertip as the drawing cursor.

Default gestures:

- Index + thumb pinch: Use active tool / draw.
- Release pinch: End the stroke.
- Open palm: Pause drawing.
- Two-finger gesture: Pan when enabled.
- Peace sign: Configurable quick action.
- Fist: Optional eraser shortcut.

Do not assign dangerous or contradictory gesture actions.

Allow all gesture bindings to be customized.

Never force users to switch tools through hand gestures only. The normal toolbar must always remain usable.

## D. Whiteboard documents

Support:
- Multiple boards.
- Multiple pages.
- Board naming.
- Automatic local saving.
- Rename.
- Duplicate.
- Delete with confirmation.
- Recent documents.

## E. Export

Support:
- PNG.
- JPEG.
- SVG when applicable to the stored objects.
- PDF.
- Transparent background where supported.

Export must preserve the actual drawings and object positions.

Do not export a screenshot of the whole application when the user expects only the canvas.

## F. Technical drawing implementation

Represent strokes and objects as structured records.

Each object should preserve:
- Type.
- Coordinates.
- Colour.
- Thickness.
- Opacity.
- Transform.
- Layer.
- Relevant style properties.

Implement proper undo/redo using an action history or equivalent reliable model.

Prevent separate gestures from becoming connected strokes.

Handle resize, zoom, pan, mirrored input, and tracking loss correctly.

---

# 09. FEATURE THREE: GESTURE CAMERA

Create a polished photo studio.

## Camera interface

- Large live preview.
- Camera switching.
- Photo button.
- Countdown.
- Filter tray.
- Sticker tray.
- Gallery.
- Gesture status indicator.

## Default hand controls

PEACE SIGN:
- Start photo countdown.
- Capture after three seconds.
- Require a stable gesture.
- Trigger only once per hold.

THUMBS UP:
- Change to next filter.

OPEN PALM:
- Open camera controls.

OK GESTURE:
- Toggle selected effect.

Allow customization in Gesture Settings.

## Photo filters

Provide actual image-processing effects:

- Natural.
- Warm.
- Cool.
- Black and white.
- Vintage.
- Soft contrast.
- High contrast.
- Monochrome.

Support adjustable filter strength.

Show a preview before capture.

## Face tracking

Use MediaPipe Face Landmarker.

Support:
- Face detection.
- Face landmark mapping.
- Position tracking.
- Rotation awareness.
- Smooth effect placement.
- Multiple faces where feasible.

## Stickers

Provide:
- Glasses.
- Hats.
- Crowns.
- Decorative elements.
- Cute face accessories.
- Simple animated effects where performance permits.

Stickers must follow relevant facial landmarks, not stay attached to fixed screen coordinates.

## Gallery

Support:
- Saved images.
- Thumbnail grid.
- Full-size preview.
- Delete.
- Download.
- Rename.
- Filter by date.
- Local persistence.

Ask before deleting stored photographs.

Never upload photographs automatically.

---

# 10. FEATURE FOUR: GESTURE TRAINING STUDIO

Build a dedicated place to create custom gestures.

This is separate from the sign-language dataset.

## Functions

- Create a gesture.
- Give it a name.
- Assign an action.
- Select an active module.
- Record examples.
- Review samples.
- Remove bad examples.
- Train a custom classifier.
- Test the gesture.
- Save the configuration.

Example custom gestures:

- Open palm: Pause drawing.
- Pinch: Draw.
- Peace sign: Capture photo.
- Thumbs up: Next filter.

## Gesture management

Allow the user to:

- Enable or disable individual gestures.
- Change sensitivity.
- Change required hold duration.
- Change cooldown.
- Edit action bindings.
- Detect conflicting bindings.
- Restore default bindings.

Show a live recognition preview.

Do not confuse custom control gestures with the sign-language vocabulary.

---

# 11. GLOBAL GESTURE COMMAND CENTER

Build a central gesture configuration system.

Create a visual interface where users can see all available gesture commands.

Each command should display:

- Gesture preview.
- Gesture name.
- Assigned action.
- Active module.
- Current sensitivity.
- Hold duration.
- Enabled/disabled state.

Create separate command profiles:

1. Whiteboard Profile.
2. Camera Profile.
3. Sign Reader Profile.
4. Custom Profile.

Switching modules should not accidentally activate leftover commands from the previous module.

Include a gesture-conflict prevention system.

---

# 12. GLOBAL COMPONENT LIBRARY

Create reusable components:

- Application sidebar.
- Header.
- Workspace container.
- Camera preview.
- Tracking status.
- Gesture indicator.
- Gesture notification.
- Caption renderer.
- Language selector.
- Camera selector.
- Tool palette.
- Colour picker.
- Brush controls.
- Confirmation dialog.
- Settings panels.
- Empty states.
- Toast notifications.
- Context menus.
- Modal dialogs.
- Gallery viewer.

Use one consistent visual language throughout.

---

# 13. PRIVACY AND LOCAL STORAGE

The application must be privacy-first.

Requirements:

- Camera permission only when needed.
- Clear camera activity indicator.
- Stop camera when no longer required.
- No hidden video recording.
- No automatic photo uploads.
- No unnecessary microphone access.
- Local dataset storage.
- Local photo storage.
- User-controlled deletion.
- Explain which data stays on the device.

Use IndexedDB for larger local datasets.

Handle storage errors and quota limits.

Provide controls for clearing stored photos, drawings, and training data independently.

---

# 14. PERFORMANCE AND HARDWARE OPTIMIZATION

Target ordinary laptops, not only expensive gaming PCs.

Implement:

- Adaptive processing rate.
- Efficient video frame scheduling.
- Avoid duplicate inference.
- Shared camera stream.
- Efficient canvas drawing.
- Reuse rendering objects.
- Proper resource disposal.
- Avoid memory leaks.
- Limit unnecessary re-renders.
- Use workers where supported and justified.
- Graceful CPU fallback.
- Reduced-quality mode for weak hardware.

Avoid running independent copies of the same hand model for each feature.

The application should not freeze when switching workspaces.

Expose genuine performance diagnostics without fabricating FPS.

---

# 15. ERROR HANDLING

Provide dedicated recovery experiences for:

- Camera permission denied.
- Camera unavailable.
- Camera disconnected.
- Model download failure.
- Model initialization failure.
- No hand detected.
- Tracking lost.
- Face not detected.
- Unsupported browser.
- Insufficient storage.
- Training dataset invalid.
- Untrained classifier.
- Low recognition confidence.

Use clear messages, not raw technical stack traces in the interface.

Preserve user work when a feature encounters an error.

---

# 16. TESTING AND QUALITY ASSURANCE

Do not consider the project complete just because it compiles.

Build actual tests.

## Unit tests

- Landmark normalization.
- Pinch detection.
- Finger extension.
- Gesture confidence.
- Gesture hysteresis.
- Gesture cooldown.
- Smoothing.
- Coordinate transformation.
- Mirrored camera handling.
- Caption rendering logic.
- Translation fallback.
- Whiteboard strokes.
- Highlighter opacity.
- Undo and redo.
- Object selection.
- Local persistence.

## Integration tests

- Camera lifecycle.
- Module switching.
- Settings persistence.
- Language switching.
- Whiteboard interaction.
- Gesture command bindings.
- Photo capture.
- Gallery management.
- Dataset creation.
- Model evaluation.

## Manual verification

Test:
- Left and right hands.
- Different camera distances.
- Different lighting.
- Temporary hand occlusion.
- Window resizing.
- Hand leaving the camera view.
- Pinch and release.
- Sustained gestures.
- Switching tools.
- Switching between modules.

Run:
- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Production build.

Fix errors. Do not suppress them just to make a build pass.

If a physical webcam is unavailable, distinguish automated test results from hardware verification.

---

# 17. REQUIRED PROJECT ARCHITECTURE

Keep the project modular.

Suggested structure:

src/
  app/
    App.tsx
    routes/
    providers/

  components/
    layout/
    camera/
    gestures/
    captions/
    settings/
    controls/
    dialogs/

  pages/
    Home/
    SignReader/
    Whiteboard/
    GestureCamera/
    TrainingStudio/
    Gallery/
    Settings/

  vision/
    VisionEngine.ts
    CameraManager.ts
    HandTracker.ts
    FaceTracker.ts
    LandmarkProcessor.ts
    TrackingSmoother.ts
    GestureClassifier.ts
    GestureStateMachine.ts
    GestureRegistry.ts
    CalibrationManager.ts

  features/
    sign-reader/
    whiteboard/
    camera/
    training/

  whiteboard/
    CanvasEngine.ts
    StrokeManager.ts
    ToolManager.ts
    HistoryManager.ts
    LayerManager.ts
    ExportManager.ts

  ml/
    FeatureExtractor.ts
    SignClassifier.ts
    DatasetManager.ts
    ModelEvaluator.ts

  captions/
    CaptionEngine.ts
    CaptionRenderer.ts
    CaptionSettings.ts
    TranslationAdapter.ts

  localization/
    i18n.ts
    locales/
      en/
      hi/
      ja/
      es/
      fr/
      de/

  settings/
    SettingsStore.ts
    ThemeManager.ts
    Preferences.ts

  storage/
    Database.ts
    PhotoRepository.ts
    DrawingRepository.ts
    DatasetRepository.ts

  hooks/
  services/
  styles/
  types/
  utils/

Keep business logic out of giant UI components.

Use clear interfaces and typed events between modules.

---

# 18. EXECUTION WORKFLOW

Work in the following order.

PHASE 1: PROJECT AUDIT
- Inspect existing files.
- Inspect available hardware and environment.
- Review dependencies.
- Decide the architecture.
- Create a concise technical plan.

PHASE 2: DESIGN FOUNDATION
- Create the complete design system.
- Create the application shell.
- Build sidebar and navigation.
- Implement theme switching.
- Implement localization infrastructure.
- Implement settings persistence.

PHASE 3: VISION ENGINE
- Camera management.
- MediaPipe setup.
- Hand tracking.
- Face tracking.
- Landmark processing.
- Tracking stabilization.
- Gesture state machine.
- Calibration.

PHASE 4: AIR WHITEBOARD
- Canvas system.
- Tool palette.
- Pen and pencil.
- Highlighter.
- Laser pointer.
- Shapes.
- Text.
- Sticky notes.
- Eraser.
- Object selection.
- Undo/redo.
- Local saving.
- Export.

PHASE 5: GESTURE CAMERA
- Live preview.
- Gesture shutter.
- Countdown.
- Face tracking.
- Filters.
- Stickers.
- Photo capture.
- Gallery.

PHASE 6: SIGN LANGUAGE READER
- Recognition pipeline.
- Supported sign vocabulary.
- Custom training.
- Confidence handling.
- Caption engine.
- Sentence construction.
- Optional speech output.

PHASE 7: TRAINING STUDIO
- Custom gesture creation.
- Sample collection.
- Dataset management.
- Classifier training.
- Testing and evaluation.

PHASE 8: FINAL INTEGRATION
- Connect all modules.
- Check shared resources.
- Test every setting.
- Test every language.
- Test camera transitions.
- Test persistence.
- Optimize performance.

PHASE 9: RELEASE
- Run automated tests.
- Resolve bugs.
- Production build.
- Create README.
- Document limitations.
- Verify the application is runnable.

Do not stop after completing the UI.

Do not stop after implementing the camera preview.

Do not leave incomplete tools or unconnected controls.

---

# 19. FINAL DELIVERY REQUIREMENTS

Deliver:

1. Complete source code.
2. Functional frontend.
3. Shared real-time tracking engine.
4. Sign reader.
5. Whiteboard with professional tools.
6. Gesture camera.
7. Training studio.
8. Advanced caption system.
9. Multilingual settings.
10. Appearance customization.
11. Persistent local data.
12. README.
13. Installation instructions.
14. Architecture documentation.
15. Testing report.

The README must explain:
- Installation.
- Development server.
- Camera permissions.
- Hardware requirements.
- Gesture controls.
- Whiteboard tools.
- Caption settings.
- Language settings.
- Dataset training.
- Export and storage.
- Known limitations.

Never claim a feature is fully working if it has only been mocked.

Maintain a FEATURE_STATUS.md document showing:

- Completed.
- Implemented but unverified.
- Partially implemented.
- Not implemented.

Update it as work progresses.

# 20. NON-NEGOTIABLE ACCEPTANCE CRITERIA

GestureLink 2.0 is ready only when:

[ ] The application starts successfully.

[ ] The design looks professional and consistent.

[ ] The interface switches between supported languages.

[ ] Themes and preferences persist.

[ ] The camera works with actual hardware.

[ ] Hand landmarks track real hands.

[ ] Gesture recognition is stabilized.

[ ] Pinch tracking controls drawing.

[ ] Pen, pencil, marker and highlighter work.

[ ] Laser pointer fades correctly.

[ ] Shapes and text can be edited.

[ ] Undo and redo work.

[ ] Drawings persist locally.

[ ] Peace-sign shutter works reliably.

[ ] Face stickers follow facial landmarks.

[ ] Photographs save locally.

[ ] Sign recognition has a functioning trained or trainable pipeline.

[ ] Unknown signs are handled honestly.

[ ] Caption modes work.

[ ] Caption appearance can be customized.

[ ] Gesture training samples persist.

[ ] Settings actually change application behaviour.

[ ] Production build passes.

[ ] Documentation is complete.

# FINAL INSTRUCTION

Build GestureLink as a complete, professional, privacy-first computer vision application.

Treat the user experience as seriously as the underlying engineering.

Do not sacrifice tracking accuracy for animations.

Do not sacrifice functionality for visual decoration.

Do not invent machine learning capabilities.

Do not create fake controls.

Do not unnecessarily complicate the codebase.

Deliver a unified application where all features work together through one reliable vision engine.

**The goal is not to make a website that looks impressive in a screenshot. The goal is to make software that is impressive when someone actually uses it.**