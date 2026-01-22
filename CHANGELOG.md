# Changelog

## [1.2.1] - 2026-01-22

### Added
- **Update Notification**: Implemented a "New Version Available" toast message that allows users to instantly reload the app when an update is detected.
- **Custom Confirm Modals**: Replaced native browser alerts with custom, app-styled confirmation modals for "Sign Out" and "Delete Item".

## [1.2.0] - 2026-01-22

### Added
- **Visual "Glow Up"**: Complete redesign of the "Add Item" and "Edit Item" modals with a glassy backdrop, rounded corners, and premium shadows.
- **Visual Type Selectors**: Replaced radio buttons with large, interactive cards for selecting "Bookmark" or "Reading List".
- **Material You Toggles**: Updated Settings switches to match Material Design 3 specifications (animated icons, filled tracks).
- **Settings Modal**: Moved Settings from a full-screen view to a centered modal for better context preservation.
- **Date Formatting**: Added a comma to the date display (e.g., "Thursday, 22 January 2026") for better readability.

### Changed
- **Branding**: Updated App Logo, Favicon, and PWA Icon to the new design.
- **Drag & Drop**: Implemented "Optimistic UI" updates for instant visual feedback during reordering.
- **Sorting Logic**: Unified sorting rules (Pinned > Manual Order > Timestamp) to ensure consistent behavior across lists.

### Fixed
- **Navbar Alignment**: Fixed vertical centering of icons and text in the main navigation tabs.
- **Reorder Lag**: Fixed an issue where the interface would freeze slightly while waiting for the database to confirm a move.
