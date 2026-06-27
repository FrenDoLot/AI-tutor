# AI Tutor Project Rules

## Mandatory Responsive Design Rule

Every new feature, page, window, component, menu, button, form, modal, or UI element added to AI Tutor must support responsive design by default.

No functionality may be designed only for desktop screens.

## Supported Devices

All new UI must work correctly on:

- desktop computers;
- laptops;
- tablets in portrait and landscape orientation;
- Android smartphones;
- iPhone.

## Requirements For Any New UI

When adding any new feature:

- use the existing responsive layout system of the project;
- do not break responsiveness of existing pages;
- keep the interface usable at all supported screen sizes;
- scale text, buttons, inputs, images, cards, and controls correctly;
- avoid horizontal scrolling;
- support touch interaction on mobile devices;
- keep the chat as the primary product surface unless the feature explicitly requires another flow.

## Prohibited

Do not:

- create a separate mobile version of the project;
- duplicate pages for different device types;
- add features that work only on one class of devices;
- hard-code desktop-only widths or layouts without responsive constraints.

## Architecture

All future components must use the single adaptive layout approach already used in AI Tutor.

Interface changes must automatically follow the existing responsive design principles instead of introducing parallel device-specific implementations.

## Goal

AI Tutor must remain fully responsive as the product grows, without needing to rewrite the interface for new devices.
